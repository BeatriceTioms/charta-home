import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { downloadMedia, sendText } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/** Only the fields this handler reads from an inbound message. */
type WaMessage = {
  id: string;
  from: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string };
};

/** Meta calls this once to verify the callback URL. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

function signatureValid(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Inbound WhatsApp messages become maintenance tickets.
 * Idempotent on the provider message id, so Meta's retries are harmless.
 */
export async function POST(request: Request) {
  const raw = await request.text();

  if (!signatureValid(raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Meta's own retries are welcome; a flood is not. Counted in Postgres
  // because serverless instances share no memory. Checked after the
  // signature, so an unsigned caller can never consume the budget.
  const { data: allowed, error: limitError } = await supabase.rpc("take_rate_limit", {
    bucket_key: "whatsapp-webhook",
    max_hits: 600,
    window_seconds: 60,
  });
  if (limitError) {
    console.error("rate limit check failed:", limitError.message);
  } else if (allowed === false) {
    // 429 asks Meta to back off and retry, rather than dropping the message.
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }


  let payload: { entry?: { changes?: { value?: { messages?: WaMessage[] } }[] }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "malformed payload" }, { status: 400 });
  }
  let handled = 0;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        const providerId = message.id;
        const phone = message.from.startsWith("+") ? message.from : `+${message.from}`;
        // A caption on a photograph is the report just as much as a text is.
        const body = (message.text?.body ?? message.image?.caption ?? "").trim();

        // One call decides where this goes: the routing rules live in the
        // database, next to the data they read, rather than being reassembled
        // out of four queries here.
        const { data: routed, error: routeError } = await supabase.rpc("wa_route_inbound", {
          from_phone: phone,
          body,
        });
        if (routeError) {
          console.error("wa routing failed:", routeError.message);
          continue;
        }
        const route = routed?.[0];
        if (!route || route.decision === "unknown") {
          // Not a tenant of any agency here. Silence is the right answer: a
          // reply would tell a stranger whether a number is one of ours.
          continue;
        }

        const lang = "fr";
        let ticketId: string | null = route.ticket_id;

        if (route.decision === "ask") {
          // Two leases, so the flat is genuinely ambiguous. The report they
          // already typed is kept, so they answer with a name and nothing else.
          const units = await activeUnits(supabase, route.resident!);
          await supabase.rpc("wa_set_state", {
            conversation: route.conversation_id!,
            new_state: "awaiting_apartment",
            report: body,
            ticket: null,
          });
          await sendText({
            to: phone,
            body: askWhichUnit(lang, route.resident_name ?? "", units.map((u) => u.label)),
          });
          handled++;
          continue;
        }

        if (route.decision === "answer") {
          const units = await activeUnits(supabase, route.resident!);
          const chosen = matchUnit(body, units);
          if (!chosen) {
            await sendText({
              to: phone,
              body: didNotCatchUnit(lang, units.map((u) => u.label)),
            });
            handled++;
            continue;
          }
          ticketId = await openTicket(supabase, {
            agencyId: route.agency!,
            residentId: route.resident!,
            unit: chosen,
            // What they wrote before being asked, not the flat's name.
            report: route.report ?? body,
          });
          await supabase.rpc("wa_set_state", {
            conversation: route.conversation_id!,
            new_state: "idle",
            report: null,
            ticket: ticketId,
          });
          if (ticketId) {
            await sendText({ to: phone, body: opened(lang, chosen.label, ticketId) });
          }
        }

        if (route.decision === "open") {
          const units = await activeUnits(supabase, route.resident!);
          const unit = units[0];
          if (!unit) continue;
          ticketId = await openTicket(supabase, {
            agencyId: route.agency!,
            residentId: route.resident!,
            unit,
            report: body,
          });
          await supabase.rpc("wa_set_state", {
            conversation: route.conversation_id!,
            new_state: "idle",
            report: null,
            ticket: ticketId,
          });
          if (ticketId) {
            await sendText({ to: phone, body: opened(lang, unit.label, ticketId) });
          }
        }

        if (!ticketId) continue;

        // The photograph, if there is one. Stored under the agency's folder so
        // the same storage policy that guards every other upload applies.
        let mediaPath: string | null = null;
        if (message.image?.id) {
          const media = await downloadMedia(message.image.id);
          if (media.ok) {
            const ext = media.mime.includes("png") ? "png" : "jpg";
            const path = `${route.agency}/${ticketId}/${crypto.randomUUID()}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from("documents")
              .upload(path, media.bytes, { contentType: media.mime });
            if (uploadError) console.error("ticket media upload:", uploadError.message);
            else mediaPath = path;
          } else {
            console.error("ticket media download:", media.error);
          }
        }

        // Unique on provider_message_id, so Meta's retries are harmless.
        await supabase.from("ticket_messages").insert({
          agency_id: route.agency!,
          ticket_id: ticketId,
          direction: "inbound",
          body: body || null,
          media_path: mediaPath,
          provider_message_id: providerId,
        });

        handled++;
      }
    }
  }

  return NextResponse.json({ handled });
}

/* ------------------------------------------------------------- helpers -- */

type Unit = { apartmentId: string; buildingId: string; label: string };

/** The flats this tenant currently holds a lease on. */
async function activeUnits(
  supabase: ReturnType<typeof createAdminClient>,
  residentId: string
): Promise<Unit[]> {
  const { data } = await supabase
    .from("leases")
    .select("apartment_id, apartments(label, building_id)")
    .eq("resident_id", residentId)
    .eq("status", "active");

  return (data ?? []).map((row) => {
    const apt = row.apartments as unknown as { label: string; building_id: string };
    return { apartmentId: row.apartment_id, buildingId: apt.building_id, label: apt.label };
  });
}

/**
 * Matches a typed reply to one of the tenant's flats.
 *
 * Forgiving on purpose. Somebody answering "2a" or "apt 2A" or "le 2A" means
 * the same flat, and being told a valid answer was not understood is the kind
 * of thing that makes people stop using a service and telephone instead.
 */
function matchUnit(reply: string, units: Unit[]): Unit | null {
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const said = normalise(reply);
  if (!said) return null;

  const exact = units.find((u) => normalise(u.label) === said);
  if (exact) return exact;

  // Contained either way round: "apt2a" against "2a", or the reverse.
  const partial = units.filter((u) => {
    const label = normalise(u.label);
    return said.includes(label) || label.includes(said);
  });
  return partial.length === 1 ? partial[0] : null;
}

async function openTicket(
  supabase: ReturnType<typeof createAdminClient>,
  input: { agencyId: string; residentId: string; unit: Unit; report: string }
): Promise<string | null> {
  const report = input.report.trim();
  const { data, error } = await supabase
    .from("tickets")
    .insert({
      agency_id: input.agencyId,
      building_id: input.unit.buildingId,
      apartment_id: input.unit.apartmentId,
      resident_id: input.residentId,
      // A title is a summary, so a long report is cut at a word rather than
      // mid syllable, and an empty one still gets something readable.
      title: summarise(report) || "Demande WhatsApp",
      description: report || null,
      reported_via: "whatsapp",
    })
    .select("id")
    .single();
  if (error) {
    console.error("ticket insert failed:", error.message);
    return null;
  }
  return data.id;
}

function summarise(report: string): string {
  const oneLine = report.replace(/\s+/g, " ").trim();
  if (oneLine.length <= 80) return oneLine;
  const cut = oneLine.slice(0, 80);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 40 ? cut.slice(0, lastSpace) : cut}…`;
}

/* The replies. French only for now, which is the language of the market. */

function askWhichUnit(lang: string, name: string, labels: string[]): string {
  const first = name.split(" ")[0] || name;
  return lang === "fr"
    ? `Bonjour ${first}. Vous avez plusieurs logements chez nous. Lequel est concerné ?\n\n${labels.map((l) => `· ${l}`).join("\n")}\n\nRépondez simplement avec son nom.`
    : `Hello ${first}. You have more than one unit with us. Which one is this about?\n\n${labels.map((l) => `· ${l}`).join("\n")}\n\nJust reply with its name.`;
}

function didNotCatchUnit(lang: string, labels: string[]): string {
  return lang === "fr"
    ? `Je n'ai pas reconnu ce logement. Répondez avec l'un de ceux ci :\n\n${labels.map((l) => `· ${l}`).join("\n")}`
    : `I did not recognise that unit. Reply with one of these:\n\n${labels.map((l) => `· ${l}`).join("\n")}`;
}

function opened(lang: string, label: string, ticketId: string): string {
  const ref = ticketId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return lang === "fr"
    ? `C'est noté pour ${label}. Votre demande porte la référence ${ref}, l'agence en est informée.\n\nVous pouvez envoyer une photo si cela aide.`
    : `Noted for ${label}. Your request is reference ${ref} and the agency has been told.\n\nSend a photo if it helps.`;
}

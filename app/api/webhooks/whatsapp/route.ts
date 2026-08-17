import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

  const payload = JSON.parse(raw);
  const supabase = createAdminClient();
  let handled = 0;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        const from: string = message.from;
        const body: string = message.text?.body ?? "";
        const providerId: string = message.id;

        // Match the sender to a resident, and through them to an apartment.
        const phone = from.startsWith("+") ? from : `+${from}`;
        const { data: resident } = await supabase
          .from("residents")
          .select("id, agency_id, full_name")
          .eq("phone_e164", phone)
          .maybeSingle();

        if (!resident) continue;

        const { data: lease } = await supabase
          .from("leases")
          .select("apartment_id, apartments(building_id)")
          .eq("resident_id", resident.id)
          .eq("status", "active")
          .maybeSingle();

        if (!lease) continue;

        // Append to the resident's open ticket, or open a new one.
        const { data: openTicket } = await supabase
          .from("tickets")
          .select("id")
          .eq("resident_id", resident.id)
          .neq("status", "resolved")
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let ticketId = openTicket?.id;

        if (!ticketId) {
          const building = (lease as unknown as { apartments: { building_id: string } })
            .apartments.building_id;
          const { data: created } = await supabase
            .from("tickets")
            .insert({
              agency_id: resident.agency_id,
              building_id: building,
              apartment_id: lease.apartment_id,
              resident_id: resident.id,
              title: body.slice(0, 120) || "Demande WhatsApp",
              description: body,
              reported_via: "whatsapp",
            })
            .select("id")
            .single();
          ticketId = created?.id;
        }

        if (!ticketId) continue;

        await supabase.from("ticket_messages").insert({
          agency_id: resident.agency_id,
          ticket_id: ticketId,
          direction: "inbound",
          body,
          provider_message_id: providerId,
        });

        await supabase
          .from("wa_conversations")
          .upsert(
            {
              agency_id: resident.agency_id,
              phone_e164: phone,
              resident_id: resident.id,
              last_inbound_at: new Date().toISOString(),
            },
            { onConflict: "agency_id,phone_e164" }
          );

        handled++;
      }
    }
  }

  return NextResponse.json({ handled });
}

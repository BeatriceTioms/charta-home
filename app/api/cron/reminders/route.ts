import { NextResponse } from "next/server";
import { formatMoney } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/server";
import {
  isWhatsAppConfigured,
  renderMessage,
  sendTemplate,
  sendText,
  toWaNumber,
} from "@/lib/whatsapp";
import { isEmailConfigured, reminderDigestEmail, rentReminderEmail, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";

/** One line of the hand over list an agency receives. */
type DigestItem = {
  tenantName: string;
  apartmentLabel: string;
  amount: string;
  dueLabel: string;
  isOverdue: boolean;
  /** Present when the tenant has a number; a follow up by hand is always possible. */
  whatsappUrl: string | null;
  /** True when the tenant already received this one by email. */
  sentByEmail: boolean;
};

export const dynamic = "force-dynamic";

/**
 * Finds charges whose reminder is due and sends it.
 *
 * The reminder_events row is claimed before dispatch and is unique on
 * (rent_charge_id, rule_id), so a retry cannot double send. A send that fails
 * marks the row `failed` and the next run picks it up again, which is why the
 * claim is deleted rather than left behind on failure.
 *
 * Runs once a day. Vercel's Hobby plan allows no more than that, and a day is
 * the right granularity anyway since reminder rules are expressed in whole
 * days from the due date. Because of that single daily chance, a rule fires as
 * soon as its offset has been *reached* rather than only on the exact day, so
 * a run that fails or is skipped catches up the next day instead of dropping
 * the reminder for good.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: rules, error: rulesError } = await supabase
    .from("reminder_rules")
    .select("*")
    .eq("is_active", true);
  if (rulesError) {
    return NextResponse.json({ error: rulesError.message }, { status: 500 });
  }

  const { data: charges, error: chargesError } = await supabase
    .from("v_charge_status")
    .select("*")
    .neq("state", "paid")
    .neq("state", "void");
  if (chargesError) {
    return NextResponse.json({ error: chargesError.message }, { status: 500 });
  }

  // Everything a message needs that a charge does not carry: who the tenant
  // is, their number, the unit, and the agency's own name.
  const { data: targets, error: targetsError } = await supabase
    .from("v_reminder_targets")
    .select("*");
  if (targetsError) {
    return NextResponse.json({ error: targetsError.message }, { status: 500 });
  }
  const targetByCharge = new Map((targets ?? []).map((t) => [t.rent_charge_id, t]));

  // Normalised to midnight UTC so the day count is a whole number whatever
  // time the schedule actually fires; Hobby cron drifts up to 59 minutes.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const configured = isWhatsAppConfigured();
  const mailer = isEmailConfigured();
  let sent = 0;
  let emailed = 0;
  let failed = 0;
  let skipped = 0;
  let handedOver = 0;

  // Collected per agency while the loop runs, so each agency receives one
  // message listing its day rather than one per tenant.
  const digest = new Map<string, { agencyName: string; items: DigestItem[] }>();

  for (const charge of charges ?? []) {
    const due = new Date(charge.due_on);
    const daysFromDue = Math.round(
      (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
    );

    for (const rule of rules ?? []) {
      if (rule.agency_id !== charge.agency_id) continue;
      // Reached, not matched exactly, so a missed day still goes out.
      if (daysFromDue < rule.offset_days) continue;

      const target = targetByCharge.get(charge.rent_charge_id);
      // No way to reach them at all, and nothing for the agency to forward.
      if (!target || (!target.resident_phone && !target.resident_email)) {
        skipped++;
        continue;
      }

      // Claim the send first. A duplicate key means another run already did it.
      const { error: claimError } = await supabase.from("reminder_events").insert({
        agency_id: charge.agency_id,
        rent_charge_id: charge.rent_charge_id,
        rule_id: rule.id,
        channel: rule.channel,
        status: "queued",
      });
      if (claimError) continue;

      const body = renderMessage(rule.message_body ?? "", {
        tenant: target.resident_name ?? "",
        amount: formatMoney(Number(charge.amount), target.currency),
        period: new Date(charge.due_on).toLocaleDateString("fr-FR"),
        days: String(Math.abs(daysFromDue)),
        agency: target.agency_name ?? "",
        apartment: target.apartment_label ?? "",
      });

      // Email is the one channel that works without anybody's approval. A
      // tenant with an address gets the reminder directly, in the agency's
      // own words; the agency is not asked to forward what was already sent.
      let reached = false;
      if (target.resident_email && mailer) {
        const locale = target.agency_locale === "en" ? "en" : "fr";
        const message = rentReminderEmail({
          agencyName: target.agency_name ?? "",
          agencyWhatsapp: target.agency_whatsapp,
          agencyEmail: target.agency_email,
          tenantName: target.resident_name ?? "",
          apartmentLabel: target.apartment_label ?? "",
          amount: formatMoney(Number(charge.amount), target.currency),
          dueLabel: new Date(charge.due_on).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB"),
          daysFromDue,
          body,
          locale,
        });
        const result = await sendEmail({ to: target.resident_email, ...message });
        if (result.ok) {
          reached = true;
          emailed++;
          await supabase
            .from("reminder_events")
            .update({ status: "sent", channel: "email" })
            .eq("rent_charge_id", charge.rent_charge_id)
            .eq("rule_id", rule.id);
          // The agency is told what went out in its name, in the same daily
          // message that lists what it still has to send itself.
          const forAgency = digest.get(charge.agency_id) ?? {
            agencyName: target.agency_name ?? "",
            items: [] as DigestItem[],
          };
          forAgency.items.push({
            tenantName: target.resident_name ?? "",
            apartmentLabel: target.apartment_label ?? "",
            amount: formatMoney(Number(charge.amount), target.currency),
            dueLabel: new Date(charge.due_on).toLocaleDateString("fr-FR"),
            isOverdue: daysFromDue > 0,
            whatsappUrl: target.resident_phone
              ? `https://wa.me/${toWaNumber(target.resident_phone)}?text=${encodeURIComponent(body)}`
              : null,
            sentByEmail: true,
          });
          digest.set(charge.agency_id, forAgency);
        } else {
          console.error(`reminder email to ${target.resident_email} failed: ${result.error}`);
        }
      }

      // WhatsApp needs a number. Without one, email was the whole answer.
      if (!target.resident_phone) {
        if (!reached) {
          // The address bounced or nothing is configured; let tomorrow retry.
          await supabase
            .from("reminder_events")
            .delete()
            .eq("rent_charge_id", charge.rent_charge_id)
            .eq("rule_id", rule.id);
          failed++;
        }
        continue;
      }

      // Nothing else can reach the tenant automatically yet, so the reminder
      // is gathered for the agency to send by hand and the claim is kept,
      // which is what stops the same tenant appearing in tomorrow's list as
      // well. Not when the email already went: the agency is not asked to
      // forward what the tenant has just received.
      if (!configured && reached) continue;
      if (!configured) {
        await supabase
          .from("reminder_events")
          .update({ status: "handed_over" })
          .eq("rent_charge_id", charge.rent_charge_id)
          .eq("rule_id", rule.id);

        const forAgency = digest.get(charge.agency_id) ?? {
          agencyName: target.agency_name ?? "",
          items: [] as DigestItem[],
        };
        forAgency.items.push({
          tenantName: target.resident_name ?? "",
          apartmentLabel: target.apartment_label ?? "",
          amount: formatMoney(Number(charge.amount), target.currency),
          dueLabel: new Date(charge.due_on).toLocaleDateString("fr-FR"),
          isOverdue: daysFromDue > 0,
          whatsappUrl: `https://wa.me/${toWaNumber(target.resident_phone)}?text=${encodeURIComponent(body)}`,
          sentByEmail: false,
        });
        digest.set(charge.agency_id, forAgency);
        handedOver++;
        continue;
      }

      // A template is required outside the 24 hour window, which a proactive
      // reminder always is. Free text only works for a tenant who wrote first.
      const result = rule.template_name
        ? await sendTemplate({
            to: target.resident_phone,
            templateName: rule.template_name,
            variables: [body],
          })
        : await sendText({ to: target.resident_phone, body });

      if (result.ok) {
        await supabase
          .from("reminder_events")
          .update({ status: "sent", provider_message_id: result.providerMessageId })
          .eq("rent_charge_id", charge.rent_charge_id)
          .eq("rule_id", rule.id);
        sent++;
      } else if (reached) {
        // The email went, so the reminder is delivered; WhatsApp was extra.
        console.error(`whatsapp reminder failed for charge ${charge.rent_charge_id}: ${result.error}`);
      } else {
        // Drop the claim so tomorrow's run tries again, and record why.
        await supabase
          .from("reminder_events")
          .delete()
          .eq("rent_charge_id", charge.rent_charge_id)
          .eq("rule_id", rule.id);
        console.error(
          `reminder failed for charge ${charge.rent_charge_id}: ${result.error}`
        );
        failed++;
      }
    }
  }

  // One message per agency, with every reminder it needs to send by hand.
  let digestsSent = 0;
  if (digest.size > 0 && isEmailConfigured()) {
    for (const [agencyId, group] of digest) {
      const recipients = await ownerEmails(supabase, agencyId);
      if (recipients.length === 0) {
        console.error(`no owner email for agency ${agencyId}, digest not sent`);
        continue;
      }
      const message = reminderDigestEmail({
        agencyName: group.agencyName,
        locale: "fr",
        dashboardUrl: `${siteUrl()}/fr/dashboard/rent`,
        items: group.items,
      });
      for (const to of recipients) {
        const result = await sendEmail({ to, ...message });
        if (result.ok) digestsSent++;
        else console.error(`digest to ${to} failed: ${result.error}`);
      }
    }
  } else if (digest.size > 0) {
    console.error("reminders were handed over but no email sender is configured");
  }

  return NextResponse.json({
    considered: charges?.length ?? 0,
    sent,
    emailed,
    failed,
    skipped,
    handedOver,
    digestsSent,
    whatsapp: configured ? "configured" : "not configured",
  });
}

/**
 * Who to hand the day's list to. The owners rather than every member: a
 * caretaker has no business chasing rent, and a list of debts is not something
 * to broadcast across the staff.
 */
async function ownerEmails(
  supabase: ReturnType<typeof createAdminClient>,
  agencyId: string
): Promise<string[]> {
  const { data: owners } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("agency_id", agencyId)
    .eq("role", "owner");
  if (!owners || owners.length === 0) return [];

  const { data: users } = await supabase.auth.admin.listUsers();
  const wanted = new Set(owners.map((o) => o.user_id));
  return (users?.users ?? [])
    .filter((u) => wanted.has(u.id) && u.email)
    .map((u) => u.email as string);
}

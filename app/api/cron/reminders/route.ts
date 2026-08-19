import { NextResponse } from "next/server";
import { formatMoney } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/server";
import {
  isWhatsAppConfigured,
  renderMessage,
  sendTemplate,
  sendText,
} from "@/lib/whatsapp";

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
  let sent = 0;
  let failed = 0;
  let skipped = 0;

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
      if (!target?.resident_phone) {
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

      // Nothing to send through yet: keep the claim so the run is idempotent,
      // but say plainly that it did not go out.
      if (!configured) {
        await supabase
          .from("reminder_events")
          .update({ status: "unconfigured" })
          .eq("rent_charge_id", charge.rent_charge_id)
          .eq("rule_id", rule.id);
        skipped++;
        continue;
      }

      const body = renderMessage(rule.message_body ?? "", {
        tenant: target.resident_name ?? "",
        amount: formatMoney(Number(charge.amount), target.currency),
        period: new Date(charge.due_on).toLocaleDateString("fr-FR"),
        days: String(Math.abs(daysFromDue)),
        agency: target.agency_name ?? "",
        apartment: target.apartment_label ?? "",
      });

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

  return NextResponse.json({
    considered: charges?.length ?? 0,
    sent,
    failed,
    skipped,
    whatsapp: configured ? "configured" : "not configured",
  });
}

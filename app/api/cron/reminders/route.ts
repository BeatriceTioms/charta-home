import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Finds charges whose reminder is due and sends it.
 *
 * Meta only allows free form messages inside the 24 hour customer service
 * window, so anything proactive must use an approved template. The template
 * name lives on the reminder rule.
 *
 * The reminder_events row is written before dispatch and is unique on
 * (rent_charge_id, rule_id), so a retry cannot double send.
 *
 * Runs once a day. Vercel's Hobby plan allows no more than that, and a day is
 * the right granularity anyway since reminder rules are expressed in whole
 * days from the due date. Because of that single daily chance, a rule fires as
 * soon as its offset has been *reached* rather than only on the exact day, so
 * a run that fails or is skipped catches up the next day instead of dropping
 * the reminder for good. The unique constraint is what keeps that safe: the
 * first run to reach the offset claims the send, every later one collides.
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

  // Normalised to midnight UTC so the day count is a whole number whatever
  // time the schedule actually fires; Hobby cron drifts up to 59 minutes.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const queued: string[] = [];

  for (const charge of charges ?? []) {
    const due = new Date(charge.due_on);
    const daysFromDue = Math.round(
      (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
    );

    for (const rule of rules ?? []) {
      if (rule.agency_id !== charge.agency_id) continue;
      // Reached, not matched exactly, so a missed day still goes out.
      if (daysFromDue < rule.offset_days) continue;

      // Claim the send first. A duplicate key means another run already did it.
      const { error: claimError } = await supabase.from("reminder_events").insert({
        agency_id: charge.agency_id,
        rent_charge_id: charge.rent_charge_id,
        rule_id: rule.id,
        channel: rule.channel,
        status: "queued",
      });
      if (claimError) continue;

      // TODO: dispatch through the WhatsApp Cloud API using rule.template_name,
      // then update reminder_events.status and provider_message_id.
      queued.push(charge.rent_charge_id);
    }
  }

  return NextResponse.json({ considered: charges?.length ?? 0, queued: queued.length });
}

-- Charta Home · editable reminder messages
--
-- Until now a reminder rule knew when to fire and on what channel, but not
-- what to say. The agency needs to write that themselves: the tone an agency
-- in Conakry uses with its tenants is theirs, not ours.
--
-- message_body holds the text with placeholders the dispatcher fills in:
--   {tenant} {amount} {period} {days} {agency} {apartment}
--
-- template_name stays alongside it. Meta refuses free text outside the 24 hour
-- customer service window, so a proactive reminder needs an approved template;
-- the body is then what the agency submitted for approval and what fills the
-- template's variables.

alter table reminder_rules
  add column if not exists message_body text;

-- Sensible French defaults so an agency is never left with a blank message.
-- Matched on the sign of the offset rather than an exact value, since the
-- courtesy lead time is the agency's to choose.
update reminder_rules
set message_body = case
  when offset_days < 0 then
    'Bonjour {tenant}, votre loyer de {amount} pour {apartment} est attendu dans {days} jours, le {period}. Merci de votre confiance. {agency}'
  when offset_days = 0 then
    'Bonjour {tenant}, votre loyer de {amount} pour {apartment} est dû aujourd''hui. Merci de votre confiance. {agency}'
  when escalation_step >= 2 then
    'Bonjour {tenant}, le loyer de {amount} pour {apartment} reste impayé depuis {days} jours. Merci de nous contacter rapidement. {agency}'
  else
    'Bonjour {tenant}, nous n''avons pas encore reçu le loyer de {amount} pour {apartment}, dû le {period}. Merci de régulariser. {agency}'
end
where message_body is null;

comment on column reminder_rules.message_body is
  'What the reminder says. Placeholders: {tenant} {amount} {period} {days} {agency} {apartment}.';

-- The dispatcher needs the resident's name and number, the unit, and the
-- agency's WhatsApp identity, all of which sit several joins from a charge.
-- One view so the cron reads a queue rather than assembling it row by row.
create or replace view v_reminder_targets
with (security_invoker = true)
as
select
  rc.id            as rent_charge_id,
  rc.agency_id,
  rc.due_on,
  rc.amount,
  ag.name          as agency_name,
  ag.whatsapp_number as agency_whatsapp,
  ag.currency,
  r.full_name      as resident_name,
  r.phone_e164     as resident_phone,
  ap.label         as apartment_label
from rent_charges rc
join leases l    on l.id = rc.lease_id
join residents r on r.id = l.resident_id
join apartments ap on ap.id = l.apartment_id
join agencies ag on ag.id = rc.agency_id;

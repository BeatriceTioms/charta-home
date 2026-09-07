# Charta Home · backend setup

The database is the security boundary. Every table carries `agency_id` and is
protected by row level security based on membership, so a query can never reach
another agency's data even if the application code is wrong.

## What is in the repo

```
supabase/
  config.toml                 local dev config
  migrations/                 the schema, applied in order
    ..._init_foundations.sql  agencies, memberships, RLS helpers
    ..._portfolio.sql         buildings, apartments, residents, owners, leases
    ..._money.sql             rent_charges ledger, payments, expenses, views
    ..._operations.sql        tickets, events, reminders, billing, audit log
    ..._functions.sql         transactional RPCs and plan limits
    ..._storage.sql           private buckets and their policies
  seed.sql                    demo agency matching the designs
lib/supabase/
  types.ts                    hand written database types
  client.ts                   browser client
  server.ts                   server client + admin (service role) client
  middleware.ts               session refresh
  queries.ts                  read helpers for Server Components
  actions.ts                  write helpers (Server Actions)
  auth-actions.ts             sign in, sign up, reset, sign out
app/api/
  cron/rent-charges           nightly charge generation
  cron/reminders              daily reminder dispatch
  webhooks/whatsapp           inbound messages become tickets
scripts/                      schema verification without Docker
```

## 1. Create the Supabase project

1. Create a project at supabase.com, region closest to Guinea (eu-west-3 Paris
   is usually the best latency).
2. Copy Project Settings > API values into `.env.local` using `.env.example`
   as the template.

## 2. Apply the schema

With the Supabase CLI (recommended):

```bash
npx supabase link --project-ref <your-ref>
npx supabase db push
```

Or paste each file in `supabase/migrations/` into the SQL editor in order.

To load the demo data:

```bash
npx supabase db reset      # local: migrations + seed
```

The seed creates the agency **Horizon Realty** with 3 buildings and 12
apartments, and a demo login:

```
amina@horizonrealty.gn / chartahome2026
```

## 3. Verify without Docker

The repo can execute the whole schema in an in-process Postgres, which is how
these migrations were checked:

```bash
npm run db:check
```

That runs three things:

- `db:verify` applies every migration and prints the resulting inventory
- `db:test` creates two agencies and two users and asserts the isolation and
  money rules actually hold
- `db:seed:verify` applies `seed.sql` and checks the demo portfolio

All 15 behaviour checks currently pass, including cross tenant reads and writes
being blocked, oldest first payment allocation, and the plan limit.

## 4. Deploy on Vercel

Set the same environment variables in the Vercel project. `vercel.json` already
registers the cron jobs:

| Job | Path | Schedule |
| --- | --- | --- |
| Generate rent charges | `/api/cron/rent-charges` | nightly at 02:00 |
| Send due reminders | `/api/cron/reminders` | daily at 07:00 |

Both are daily because Vercel's Hobby plan refuses anything more frequent: a
per hour expression fails at deploy time with *Hobby accounts are limited to
daily cron jobs*. Hobby also drifts the trigger by up to 59 minutes, which is
why the reminder job normalises the date to midnight UTC before counting days.

A day is the natural granularity anyway, since reminder rules are written in
whole days from the due date. The cost of one attempt per day is that a failed
run would drop that day's reminders, so a rule fires once its offset has been
reached rather than only on the exact day; the unique constraint on
`(rent_charge_id, rule_id)` keeps the retry from double sending, and
`npm run db:test` proves it.

On Pro you can move reminders to `0 * * * *` for tighter timing. Nothing in the
code needs to change.

Both require `Authorization: Bearer $CRON_SECRET`.

## 5. WhatsApp

Point the Meta webhook at `/api/webhooks/whatsapp`. The GET handler answers the
verification challenge; the POST handler validates the signature, matches the
sender to a resident, and turns the message into a ticket. It is idempotent on
the provider message id, so Meta's retries are safe.

One constraint that shapes the whole reminder feature: Meta only allows free
form messages within 24 hours of the resident's last message. Every proactive
reminder must use a **pre-approved template**, so submit the French templates
early (courtesy reminder, second reminder, escalation, receipt) and store the
approved name on `reminder_rules.template_name`.

## Money

Amounts are integers in the smallest unit of the agency currency. The Guinean
franc has no subunit, so a GNF amount is whole francs. Never use floats.

`rent_charges` is the ledger. Payments allocate against charges oldest first
through `record_payment()`, and status is derived in `v_charge_status` rather
than stored, so it cannot drift.

## Net yield

`buildings.market_value` (or `acquisition_value`) is required for
`v_building_performance.net_yield_pct`. Without a valuation the view returns
null, because a yield percentage without a denominator is meaningless. Make the
valuation field part of the building form.

## Roles

| Role | Can do |
| --- | --- |
| `owner` | everything, including deleting and managing members |
| `manager` | portfolio, leases, money, maintenance |
| `accountant` | money and portfolio reads and writes, not member management |
| `caretaker` | maintenance only |

Scoping a caretaker to a single building uses the `membership_buildings` idea
described in the architecture notes; add it when you hire your first caretaker.

## What is not done yet

The full gap list, with what has been verified and in what order to tackle the
rest, lives in [go-live-checklist.md](./go-live-checklist.md). In short:

- The dashboard pages still read from `lib/store.tsx` (the session store).
  `lib/supabase/queries.ts` and `lib/supabase/actions.ts` are the drop in
  replacements, one page at a time.
- Reminder dispatch writes `reminder_events` but does not yet call the WhatsApp
  send API; the TODO marks the spot.
- Subscription billing is manual. See the architecture notes on why a payment
  provider should wait until the first paying agencies are known.

## Choosing a plan

There is no card form yet. An owner picks a tier and a billing cycle in
Settings, `request_plan` records the choice at the list price for the agency's
country (`plan_prices`), and two emails go out: one to the inbox below, one to
the owner with the mobile money details. The plan itself only moves when you
move it, once the money has arrived:

```sql
update subscriptions
   set plan = 'growth', status = 'active', current_period_end = now() + interval '1 month'
 where agency_id = '<agency>';
update plan_requests set status = 'paid' where id = '<request>';
```

Environment, in `.env.local` and on Vercel:

```
SALES_EMAIL=hello@chartahome.com   # where a plan request lands
MOBILE_MONEY_ORANGE=               # printed in the owner's confirmation
MOBILE_MONEY_MTN=                  # leave blank and the mail says you will reply with it
```

The only thing a tier restricts is the number of apartments, enforced by
`apartments_plan_limit` on insert. Buildings and team members are not capped.

## The platform desk

`/admin` lists every agency, its plan and status, apartments against the
ceiling, what it has collected, and any request waiting for payment. It is
only reachable by people in `platform_admins`, which nothing but the service
role writes.

Staff are not agencies. They never go through signup, own no portfolio,
and land on the desk when they sign in. To add one:

```bash
npm run admin:grant -- desk@chartahome.com
```

If no account exists for the address, one is created without a password.
Either way the script issues a link to set one and sends it through Resend
when `RESEND_API_KEY` and `EMAIL_FROM` are in `.env`; without them it prints
the link for you to pass on directly. The link is good for an hour, and
running the script again issues a fresh one. Supabase's own mailer is not
used: it is rate limited to a few messages an hour, sends from a shared
address that Gmail files as spam, and its links die after a day. The
script never sees a password. Supabase must allow the reset page as a
redirect (Authentication, URL Configuration, Redirect URLs), or the link
opens the landing page instead.

The flow, end to end: the agency pays by mobile money and sends the receipt
over WhatsApp or email. The desk checks it and presses **Issue a code** on
that agency, picking the tier and cycle. The code is eight characters, bound
to that agency, valid for one hour and dead the moment it is used; the desk
sends it by WhatsApp (a ready link) or by email (a button). The owner types
it under Settings, Plan and billing, and the subscription goes active, with
the period running on from the current one so paying early costs nothing.
Issuing a second code for an agency expires the first.

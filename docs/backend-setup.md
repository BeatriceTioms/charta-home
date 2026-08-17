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
  cron/reminders              hourly reminder dispatch
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
| Send due reminders | `/api/cron/reminders` | hourly |

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

- The dashboard pages still read from `lib/store.tsx` (the session store).
  `lib/supabase/queries.ts` and `lib/supabase/actions.ts` are the drop in
  replacements, one page at a time.
- Reminder dispatch writes `reminder_events` but does not yet call the WhatsApp
  send API; the TODO marks the spot.
- Subscription billing is manual. See the architecture notes on why a payment
  provider should wait until the first paying agencies are known.

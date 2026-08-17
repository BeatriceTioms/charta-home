# Charta Home · what is left to be fully operational

Written 17 August 2026. Companion to `backend-setup.md`, which explains how the
backend is built. This one is the honest gap list: what is proven to work, what
is written but unproven, and what is not written at all.

---

## Verified working

Checked in this repository, no live project required.

| Area | Evidence |
| --- | --- |
| Schema | `npm run db:verify` · 7/7 migrations, 23 tables, 4 views, 70 policies, RLS on every public table |
| Security boundary | `npm run db:test` · 21/21 checks, including cross tenant isolation on every table, reassignment, technician stats, photo reordering |
| Seed | `npm run db:seed:verify` · demo agency, 3 buildings, 12 apartments, 10 leases, rent states as intended |
| Cron auth | No header and wrong secret both return 401; correct secret reaches Supabase |
| WhatsApp verification | Wrong token 403, correct token echoes the challenge |
| WhatsApp signature | No signature 401, bad signature 401, valid HMAC 200 |
| Dashboard guard | With Supabase env present, an unauthenticated dashboard request redirects to `/fr/login` |
| Build | `npx next build` · 33 pages, French and English prerendered |
| Types | `npx tsc --noEmit` clean |

Every dashboard button works today against the session store in `lib/store.tsx`:
apartments with photos, photo add, replace and delete, leases, payments,
receipts, CSV export, reminders, tickets create, edit, delete, assign, reassign
and close, and technician create, edit and delete.

---

## Blocking · nothing server side runs without these

### 1. Create the Supabase project and set the environment

Six variables, listed in `.env.example`. Set them in Vercel for Production,
Preview and Development, and in `.env.local` for local work.

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `WHATSAPP_*`,
`NEXT_PUBLIC_SITE_URL`.

Until this exists, the cron routes return `fetch failed`, which is exactly what
they do today.

### 2. Point the pages at Supabase

The largest remaining task. Pages read `lib/store.tsx`, a session store that
resets on reload. The replacements exist and are typed:

- Reads · `lib/supabase/queries.ts`
- Writes · `lib/supabase/actions.ts`

Every mutation the interface performs now has a matching server action, so the
swap is mechanical, one page at a time. Suggested order: apartments, then rent,
then tenants, then maintenance, then settings.

### 3. Photo storage

`addApartmentPhoto` uploads to the private `apartment-photos` bucket and
`signPhotoUrls` issues one hour signed URLs. The interface still holds images as
data URLs in memory, so it must be switched to the action and the signed URL.

### 4. Reminder dispatch

`app/api/cron/reminders/route.ts` claims the send in `reminder_events` and stops
at a TODO. The Cloud API call, the status update and the `provider_message_id`
write are missing. Reminders are the product's core promise, so this is the
first feature to finish after the pages are wired.

### 5. WhatsApp Cloud API account

Outside the code, and slow, so start early:

- Meta business verification
- A phone number on the WhatsApp Business Platform
- Message templates submitted and approved in French, one per reminder rule.
  Proactive messages outside the 24 hour service window require an approved
  template; free text will be rejected.
- Webhook subscribed to `https://<domain>/api/webhooks/whatsapp`

### 6. Transactional email

Supabase's built in mailer is rate limited and not meant for production. Sign
up, password reset and invitations need a real SMTP provider and French
templates.

---

## Correctness · known wrong today

### 7. Currency and phone format

`lib/data.ts` formats money as `$1,450` and carries `+1 555` demo numbers, while
the settings page says GNF, the Supabase seed is GNF, and the launch market is
Conakry. `fmt` is one function and the demo values are one file, so the fix is
small, but it must happen before anyone sees a demo.

### 8. Settings do not persist

`app/[locale]/dashboard/settings/page.tsx` is local state. Agency name, WhatsApp
number, country, city, currency, reminder rules and team members need to write
to `agencies`, `reminder_rules` and `memberships`. The receipt already reads its
issuer from one place, `agency` in `lib/data.ts`, which is where the agencies row
should land.

### 9. Seed strings are English

Ticket assignees read `B. Keita (plumber)` and payment dates read `2 Jul` in
both languages. Real rows from Supabase remove this, so it resolves itself with
task 2.

---

## Operational · needed before real agencies

| # | Item | Note |
| --- | --- | --- |
| 10 | Cron secret in Vercel | `vercel.json` already schedules rent charges nightly at 02:00 and reminders hourly. Confirm both fire after the first deploy. |
| 11 | Backups | Enable point in time recovery on Supabase. Tenant payment records are not something to lose. |
| 12 | Monitoring | Error tracking and a log drain. Today a failed cron is silent. |
| 13 | Webhook rate limiting | The endpoint is signature checked but unthrottled. |
| 14 | Automated tests | The database has 21 checks; the interface has none, and there is no CI running them on push. |
| 15 | Billing | Subscriptions are manual. Deliberate: wait for the first paying agencies before choosing a provider that works in Guinea. |
| 16 | Legal pages | Privacy policy, terms and a data retention statement. The product holds tenant names, phone numbers and payment histories. |

---

## Suggested order

1. Supabase project and environment · unblocks everything
2. Currency and phone format · small, and it is visible in every demo
3. Wire the pages, one at a time, reads before writes
4. Photo storage
5. WhatsApp account and templates, started early because approval takes time
6. Reminder dispatch
7. Settings persistence
8. Backups, monitoring, legal pages
9. Billing, once there is someone to bill

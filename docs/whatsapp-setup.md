# Connecting WhatsApp

What this gives you: tenants report a problem by sending a WhatsApp message,
and it becomes a maintenance ticket with the right flat attached. Rent
reminders go out on their own instead of being sent by hand.

You do **not** need company documents for any of this. Business verification
raises a limit later; it is not a gate on getting started.

---

## Before you begin

**Use a new SIM, not the number you already use.**

A number can be on the WhatsApp Business *app* or on the API, never both.
Moving your existing number means deleting its WhatsApp account: you lose the
chat history on it, and you cannot go back without deregistering. Keep that
number for talking to people. Give Charta Home its own.

You will end up with four values. Keep them somewhere safe as you go:

| Value | Where it comes from |
| --- | --- |
| `WHATSAPP_PHONE_NUMBER_ID` | Step 3 |
| `WHATSAPP_ACCESS_TOKEN` | Step 5 |
| `WHATSAPP_VERIFY_TOKEN` | You invent it, Step 6 |
| `WHATSAPP_APP_SECRET` | Step 6 |

---

## 1. Create the app

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps)
   and sign in with the Facebook account that will own this.
2. **Create app** → type **Business** → give it a name (Charta Home) and your
   email.
3. On the app dashboard, find **WhatsApp** and click **Set up**.

It will create a Business portfolio if you do not have one. That is fine.

## 2. Try it with the test number

Meta gives you a free test number straight away. Under **WhatsApp → API Setup**:

1. Add your own mobile under **To**, and confirm the code it sends.
2. Press **Send message**. If it arrives, everything above is correct.

The test number only reaches numbers you add here, up to five. It is for
proving the wiring, not for tenants.

## 3. Add your real number

Still under **API Setup**, click **Add phone number**.

- Enter the new SIM's number and verify it by SMS or call.
- Choose a display name. Meta reviews it, usually within a day. A name that
  matches your agency is approved; a name claiming something you cannot show
  is not.

Once it appears in the **From** dropdown, copy its **Phone number ID**. That is
`WHATSAPP_PHONE_NUMBER_ID`. It is a long number, not the phone number itself.

At this point you can message **real tenants**, up to **250 different people
per rolling 24 hours**. For an agency in Conakry that is more than a day's
reminders. Verification later raises it to 1,000, then higher.

## 4. Create a system user

The token shown on the API Setup page expires in 24 hours. A permanent one
belongs to a system user.

1. Go to
   [business.facebook.com/settings](https://business.facebook.com/settings) →
   **Users** → **System users**.
2. **Add** → name it (Charta Home Server) → role **Admin**.
3. Select it → **Assign assets** → pick your app → enable **Manage app** →
   save.
4. **Assign assets** again → **WhatsApp accounts** → pick your WhatsApp
   Business Account → **Full control** → save.

Step 4 is the one people miss. Without it the token exists but cannot send.

## 5. Generate the token

On the same system user, **Generate new token**:

- App: the one you created.
- Expiry: **Never**.
- Permissions: tick `whatsapp_business_messaging` and
  `whatsapp_business_management`.

**Copy it now.** It is shown once and never again. That is
`WHATSAPP_ACCESS_TOKEN`.

## 6. Point the webhook at Charta Home

This is how a tenant's message reaches you.

First invent a verify token. Any long random string; it only has to match on
both sides:

```bash
openssl rand -hex 24
```

That is `WHATSAPP_VERIFY_TOKEN`.

Then get `WHATSAPP_APP_SECRET` from your app dashboard → **App settings** →
**Basic** → **App secret** → **Show**.

Put all four values into Vercel (**Settings → Environment Variables**), and
redeploy. The webhook has to be live before Meta will accept it.

Now, in the app dashboard under **WhatsApp → Configuration → Webhook**:

- Callback URL: `https://chartahome.com/api/webhooks/whatsapp`
- Verify token: the string you just generated.
- Click **Verify and save**.

Then **Manage** next to Webhook fields and subscribe to **messages**.

## 7. Check it

Send a WhatsApp message from a tenant's registered number to your new number.

Within a few seconds you should get a reply naming their flat and a reference,
and a ticket should appear under Maintenance.

If nothing happens, look at the Vercel logs for that deployment:

| What you see | What it means |
| --- | --- |
| `bad signature`, 401 | `WHATSAPP_APP_SECRET` is wrong or missing |
| Nothing at all | Webhook not subscribed to **messages**, or the URL is wrong |
| Ticket appears, no reply sent | `WHATSAPP_ACCESS_TOKEN` is wrong, or step 4.4 was skipped |
| `ticket media download:` | Token lacks permission to fetch media |

A message from a number that is not on any tenant's record is ignored on
purpose, and answered with silence. Check the tenant's number is stored in
full international form, `+224…`.

---

## Reminders

Once the four values are set, the daily job sends reminders itself and stops
emailing you the hand over list. Nothing else changes.

One limit to know about: Meta only allows free text within 24 hours of the
tenant writing to you. A reminder is not that, so it needs an **approved
template**. Until a template is set on a reminder rule, that rule's messages
will be rejected by Meta.

Templates are created under **WhatsApp → Message templates**, approved in a few
hours, and the approved name goes in `reminder_rules.template_name`. Ask me to
wire the template picker into the settings page when you have one approved.

## Verification, later

When the company is registered, **Business settings → Business info → Start
verification**. You will need the RCCM document and proof of address. It raises
the daily cap and lets you show a verified name. Nothing above stops working
while it is pending.

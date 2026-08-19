/**
 * Transactional email, through Resend.
 *
 * Supabase will send an invitation itself, but the built in sender is meant
 * for getting a project off the ground: it is rate limited to a handful of
 * messages an hour and sends from a shared address, which is the kind of thing
 * that lands in spam. An agency inviting its own staff should send from its
 * own domain, so the invitation goes out through Resend when a key is present
 * and falls back to Supabase's sender when it is not.
 *
 * Configure with, in .env.local and in the Vercel project:
 *   RESEND_API_KEY=re_...
 *   EMAIL_FROM=Charta Home <no-reply@your-domain.com>
 *
 * The from address has to sit on a domain verified in Resend. Until one is,
 * Resend accepts onboarding@resend.dev, but only to the account owner's own
 * address, which is enough to test the wiring and not enough to invite anyone.
 */

const ENDPOINT = "https://api.resend.com/emails";

/** Whether a real send is possible, so callers can pick a fallback. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type EmailResult = { ok: true } | { ok: false; error: string };

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, error: "email is not configured" };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      // Resend answers with a JSON body naming the problem, which is worth
      // keeping: "domain is not verified" is a fixable thing to be told.
      const body = await response.text();
      return { ok: false, error: `resend ${response.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "email send failed" };
  }
}

/** Everything inside an attribute or a text node has to be escaped first. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The invitation itself. Deliberately plain: a table and inline styles, since
 * mail clients are not browsers, and a link the recipient can read before
 * clicking, since asking someone to trust an unlabelled button is how people
 * are taught to fall for the other kind of email.
 */
export function invitationEmail(input: {
  agencyName: string;
  inviterName: string;
  role: string;
  actionLink: string;
  locale: string;
}): { subject: string; html: string; text: string } {
  const fr = input.locale === "fr";
  const agency = esc(input.agencyName);
  const inviter = esc(input.inviterName);
  const role = esc(input.role);
  const link = esc(input.actionLink);

  const subject = fr
    ? `${input.inviterName} vous invite à rejoindre ${input.agencyName} sur Charta Home`
    : `${input.inviterName} invited you to join ${input.agencyName} on Charta Home`;

  const lead = fr
    ? `${inviter} vous a ajouté à <strong>${agency}</strong> sur Charta Home, avec le rôle ${role}.`
    : `${inviter} added you to <strong>${agency}</strong> on Charta Home, as ${role}.`;

  const cta = fr ? "Créer mon compte" : "Create my account";
  const fallback = fr
    ? "Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :"
    : "If the button does not work, copy this address into your browser:";
  const footer = fr
    ? "Vous ne connaissez pas cette agence ? Ignorez ce message, aucun compte ne sera créé."
    : "Do not recognise this agency? Ignore this message and no account will be created.";

  const html = `<!doctype html>
<html lang="${fr ? "fr" : "en"}">
  <body style="margin:0;padding:32px 16px;background:#f4f8f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:32px 32px 8px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#003152;">Charta&nbsp;Home</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 32px 24px;">
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#020202;">${lead}</p>
          <a href="${link}" style="display:inline-block;background:#003152;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:999px;">${cta}</a>
          <p style="margin:24px 0 6px;font-size:12px;color:#6b7280;">${fallback}</p>
          <p style="margin:0;font-size:12px;word-break:break-all;color:#003152;">${link}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 32px;border-top:1px solid #e5eaec;">
          <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#6b7280;">${footer}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = fr
    ? `${input.inviterName} vous a ajouté à ${input.agencyName} sur Charta Home, avec le rôle ${input.role}.\n\nCréez votre compte ici :\n${input.actionLink}\n\n${footer}`
    : `${input.inviterName} added you to ${input.agencyName} on Charta Home, as ${input.role}.\n\nCreate your account here:\n${input.actionLink}\n\n${footer}`;

  return { subject, html, text };
}

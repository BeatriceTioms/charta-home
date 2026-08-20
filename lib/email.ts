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

/**
 * Whether a real send is possible, so callers can pick a fallback.
 *
 * Both variables are required, and a half configured sender is the easy
 * mistake: a key with no from address falls back to Supabase's own mail, which
 * still arrives, so nothing looks broken until you notice the message is not
 * the one you wrote. That silence is the bug, so say so once, loudly.
 */
export function isEmailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (key && from) return true;

  if (key || from) {
    console.warn(
      `[email] Resend is half configured, so mail falls back to Supabase's sender. ` +
        `Missing: ${!key ? "RESEND_API_KEY" : "EMAIL_FROM"}.`
    );
  }
  return false;
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


export type Message = { subject: string; html: string; text: string };

/**
 * The shell every message shares.
 *
 * Tables and inline styles, because mail clients are not browsers and have not
 * been for twenty years: no flexbox, no external stylesheet, no custom
 * property. What it does carry is the brand's own dark azure, one card on a
 * tinted ground, and generous space, so an invitation from Charta Home looks
 * like the product it comes from.
 *
 * The destination is always printed as text under the button. A recipient who
 * cannot read where a link goes before clicking it is being trained into
 * exactly the habit that phishing relies on.
 */
function layout(input: {
  locale: string;
  preheader: string;
  heading: string;
  body: string;
  cta?: { label: string; href: string };
  footer: string;
}): string {
  const fr = input.locale === "fr";
  const linkNote = fr
    ? "Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :"
    : "If the button does not work, copy this address into your browser:";

  const button = input.cta
    ? `
          <a href="${esc(input.cta.href)}" style="display:inline-block;background:#003152;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 26px;border-radius:999px;">${esc(input.cta.label)}</a>
          <p style="margin:26px 0 6px;font-size:12px;line-height:1.5;color:#7b858c;">${linkNote}</p>
          <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;color:#003152;">${esc(input.cta.href)}</p>`
    : "";

  return `<!doctype html>
<html lang="${fr ? "fr" : "en"}">
  <body style="margin:0;padding:0;background:#eef5f6;">
    <!-- The line a client shows beside the subject, and nowhere else. -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(input.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef5f6;padding:36px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:540px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(2,2,2,0.06);">
            <tr>
              <td style="background:#003152;padding:22px 32px;">
                <p style="margin:0;font-size:17px;font-weight:700;letter-spacing:-0.2px;color:#ffffff;">
                  Charta&nbsp;<span style="color:#ADDFE1;font-weight:500;">Home</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 32px 30px;">
                <h1 style="margin:0 0 14px;font-size:21px;line-height:1.35;font-weight:700;color:#020202;">${esc(input.heading)}</h1>
                <div style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#3d474e;">${input.body}</div>
                ${button}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 30px;border-top:1px solid #e7eef0;">
                <p style="margin:0;font-size:12px;line-height:1.65;color:#7b858c;">${esc(input.footer)}</p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;font-size:11px;color:#9aa4ab;">Charta Home · Conakry</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Someone has been added to an agency and needs to set a password. */
export function invitationEmail(input: {
  agencyName: string;
  inviterName: string;
  role: string;
  actionLink: string;
  locale: string;
}): Message {
  const fr = input.locale === "fr";
  const roleLabel = roleName(input.role, input.locale);

  const subject = fr
    ? `${input.inviterName} vous invite à rejoindre ${input.agencyName}`
    : `${input.inviterName} invited you to join ${input.agencyName}`;

  const heading = fr ? "Vous avez été invité" : "You have been invited";
  const body = fr
    ? `<p style="margin:0 0 12px;"><strong>${esc(input.inviterName)}</strong> vous a ajouté à <strong>${esc(input.agencyName)}</strong> sur Charta Home, en tant que ${esc(roleLabel)}.</p>
       <p style="margin:0;">Créez votre mot de passe pour accéder au portefeuille de l'agence : les logements, les loyers et les interventions.</p>`
    : `<p style="margin:0 0 12px;"><strong>${esc(input.inviterName)}</strong> added you to <strong>${esc(input.agencyName)}</strong> on Charta Home, as ${esc(roleLabel)}.</p>
       <p style="margin:0;">Set your password to reach the agency's portfolio: its units, its rent and its maintenance.</p>`;

  const footer = fr
    ? "Vous ne connaissez pas cette agence ? Ignorez ce message, aucun compte ne sera activé."
    : "Do not recognise this agency? Ignore this message and no account will be activated.";

  return {
    subject,
    html: layout({
      locale: input.locale,
      preheader: subject,
      heading,
      body,
      cta: { label: fr ? "Créer mon mot de passe" : "Set my password", href: input.actionLink },
      footer,
    }),
    text: fr
      ? `${input.inviterName} vous a ajouté à ${input.agencyName} sur Charta Home, en tant que ${roleLabel}.\n\nCréez votre mot de passe ici :\n${input.actionLink}\n\n${footer}`
      : `${input.inviterName} added you to ${input.agencyName} on Charta Home, as ${roleLabel}.\n\nSet your password here:\n${input.actionLink}\n\n${footer}`,
  };
}

/** The first message an agency owner gets, just after signing up. */
export function welcomeEmail(input: {
  agencyName: string;
  ownerName: string;
  dashboardUrl: string;
  locale: string;
}): Message {
  const fr = input.locale === "fr";
  const first = input.ownerName.split(" ")[0] || input.ownerName;

  const subject = fr
    ? `Bienvenue sur Charta Home, ${first}`
    : `Welcome to Charta Home, ${first}`;

  const heading = fr ? `Bienvenue, ${first}` : `Welcome, ${first}`;

  // Three concrete first steps rather than a tour. Someone who has just signed
  // up wants to know what to do next, not what the product believes about
  // itself.
  const steps = fr
    ? ["Ajoutez votre premier immeuble", "Créez ses logements et leurs baux", "Invitez votre équipe"]
    : ["Add your first building", "Create its units and their leases", "Invite your team"];

  const body = fr
    ? `<p style="margin:0 0 16px;"><strong>${esc(input.agencyName)}</strong> est prêt. Trois choses pour commencer :</p>
       ${stepList(steps)}
       <p style="margin:18px 0 0;">Vos données restent les vôtres : vous pouvez les exporter à tout moment.</p>`
    : `<p style="margin:0 0 16px;"><strong>${esc(input.agencyName)}</strong> is ready. Three things to start with:</p>
       ${stepList(steps)}
       <p style="margin:18px 0 0;">Your data stays yours: you can export it at any time.</p>`;

  const footer = fr
    ? "Une question ? Répondez simplement à ce message."
    : "A question? Just reply to this message.";

  return {
    subject,
    html: layout({
      locale: input.locale,
      preheader: fr
        ? `${input.agencyName} est prêt sur Charta Home.`
        : `${input.agencyName} is ready on Charta Home.`,
      heading,
      body,
      cta: {
        label: fr ? "Ouvrir mon tableau de bord" : "Open my dashboard",
        href: input.dashboardUrl,
      },
      footer,
    }),
    text: fr
      ? `Bienvenue, ${first}.\n\n${input.agencyName} est prêt sur Charta Home.\n\n${steps.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\n${input.dashboardUrl}\n\n${footer}`
      : `Welcome, ${first}.\n\n${input.agencyName} is ready on Charta Home.\n\n${steps.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\n${input.dashboardUrl}\n\n${footer}`,
  };
}

/** A password reset, which is the one message that must never oversell. */
export function passwordResetEmail(input: {
  resetLink: string;
  locale: string;
}): Message {
  const fr = input.locale === "fr";

  const subject = fr ? "Réinitialiser votre mot de passe" : "Reset your password";
  const heading = subject;

  const body = fr
    ? `<p style="margin:0;">Vous avez demandé à changer le mot de passe de votre compte Charta Home. Le lien ci-dessous est valable une heure et ne fonctionne qu'une fois.</p>`
    : `<p style="margin:0;">You asked to change the password on your Charta Home account. The link below lasts an hour and works once.</p>`;

  const footer = fr
    ? "Si vous n'avez rien demandé, ignorez ce message : votre mot de passe actuel reste valable."
    : "If you did not ask for this, ignore this message: your current password still works.";

  return {
    subject,
    html: layout({
      locale: input.locale,
      preheader: subject,
      heading,
      body,
      cta: { label: fr ? "Choisir un nouveau mot de passe" : "Choose a new password", href: input.resetLink },
      footer,
    }),
    text: fr
      ? `Réinitialiser votre mot de passe Charta Home.\n\n${input.resetLink}\n\nLe lien est valable une heure.\n\n${footer}`
      : `Reset your Charta Home password.\n\n${input.resetLink}\n\nThe link lasts an hour.\n\n${footer}`,
  };
}

/** A numbered list that survives clients with no list styling of their own. */
function stepList(steps: string[]): string {
  return steps
    .map(
      (step, i) =>
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 9px;"><tr>
           <td width="26" valign="top" style="padding-top:1px;">
             <span style="display:inline-block;width:20px;height:20px;border-radius:999px;background:#ADDFE1;color:#003152;font-size:11px;font-weight:700;text-align:center;line-height:20px;">${i + 1}</span>
           </td>
           <td style="font-size:15px;line-height:1.5;color:#3d474e;">${esc(step)}</td>
         </tr></table>`
    )
    .join("");
}

/** Roles are stored in English; an invitation should read in the recipient's. */
function roleName(role: string, locale: string): string {
  const fr = locale === "fr";
  const labels: Record<string, [string, string]> = {
    owner: ["associé", "partner"],
    manager: ["gestionnaire", "manager"],
    accountant: ["comptable", "accountant"],
    caretaker: ["gardien", "caretaker"],
  };
  const pair = labels[role];
  return pair ? (fr ? pair[0] : pair[1]) : role;
}

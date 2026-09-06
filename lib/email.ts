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

/**
 * The day's rent reminders, sent to the agency rather than the tenant.
 *
 * Until the WhatsApp Business API is approved, nothing may message a tenant
 * automatically: Meta refuses free text outside a 24 hour window and an
 * approved template needs a verified business behind it. Waiting for that
 * would mean the reminder feature does nothing at all for weeks.
 *
 * So the job still runs, and what it produces is a list the agency can act on
 * in one tap each. Every row carries a wa.me link with the message already
 * written, which opens WhatsApp on a phone with the text in the box. It is one
 * press instead of none, and it has the side effect of putting a person
 * between the schedule and the tenant, which for a late payment is not the
 * worst thing.
 */
export function reminderDigestEmail(input: {
  agencyName: string;
  locale: string;
  dashboardUrl: string;
  items: {
    tenantName: string;
    apartmentLabel: string;
    amount: string;
    dueLabel: string;
    isOverdue: boolean;
    /** Already built by the caller, message included. */
    whatsappUrl: string;
  }[];
}): Message {
  const fr = input.locale === "fr";
  const n = input.items.length;

  const subject = fr
    ? n === 1
      ? "1 rappel de loyer à envoyer aujourd'hui"
      : `${n} rappels de loyer à envoyer aujourd'hui`
    : n === 1
      ? "1 rent reminder to send today"
      : `${n} rent reminders to send today`;

  const heading = fr ? "Vos rappels du jour" : "Your reminders for today";

  const intro = fr
    ? `<p style="margin:0 0 18px;">Voici les loyers à relancer pour <strong>${esc(input.agencyName)}</strong>. Chaque bouton ouvre WhatsApp avec le message déjà écrit : il ne reste qu'à envoyer.</p>`
    : `<p style="margin:0 0 18px;">Here are the rents to chase for <strong>${esc(input.agencyName)}</strong>. Each button opens WhatsApp with the message already written: all that is left is to send it.</p>`;

  const send = fr ? "Envoyer sur WhatsApp" : "Send on WhatsApp";
  const overdue = fr ? "En retard" : "Overdue";

  const rows = input.items
    .map(
      (item) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;border:1px solid #e7eef0;border-radius:14px;">
        <tr>
          <td style="padding:14px 16px;">
            <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#020202;">
              ${esc(item.apartmentLabel)} · ${esc(item.tenantName)}
            </p>
            <p style="margin:0 0 12px;font-size:13px;color:#7b858c;">
              ${esc(item.amount)} · ${esc(item.dueLabel)}${
                item.isOverdue
                  ? ` <span style="color:#b42318;font-weight:600;">${overdue}</span>`
                  : ""
              }
            </p>
            <a href="${esc(item.whatsappUrl)}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:9px 18px;border-radius:999px;">${send}</a>
          </td>
        </tr>
      </table>`
    )
    .join("");

  const footer = fr
    ? "Ces rappels partiront automatiquement dès que votre compte WhatsApp Business sera approuvé."
    : "These reminders will go out automatically as soon as your WhatsApp Business account is approved.";

  const text = [
    fr ? `Rappels du jour pour ${input.agencyName} :` : `Today's reminders for ${input.agencyName}:`,
    "",
    ...input.items.map(
      (i) =>
        `${i.apartmentLabel} · ${i.tenantName} — ${i.amount} — ${i.dueLabel}\n${i.whatsappUrl}`
    ),
    "",
    footer,
  ].join("\n");

  return {
    subject,
    html: layout({
      locale: input.locale,
      preheader: subject,
      heading,
      body: intro + rows,
      cta: { label: fr ? "Ouvrir le tableau de bord" : "Open the dashboard", href: input.dashboardUrl },
      footer,
    }),
    text,
  };
}


/* ------------------------------------------------------- choosing a plan --
 * There is no card form. An owner picks a tier in settings, the team gets the
 * request, and the agency pays by Orange Money or MTN MoMo. Two messages: one
 * to the inbox that will chase the payment, one to the owner saying what they
 * asked for and how to pay it.
 */

/** To the team. Everything needed to invoice without opening the dashboard. */
export function planRequestEmail(input: {
  agencyName: string;
  country: string;
  city: string;
  contactEmail: string;
  requestedBy: string;
  planLabel: string;
  cycleLabel: string;
  /** Already formatted, or null for a quote. */
  amount: string | null;
  locale: string;
}): Message {
  const fr = input.locale === "fr";
  const subject = fr
    ? `Demande de formule : ${input.agencyName} · ${input.planLabel} ${input.cycleLabel}`
    : `Plan request: ${input.agencyName} · ${input.planLabel} ${input.cycleLabel}`;

  const rows: [string, string][] = [
    [fr ? "Agence" : "Agency", input.agencyName],
    [fr ? "Pays" : "Country", `${input.country} · ${input.city}`],
    [fr ? "Contact" : "Contact", input.contactEmail],
    [fr ? "Demandé par" : "Requested by", input.requestedBy],
    [fr ? "Formule" : "Plan", input.planLabel],
    [fr ? "Cycle" : "Cycle", input.cycleLabel],
    [fr ? "Montant" : "Amount", input.amount ?? (fr ? "Sur devis" : "Quote")],
  ];
  const table = `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#7b858c;width:40%;">${esc(k)}</td><td style="padding:6px 0;color:#020202;font-weight:600;">${esc(v)}</td></tr>`
    )
    .join("")}</table>`;

  const body = fr
    ? `<p style="margin:0 0 14px;">Une agence a choisi une formule et attend les coordonnées de paiement mobile money.</p>${table}`
    : `<p style="margin:0 0 14px;">An agency has chosen a plan and is waiting for the mobile money details.</p>${table}`;

  const footer = fr
    ? "Répondez directement à l'adresse de contact. La formule s'active une fois le paiement reçu."
    : "Reply to the contact address directly. The plan goes live once the payment has arrived.";

  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");

  return {
    subject,
    html: layout({ locale: input.locale, preheader: subject, heading: subject, body, footer }),
    text: `${text}\n\n${footer}`,
  };
}

/** To the owner. What they asked for, and where the money goes. */
export function planRequestReceiptEmail(input: {
  agencyName: string;
  ownerName: string;
  planLabel: string;
  cycleLabel: string;
  amount: string | null;
  orangeNumber: string;
  mtnNumber: string;
  settingsUrl: string;
  locale: string;
}): Message {
  const fr = input.locale === "fr";
  const first = input.ownerName.split(" ")[0] || input.ownerName;
  const subject = fr
    ? `Votre demande de formule ${input.planLabel}`
    : `Your ${input.planLabel} plan request`;

  const numbers = [
    input.orangeNumber && ["Orange Money", input.orangeNumber],
    input.mtnNumber && ["MTN MoMo", input.mtnNumber],
  ].filter(Boolean) as [string, string][];

  const amountLine = input.amount
    ? fr
      ? `<p style="margin:0 0 12px;">Montant : <strong>${esc(input.amount)}</strong> (${esc(input.planLabel)}, ${esc(input.cycleLabel)}).</p>`
      : `<p style="margin:0 0 12px;">Amount: <strong>${esc(input.amount)}</strong> (${esc(input.planLabel)}, ${esc(input.cycleLabel)}).</p>`
    : fr
      ? `<p style="margin:0 0 12px;">La formule <strong>${esc(input.planLabel)}</strong> est établie sur devis. Nous revenons vers vous dans la journée avec une proposition.</p>`
      : `<p style="margin:0 0 12px;">The <strong>${esc(input.planLabel)}</strong> plan is quoted. We will come back to you within the day with a proposal.</p>`;

  // The numbers are printed only when the team has set them. A blank one is
  // not a place to invent a phone number.
  const howToPay =
    numbers.length > 0
      ? (fr
          ? `<p style="margin:0 0 8px;">Réglez par mobile money, en indiquant <strong>${esc(input.agencyName)}</strong> en référence :</p>`
          : `<p style="margin:0 0 8px;">Pay by mobile money, giving <strong>${esc(input.agencyName)}</strong> as the reference:</p>`) +
        `<ul style="margin:0 0 12px;padding-left:18px;">${numbers
          .map(([k, v]) => `<li style="margin:4px 0;">${esc(k)} : <strong>${esc(v)}</strong></li>`)
          .join("")}</ul>`
      : fr
        ? `<p style="margin:0 0 12px;">Nous vous envoyons dans la journée le numéro Orange Money ou MTN MoMo sur lequel régler.</p>`
        : `<p style="margin:0 0 12px;">We will send you the Orange Money or MTN MoMo number to pay to within the day.</p>`;

  const closing = fr
    ? `<p style="margin:0;">La formule s'active dès réception du paiement. En attendant, rien ne change dans votre tableau de bord.</p>`
    : `<p style="margin:0;">The plan goes live as soon as the payment arrives. Until then nothing changes in your dashboard.</p>`;

  const body = `${amountLine}${howToPay}${closing}`;
  const footer = fr
    ? "Vous n'avez pas fait cette demande ? Répondez à ce message et nous l'annulons."
    : "Did not make this request? Reply to this message and we will cancel it.";

  const textNumbers = numbers.map(([k, v]) => `${k}: ${v}`).join("\n");
  const text = fr
    ? `Bonjour ${first},\n\nVotre demande : ${input.planLabel}, ${input.cycleLabel}${input.amount ? `, ${input.amount}` : " (sur devis)"}.\n\n${textNumbers || "Nous vous envoyons le numéro mobile money dans la journée."}\n\nVos paramètres : ${input.settingsUrl}\n\n${footer}`
    : `Hello ${first},\n\nYour request: ${input.planLabel}, ${input.cycleLabel}${input.amount ? `, ${input.amount}` : " (quoted)"}.\n\n${textNumbers || "We will send the mobile money number within the day."}\n\nYour settings: ${input.settingsUrl}\n\n${footer}`;

  return {
    subject,
    html: layout({
      locale: input.locale,
      preheader: subject,
      heading: fr ? `Merci, ${first}` : `Thank you, ${first}`,
      body,
      cta: { label: fr ? "Voir mes paramètres" : "See my settings", href: input.settingsUrl },
      footer,
    }),
    text,
  };
}

/** The code itself, to the owner, once the desk has seen the payment. */
export function planCodeEmail(input: {
  agencyName: string;
  ownerName: string;
  code: string;
  planLabel: string;
  cycleLabel: string;
  /** Already formatted for the reader. */
  validUntil: string;
  settingsUrl: string;
  locale: string;
}): Message {
  const fr = input.locale === "fr";
  const first = input.ownerName.split(" ")[0] || input.ownerName;
  const subject = fr
    ? `Votre code d'activation ${input.planLabel} : ${input.code}`
    : `Your ${input.planLabel} activation code: ${input.code}`;

  const codeBlock = `<p style="margin:18px 0;text-align:center;"><span style="display:inline-block;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:26px;letter-spacing:6px;font-weight:700;color:#003152;background:#eef7f8;border-radius:14px;padding:14px 22px;">${esc(input.code)}</span></p>`;

  const body = fr
    ? `<p style="margin:0 0 12px;">Paiement bien reçu pour <strong>${esc(input.agencyName)}</strong>. Voici votre code pour activer la formule <strong>${esc(input.planLabel)}</strong> (${esc(input.cycleLabel)}) :</p>${codeBlock}
       <p style="margin:0 0 12px;">Saisissez le dans Paramètres, Formule et facturation. Il est valable jusqu'à <strong>${esc(input.validUntil)}</strong> et ne sert qu'une fois.</p>`
    : `<p style="margin:0 0 12px;">Payment received for <strong>${esc(input.agencyName)}</strong>. Here is your code to activate the <strong>${esc(input.planLabel)}</strong> plan (${esc(input.cycleLabel)}):</p>${codeBlock}
       <p style="margin:0 0 12px;">Enter it in Settings, Plan and billing. It is valid until <strong>${esc(input.validUntil)}</strong> and works once.</p>`;

  const footer = fr
    ? "Le code a expiré ? Répondez à ce message et nous en émettons un autre."
    : "Code expired? Reply to this message and we will issue another.";

  return {
    subject,
    html: layout({
      locale: input.locale,
      preheader: subject,
      heading: fr ? `Merci, ${first}` : `Thank you, ${first}`,
      body,
      cta: { label: fr ? "Saisir mon code" : "Enter my code", href: input.settingsUrl },
      footer,
    }),
    text: fr
      ? `Paiement bien reçu pour ${input.agencyName}.\n\nVotre code ${input.planLabel} (${input.cycleLabel}) : ${input.code}\nValable jusqu'à ${input.validUntil}, une seule fois.\n\nSaisissez le ici : ${input.settingsUrl}\n\n${footer}`
      : `Payment received for ${input.agencyName}.\n\nYour ${input.planLabel} (${input.cycleLabel}) code: ${input.code}\nValid until ${input.validUntil}, once.\n\nEnter it here: ${input.settingsUrl}\n\n${footer}`,
  };
}

/**
 * The rent reminder, to the tenant.
 *
 * The body is the agency's own wording from its settings, already filled in,
 * so what the tenant reads is what the agency wrote. Around it: the figures
 * that matter, and the agency's own number, because a tenant who wants to
 * say "I paid yesterday" should be able to say it to the agency and not to
 * a no reply address.
 */
export function rentReminderEmail(input: {
  agencyName: string;
  agencyWhatsapp: string | null;
  agencyEmail: string | null;
  tenantName: string;
  apartmentLabel: string;
  amount: string;
  dueLabel: string;
  /** Days past the due date; negative is before it. */
  daysFromDue: number;
  /** The agency's message, placeholders already filled. */
  body: string;
  locale: string;
}): Message {
  const fr = input.locale === "fr";
  const overdue = input.daysFromDue > 0;
  const first = input.tenantName.split(" ")[0] || input.tenantName;

  const subject = overdue
    ? fr ? `Loyer en retard · ${input.apartmentLabel} · ${input.amount}` : `Rent overdue · ${input.apartmentLabel} · ${input.amount}`
    : fr ? `Rappel de loyer · ${input.apartmentLabel} · ${input.amount}` : `Rent reminder · ${input.apartmentLabel} · ${input.amount}`;

  const rows: [string, string][] = [
    [fr ? "Logement" : "Unit", input.apartmentLabel],
    [fr ? "Montant" : "Amount", input.amount],
    [fr ? "Échéance" : "Due", input.dueLabel],
    [fr ? "Agence" : "Agency", input.agencyName],
  ];
  const table = `<table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${rows
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#7b858c;">${esc(k)}</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#003152;">${esc(v)}</td></tr>`)
    .join("")}</table>`;

  const contact = [
    input.agencyWhatsapp ? (fr ? `WhatsApp : ${input.agencyWhatsapp}` : `WhatsApp: ${input.agencyWhatsapp}`) : "",
    input.agencyEmail ? (fr ? `Email : ${input.agencyEmail}` : `Email: ${input.agencyEmail}`) : "",
  ].filter(Boolean);

  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;white-space:pre-line;">${esc(p)}</p>`)
    .join("");

  const html = layout({
    locale: input.locale,
    preheader: subject,
    heading: fr ? `Bonjour ${first}` : `Hello ${first}`,
    body: `${paragraphs}${table}${contact.length ? `<p style="margin:0;color:#7b858c;">${fr ? "Déjà réglé, ou une question ? Écrivez à l'agence." : "Already paid, or a question? Write to the agency."}<br>${contact.map(esc).join("<br>")}</p>` : ""}`,
    footer: fr
      ? `Envoyé par Charta Home pour le compte de ${input.agencyName}.`
      : `Sent by Charta Home on behalf of ${input.agencyName}.`,
  });

  const text = [
    input.body,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    ...contact,
    "",
    fr ? `Envoyé par Charta Home pour le compte de ${input.agencyName}.` : `Sent by Charta Home on behalf of ${input.agencyName}.`,
  ].join("\n");

  return { subject, html, text };
}

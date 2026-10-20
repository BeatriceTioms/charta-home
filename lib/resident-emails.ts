/**
 * Emails sent to residents from the app's flows, through Resend (lib/email.ts).
 * Same look as the rest: one card on a tinted ground, the brand's azure.
 */
import type { Message } from "@/lib/email";

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function residentReceiptEmail(input: {
  locale: string;
  agency: string;
  kind: "rent" | "stay" | "booking";
  amount: string;
  reference: string;
}): Message {
  const fr = input.locale === "fr";
  const what =
    input.kind === "rent"
      ? fr ? "votre loyer" : "your rent"
      : input.kind === "booking"
        ? fr ? "votre réservation (premier mois et caution)" : "your booking (first month and deposit)"
        : fr ? "votre séjour" : "your stay";
  const subject = fr ? `Reçu · ${input.amount} payé à ${input.agency}` : `Receipt · ${input.amount} paid to ${input.agency}`;
  const lead = fr
    ? `${input.agency} a bien reçu ${what}. Ce reçu est aussi dans l’application Charta Home.`
    : `${input.agency} has received ${what}. This receipt is also in the Charta Home app.`;
  const refLabel = fr ? "Référence" : "Reference";
  const amountLabel = fr ? "Montant" : "Amount";

  const html = `<!doctype html><html><body style="margin:0;background:#eaf5fb;font-family:Inter,Arial,sans-serif;color:#020202;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;" cellpadding="0" cellspacing="0"><tr><td style="padding:32px;">
<p style="margin:0 0 6px;font-size:13px;color:#003152;font-weight:700;">Charta Home</p>
<h1 style="margin:0 0 14px;font-size:22px;">${esc(subject)}</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#3b4a55;">${esc(lead)}</p>
<table role="presentation" width="100%" style="border-top:1px solid #ebebeb;" cellpadding="0" cellspacing="0">
<tr><td style="padding:12px 0;color:#6e6e73;font-size:14px;">${amountLabel}</td><td align="right" style="padding:12px 0;font-weight:700;font-size:15px;">${esc(input.amount)}</td></tr>
<tr><td style="padding:12px 0;color:#6e6e73;font-size:14px;border-top:1px solid #ebebeb;">${refLabel}</td><td align="right" style="padding:12px 0;font-size:14px;border-top:1px solid #ebebeb;">${esc(input.reference)}</td></tr>
</table></td></tr></table></td></tr></table></body></html>`;

  const text = `${subject}\n\n${lead}\n\n${amountLabel}: ${input.amount}\n${refLabel}: ${input.reference}\n`;
  return { subject, html, text };
}

/** To the agency: a resident booked and paid for a unit in the app. */
export function agencyBookingEmail(input: {
  locale: string;
  unit: string;
  name: string;
  email: string;
  phone: string;
  moveIn: string;
  months: number;
  amount: string;
  dashboardUrl: string;
}): Message {
  const fr = input.locale === "fr";
  const subject = fr ? `Nouvelle réservation payée · ${input.unit}` : `New paid booking · ${input.unit}`;
  const lead = fr
    ? `${input.name} a réservé ${input.unit} dans l’application et a payé le premier mois et la caution. Contactez cette personne pour préparer le bail, puis acceptez ou refusez la réservation dans votre tableau de bord.`
    : `${input.name} booked ${input.unit} in the app and paid the first month and the deposit. Get in touch to prepare the lease, then accept or decline the booking in your dashboard.`;
  const rows: [string, string][] = [
    [fr ? "Entrée" : "Move-in", input.moveIn],
    [fr ? "Durée" : "Length", fr ? `${input.months} mois` : `${input.months} months`],
    [fr ? "Payé" : "Paid", input.amount],
    ["Email", input.email],
    [fr ? "Téléphone" : "Phone", input.phone || "—"],
  ];
  const cta = fr ? "Ouvrir le tableau de bord" : "Open the dashboard";
  const html = `<!doctype html><html><body style="margin:0;background:#eaf5fb;font-family:Inter,Arial,sans-serif;color:#020202;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;" cellpadding="0" cellspacing="0"><tr><td style="padding:32px;">
<p style="margin:0 0 6px;font-size:13px;color:#003152;font-weight:700;">Charta Home</p>
<h1 style="margin:0 0 14px;font-size:22px;">${esc(subject)}</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#3b4a55;">${esc(lead)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${rows.map(([k, v]) => `<tr><td style="padding:12px 0;color:#6e6e73;font-size:14px;border-top:1px solid #ebebeb;">${esc(k)}</td><td align="right" style="padding:12px 0;font-size:14px;font-weight:600;border-top:1px solid #ebebeb;">${esc(v)}</td></tr>`).join("\n")}
</table>
<p style="margin:24px 0 0;"><a href="${esc(input.dashboardUrl)}" style="display:inline-block;background:#003152;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:999px;">${esc(cta)}</a></p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${subject}\n\n${lead}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${input.dashboardUrl}\n`;
  return { subject, html, text };
}

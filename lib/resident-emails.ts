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
  kind: "rent" | "stay";
  amount: string;
  reference: string;
}): Message {
  const fr = input.locale === "fr";
  const what = input.kind === "rent" ? (fr ? "votre loyer" : "your rent") : fr ? "votre séjour" : "your stay";
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

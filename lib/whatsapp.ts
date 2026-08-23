/**
 * WhatsApp Cloud API client.
 *
 * Meta only allows free form text inside the 24 hour customer service window,
 * which opens when the tenant messages first. A rent reminder is proactive by
 * definition, so it almost always needs an approved template. Both paths are
 * here: `sendTemplate` for the normal case, `sendText` for a reply to somebody
 * who has just written in.
 *
 * Configuration lives in the environment, not the database, because the phone
 * number id and access token belong to the deployment rather than the agency.
 */

const API_VERSION = "v21.0";

export type SendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string };

export const isWhatsAppConfigured = () =>
  Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);

/** Meta wants digits only, no plus and no spaces. */
export const toWaNumber = (phone: string) => phone.replace(/\D/g, "");

async function post(body: unknown): Promise<SendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    return { ok: false, error: "WhatsApp is not configured" };
  }

  let response: Response;
  try {
    response = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
  } catch (err) {
    // A network failure is worth retrying tomorrow, so it must not look like
    // a send that succeeded.
    return { ok: false, error: `network: ${(err as Error).message}` };
  }

  const payload = (await response.json().catch(() => null)) as {
    messages?: { id: string }[];
    error?: { message?: string; code?: number };
  } | null;

  if (!response.ok) {
    const detail = payload?.error?.message ?? `HTTP ${response.status}`;
    return { ok: false, error: detail };
  }

  const id = payload?.messages?.[0]?.id;
  if (!id) return { ok: false, error: "no message id in response" };
  return { ok: true, providerMessageId: id };
}

/**
 * Sends an approved template. Meta substitutes the body variables positionally,
 * so the order of `variables` must match the {{1}}, {{2}} ... in the template
 * as it was approved.
 */
export function sendTemplate(input: {
  to: string;
  templateName: string;
  languageCode?: string;
  variables: string[];
}): Promise<SendResult> {
  return post({
    messaging_product: "whatsapp",
    to: toWaNumber(input.to),
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.languageCode ?? "fr" },
      ...(input.variables.length > 0 && {
        components: [
          {
            type: "body",
            parameters: input.variables.map((text) => ({ type: "text", text })),
          },
        ],
      }),
    },
  });
}

/** Free text. Only reaches a tenant inside the 24 hour window. */
export function sendText(input: { to: string; body: string }): Promise<SendResult> {
  return post({
    messaging_product: "whatsapp",
    to: toWaNumber(input.to),
    type: "text",
    text: { preview_url: false, body: input.body },
  });
}

/**
 * Fills a reminder body written by the agency. Unknown placeholders are left
 * as they are rather than blanked, so a typo shows up in the preview instead
 * of silently sending a sentence with a hole in it.
 */
export function renderMessage(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? values[key] : whole
  );
}

/**
 * Fetches a photograph a tenant sent.
 *
 * Meta does not put the image in the webhook, only an id. Retrieving it is two
 * calls: the id gives a short lived URL, and that URL needs the access token
 * as well, which is easy to miss because it looks like an ordinary CDN link.
 *
 * A photograph of the leak is often worth more than the sentence describing
 * it, so this is not optional decoration: it is how a caretaker knows whether
 * to bring a wrench or a plumber.
 */
export async function downloadMedia(
  mediaId: string
): Promise<{ ok: true; bytes: Uint8Array; mime: string } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "whatsapp is not configured" };

  try {
    const lookup = await fetch(`https://graph.facebook.com/${API_VERSION}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!lookup.ok) {
      return { ok: false, error: `media lookup ${lookup.status}` };
    }
    const meta = (await lookup.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return { ok: false, error: "media has no url" };

    // The URL is on a Meta host and still requires the token.
    const file = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!file.ok) return { ok: false, error: `media fetch ${file.status}` };

    return {
      ok: true,
      bytes: new Uint8Array(await file.arrayBuffer()),
      mime: meta.mime_type ?? "application/octet-stream",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "media download failed" };
  }
}

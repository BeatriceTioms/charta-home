/**
 * PayUnit, for Cameroon.
 *
 * A hosted checkout: we open a transaction, send the owner to PayUnit's page,
 * and PayUnit collects by MTN MoMo, Orange Money or card. Two facts shape
 * everything here.
 *
 * The notify callback is unsigned and its shape is undocumented, so nothing
 * is ever activated on the strength of it. A callback, or the owner coming
 * back to settings, is only a prompt to ask PayUnit for the transaction's
 * status by the id we chose ourselves, and that answer is what activates.
 *
 * Orange Money refuses a transaction id with special characters, so ours are
 * a prefix and hex.
 *
 * Configure with:
 *   PAYUNIT_API_KEY        the application token
 *   PAYUNIT_API_USER       from the PayUnit dashboard, with the password below
 *   PAYUNIT_API_PASSWORD
 *   PAYUNIT_MODE           test or live; test until the first real payment
 */

const BASE = "https://gateway.payunit.net";

export type PayunitStatus = "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";

export function isPayunitConfigured(): boolean {
  return Boolean(
    process.env.PAYUNIT_API_KEY && process.env.PAYUNIT_API_USER && process.env.PAYUNIT_API_PASSWORD
  );
}

export function payunitMode(): "test" | "live" {
  return process.env.PAYUNIT_MODE === "live" ? "live" : "test";
}

/** Every request carries the same four headers. */
export function payunitHeaders(): Record<string, string> {
  const user = process.env.PAYUNIT_API_USER ?? "";
  const password = process.env.PAYUNIT_API_PASSWORD ?? "";
  return {
    "Content-Type": "application/json",
    Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
    "x-api-key": process.env.PAYUNIT_API_KEY ?? "",
    mode: payunitMode(),
  };
}

/** What the gateway is sent to open a transaction. Exported for the checks. */
export function initializeBody(input: {
  amount: number;
  currency: string;
  transactionId: string;
  returnUrl: string;
  notifyUrl: string;
  description: string;
}) {
  return {
    total_amount: input.amount,
    currency: input.currency,
    transaction_id: input.transactionId,
    return_url: input.returnUrl,
    notify_url: input.notifyUrl,
    payment_country: "CM",
    description: input.description,
  };
}

export type InitializeResult =
  | { ok: true; checkoutUrl: string; providerRef: string }
  | { ok: false; error: string };

export async function initializePayment(input: Parameters<typeof initializeBody>[0]): Promise<InitializeResult> {
  if (!isPayunitConfigured()) return { ok: false, error: "payunit is not configured" };
  // Both must be https or the gateway refuses, and it says so unhelpfully.
  if (!/^https:\/\//.test(input.returnUrl) || !/^https:\/\//.test(input.notifyUrl)) {
    return { ok: false, error: "return_url and notify_url must be https" };
  }
  try {
    // The gateway answers 502/503/504 ("no healthy upstream") during its own
    // outages, often for a few seconds only. Opening a transaction twice is
    // harmless (same id, nothing is charged until the payer approves), so a
    // short retry saves the payer from tapping Pay again.
    let r = await openTransaction(input);
    for (let attempt = 1; attempt < 3 && [502, 503, 504].includes(r.status); attempt++) {
      await new Promise((done) => setTimeout(done, 1500 * attempt));
      r = await openTransaction(input);
    }
    if ([502, 503, 504].includes(r.status)) {
      return { ok: false, error: `payunit is unavailable (${r.status})` };
    }
    const body = (await r.json().catch(() => ({}))) as {
      status?: string;
      message?: string;
      data?: { transaction_url?: string; transaction_id?: string };
    };
    const url = body.data?.transaction_url;
    if (!r.ok || body.status !== "SUCCESS" || !url) {
      return { ok: false, error: body.message || `payunit refused (${r.status})` };
    }
    return { ok: true, checkoutUrl: url, providerRef: body.data?.transaction_id ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "payunit unreachable" };
  }
}

function openTransaction(input: Parameters<typeof initializeBody>[0]) {
  return fetch(`${BASE}/api/gateway/initialize`, {
    method: "POST",
    headers: payunitHeaders(),
    body: JSON.stringify(initializeBody(input)),
  });
}

/** The gateway's word on a transaction, by the id we chose. */
export async function paymentStatus(
  transactionId: string
): Promise<{ ok: true; status: PayunitStatus; raw: unknown } | { ok: false; error: string }> {
  if (!isPayunitConfigured()) return { ok: false, error: "payunit is not configured" };
  try {
    const r = await fetch(`${BASE}/api/gateway/paymentstatus/${encodeURIComponent(transactionId)}`, {
      headers: payunitHeaders(),
      cache: "no-store",
    });
    const body = (await r.json().catch(() => ({}))) as {
      message?: string;
      data?: { transaction_status?: string };
      transaction_status?: string;
    };
    const status = normalizeStatus(body.data?.transaction_status ?? body.transaction_status);
    if (!r.ok || !status) return { ok: false, error: body.message || `no status (${r.status})` };
    return { ok: true, status, raw: body };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "payunit unreachable" };
  }
}

/** Case and spelling vary across the gateway's own examples. */
export function normalizeStatus(value: unknown): PayunitStatus | null {
  const s = String(value ?? "").trim().toUpperCase();
  if (s === "SUCCESS" || s === "SUCCESSFUL" || s === "COMPLETED") return "SUCCESS";
  if (s === "PENDING" || s === "INITIATED" || s === "PROCESSING") return "PENDING";
  if (s === "FAILED" || s === "FAILURE" || s === "ERROR") return "FAILED";
  if (s === "CANCELLED" || s === "CANCELED") return "CANCELLED";
  return null;
}

/** Our side of the transaction id. A prefix and hex, nothing Orange Money refuses. */
export function newTransactionId(): string {
  const hex = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `CH${hex.toUpperCase()}`;
}

/**
 * The countries whose agencies pay online. The settings page and the desk
 * both hide the code path for these, because a code is the manual path's
 * receipt and an agency that pays through the gateway never needs one.
 * Empty until PayUnit is configured, so nobody is left with neither.
 */
export function onlinePaymentCountries(): string[] {
  return isPayunitConfigured() ? ["Cameroon"] : [];
}

import { NextResponse } from "next/server";
import { settlePayment } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * PayUnit's callback.
 *
 * It is unsigned and its body is undocumented, so nothing in it is believed.
 * The one thing taken from it is which transaction it is about, and then
 * PayUnit is asked directly. An answer of 200 goes back whatever happened,
 * because a gateway that is told "error" retries, and a retry of a callback
 * that was never trusted changes nothing.
 */
export async function POST(request: Request) {
  let ref = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    ref = String(body.transaction_id ?? body.transactionId ?? body.t_id ?? "");
  } catch {
    // Some gateways post a form rather than json.
    try {
      const form = await request.formData();
      ref = String(form.get("transaction_id") ?? "");
    } catch {
      /* nothing usable */
    }
  }
  if (!/^[A-Za-z0-9]{6,64}$/.test(ref)) {
    return NextResponse.json({ ok: false, error: "no transaction id" }, { status: 400 });
  }
  const result = await settlePayment({ providerRef: ref });
  return NextResponse.json({ ok: true, outcome: result.ok ? result.outcome : "unverified" });
}

/** PayUnit may probe the address with a GET; that is not a payment. */
export async function GET() {
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Where PayUnit sends the resident after the checkout. PayUnit requires an
 * https address, so this bounces to the app's own link. Nothing is decided
 * here: the app asks /api/mobile/payments/[ref] for the real outcome.
 */
export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get("ref") ?? "";
  const safe = /^[A-Za-z0-9]{6,64}$/.test(ref) ? ref : "";
  return NextResponse.redirect(`chartahome://payment-return${safe ? `?ref=${safe}` : ""}`, 302);
}

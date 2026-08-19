"use client";

import { LogoMark } from "@/components/Logo";
import { agencyDefaults } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useMoney } from "@/lib/money";
import { useI18n } from "@/lib/i18n/context";

export type ReceiptData = {
  tenant: string;
  tenantPhone?: string;
  apartment: string;
  building: string;
  address: string;
  amount: number;
  /** Service charges billed on top of the rent, when the lease carries any. */
  charges?: number;
  period: string;
  paidOn: string;
  method?: string;
  reference: string;
};

/**
 * The printed receipt is built as raw HTML in a new window, so every value
 * interpolated into it has to be escaped. Tenant and agency names are typed by
 * people, and a name containing a tag would otherwise become markup.
 */
const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const rule = "border-b border-onyx/10";
const term = "text-[10px] font-semibold uppercase tracking-[0.12em] text-onyx/40";

export function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: ReceiptData;
  onClose: () => void;
}) {
  const { t, f, locale } = useI18n();
  const { agencyInfo } = useStore();
  const { fmt } = useMoney();
  const m = t.dash.rent.receiptModal;

  // The signed in agency's own details where the row carries them, the
  // defaults for the fields agencies has no column for yet.
  const agency = {
    ...agencyDefaults,
    ...(agencyInfo && {
      name: agencyInfo.name,
      city: agencyInfo.city,
      country: agencyInfo.country,
      ...(agencyInfo.whatsapp && { phone: agencyInfo.whatsapp }),
    }),
  };
  const tag = locale === "fr" ? "fr-FR" : "en-GB";

  const longDate = (value: string) =>
    value
      ? new Date(value).toLocaleDateString(tag, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : t.dash.common.none;

  const paidOn = longDate(receipt.paidOn);
  const issuedOn = new Date().toLocaleDateString(tag, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const charges = receipt.charges ?? 0;
  const total = receipt.amount + charges;

  /** The printable document. Standalone so it carries its own styles. */
  const print = () => {
    const w = window.open("", "_blank", "width=820,height=1000");
    if (!w) return;

    const row = (label: string, period: string, value: number) =>
      `<tr><td>${esc(label)}</td><td class="mid">${esc(period)}</td><td class="num">${esc(fmt(value))}</td></tr>`;

    w.document.write(`<!doctype html><html lang="${esc(locale)}"><head><meta charset="utf-8">
<title>${esc(m.title)} ${esc(receipt.reference)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #020202; margin: 0; font-size: 12px; line-height: 1.55; }
  .sheet { max-width: 174mm; margin: 0 auto; }
  header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #003152; padding-bottom: 14px; }
  .brand { font-size: 17px; font-weight: bold; color: #003152; letter-spacing: 0.5px; }
  .issuer { margin-top: 6px; color: #555; font-size: 11px; }
  .doc { text-align: right; }
  .doc h1 { font-size: 15px; letter-spacing: 2px; text-transform: uppercase; color: #003152; margin: 0 0 8px; }
  .stamp { display: inline-block; border: 2px solid #003152; color: #003152; border-radius: 999px; padding: 3px 14px; font-size: 10px; font-weight: bold; letter-spacing: 2px; }
  .meta { margin-top: 8px; font-size: 11px; color: #555; }
  .parties { display: flex; gap: 18px; margin-top: 22px; }
  .party { flex: 1; border: 1px solid #d9dfe4; border-radius: 6px; padding: 12px 14px; }
  .term { font-size: 9px; text-transform: uppercase; letter-spacing: 1.4px; color: #888; }
  .name { font-weight: bold; margin-top: 3px; }
  .muted { color: #555; }
  .prop { margin-top: 18px; border-left: 3px solid #ADDFE1; padding: 8px 0 8px 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 22px; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 1.4px; color: #888; border-bottom: 1px solid #003152; padding-bottom: 7px; }
  td { padding: 11px 0; border-bottom: 1px solid #eceff1; }
  .mid { text-align: center; color: #555; }
  .num, th.num { text-align: right; }
  tfoot td { border-top: 2px solid #003152; border-bottom: none; font-weight: bold; font-size: 15px; color: #003152; padding-top: 12px; }
  .payment { display: flex; gap: 18px; margin-top: 20px; }
  .payment div { flex: 1; }
  .legal { margin-top: 22px; border: 1px solid #d9dfe4; background: #f7fafb; border-radius: 6px; padding: 12px 14px; font-size: 11px; color: #444; }
  .sign { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 34px; }
  .line { width: 190px; border-top: 1px solid #020202; padding-top: 6px; font-size: 11px; text-align: center; }
  footer { margin-top: 26px; border-top: 1px solid #eceff1; padding-top: 10px; font-size: 10px; color: #999; display: flex; justify-content: space-between; }
</style></head><body><div class="sheet">
  <header>
    <div>
      <div class="brand">${esc(agency.name)}</div>
      <div class="issuer">${esc(agency.address)}<br/>${esc(agency.city)}, ${esc(agency.country)}<br/>${esc(agency.phone)} · ${esc(agency.email)}<br/>${esc(m.registration)} ${esc(agency.registration)}</div>
    </div>
    <div class="doc">
      <h1>${esc(m.docType)}</h1>
      <span class="stamp">${esc(m.paid)}</span>
      <div class="meta">${esc(m.number)} ${esc(receipt.reference)}<br/>${esc(m.issuedOn)} ${esc(issuedOn)}</div>
    </div>
  </header>

  <div class="parties">
    <div class="party">
      <div class="term">${esc(m.landlord)}</div>
      <div class="name">${esc(agency.name)}</div>
      <div class="muted">${esc(agency.address)}<br/>${esc(agency.city)}, ${esc(agency.country)}</div>
    </div>
    <div class="party">
      <div class="term">${esc(m.tenant)}</div>
      <div class="name">${esc(receipt.tenant)}</div>
      <div class="muted">${esc(receipt.apartment)}, ${esc(receipt.building)}${receipt.tenantPhone ? `<br/>${esc(receipt.tenantPhone)}` : ""}</div>
    </div>
  </div>

  <div class="prop">
    <div class="term">${esc(m.property)}</div>
    <div class="name">${esc(receipt.apartment)}, ${esc(receipt.building)}</div>
    <div class="muted">${esc(receipt.address)}</div>
  </div>

  <table>
    <thead><tr><th>${esc(m.description)}</th><th class="mid">${esc(m.period)}</th><th class="num">${esc(m.amount)}</th></tr></thead>
    <tbody>
      ${row(m.rentLine, receipt.period, receipt.amount)}
      ${charges > 0 ? row(m.chargesLine, receipt.period, charges) : ""}
    </tbody>
    <tfoot><tr><td colspan="2">${esc(m.total)}</td><td class="num">${esc(fmt(total))}</td></tr></tfoot>
  </table>

  <div class="payment">
    <div><div class="term">${esc(m.paidOn)}</div><div class="name">${esc(paidOn)}</div></div>
    ${receipt.method ? `<div><div class="term">${esc(m.method)}</div><div class="name">${esc(receipt.method)}</div></div>` : ""}
    <div><div class="term">${esc(m.reference)}</div><div class="name">${esc(receipt.reference)}</div></div>
  </div>

  <p class="legal">${esc(m.legal)}</p>

  <div class="sign">
    <div class="muted">${esc(f(m.place, { city: agency.city, date: issuedOn }))}</div>
    <div class="line">${esc(m.signature)}</div>
  </div>

  <footer><span>${esc(f(m.issued, { agency: agency.name }))}</span><span>${esc(m.page)}</span></footer>
</div><script>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-onyx/60 p-5 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={m.title}
    >
      <div
        className="my-auto w-full max-w-2xl rounded-3xl bg-white text-onyx shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-[76vh] overflow-y-auto p-8 sm:p-10">
          {/* issuer and document identity */}
          <header className={`flex flex-wrap items-start justify-between gap-6 border-b-[3px] border-azure-800 pb-5`}>
            <div className="flex items-start gap-3">
              <LogoMark className="h-11 w-11 shrink-0" />
              <div>
                <p className="font-serif text-lg font-semibold text-azure-800">{agency.name}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-onyx/55">
                  {agency.address}
                  <br />
                  {agency.city}, {agency.country}
                  <br />
                  {agency.phone} · {agency.email}
                  <br />
                  {m.registration} {agency.registration}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-azure-800">
                {m.docType}
              </p>
              <span className="mt-2 inline-block rounded-full border-2 border-azure-800 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-azure-800">
                {m.paid}
              </span>
              <p className="mt-2 text-[11px] text-onyx/55">
                {m.number} {receipt.reference}
                <br />
                {m.issuedOn} {issuedOn}
              </p>
            </div>
          </header>

          {/* the two parties */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              {
                label: m.landlord,
                name: agency.name,
                lines: [agency.address, `${agency.city}, ${agency.country}`],
              },
              {
                label: m.tenant,
                name: receipt.tenant,
                lines: [
                  `${receipt.apartment}, ${receipt.building}`,
                  ...(receipt.tenantPhone ? [receipt.tenantPhone] : []),
                ],
              },
            ].map((party) => (
              <div key={party.label} className="rounded-2xl border border-onyx/10 p-4">
                <p className={term}>{party.label}</p>
                <p className="mt-1 font-bold">{party.name}</p>
                {party.lines.map((line) => (
                  <p key={line} className="text-[13px] text-onyx/55">{line}</p>
                ))}
              </div>
            ))}
          </div>

          {/* the property */}
          <div className="mt-5 border-l-[3px] border-soft-500 py-1 pl-4">
            <p className={term}>{m.property}</p>
            <p className="mt-0.5 font-bold">
              {receipt.apartment}, {receipt.building}
            </p>
            <p className="text-[13px] text-onyx/55">{receipt.address}</p>
          </div>

          {/* what is being settled */}
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-azure-800">
                <th className={`${term} pb-2 text-left`}>{m.description}</th>
                <th className={`${term} pb-2 text-center`}>{m.period}</th>
                <th className={`${term} pb-2 text-right`}>{m.amount}</th>
              </tr>
            </thead>
            <tbody>
              <tr className={rule}>
                <td className="py-3">{m.rentLine}</td>
                <td className="py-3 text-center text-onyx/55">{receipt.period}</td>
                <td className="py-3 text-right font-semibold">{fmt(receipt.amount)}</td>
              </tr>
              {charges > 0 && (
                <tr className={rule}>
                  <td className="py-3">{m.chargesLine}</td>
                  <td className="py-3 text-center text-onyx/55">{receipt.period}</td>
                  <td className="py-3 text-right font-semibold">{fmt(charges)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-azure-800">
                <td colSpan={2} className="pt-3 text-sm font-bold text-azure-800">
                  {m.total}
                </td>
                <td className="pt-3 text-right text-2xl font-extrabold tracking-tight text-azure-800">
                  {fmt(total)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* how it was settled */}
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <p className={term}>{m.paidOn}</p>
              <p className="mt-0.5 font-semibold">{paidOn}</p>
            </div>
            {receipt.method && (
              <div>
                <p className={term}>{m.method}</p>
                <p className="mt-0.5 font-semibold">{receipt.method}</p>
              </div>
            )}
            <div>
              <p className={term}>{m.reference}</p>
              <p className="mt-0.5 font-semibold">{receipt.reference}</p>
            </div>
          </div>

          <p className="mt-6 rounded-2xl border border-onyx/10 bg-soft-100/60 p-4 text-[12px] leading-relaxed text-onyx/70">
            {m.legal}
          </p>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
            <p className="text-[12px] text-onyx/55">
              {f(m.place, { city: agency.city, date: issuedOn })}
            </p>
            <p className="w-48 border-t border-onyx pt-2 text-center text-[12px]">
              {m.signature}
            </p>
          </div>

          <footer className="mt-6 flex flex-wrap justify-between gap-2 border-t border-onyx/10 pt-3 text-[10px] text-onyx/40">
            <span>{f(m.issued, { agency: agency.name })}</span>
            <span>{m.page}</span>
          </footer>
        </div>

        <div className="flex gap-3 border-t border-onyx/10 p-6">
          <button
            onClick={print}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-azure-800 py-3 text-sm font-semibold text-white transition hover:bg-azure-900"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" />
            </svg>
            {t.dash.common.print}
          </button>
          <button
            onClick={onClose}
            className="rounded-full border border-azure-900/15 px-6 py-3 text-sm font-semibold text-azure-800 transition hover:bg-soft-100"
          >
            {t.dash.common.close}
          </button>
        </div>
      </div>
    </div>
  );
}

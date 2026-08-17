"use client";

import { LogoMark } from "@/components/Logo";
import { fmt } from "@/lib/data";
import { useI18n } from "@/lib/i18n/context";

export type ReceiptData = {
  tenant: string;
  apartment: string;
  building: string;
  address: string;
  amount: number;
  period: string;
  paidOn: string;
  reference: string;
};

export function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: ReceiptData;
  onClose: () => void;
}) {
  const { t, f, locale } = useI18n();
  const m = t.dash.rent.receiptModal;

  const paidOn = new Date(receipt.paidOn).toLocaleDateString(
    locale === "fr" ? "fr-FR" : "en-GB",
    { day: "numeric", month: "long", year: "numeric" }
  );

  const print = () => {
    const w = window.open("", "_blank", "width=460,height=680");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${m.title} ${receipt.reference}</title>
      <style>
        body{font-family:Georgia,serif;color:#020202;margin:40px;}
        .head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #003152;padding-bottom:16px;}
        h1{font-size:19px;color:#003152;margin:0;}
        .stamp{color:#003152;border:2px solid #003152;border-radius:999px;padding:4px 14px;font-weight:bold;font-size:12px;letter-spacing:2px;}
        dt{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-top:14px;}
        dd{margin:2px 0 0;font-size:15px;}
        .amount{font-size:28px;font-weight:bold;color:#003152;margin-top:24px;}
        .foot{margin-top:32px;font-size:11px;color:#888;}
      </style></head><body>
      <div class="head"><h1>Charta Home · ${m.title}</h1><span class="stamp">${m.paid}</span></div>
      <dl>
        <dt>${m.title}</dt><dd>${receipt.reference}</dd>
        <dt>${m.tenant}</dt><dd>${receipt.tenant}</dd>
        <dt>${m.property}</dt><dd>${receipt.apartment}, ${receipt.building}<br/>${receipt.address}</dd>
        <dt>${m.period}</dt><dd>${receipt.period}</dd>
        <dt>${m.paidOn}</dt><dd>${paidOn}</dd>
      </dl>
      <p class="amount">${fmt(receipt.amount)}</p>
      <p class="foot">${f(m.issued, { agency: "Horizon Realty" })}</p>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-onyx/60 p-5 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-8 text-onyx shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-azure-800 pb-5">
          <div className="flex items-center gap-3">
            <LogoMark className="h-10 w-10" />
            <div>
              <p className="font-serif text-lg font-semibold text-azure-800">{m.title}</p>
              <p className="text-xs text-onyx/45">{receipt.reference}</p>
            </div>
          </div>
          <span className="rounded-full border-2 border-azure-800 px-4 py-1 text-xs font-bold uppercase tracking-widest text-azure-800">
            {m.paid}
          </span>
        </div>

        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-onyx/40">
              {m.tenant}
            </dt>
            <dd className="mt-0.5 font-semibold">{receipt.tenant}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-onyx/40">
              {m.property}
            </dt>
            <dd className="mt-0.5 font-semibold">
              {receipt.apartment}, {receipt.building}
            </dd>
            <dd className="text-onyx/55">{receipt.address}</dd>
          </div>
          <div className="flex gap-10">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-onyx/40">
                {m.period}
              </dt>
              <dd className="mt-0.5 font-semibold">{receipt.period}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-onyx/40">
                {m.paidOn}
              </dt>
              <dd className="mt-0.5 font-semibold">{paidOn}</dd>
            </div>
          </div>
        </dl>

        <p className="mt-6 text-3xl font-extrabold tracking-tight text-azure-800">
          {fmt(receipt.amount)}
        </p>

        <div className="mt-8 flex gap-3">
          <button
            onClick={print}
            className="flex-1 rounded-full bg-azure-800 py-3 text-sm font-semibold text-white transition hover:bg-azure-900"
          >
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

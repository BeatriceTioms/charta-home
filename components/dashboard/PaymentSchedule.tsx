"use client";

import { useMemo } from "react";
import { periodValue, type Payment } from "@/lib/data";
import { useMoney } from "@/lib/money";
import { useI18n } from "@/lib/i18n/context";

/**
 * A tenant's periods, at a glance.
 *
 * The payment history is a table, which answers "what happened" but not "are
 * we straight". Somebody chasing rent wants the second question, and wants it
 * without reading rows: which months are settled, which are not, and whether
 * this tenant is ahead or behind. A strip of periods answers that in one look,
 * and the table underneath still holds the detail.
 *
 * Periods paid in advance are the reason this earns its place. A tenant who
 * has paid the year reads as six green squares, which is instantly different
 * from a tenant who has paid this month and nothing else.
 */
export function PaymentSchedule({ payments }: { payments: Payment[] }) {
  const { t } = useI18n();
  const { fmt } = useMoney();
  const s = t.dash.apartment.schedule;

  // Oldest first here, because a schedule reads left to right in time.
  const ordered = useMemo(
    () => [...payments].sort((a, b) => periodValue(a.month) - periodValue(b.month)),
    [payments]
  );

  if (ordered.length === 0) {
    return <p className="text-sm text-onyx/45 dark:text-white/45">{s.empty}</p>;
  }

  const paid = ordered.filter((p) => p.status === "paid").length;
  const overdue = ordered.filter((p) => p.status === "overdue").length;

  // Anything settled beyond the current period is rent paid in advance, which
  // is worth saying out loud rather than leaving to be counted off the strip.
  const now = new Date();
  const thisPeriod = `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][now.getMonth()]} ${now.getFullYear()}`;
  const ahead = ordered.filter(
    (p) => p.status === "paid" && periodValue(p.month) > periodValue(thisPeriod)
  ).length;
  const withProof = ordered.filter((p) => p.proof).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-semibold text-azure-950 dark:text-white">
          {paid}/{ordered.length} {s.settled}
        </span>
        {overdue > 0 && (
          <span className="font-semibold text-red-600 dark:text-red-400">
            {overdue} {s.late}
          </span>
        )}
        {withProof > 0 && (
          <span className="font-semibold text-onyx/50 dark:text-white/50">
            {withProof} {s.withProof}
          </span>
        )}
        {ahead > 0 && (
          <span className="font-semibold text-azure-600 dark:text-soft-500">
            {ahead} {s.inAdvance}
          </span>
        )}
      </div>

      {/* A row per period rather than a strip of chips: the month, what it
          was, when it settled and the slip behind it all line up in columns,
          so a slip sits beside the month it belongs to instead of being a
          mark inside it. */}
      <div className="divide-y divide-azure-900/8 dark:divide-white/8">
        {ordered.map((p) => {
          const tone =
            p.status === "paid"
              ? "bg-soft-500 text-azure-950"
              : p.status === "overdue"
                ? "bg-red-500/15 text-red-700 dark:text-red-300"
                : "bg-azure-900/8 text-onyx/55 dark:bg-white/10 dark:text-white/55";

          return (
            <div key={p.month} className="flex items-center gap-3 py-2">
              <span className="w-20 shrink-0 text-[13px] font-bold text-azure-950 dark:text-white">
                {p.month}
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>
                {t.dash.status[p.status]}
              </span>
              {p.proof ? (
                <a
                  href={p.proof}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-[5.5rem] shrink-0 items-center justify-center gap-1.5 rounded-full border border-azure-900/15 px-3 py-1 text-[11px] font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-soft-500 dark:hover:bg-white/10"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                  </svg>
                  {s.proof}
                </a>
              ) : (
                <span className="w-[5.5rem] shrink-0" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate text-right text-[13px] text-onyx/55 dark:text-white/55">
                {fmt(p.amount)}
                {p.status === "paid" && p.paidOn ? ` · ${s.paidOn} ${p.paidOn}` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

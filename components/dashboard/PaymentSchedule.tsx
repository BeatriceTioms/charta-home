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

      <div className="flex flex-wrap gap-1.5">
        {ordered.map((p) => {
          const tone =
            p.status === "paid"
              ? "bg-soft-500 text-azure-950 border-soft-500"
              : p.status === "overdue"
                ? "bg-red-500/12 text-red-700 border-red-500/35 dark:text-red-300"
                : "bg-transparent text-onyx/45 border-azure-900/15 dark:text-white/45 dark:border-white/15";

          const title = `${p.month} · ${fmt(p.amount)} · ${
            p.status === "paid" && p.paidOn
              ? `${s.paidOn} ${p.paidOn}`
              : t.dash.status[p.status]
          }`;

          // A settled period with a slip behind it opens the slip. It is the
          // answer to "are we sure this was paid", and it was being stored
          // where nobody could reach it.
          const body = (
            <>
              {p.month}
              {p.proof && (
                <svg
                  viewBox="0 0 24 24"
                  className="ml-1.5 inline h-3 w-3 align-[-1px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
              )}
            </>
          );

          const shape = `rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${tone}`;

          return p.proof ? (
            <a
              key={p.month}
              href={p.proof}
              target="_blank"
              rel="noopener noreferrer"
              title={`${title} · ${s.viewProof}`}
              className={`${shape} transition hover:opacity-80`}
            >
              {body}
            </a>
          ) : (
            <span key={p.month} title={title} className={shape}>
              {body}
            </span>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { absoluteLabel, exactLabel, relativeLabel } from "@/lib/relative-time";

/**
 * When something happened, in words, from the timestamp on the row.
 *
 * The three times on the recent activity card used to be fixed strings, so a
 * payment recorded in March read "2 hours ago" in September. These come from
 * the record, which means they need a clock, and a clock is the one thing a
 * server render and a browser render never agree on. Two things follow: the
 * first paint uses the row's own moment as the reference, so the server and
 * the browser produce the same words for it, and the exact moment is on the
 * element either way, so hovering gives the date no phrasing can be wrong
 * about.
 */
export function RelativeTime({ at, className }: { at: string; className?: string }) {
  const { locale } = useI18n();
  const tag = locale === "fr" ? "fr-FR" : "en-GB";

  // Set once on mount. Nothing on this card changes phrase while it is being
  // looked at, and an interval would rerender the dashboard once a minute for
  // a line of grey text.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  if (Number.isNaN(Date.parse(at))) return null;

  return (
    <p
      className={className ?? "mt-1.5 text-[11px] text-onyx/35 dark:text-white/35"}
      suppressHydrationWarning
    >
      <time dateTime={at} title={exactLabel(at, tag)}>
        {now === null ? absoluteLabel(at, tag) : relativeLabel(at, now, tag)}
      </time>
    </p>
  );
}

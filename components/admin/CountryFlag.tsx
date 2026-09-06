import * as Flags from "country-flag-icons/react/3x2";
import { COUNTRY_CODES } from "@/lib/country-codes";

/**
 * A country's flag, drawn rather than typed.
 *
 * The product uses no emoji, and a flag is the one place that rule bites: the
 * regional indicator pair a keyboard produces renders as a different picture
 * on every platform and as two letters on some. These are the flags of every
 * country the signup form offers, as SVG, with an ISO chip for anything the
 * map does not know so the column never goes blank.
 */
export function CountryFlag({ country, className = "h-4 w-6" }: { country: string; className?: string }) {
  const code = COUNTRY_CODES[country] ?? (/^[A-Z]{2}$/.test(country) ? country : null);
  const Flag = code ? (Flags as Record<string, React.ComponentType<{ title?: string; className?: string }> | undefined>)[code] : undefined;

  if (!Flag) {
    return (
      <span
        title={country}
        className={`${className} inline-grid place-items-center rounded-[3px] border border-azure-900/15 bg-azure-900/5 text-[9px] font-bold leading-none text-azure-900 dark:border-white/15 dark:bg-white/10 dark:text-white`}
      >
        {(code ?? country.slice(0, 2)).toUpperCase()}
      </span>
    );
  }
  return <Flag title={country} className={`${className} shrink-0 rounded-[3px] shadow-sm ring-1 ring-black/10`} />;
}

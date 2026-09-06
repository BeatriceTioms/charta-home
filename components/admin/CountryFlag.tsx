/**
 * A country's flag, drawn rather than typed.
 *
 * The product uses no emoji, and a flag is the one place that rule bites: the
 * regional indicator pair a keyboard produces renders as a different picture
 * on every platform and as two letters on some. These are the flags of the
 * countries the platform sells in and their neighbours, as plain SVG, with an
 * ISO chip for anywhere else so the column never goes blank.
 */

const CODES: Record<string, string> = {
  Guinea: "GN", Cameroon: "CM", Senegal: "SN", Mali: "ML", "Ivory Coast": "CI",
  Chad: "TD", Gabon: "GA", Benin: "BJ", Togo: "TG", "Burkina Faso": "BF",
  France: "FR", Niger: "NE", Congo: "CG", "Guinea Bissau": "GW", Ghana: "GH",
  Nigeria: "NG", Morocco: "MA", Belgium: "BE", "United States": "US", Canada: "CA",
};

/** A five point star centred on (0,0) with radius 1. */
const STAR = "0,-1 0.588,0.809 -0.951,-0.309 0.951,-0.309 -0.588,0.809";

function Vertical({ colours }: { colours: [string, string, string] }) {
  return (
    <>
      <rect x="0" y="0" width="1" height="2" fill={colours[0]} />
      <rect x="1" y="0" width="1" height="2" fill={colours[1]} />
      <rect x="2" y="0" width="1" height="2" fill={colours[2]} />
    </>
  );
}

function Horizontal({ colours }: { colours: [string, string, string] }) {
  return (
    <>
      <rect x="0" y="0" width="3" height="0.667" fill={colours[0]} />
      <rect x="0" y="0.667" width="3" height="0.667" fill={colours[1]} />
      <rect x="0" y="1.333" width="3" height="0.667" fill={colours[2]} />
    </>
  );
}

function draw(country: string): React.ReactNode | null {
  switch (country) {
    case "Guinea": return <Vertical colours={["#CE1126", "#FCD116", "#009460"]} />;
    case "Mali": return <Vertical colours={["#14B53A", "#FCD116", "#CE1126"]} />;
    case "Chad": return <Vertical colours={["#002664", "#FECB00", "#C60C30"]} />;
    case "Ivory Coast": return <Vertical colours={["#F77F00", "#FFFFFF", "#009E60"]} />;
    case "France": return <Vertical colours={["#0055A4", "#FFFFFF", "#EF4135"]} />;
    case "Belgium": return <Vertical colours={["#000000", "#FDDA24", "#EF3340"]} />;
    case "Nigeria": return <Vertical colours={["#008751", "#FFFFFF", "#008751"]} />;
    case "Gabon": return <Horizontal colours={["#009E60", "#FCD116", "#3A75C4"]} />;
    case "Cameroon":
      return (
        <>
          <Vertical colours={["#007A5E", "#CE1126", "#FCD116"]} />
          <polygon points={STAR} fill="#FCD116" transform="translate(1.5 1) scale(0.38)" />
        </>
      );
    case "Senegal":
      return (
        <>
          <Vertical colours={["#00853F", "#FDEF42", "#E31B23"]} />
          <polygon points={STAR} fill="#00853F" transform="translate(1.5 1) scale(0.38)" />
        </>
      );
    case "Burkina Faso":
      return (
        <>
          <rect x="0" y="0" width="3" height="1" fill="#EF2B2D" />
          <rect x="0" y="1" width="3" height="1" fill="#009E49" />
          <polygon points={STAR} fill="#FCD116" transform="translate(1.5 1) scale(0.42)" />
        </>
      );
    case "Ghana":
      return (
        <>
          <Horizontal colours={["#CE1126", "#FCD116", "#006B3F"]} />
          <polygon points={STAR} fill="#000000" transform="translate(1.5 1) scale(0.3)" />
        </>
      );
    case "Benin":
      return (
        <>
          <rect x="0" y="0" width="3" height="1" fill="#FCD116" />
          <rect x="0" y="1" width="3" height="1" fill="#E8112D" />
          <rect x="0" y="0" width="1.2" height="2" fill="#008751" />
        </>
      );
    case "Togo":
      return (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x="0" y={i * 0.4} width="3" height="0.4" fill={i % 2 === 0 ? "#006A4E" : "#FFCE00"} />
          ))}
          <rect x="0" y="0" width="1.2" height="1.2" fill="#D21034" />
          <polygon points={STAR} fill="#FFFFFF" transform="translate(0.6 0.6) scale(0.42)" />
        </>
      );
    case "Niger":
      return (
        <>
          <Horizontal colours={["#E05206", "#FFFFFF", "#0DB02B"]} />
          <circle cx="1.5" cy="1" r="0.28" fill="#E05206" />
        </>
      );
    case "Morocco":
      return (
        <>
          <rect x="0" y="0" width="3" height="2" fill="#C1272D" />
          <polygon points={STAR} fill="none" stroke="#006233" strokeWidth="0.12" transform="translate(1.5 1) scale(0.5)" />
        </>
      );
    default:
      return null;
  }
}

export function CountryFlag({ country, className = "h-4 w-6" }: { country: string; className?: string }) {
  const art = draw(country);
  const code = CODES[country] ?? country.slice(0, 2).toUpperCase();
  if (!art) {
    return (
      <span
        title={country}
        className={`${className} inline-grid place-items-center rounded-[3px] border border-azure-900/15 bg-azure-900/5 text-[9px] font-bold leading-none text-azure-900 dark:border-white/15 dark:bg-white/10 dark:text-white`}
      >
        {code}
      </span>
    );
  }
  return (
    <svg
      viewBox="0 0 3 2"
      role="img"
      aria-label={country}
      className={`${className} shrink-0 rounded-[3px] shadow-sm ring-1 ring-black/10`}
      preserveAspectRatio="none"
    >
      <title>{country}</title>
      {art}
    </svg>
  );
}

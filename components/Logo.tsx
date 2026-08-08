import Link from "next/link";

export function LogoMark({
  className = "h-10 w-10",
  color = "#003152",
  door = "#ffffff",
  wedge = "#addfe1",
}: {
  className?: string;
  color?: string;
  door?: string;
  wedge?: string;
}) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {/* C ring, open on the right */}
      <path
        d="M 70 15.4 A 40 40 0 1 0 70 84.6"
        fill="none"
        stroke={color}
        strokeWidth="15"
      />
      {/* H */}
      <rect x="35" y="23" width="11" height="54" fill={color} />
      <rect x="53" y="23" width="12" height="61" fill={color} />
      <rect x="43" y="45" width="14" height="11" fill={color} />
      {/* light spilling from the door */}
      <polygon points="54,84 71,84 54,74" fill={wedge} />
      {/* open door cut into the right leg */}
      <path d="M 55.5 60 L 63 58.5 L 63 82.5 L 55.5 81 Z" fill={door} />
      <circle cx="57.6" cy="70.5" r="1.2" fill={color} />
    </svg>
  );
}

export function Logo({
  href = "/",
  dark = false,
  markClassName = "h-10 w-10",
  textClassName = "text-2xl",
}: {
  href?: string;
  dark?: boolean;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <LogoMark
        className={markClassName}
        color={dark ? "#ffffff" : "#003152"}
        door={dark ? "#003152" : "#ffffff"}
      />
      <span
        className={`font-serif tracking-tight ${textClassName} ${
          dark ? "text-white" : "text-azure-800"
        }`}
      >
        <span className="font-semibold">Charta</span>{" "}
        <span className="font-normal opacity-80">Home</span>
      </span>
    </Link>
  );
}

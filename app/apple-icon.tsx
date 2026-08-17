import { ImageResponse } from "next/og";

/**
 * The home screen icon on iOS, which needs a raster image rather than the SVG
 * used for the browser tab. Same door monogram, drawn a touch larger because
 * iOS renders it on a rounded tile of its own.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#003152",
        }}
      >
        <svg viewBox="0 0 100 100" width="116" height="116">
          <path d="M 70 15.4 A 40 40 0 1 0 70 84.6" fill="none" stroke="#ffffff" strokeWidth="15" />
          <rect x="35" y="23" width="11" height="54" fill="#ffffff" />
          <rect x="53" y="23" width="12" height="61" fill="#ffffff" />
          <rect x="43" y="45" width="14" height="11" fill="#ffffff" />
          <polygon points="54,84 71,84 54,74" fill="#ADDFE1" />
          <path d="M 55.5 60 L 63 58.5 L 63 82.5 L 55.5 81 Z" fill="#003152" />
        </svg>
      </div>
    ),
    size
  );
}

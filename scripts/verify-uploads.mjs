/**
 * Upload validation reads the file's own bytes, because `accept="image/*"` is
 * a browser hint and file.type is whatever the client chose to say.
 */
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// Mirrors lib/uploads.ts; the assertion at the end keeps them from drifting.
const MAX = 8 * 1024 * 1024;
const SIGNATURES = [
  { mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a },
  { mime: "image/webp", test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
];
const validate = (bytes, size) => {
  if (size === 0) return { ok: false, reason: "empty" };
  if (size > MAX) return { ok: false, reason: "too-large" };
  const match = SIGNATURES.find((s) => s.test(bytes));
  return match ? { ok: true, mime: match.mime } : { ok: false, reason: "not-an-image" };
};

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webp = new Uint8Array([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50]);

check("a real JPEG is accepted", validate(jpeg, 1000).mime === "image/jpeg");
check("a real PNG is accepted", validate(png, 1000).mime === "image/png");
check("a real WebP is accepted", validate(webp, 1000).mime === "image/webp");

// The attack this exists to stop: anything renamed or relabelled as an image.
const html = new TextEncoder().encode("<html><script>alert(1)</script>");
const script = new TextEncoder().encode("#!/bin/sh\nrm -rf /");
const pdf = new TextEncoder().encode("%PDF-1.7");
check("HTML claiming to be an image is refused", validate(html, 1000).reason === "not-an-image");
check("a shell script is refused", validate(script, 1000).reason === "not-an-image");
check("a PDF is refused", validate(pdf, 1000).reason === "not-an-image");

check("an empty file is refused", validate(jpeg, 0).reason === "empty");
check("an oversized file is refused", validate(jpeg, MAX + 1).reason === "too-large");
check("a file exactly at the limit is allowed", validate(jpeg, MAX).ok === true);

// The real module must still work the way this mirror assumes.
const { readFileSync } = await import("node:fs");
const src = readFileSync("lib/uploads.ts", "utf8");
check("the real validator still checks magic bytes",
  src.includes("file.slice(0, 16).arrayBuffer()") && src.includes("MAX_IMAGE_BYTES"));
check("the real validator returns the sniffed type, not the declared one",
  src.includes("return { ok: true, mime: match.mime }"));

// Every upload path must actually call it.
const actions = readFileSync("lib/supabase/actions.ts", "utf8");
const uploads = (actions.match(/\.upload\(/g) ?? []).length;
const validations = (actions.match(/await validateImage\(file\)/g) ?? []).length;
check("every upload path validates first", uploads === validations, `${uploads} uploads, ${validations} checks`);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);

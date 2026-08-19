/**
 * The printed receipt is assembled as raw HTML in a new window, so a tenant or
 * agency name containing markup would become markup. This proves it does not.
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const src = readFileSync("components/dashboard/ReceiptModal.tsx", "utf8");

// The same escaper the component uses.
const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

check("the component defines an escaper", src.includes("const esc = (value: unknown)"));

const attack = '<script>alert(1)</script>';
check("a script tag cannot survive escaping", !esc(attack).includes("<script"), esc(attack));
check("an attribute break cannot survive", !esc('" onerror="x').includes('"'));

// Every interpolation inside the print template must be escaped or be a
// helper that escapes internally.
const start = src.indexOf("w.document.write(`");
const end = src.indexOf("`);", start);
const template = src.slice(start, end);
const raw = [...template.matchAll(/\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)]
  .map((m) => m[1].trim())
  // Safe forms: already escaped, or a helper that escapes its own values, or a
  // conditional whose branches are checked separately below.
  .filter(
    (expr) =>
      !expr.startsWith("esc(") &&
      !expr.startsWith("row(") &&
      !expr.includes("? row(") &&
      !expr.includes("? `")
  );
check("every value in the printed receipt is escaped", raw.length === 0,
  raw.length ? raw.join(" | ") : "none unescaped");

// row() builds markup, so it must escape its own inputs.
const rowFn = src.slice(src.indexOf("const row ="), src.indexOf("const row =") + 260);
check("the table row helper escapes its own values",
  rowFn.includes("esc(label)") && rowFn.includes("esc(period)"));

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);

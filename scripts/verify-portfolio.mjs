/**
 * Charta Home · the order loadPortfolio builds things in
 *
 * loadPortfolio reads a dozen tables, turns most of them into lookup maps,
 * and then walks the buildings once, reaching into those maps for every
 * unit. A map declared after that walk is a reference error at render time
 * and nothing before it: the types are fine, the build is fine, and an
 * agency with no buildings never runs the walk, so it looks fine in testing
 * too. The first agency with a building gets a blank page.
 *
 * That shipped once. This holds the order: every lookup the walk reaches
 * for is built above it.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const src = await readFile(path.join(process.cwd(), "lib", "supabase", "adapters.ts"), "utf8");

const walkAt = src.indexOf("const buildings: Building[] = buildingRows.map(");
check("the buildings walk is where it is expected", walkAt > 0);

// Everything the walk reaches for, by name, taken from the walk's own body
// rather than from a list somebody has to remember to update.
const walkEnd = src.indexOf("\n  const ", walkAt + 10) > 0 ? src.indexOf("\n  } as Building;", walkAt) : src.length;
const body = src.slice(walkAt, walkEnd > walkAt ? walkEnd : src.length);
const used = [...new Set([...body.matchAll(/\b(\w+(?:By\w+))\.get\(/g)].map((m) => m[1]))];
check("the walk reaches for lookup maps", used.length >= 4, used.join(", "));

const late = used.filter((name) => {
  const declaredAt = src.indexOf(`const ${name}`);
  return declaredAt === -1 || declaredAt > walkAt;
});
check(
  "every lookup the walk uses is built before it",
  late.length === 0,
  late.length ? `declared after the walk: ${late.join(", ")}` : `${used.length} maps, all above`
);

// The same trap, one level out: anything the walk closes over.
for (const name of ["stays", "ratesByApartment"]) {
  const at = src.indexOf(`const ${name}`);
  check(`${name} is built before the walk`, at > 0 && at < walkAt, at > walkAt ? "declared after it" : "");
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);

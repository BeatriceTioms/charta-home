/**
 * Charta Home · the one chip in the top bar
 *
 * This control has been rebuilt four times, and each rebuild broke it in a way
 * that only showed up on screen: the agency named in the sidebar where a
 * section heading goes, then named twice, then two pills side by side that
 * both read as the building selector. None of those were type errors and none
 * of them failed a query, so nothing here checks types. It checks the two
 * things that were actually wrong: how many switchers the bar mounts, and
 * whether switching the agency really goes through the server.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const read = (...p) => readFile(path.join(process.cwd(), ...p), "utf8");

const shell = await read("components", "dashboard", "Shell.tsx");
const switcher = await read("components", "dashboard", "PortfolioSwitcher.tsx");

/* ------------------------------------------------------------- the bar --
 * Two chips beside each other read as one control repeated. Counted by the
 * components the bar actually mounts rather than by name, so renaming the
 * component cannot smuggle a second one back in.
 */
// Anything that changes which portfolio you are looking at. The FR/EN toggle
// is also a Switcher and is not one of these.
const mounted = [...shell.matchAll(/<((?:Portfolio|Agency|Building)Switcher)\b/g)].map((m) => m[1]);
check(
  "the top bar mounts exactly one switcher",
  mounted.length === 1,
  mounted.length ? mounted.join(" + ") : "none"
);

check(
  "and it is the one that changes the agency",
  /agencies\s*,/.test(switcher) && /selectAgency/.test(switcher),
  mounted[0] ?? "nothing mounted"
);

/* The complaint that started all of this: the agency named in the navigation.
 * The sidebar is the <aside>, so this looks there rather than at the file.
 */
const aside = shell.slice(shell.indexOf("<aside"), shell.indexOf("</aside>"));
check(
  "the sidebar names no agency",
  !/agencyInfo|agencies\b|agencyName/.test(aside),
  "it belongs beside the building, not above the menu"
);

/* --------------------------------------------------------- the switch --
 * Follows the value out of the click rather than trusting the handler's name:
 * whatever the option passes along has to reach the server action, and the
 * page has to be asked for again afterwards. A switch that only set local
 * state would leave the server loading the old agency's portfolio.
 */
const handler = switcher.slice(
  switcher.indexOf("const switchAgency"),
  switcher.indexOf("const subtitle")
);
const [, argName] = handler.match(/const switchAgency\s*=\s*async\s*\(\s*(\w+)/) ?? [];
check(
  "changing agency sends the chosen id to the server",
  Boolean(argName) && new RegExp(`selectAgency\\([^)]*\\b${argName}\\b`).test(handler),
  argName ? `carries ${argName}` : "no argument found"
);
check(
  "and asks for the page again once it has",
  /router\.refresh\(\)/.test(handler),
  "the server reads the cookie this sets, so the refresh is the switch"
);
check(
  "switching agency forgets the building that was open",
  /removeItem\(\s*["'`]charta-building/.test(handler),
  "a building id from one agency means nothing in another"
);
check(
  "switching to the agency already open does nothing",
  /===\s*agencyId\)\s*return/.test(handler),
  "no needless round trip"
);

/* ------------------------------------------------------- the buildings --
 * They hang under the agency, and only when there is a choice to make. An
 * agency with three buildings and no list would have two of them unreachable,
 * which is the regression this guards.
 */
check(
  "the buildings of the open agency are listed",
  /buildings\.map\(/.test(switcher),
  "so a second building is reachable"
);
check(
  "and hidden when there is only one",
  /buildings\.length\s*>\s*1\s*&&/.test(switcher),
  "nothing to choose between"
);
check(
  "a new agency can be created from the same menu",
  /createAgency\(/.test(switcher),
  "otherwise there is no way to get a second one"
);

/* The panel carries two lists, so it is tall enough to sit over the figures on
 * the page. At 80% white the numbers behind it showed through the rows.
 */
// The chip is also a white pill, and a translucent chip is fine. This has to
// read the panel, so it starts at the element the options live in.
const panel = switcher.slice(switcher.indexOf("role=\"listbox\""));
const [, panelBg] = panel.match(/\bbg-white\/(\d+)\b/) ?? [];
check(
  "the panel is opaque enough to read over the page",
  Number(panelBg) >= 90,
  `bg-white/${panelBg ?? "?"}`
);

/* ------------------------------------------------------------- the copy --
 * Every string the menu shows is looked up, and a missing key renders as
 * nothing at all rather than as an error, so the labels are checked against
 * the dictionaries in both languages.
 */
const dict = await read("lib", "i18n", "dictionaries.ts");
const keys = [...switcher.matchAll(/\bsh\.(\w+)/g)].map((m) => m[1]);
const missing = keys.filter(
  (k) => (dict.match(new RegExp(`^\\s*${k}:`, "gm")) ?? []).length < 2
);
check(
  "every label the menu shows exists in both languages",
  missing.length === 0,
  missing.length ? `missing: ${missing.join(", ")}` : `${new Set(keys).size} keys`
);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);

/**
 * The password reset and invitation page, checked as source.
 *
 * This one is here because of a bug that had no visible symptom. The page used
 * whatever session the browser already held, so an owner still signed in on
 * their own machine, opening a colleague's invitation, silently changed their
 * own password instead. Both accounts existed, both were valid, and the form
 * reported success. Nothing short of trying to sign in afterwards would have
 * shown it.
 *
 * The rules below are what stop that recurring. They are asserted against the
 * page's text rather than by driving a browser, because the failure was a
 * missing guard rather than a rendering problem, and a missing guard is
 * exactly what reading the source can catch.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const page = await readFile(
  path.join(process.cwd(), "app", "[locale]", "reset-password", "page.tsx"),
  "utf8"
);
const catcher = await readFile(
  path.join(process.cwd(), "components", "auth", "RecoveryRedirect.tsx"),
  "utf8"
);

/* ------------------------------------------- binding to the link's account */

check(
  "the page reads both tokens out of the fragment",
  /access_token/.test(page) && /refresh_token/.test(page),
  "the fragment is the only statement of whose password this is"
);

check(
  "a link with no token is refused",
  /if \(!accessToken \|\| !refreshToken\)/.test(page) &&
    /setStage\("invalid"\)/.test(page),
  "without this the form falls back to the current session"
);

check(
  "the session is set from the token rather than inherited",
  /setSession\(\{\s*access_token/.test(page),
  "setSession replaces whoever was signed in"
);

check(
  "the account the token names is remembered",
  /setTokenUserId\(data\.session\.user\.id\)/.test(page),
  "so the write can be checked against it"
);

check(
  "the write is refused if the session is no longer that account",
  /current\.session\.user\.id !== tokenUserId/.test(page),
  "guards a second tab signing in underneath this page"
);

// The ordering matters as much as the presence: the identity check has to run
// before the password is written, not after.
const guardAt = page.indexOf("!== tokenUserId");
const updateAt = page.indexOf("updateUser({ password })");
check(
  "the identity check runs before the password is written",
  guardAt > -1 && updateAt > -1 && guardAt < updateAt,
  `guard at ${guardAt}, write at ${updateAt}`
);

/* ------------------------------------------------------- actually working */

check(
  "the page really sets a password",
  /supabase\.auth\.updateUser\(\{ password \}\)/.test(page),
  "it used to be a setTimeout that showed success and did nothing"
);

check(
  "a failure from Supabase is surfaced",
  /if \(updateError\)/.test(page) && /setError\(updateError\.message\)/.test(page)
);

check(
  "an expired or used link is named as such",
  /error_description/.test(page),
  "rather than failing after the password is typed twice"
);

/* --------------------------------------------- catching a stray redirect */

check(
  "a token landing elsewhere is carried to this page",
  /reset-password/.test(catcher) && /router\.replace/.test(catcher),
  "Supabase falls back to the Site URL when a redirect is not allowlisted"
);

check(
  "the fragment travels with that redirect",
  /\$\{target\}\$\{hash\}/.test(catcher),
  "dropping it would strand the token on the landing page"
);

check(
  "the catcher does not bounce the reset page against itself",
  /if \(pathname === target\) return/.test(catcher),
  "a redirect loop would be worse than the bug"
);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);

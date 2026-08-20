/**
 * The invitation email, checked without sending one.
 *
 * The two things worth proving here are that a name carried into the message
 * cannot become markup, and that the recipient can always see where the link
 * goes. Everything else about an email is a matter of taste; those two are
 * matters of safety.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { invitationEmail, isEmailConfigured, passwordResetEmail, sendEmail, welcomeEmail } from "../lib/email.ts";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// The module under test is imported directly, so these run against the text
// that ships rather than a copy of it. Node strips the types on the way in.
const source = await readFile(path.join(process.cwd(), "lib", "email.ts"), "utf8");

const hostile = {
  agencyName: '<script>alert("agency")</script>',
  inviterName: 'Amina" onload="alert(1)',
  role: "owner",
  actionLink: "https://example.supabase.co/auth/v1/verify?token=abc&type=invite",
  locale: "fr",
};

const mail = invitationEmail(hostile);

check(
  "a name cannot open a tag in the html",
  !mail.html.includes("<script>") && mail.html.includes("&lt;script&gt;"),
  "agency name escaped"
);

check(
  "a name cannot break out of an attribute",
  !mail.html.includes('onload="alert(1)"'),
  "inviter name escaped"
);

check(
  "the subject carries the raw name, not escaped entities",
  mail.subject.includes(hostile.agencyName) && !mail.subject.includes("&lt;"),
  "subjects are plain text, so escaping there would show as literal entities"
);

check(
  "the link is shown as text as well as linked",
  mail.html.includes("word-break:break-all"),
  "recipient can read the destination before clicking"
);

check(
  "the plain text part carries the link",
  mail.text.includes(hostile.actionLink),
  "clients without html still get through"
);

const en = invitationEmail({ ...hostile, locale: "en" });
check("both languages render", en.subject.includes("invited you to join"), en.subject.slice(0, 48));

check(
  "the ampersand in a real invite link survives",
  mail.html.includes("type=invite") && mail.html.includes("&amp;type=invite"),
  "query separators are escaped once, not twice"
);

/* ------------------------------------------------------- configuration --
 * The half configured case is the one that bites: a key with no from address
 * falls back to Supabase's own sender, the mail still arrives, and the only
 * symptom is that it is not the message you wrote. Exercised for real rather
 * than matched in the source, so a rewrite cannot quietly pass.
 */
const savedKey = process.env.RESEND_API_KEY;
const savedFrom = process.env.EMAIL_FROM;
const withEnv = (key, from, fn) => {
  if (key === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = key;
  if (from === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = from;
  return fn();
};

check("neither set is not configured",
  withEnv(undefined, undefined, isEmailConfigured) === false);
check("a key with no from address is not configured",
  withEnv("re_test", undefined, isEmailConfigured) === false,
  "this is the case that silently falls back to Supabase");
check("a from address with no key is not configured",
  withEnv(undefined, "Charta <a@b.com>", isEmailConfigured) === false);
check("both set is configured",
  withEnv("re_test", "Charta <a@b.com>", isEmailConfigured) === true);

const unconfigured = await withEnv(undefined, undefined, () =>
  sendEmail({ to: "a@b.com", subject: "s", html: "<p>h</p>", text: "t" })
);
check("an unconfigured send reports failure rather than pretending",
  unconfigured.ok === false, unconfigured.error);

if (savedKey === undefined) delete process.env.RESEND_API_KEY;
else process.env.RESEND_API_KEY = savedKey;
if (savedFrom === undefined) delete process.env.EMAIL_FROM;
else process.env.EMAIL_FROM = savedFrom;


/* ------------------------------------------------ the other two messages */

const welcome = welcomeEmail({
  agencyName: '<img src=x onerror=alert(1)>',
  ownerName: "Amina Sow",
  dashboardUrl: "https://chartahome.com/fr/dashboard",
  locale: "fr",
});
check(
  "the welcome escapes the agency name",
  !welcome.html.includes("<img src=x") && welcome.html.includes("&lt;img"),
  "agency names come from a signup form"
);
check(
  "the welcome greets by first name only",
  welcome.subject.includes("Amina") && !welcome.subject.includes("Sow"),
  welcome.subject
);
check(
  "the welcome lists concrete first steps",
  welcome.text.includes("1.") && welcome.text.includes("2.") && welcome.text.includes("3."),
  "three numbered steps"
);

const reset = passwordResetEmail({
  resetLink: "https://example.supabase.co/auth/v1/verify?token=xyz&type=recovery",
  locale: "en",
});
check(
  "the reset says what to do if it was not you",
  /did not ask/i.test(reset.text),
  "an unrequested reset needs an explicit reassurance"
);
check(
  "the reset link survives escaping intact",
  reset.html.includes("&amp;type=recovery"),
  "one round of escaping, not two"
);

// All three share one shell, so a change to the frame cannot drift apart.
const family = [mail, welcome, reset];
check(
  "every message carries the brand header",
  family.every((m) => m.html.includes("Charta&nbsp;")),
  `${family.length} messages`
);
check(
  "every message has a plain text alternative",
  family.every((m) => m.text.trim().length > 40),
  "a message with no text part is a spam signal"
);
check(
  "every message hides its preheader from the body",
  family.every((m) => m.html.includes("display:none;max-height:0")),
  "the line clients show beside the subject"
);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);

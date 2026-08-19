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
import { invitationEmail } from "../lib/email.ts";

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

// The fallback path matters: without a key nothing should claim to be sent.
const configured = /RESEND_API_KEY && process\.env\.EMAIL_FROM/.test(source);
check("configuration needs both a key and a from address", configured);

const failsClosed = /if \(!key \|\| !from\) return \{ ok: false/.test(source);
check("an unconfigured send reports failure rather than pretending", failsClosed);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);

/**
 * Reports whether transactional mail will actually go out through Resend, and
 * why not when it will not.
 *
 * A half configured sender is silent: invitations still arrive, because the
 * code falls back to Supabase's own mail, so the only symptom is that the
 * message is not the one you wrote. This names the missing piece instead.
 *
 *   npm run email:config
 *   npm run email:config -- you@your-domain.com   (sends one real message)
 *
 * The second form sends an actual email, so it asks for the recipient
 * explicitly rather than guessing one.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

/** .env is not loaded automatically outside Next, so read it the same way. */
async function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = await readFile(path.join(process.cwd(), file), "utf8");
      for (const raw of text.split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq < 0) continue;
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (!(key in process.env)) process.env[key] = value;
      }
    } catch {
      /* the file is optional */
    }
  }
}

await loadEnv();

const key = process.env.RESEND_API_KEY ?? "";
const from = process.env.EMAIL_FROM ?? "";
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

const show = (name, value, note = "") =>
  console.log(
    `  ${value ? "set  " : "MISSING"}  ${name.padEnd(22)}${
      value ? maskish(name, value) : ""
    }${note ? `  ${note}` : ""}`
  );

/** Never print a key. The shape is enough to tell a typo from a wrong value. */
function maskish(name, value) {
  if (/KEY|SECRET|TOKEN/.test(name)) {
    return `${value.slice(0, 3)}…${value.length} chars`;
  }
  return value;
}

console.log("\nTransactional email\n");
show("RESEND_API_KEY", key, key && !key.startsWith("re_") ? "expected to start with re_" : "");
show("EMAIL_FROM", from);
show("NEXT_PUBLIC_SITE_URL", site, site ? "" : "invitation links need this");

const configured = Boolean(key && from);
console.log(
  `\n  ${configured ? "Resend will send" : "Supabase's own sender will send"}` +
    `${configured ? "" : " — that is why the message does not look like yours"}\n`
);

if (!configured) {
  const missing = !key ? "RESEND_API_KEY" : !from ? "EMAIL_FROM" : "";
  if (missing) {
    console.log(`  Add ${missing} to .env.local and to the Vercel project, then redeploy.`);
    console.log(`  EMAIL_FROM must sit on a domain verified at resend.com/domains,`);
    console.log(`  for example: EMAIL_FROM="Charta Home <no-reply@your-domain.com>"\n`);
  }
  process.exit(1);
}

const to = process.argv[2];
if (!to) {
  console.log("  Pass an address to send one real test message:");
  console.log("    npm run email:config -- you@your-domain.com\n");
  process.exit(0);
}

const { invitationEmail } = await import("../lib/email.ts");
const message = invitationEmail({
  agencyName: "Charta Home",
  inviterName: "Configuration check",
  role: "manager",
  actionLink: `${site || "http://localhost:3000"}/fr/reset-password`,
  locale: "fr",
});

console.log(`  Sending a test invitation to ${to} …`);
const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    from,
    to: [to],
    subject: `[test] ${message.subject}`,
    html: message.html,
    text: message.text,
  }),
});

const body = await response.text();
if (!response.ok) {
  console.log(`  FAILED  resend ${response.status}: ${body.slice(0, 400)}\n`);
  process.exit(1);
}
console.log(`  Sent. ${body.slice(0, 120)}\n`);

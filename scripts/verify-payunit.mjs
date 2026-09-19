/**
 * Charta Home · PayUnit, without PayUnit
 *
 * The gateway is not called here. What is checked is what would be sent to
 * it and what is made of its answers, because those are the two places a
 * payment integration goes wrong quietly: a header the gateway ignores, a
 * status spelled differently from the docs, a transaction id Orange Money
 * refuses. fetch is replaced for the run, so the requests are inspected
 * rather than made.
 */
import {
  initializeBody,
  initializePayment,
  isPayunitConfigured,
  newTransactionId,
  normalizeStatus,
  paymentStatus,
  payunitHeaders,
} from "../lib/payunit.ts";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

/* --------------------------------------------------------- configuration */
delete process.env.PAYUNIT_API_KEY;
check("unconfigured is unconfigured", isPayunitConfigured() === false);
process.env.PAYUNIT_API_KEY = "pu_test_key";
process.env.PAYUNIT_API_USER = "user_1";
process.env.PAYUNIT_API_PASSWORD = "pass:with:colons";
delete process.env.PAYUNIT_MODE;
check("all three set is configured", isPayunitConfigured() === true);

/* ---------------------------------------------------------------- headers */
const h = payunitHeaders();
check("the four headers the gateway documents are all there",
  h["x-api-key"] === "pu_test_key" && h.mode === "test" && h["Content-Type"] === "application/json" && /^Basic /.test(h.Authorization),
  Object.keys(h).join(", "));
check("basic auth is user:password, base64, and a password with colons survives",
  Buffer.from(h.Authorization.slice(6), "base64").toString() === "user_1:pass:with:colons");
check("mode defaults to test, and only the exact word live is live",
  h.mode === "test" && (process.env.PAYUNIT_MODE = "LIVE", payunitHeaders().mode === "test") && (process.env.PAYUNIT_MODE = "live", payunitHeaders().mode === "live"),
  "a typo in the env cannot move real money");
process.env.PAYUNIT_MODE = "test";

/* --------------------------------------------------------- the request */
const body = initializeBody({
  amount: 30000, currency: "XAF", transactionId: "CHABCDEF0123456789",
  returnUrl: "https://chartahome.com/fr/dashboard/settings?payment=x", notifyUrl: "https://chartahome.com/api/payunit/notify",
  description: "Charta Home Growth monthly",
});
check("the body uses the gateway's own field names",
  body.total_amount === 30000 && body.currency === "XAF" && body.transaction_id === "CHABCDEF0123456789" &&
    body.return_url.startsWith("https://") && body.notify_url.startsWith("https://") && body.payment_country === "CM",
  Object.keys(body).join(", "));

const ids = Array.from({ length: 200 }, newTransactionId);
check("a transaction id is letters and digits only, which Orange Money requires",
  ids.every((id) => /^[A-Z0-9]{10,64}$/.test(id)), ids[0]);
check("and two hundred of them are two hundred different ids", new Set(ids).size === 200);

/* --------------------------------------------------------- the answers */
check("the gateway's status spellings all map",
  normalizeStatus("SUCCESS") === "SUCCESS" && normalizeStatus("successful") === "SUCCESS" &&
    normalizeStatus("Pending") === "PENDING" && normalizeStatus("CANCELED") === "CANCELLED" &&
    normalizeStatus("FAILED") === "FAILED" && normalizeStatus("weird") === null && normalizeStatus(undefined) === null);

// fetch is replaced for the rest of the run.
const calls = [];
const realFetch = globalThis.fetch;
let nextResponse = { ok: true, status: 200, json: async () => ({}) };
globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return nextResponse; };

nextResponse = { ok: false, status: 401, json: async () => ({ status: "FAILED", message: "Invalid api key" }) };
const refusedInit = await initializePayment({
  amount: 1, currency: "XAF", transactionId: "CH0", returnUrl: "https://a.b/r", notifyUrl: "https://a.b/n", description: "d",
});
check("a refusal from the gateway is reported in its words",
  refusedInit.ok === false && refusedInit.error === "Invalid api key");

const httpInit = await initializePayment({
  amount: 1, currency: "XAF", transactionId: "CH0", returnUrl: "http://a.b/r", notifyUrl: "https://a.b/n", description: "d",
});
check("an http return address is refused before the gateway is asked",
  httpInit.ok === false && /https/.test(httpInit.error), "the gateway would refuse it less clearly");

nextResponse = { ok: true, status: 200, json: async () => ({
  status: "SUCCESS", statusCode: 200, message: "Transaction created!",
  data: { transaction_id: "pu-1", transaction_url: "https://gateway.payunit.net/#/hostedPayment/payment?t_id=abc", providers: [] },
}) };
calls.length = 0;
const opened = await initializePayment({
  amount: 30000, currency: "XAF", transactionId: "CHDEADBEEF", returnUrl: "https://a.b/r", notifyUrl: "https://a.b/n", description: "d",
});
check("a created transaction hands back the hosted checkout address",
  opened.ok === true && opened.checkoutUrl.includes("hostedPayment"));
check("the initialize request goes to the documented endpoint with the documented headers and body",
  calls.length === 1 && calls[0].url === "https://gateway.payunit.net/api/gateway/initialize" && calls[0].init.method === "POST" &&
    calls[0].init.headers["x-api-key"] === "pu_test_key" && JSON.parse(calls[0].init.body).transaction_id === "CHDEADBEEF",
  calls[0]?.url);

nextResponse = { ok: true, status: 200, json: async () => ({ data: { transaction_status: "SUCCESSFUL" } }) };
calls.length = 0;
const st = await paymentStatus("CHDEADBEEF");
check("status is asked by our own id at the documented path",
  calls.length === 1 && calls[0].url === "https://gateway.payunit.net/api/gateway/paymentstatus/CHDEADBEEF" && !calls[0].init?.method,
  calls[0]?.url);
check("and the gateway's answer comes back normalized", st.ok === true && st.status === "SUCCESS");

nextResponse = { ok: true, status: 200, json: async () => ({ transaction_status: "PENDING" }) };
const pend = await paymentStatus("CHDEADBEEF");
check("a status at the top level is read as well as one under data", pend.ok === true && pend.status === "PENDING");

nextResponse = { ok: true, status: 200, json: async () => ({ data: {} }) };
const none = await paymentStatus("CHDEADBEEF");
check("an answer with no status is a failure to ask, not a payment", none.ok === false);

globalThis.fetch = realFetch;

/* ------------------------------------------------------------ the route */
import { readFile } from "node:fs/promises";
const route = await readFile("app/api/payunit/notify/route.ts", "utf8");
const billing = await readFile("lib/billing.ts", "utf8");
check("the callback only ever names a transaction; the status endpoint decides",
  /settlePayment\(\{ providerRef: ref \}\)/.test(route) && !/final_status|settle_subscription_payment/.test(route) &&
    /paymentStatus\(row\.provider_ref\)/.test(billing),
  "nothing in the callback body is believed");
check("the callback answers 200 whatever the outcome, so the gateway does not retry a refusal forever",
  !/status: 5\d\d/.test(route));
check("a pending answer settles nothing",
  /answer\.status === "PENDING"\) return \{ ok: true, outcome: "pending"/.test(billing));


/* ------------------------------------------------ where the code is not
 * A code is the manual path's receipt. An agency that pays through the
 * gateway never gets one, so the field, the button and the column go away
 * for it, on settings and at the desk alike, and only once PayUnit is
 * really configured, so nobody is left with neither path.
 */
import { onlinePaymentCountries } from "../lib/payunit.ts";
delete process.env.PAYUNIT_API_KEY;
check("with no gateway configured, no country pays online", onlinePaymentCountries().length === 0,
  "the manual path stays until the gateway is real");
process.env.PAYUNIT_API_KEY = "k";
check("with the gateway configured, Cameroon pays online and Guinea does not",
  onlinePaymentCountries().includes("Cameroon") && !onlinePaymentCountries().includes("Guinea"));

const settings = await readFile("components/dashboard/SettingsForm.tsx", "utf8");
check("the code field is gone for an agency that pays online",
  /canEdit && !canPayOnline && \(/.test(settings) && /pc\.codeLabel/.test(settings),
  "and still there for everyone else");
check("the plan chooser offers an online agency only the gateway",
  !/pc\.orRequest/.test(settings) && /canPayOnline \? pc\.modalSubtitleOnline/.test(settings),
  "no request by email, no code to wait for");
const dash = await readFile("components/admin/AdminDashboard.tsx", "utf8");
const detail = await readFile("components/admin/AgencyDetail.tsx", "utf8");
check("the desk shows no code and no Issue button for an online agency",
  /onlineCountries\.includes\(r\.agency_country\)/.test(dash) && /a\.paysOnline/.test(dash) &&
    /paysOnline \?/.test(detail) && /\{!paysOnline && \(/.test(detail) && /issuing && !paysOnline/.test(detail),
  "row, file and modal alike");
check("the desk shows online payments on the agency's file",
  /d\.onlinePayments/.test(detail) && /online\.map\(/.test(detail));
for (const p of ["app/[locale]/admin/page.tsx", "app/[locale]/admin/agencies/[agencyId]/page.tsx"]) {
  const page = await readFile(p, "utf8");
  check(`${p.split("/").slice(-2).join("/")} hands the desk the online countries from the server`,
    /onlineCountries=\{onlinePaymentCountries\(\)\}/.test(page));
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);

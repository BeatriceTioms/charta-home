/**
 * Where this deployment lives, for links that leave the building.
 *
 * A link inside the app can be a path. A link inside an email cannot: it is
 * read on somebody else's machine, so it has to name the host. Three places
 * needed one and each wrote `process.env.NEXT_PUBLIC_SITE_URL ?? localhost`,
 * which meant that forgetting one variable sent every invitation to a password
 * page on the recipient's own computer.
 *
 * Falling back to localhost in production is the part that was wrong. Vercel
 * already publishes the deployment's own hostname, so the fallback is now the
 * real domain and localhost is reached only when actually running locally.
 */

/**
 * The origin to build outward facing links from, with no trailing slash.
 *
 * In order of preference:
 *
 *  1. `NEXT_PUBLIC_SITE_URL`, the custom domain, which is the only one that
 *     survives a project rename and is what a tenant should see.
 *  2. `VERCEL_PROJECT_PRODUCTION_URL`, the project's stable production
 *     hostname. Set by Vercel on every deployment, including previews, and it
 *     points at production rather than at the preview itself, which is what a
 *     password link should do.
 *  3. `VERCEL_URL`, this exact deployment. Only useful on a preview, and only
 *     as a last resort, because the hostname changes with every push.
 *  4. localhost, for development.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return normalise(configured);

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return normalise(production);

  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) return normalise(deployment);

  return "http://localhost:3000";
}

/**
 * Vercel supplies a bare hostname with no scheme, while a person setting
 * NEXT_PUBLIC_SITE_URL by hand may include one, a trailing slash, or both.
 */
function normalise(value: string): string {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, "");
}

/**
 * Whether outward facing links will actually reach this deployment.
 *
 * False means every link in an email points at the reader's own machine, which
 * is worth saying out loud rather than discovering from a confused recipient.
 */
export function isSiteUrlReachable(): boolean {
  return !siteUrl().startsWith("http://localhost");
}

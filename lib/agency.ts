import { cookies } from "next/headers";

/**
 * Which agency the dashboard is currently showing.
 *
 * One person can belong to several agencies. The database has always modelled
 * that, since a membership is a person and an agency rather than a column on
 * either, and row level security answers with every agency they belong to. The
 * application had simply never asked which one: it took the first row it saw.
 *
 * The choice lives in a cookie rather than in local storage, because the
 * portfolio is read on the server and the server cannot see local storage. The
 * building switcher can stay where it is: a building is chosen after the data
 * has arrived, an agency decides what arrives at all.
 */
export const AGENCY_COOKIE = "charta-agency";

/** A year: this is a preference, and being asked again every week is a nuisance. */
export const AGENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The agency asked for, which is a request and not a permission. Whatever
 * comes back is checked against the agencies the reader actually belongs to
 * before anything is loaded for it, so a hand edited cookie buys nothing.
 */
export async function requestedAgencyId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(AGENCY_COOKIE)?.value ?? null;
}

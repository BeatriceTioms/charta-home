"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { AGENCY_COOKIE, AGENCY_COOKIE_MAX_AGE } from "@/lib/agency";
import { invitationEmail, isEmailConfigured, planRequestEmail, planRequestReceiptEmail, sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/data";
import { isPlanCode, planName, type BillingCycle } from "@/lib/pricing";
import { toE164 } from "@/lib/phone";
import { isSiteUrlReachable, siteUrl } from "@/lib/site-url";
import { initializePayment, isPayunitConfigured, newTransactionId } from "@/lib/payunit";
import { settlePayment } from "@/lib/billing";
import { validateImage } from "@/lib/uploads";
import { createAdminClient, createClient } from "./server";
import type { LeaseCycle, MemberRole, PaymentMethod, ReportChannel, TicketPriority } from "./types";

/**
 * Write helpers. Anything with an invariant goes through a Postgres function so
 * the rule holds no matter who calls it.
 */

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const revalidateDashboard = (locale: string) =>
  revalidatePath(`/${locale}/dashboard`, "layout");

/**
 * Switches which agency the dashboard is showing.
 *
 * Only sets a cookie. Nothing is trusted to it: the portfolio checks the value
 * against the agencies the reader actually belongs to before loading anything,
 * so a hand written cookie shows the same dashboard as no cookie at all.
 */
export async function selectAgency(locale: string, agencyId: string): Promise<ActionResult> {
  const jar = await cookies();
  jar.set(AGENCY_COOKIE, agencyId, {
    maxAge: AGENCY_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
  });
  revalidateDashboard(locale);
  return { ok: true };
}

/**
 * A second agency for somebody who already has one.
 *
 * The same function signup calls, which creates the agency, the owner's
 * membership, the trial and the default reminder cadence in one transaction.
 * A person managing two businesses is two memberships, not two logins, and the
 * new one is selected straight away because that is what they are here for.
 */
export async function createAgency(
  locale: string,
  input: { name: string; country: string; city: string; currency: string }
): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "agency-name-required" };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "not signed in" };

  const { data: id, error } = await supabase.rpc("create_agency_for_current_user", {
    agency_name: name,
    agency_country: input.country,
    agency_city: input.city,
    agency_currency: input.currency,
    agency_locale: locale === "en" ? "en" : "fr",
    // The name they already go by, so a second agency does not greet them as
    // the local part of their email address.
    owner_name:
      (await supabase.from("memberships").select("full_name").limit(1).maybeSingle()).data
        ?.full_name ?? auth.user.email?.split("@")[0] ?? "",
  });
  if (error) return { ok: false, error: error.message };

  const jar = await cookies();
  jar.set(AGENCY_COOKIE, String(id), {
    maxAge: AGENCY_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
  });
  revalidateDashboard(locale);
  return { ok: true, id: String(id) };
}

export async function addApartment(
  locale: string,
  input: {
    buildingId: string;
    agencyId: string;
    label: string;
    rooms: number;
    bathrooms: number;
    sqm: number;
    baseRent: number;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("apartments")
    .insert({
      agency_id: input.agencyId,
      building_id: input.buildingId,
      label: input.label,
      rooms: input.rooms,
      bathrooms: input.bathrooms,
      sqm: input.sqm,
      base_rent: input.baseRent,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  // The id comes back so photos chosen in the same form can attach to it.
  return { ok: true, id: data.id };
}

/**
 * Who this number already belongs to, if anyone.
 *
 * The lease form asks while the number is being typed, so an agency is told
 * "already on file for Beatrice Tiomela" before they submit rather than
 * afterwards, by reading a name they did not enter.
 */
export async function residentByPhone(
  input: { agencyId: string; phone: string }
): Promise<{ name: string } | null> {
  const phone = toE164(input.phone);
  if (!phone) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resident_by_phone", {
    target_agency: input.agencyId,
    phone,
  });
  if (error || !data || data.length === 0) return null;
  return { name: data[0].full_name };
}

export async function createLease(
  locale: string,
  input: {
    apartmentId: string;
    residentName: string;
    residentPhone: string;
    /** Where rent reminders go. Optional, and checked for shape when given. */
    residentEmail?: string;
    rent: number;
    cycle: LeaseCycle;
    startsOn: string;
    deposit?: number;
    /** Fixed term leases end on a date; open ended ones leave this null. */
    endsOn?: string | null;
  }
): Promise<ActionResult> {
  // A number that cannot be read at all is a typo worth stopping on, rather
  // than a tenant quietly recorded with no way to reach them.
  const phone = toE164(input.residentPhone);
  if (input.residentPhone.trim() && !phone) {
    return { ok: false, error: "lease-bad-phone" };
  }
  // An address that cannot be an address would sit silently until the first
  // reminder bounced, which is weeks away and nobody's fault by then.
  const email = (input.residentEmail ?? "").trim().toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "lease-bad-email" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_lease", {
    target_apartment: input.apartmentId,
    resident_name: input.residentName,
    // The form shows, and suggests, a spaced number. The column wants E.164,
    // and blank has to reach the database as null, not as the empty string
    // the column's own check refuses.
    resident_phone: phone || null,
    rent: input.rent,
    cycle_in: input.cycle,
    starts_on_in: input.startsOn,
    deposit_in: input.deposit ?? 0,
    ends_on_in: input.endsOn || null,
    resident_email: email || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

/**
 * Money received, with the paper behind it.
 *
 * The proof arrives as a file rather than a path: it is uploaded here, under
 * the agency's own folder in the private receipts bucket, so the client never
 * chooses where anything lands. A failed upload does not lose the payment,
 * because the payment is what matters and the slip can be attached later.
 *
 * Fields on the form: leaseId, agencyId, amount, method, paidOn, periods,
 * reference, and optionally proof.
 */
export async function recordPayment(
  locale: string,
  form: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const leaseId = String(form.get("leaseId") ?? "");
  const agencyId = String(form.get("agencyId") ?? "");
  const amount = Number(form.get("amount") ?? 0);
  if (!leaseId || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "payment-invalid" };
  }

  let proofPath: string | null = null;
  const proof = form.get("proof");
  if (proof instanceof File && proof.size > 0) {
    const check = await validateImage(proof);
    if (!check.ok) return { ok: false, error: `proof-${check.reason}` };

    // The policy on this bucket matches on the leading folder being an agency
    // the caller belongs to, so the path is built here and not by the browser.
    const path = `${agencyId}/${leaseId}/${crypto.randomUUID()}`;
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(path, proof, { contentType: check.mime, upsert: false });
    if (uploadError) return { ok: false, error: uploadError.message };
    proofPath = path;
  }

  const { error } = await supabase.rpc("record_payment", {
    target_lease: leaseId,
    payment_amount: amount,
    payment_method_in: String(form.get("method") ?? "cash") as PaymentMethod,
    paid_on_in: String(form.get("paidOn") ?? ""),
    reference_in: String(form.get("reference") ?? "") || null,
    periods_covered: Math.max(1, Number(form.get("periods") ?? 1)),
    proof_path_in: proofPath,
  });
  if (error) {
    // The slip is orphaned if the payment failed; better than keeping a file
    // that belongs to a record which does not exist.
    if (proofPath) await supabase.storage.from("receipts").remove([proofPath]);
    return { ok: false, error: error.message };
  }
  revalidateDashboard(locale);
  return { ok: true };
}

export async function createTicket(
  locale: string,
  input: {
    agencyId: string;
    buildingId: string;
    apartmentId?: string | null;
    title: string;
    description?: string;
    reportedVia: ReportChannel;
    priority: TicketPriority;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("tickets").insert({
    agency_id: input.agencyId,
    building_id: input.buildingId,
    apartment_id: input.apartmentId ?? null,
    title: input.title,
    description: input.description ?? null,
    reported_via: input.reportedVia,
    priority: input.priority,
  });
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

export async function updateTicket(
  locale: string,
  input: {
    ticketId: string;
    title?: string;
    description?: string | null;
    priority?: TicketPriority;
    apartmentId?: string | null;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tickets")
    .update({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.apartmentId !== undefined && { apartment_id: input.apartmentId }),
    })
    .eq("id", input.ticketId);
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

export async function deleteTicket(locale: string, ticketId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("tickets").delete().eq("id", ticketId);
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

/**
 * Covers first assignment and reassignment alike. The function records the
 * handover in the ticket thread, so the history survives the change.
 */
export async function assignTicket(
  locale: string,
  input: { ticketId: string; technicianId: string; estimatedCost?: number }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_technician", {
    target_ticket: input.ticketId,
    target_technician: input.technicianId,
    estimated_cost: input.estimatedCost ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

export async function resolveTicket(
  locale: string,
  input: { ticketId: string; cost: number }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_ticket", {
    target_ticket: input.ticketId,
    final_cost: input.cost,
  });
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

/* ----------------------------------------------------------- technicians */

export async function addTechnician(
  locale: string,
  input: {
    agencyId: string;
    name: string;
    trade?: string;
    phone?: string;
    isExternal: boolean;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("technicians").insert({
    agency_id: input.agencyId,
    full_name: input.name,
    trade: input.trade ?? null,
    phone_e164: input.phone ? toE164(input.phone) || null : null,
    is_external: input.isExternal,
  });
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

export async function updateTechnician(
  locale: string,
  input: {
    technicianId: string;
    name?: string;
    trade?: string | null;
    phone?: string | null;
    isExternal?: boolean;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("technicians")
    .update({
      ...(input.name !== undefined && { full_name: input.name }),
      ...(input.trade !== undefined && { trade: input.trade }),
      ...(input.phone !== undefined && { phone_e164: toE164(input.phone ?? "") || null }),
      ...(input.isExternal !== undefined && { is_external: input.isExternal }),
    })
    .eq("id", input.technicianId);
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

/**
 * Retires a technician. Open tickets are unassigned first so none is left
 * pointing at somebody who is gone; resolved work keeps its history.
 */
export async function deleteTechnician(
  locale: string,
  technicianId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error: unassignError } = await supabase
    .from("tickets")
    .update({ technician_id: null, status: "new" })
    .eq("technician_id", technicianId)
    .neq("status", "resolved");
  if (unassignError) return { ok: false, error: unassignError.message };

  const { error } = await supabase.from("technicians").delete().eq("id", technicianId);
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

/* -------------------------------------------------------- photo gallery */

/**
 * Uploads to the private apartment-photos bucket and records the row. The
 * path convention is <agency_id>/<apartment_id>/<file>, which is what the
 * storage policies match on. Takes FormData because the browser hands over a
 * real file: fields agencyId, apartmentId, file, caption.
 */
export async function addApartmentPhoto(
  locale: string,
  form: FormData
): Promise<ActionResult> {
  const agencyId = String(form.get("agencyId") ?? "");
  const apartmentId = String(form.get("apartmentId") ?? "");
  const file = form.get("file");
  const caption = String(form.get("caption") ?? "").trim();
  if (!agencyId || !apartmentId || !(file instanceof File)) {
    return { ok: false, error: "missing photo upload fields" };
  }

  const check = await validateImage(file);
  if (!check.ok) return { ok: false, error: `image rejected: ${check.reason}` };

  const supabase = await createClient();
  const path = `${agencyId}/${apartmentId}/${crypto.randomUUID()}`;

  const { error: uploadError } = await supabase.storage
    .from("apartment-photos")
    // The type the bytes claim, not the one the client declared.
    .upload(path, file, { contentType: check.mime, upsert: false });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { count } = await supabase
    .from("apartment_photos")
    .select("id", { count: "exact", head: true })
    .eq("apartment_id", apartmentId);

  const { error } = await supabase.from("apartment_photos").insert({
    agency_id: agencyId,
    apartment_id: apartmentId,
    storage_path: path,
    caption: caption || null,
    position: count ?? 0,
  });
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

/**
 * Edits a photo in place: a new image replaces the stored object under a new
 * path so the old URL cannot resurface, and the caption follows. Fields:
 * photoId, agencyId, apartmentId, oldPath, caption, and optionally file.
 */
export async function replaceApartmentPhoto(
  locale: string,
  form: FormData
): Promise<ActionResult> {
  const photoId = String(form.get("photoId") ?? "");
  const agencyId = String(form.get("agencyId") ?? "");
  const apartmentId = String(form.get("apartmentId") ?? "");
  const oldPath = String(form.get("oldPath") ?? "");
  const caption = String(form.get("caption") ?? "").trim();
  const file = form.get("file");
  if (!photoId) return { ok: false, error: "missing photo id" };

  const supabase = await createClient();
  const patch: { caption: string | null; storage_path?: string } = {
    caption: caption || null,
  };

  if (file instanceof File && file.size > 0) {
    const check = await validateImage(file);
    if (!check.ok) return { ok: false, error: `image rejected: ${check.reason}` };

    const path = `${agencyId}/${apartmentId}/${crypto.randomUUID()}`;
    const { error: uploadError } = await supabase.storage
      .from("apartment-photos")
      .upload(path, file, { contentType: check.mime, upsert: false });
    if (uploadError) return { ok: false, error: uploadError.message };
    patch.storage_path = path;
  }

  const { error } = await supabase.from("apartment_photos").update(patch).eq("id", photoId);
  if (error) return { ok: false, error: error.message };

  if (patch.storage_path && oldPath) {
    await supabase.storage.from("apartment-photos").remove([oldPath]);
  }
  revalidateDashboard(locale);
  return { ok: true };
}

export async function updateApartmentPhoto(
  locale: string,
  input: { photoId: string; caption?: string | null; position?: number }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("apartment_photos")
    .update({
      ...(input.caption !== undefined && { caption: input.caption }),
      ...(input.position !== undefined && { position: input.position }),
    })
    .eq("id", input.photoId);
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

/** Removes the row and the stored object. The trigger closes the gap in position. */
export async function deleteApartmentPhoto(
  locale: string,
  input: { photoId: string; storagePath: string }
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.from("apartment_photos").delete().eq("id", input.photoId);
  if (error) return { ok: false, error: error.message };

  const { error: storageError } = await supabase.storage
    .from("apartment-photos")
    .remove([input.storagePath]);
  if (storageError) return { ok: false, error: storageError.message };

  revalidateDashboard(locale);
  return { ok: true };
}

/* --------------------------------------------------------------- buildings */

/**
 * The first thing a new agency needs. RLS lets owner, manager or accountant
 * insert directly, so this is a plain write with no invariant to protect.
 */
export async function addBuilding(
  locale: string,
  input: { agencyId: string; name: string; address: string; city: string }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buildings")
    .insert({
      agency_id: input.agencyId,
      name: input.name,
      address: input.address,
      city: input.city,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true, id: data.id };
}

/* ------------------------------------------------------------- settings */

/**
 * The signed in person's own name, on their own membership.
 *
 * Everyone in an agency may set this, whatever their role: it is their name,
 * not a setting of the business. The row is keyed by the caller's own id
 * rather than one supplied by the client, so this cannot rename a colleague.
 */
export async function updateMyProfile(
  locale: string,
  input: { agencyId: string; fullName: string }
): Promise<ActionResult> {
  const name = input.fullName.trim();
  if (!name) return { ok: false, error: "profile-name-required" };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "not signed in" };

  // Through the function rather than the table: memberships_update is owner
  // only, and it stays that way, because a writable role column is the
  // permission system handing itself over.
  const { error } = await supabase.rpc("set_my_display_name", {
    target_agency: input.agencyId,
    new_name: name,
  });
  if (error) return { ok: false, error: error.message };

  revalidateDashboard(locale);
  return { ok: true };
}

export async function updateAgencySettings(
  locale: string,
  input: {
    agencyId: string;
    name: string;
    whatsappNumber: string;
    country: string;
    city: string;
    currency: string;
    address?: string;
    email?: string;
    registration?: string;
  }
): Promise<ActionResult> {
  const supabase = await createClient();

  // What the agency was called before this save, for the rename below.
  const { data: previous } = await supabase
    .from("agencies")
    .select("name")
    .eq("id", input.agencyId)
    .maybeSingle();

  const { error } = await supabase
    .from("agencies")
    .update({
      name: input.name,
      whatsapp_number: input.whatsappNumber || null,
      country: input.country,
      city: input.city,
      currency: input.currency,
      // Blank clears the line rather than storing an empty string, so the
      // receipt leaves it out entirely.
      address: input.address?.trim() || null,
      email: input.email?.trim() || null,
      registration: input.registration?.trim() || null,
    })
    .eq("id", input.agencyId);
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

/**
 * One rule per (agency, offset, channel). The settings page writes the whole
 * cadence at once, so this replaces it wholesale: upsert what was sent, then
 * drop any rule left behind.
 *
 * That second step matters because the lead time is editable. Moving the
 * courtesy reminder from three days before to five creates a rule at -5 and
 * would otherwise leave the one at -3 still firing.
 *
 * Deleting is safe for history: reminder_events references rule_id with
 * `on delete set null`, so past sends survive without their rule.
 */
export async function upsertReminderRules(
  locale: string,
  input: {
    agencyId: string;
    rules: {
      offsetDays: number;
      channel: ReportChannel;
      isActive: boolean;
      escalationStep?: number;
      messageBody?: string;
    }[];
  }
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.from("reminder_rules").upsert(
    input.rules.map((r) => ({
      agency_id: input.agencyId,
      offset_days: r.offsetDays,
      channel: r.channel,
      is_active: r.isActive,
      escalation_step: r.escalationStep ?? 0,
      ...(r.messageBody !== undefined && { message_body: r.messageBody }),
    })),
    { onConflict: "agency_id,offset_days,channel" }
  );
  if (error) return { ok: false, error: error.message };

  const keep = input.rules.map((r) => r.offsetDays);
  const { error: pruneError } = await supabase
    .from("reminder_rules")
    .delete()
    .eq("agency_id", input.agencyId)
    .not("offset_days", "in", `(${keep.join(",")})`);
  if (pruneError) return { ok: false, error: pruneError.message };

  revalidateDashboard(locale);
  return { ok: true };
}

/**
 * Invites a teammate by email and seats them on the agency. Two steps that
 * cross a privilege boundary, so this checks the caller's own role first with
 * the ordinary client, under RLS, before reaching for the admin client that
 * can create a user and would otherwise bypass RLS entirely.
 *
 * Delivery depends on SMTP being configured on the Supabase project; without
 * it the account is created but the invite email may not arrive.
 */
export async function inviteMember(
  locale: string,
  input: { agencyId: string; email: string; role: MemberRole; pages?: string[] }
): Promise<ActionResult> {
  const caller = await createClient();
  const { data: allowed } = await caller.rpc("has_role", {
    target_agency: input.agencyId,
    allowed: ["owner"],
  });
  if (!allowed) return { ok: false, error: "only the owner can invite" };

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "invite-bad-email" };
  }

  const admin = createAdminClient();

  // Who is inviting, and to what, so the email reads like a person rather
  // than a system. Both are already readable to the caller under its own RLS.
  const { data: { user } } = await caller.auth.getUser();
  const { data: agency } = await caller
    .from("agencies")
    .select("name")
    .eq("id", input.agencyId)
    .single();
  const { data: inviterRow } = await caller
    .from("memberships")
    .select("full_name")
    .eq("agency_id", input.agencyId)
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  // An invitation whose link points at the reader's own machine is worse than
  // no invitation: the account is created, the colleague cannot reach it, and
  // nothing anywhere says why. Refuse rather than send that.
  if (process.env.NODE_ENV === "production" && !isSiteUrlReachable()) {
    console.error(
      "[invite] refusing to send: no NEXT_PUBLIC_SITE_URL and no Vercel hostname, " +
        "so the link would point at localhost."
    );
    return { ok: false, error: "invite-site-url-missing" };
  }

  const redirectTo = `${siteUrl()}/${locale}/reset-password`;
  let userId: string;

  if (isEmailConfigured()) {
    // generateLink mints the same invitation without Supabase sending its own
    // copy, which leaves the delivery to Resend and the wording to us.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });
    if (linkError || !link?.user) {
      return { ok: false, error: linkError?.message ?? "could not create the invitation" };
    }
    userId = link.user.id;

    const message = invitationEmail({
      agencyName: agency?.name ?? "Charta Home",
      inviterName: inviterRow?.full_name ?? user?.email?.split("@")[0] ?? "A colleague",
      role: input.role,
      actionLink: link.properties.action_link,
      locale,
    });
    const sent = await sendEmail({ to: email, ...message });
    if (!sent.ok) {
      // The account now exists but nobody was told about it. Saying so is
      // better than a membership row for someone who never hears from us.
      console.error("invite email failed:", sent.error);
      return { ok: false, error: `invite-email-failed: ${sent.error}` };
    }
  } else {
    // No Resend key yet, so fall back to Supabase's own sender.
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo }
    );
    if (inviteError) return { ok: false, error: inviteError.message };
    userId = invited.user.id;
  }

  // An address already on the team is the common mistake, and upsert says so
  // by changing nothing rather than failing on the primary key.
  const { error } = await admin.from("memberships").upsert(
    {
      user_id: userId,
      agency_id: input.agencyId,
      role: input.role,
      full_name: email.split("@")[0],
      // What the owner ticked, or what the role implies if they ticked nothing.
      ...(input.pages && input.pages.length > 0 && { allowed_pages: input.pages }),
    },
    { onConflict: "user_id,agency_id" }
  );
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

/**
 * What a colleague sees in the sidebar.
 *
 * Owner only, and the function cannot reach role, so tidying a menu can never
 * be the thing that quietly promotes somebody. It is navigation: RLS decides
 * what the data will actually give up, whatever is ticked here.
 */
export async function setMemberPages(
  locale: string,
  input: { agencyId: string; userId: string; pages: string[] }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_pages", {
    target_agency: input.agencyId,
    target_user: input.userId,
    pages: input.pages,
  });
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

export async function removeMember(
  locale: string,
  input: { agencyId: string; userId: string }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("agency_id", input.agencyId)
    .eq("user_id", input.userId);
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

/* ------------------------------------------------- apartments and leases */

export async function updateApartment(
  locale: string,
  input: {
    apartmentId: string;
    label?: string;
    rooms?: number;
    bathrooms?: number;
    sqm?: number;
    baseRent?: number;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("apartments")
    .update({
      ...(input.label !== undefined && { label: input.label }),
      ...(input.rooms !== undefined && { rooms: input.rooms }),
      ...(input.bathrooms !== undefined && { bathrooms: input.bathrooms }),
      ...(input.sqm !== undefined && { sqm: input.sqm }),
      ...(input.baseRent !== undefined && { base_rent: input.baseRent }),
    })
    .eq("id", input.apartmentId);
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

/**
 * Removes a unit. Leases, charges and payments cascade from it, so this is
 * refused while anyone still lives there: an agency deleting an occupied unit
 * by accident would take its whole payment history with it.
 */
export async function deleteApartment(
  locale: string,
  apartmentId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("leases")
    .select("id", { count: "exact", head: true })
    .eq("apartment_id", apartmentId)
    .eq("status", "active");
  if ((count ?? 0) > 0) return { ok: false, error: "occupied" };

  const { error } = await supabase.from("apartments").delete().eq("id", apartmentId);
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

/** Corrects a tenant's own details, which live on the resident row. */
export async function updateResident(
  locale: string,
  input: { residentId: string; fullName?: string; phone?: string; email?: string | null }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("residents")
    .update({
      ...(input.fullName !== undefined && { full_name: input.fullName }),
      ...(input.phone !== undefined && { phone_e164: toE164(input.phone ?? "") || null }),
      ...(input.email !== undefined && { email: input.email }),
    })
    .eq("id", input.residentId);
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

/** Adjusts the terms of a running lease. */
export async function updateLease(
  locale: string,
  input: {
    leaseId: string;
    rentAmount?: number;
    cycle?: LeaseCycle;
    startsOn?: string;
    endsOn?: string | null;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("leases")
    .update({
      ...(input.rentAmount !== undefined && { rent_amount: input.rentAmount }),
      ...(input.cycle !== undefined && { cycle: input.cycle }),
      ...(input.startsOn !== undefined && { starts_on: input.startsOn }),
      ...(input.endsOn !== undefined && { ends_on: input.endsOn }),
    })
    .eq("id", input.leaseId);
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

/**
 * Ends a tenancy. The lease is marked ended rather than deleted, because the
 * rent it collected is the agency's own accounting history and deleting the
 * lease would cascade it away.
 */
export async function endLease(
  locale: string,
  input: { leaseId: string; endsOn: string }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leases")
    .update({ status: "ended", ends_on: input.endsOn })
    .eq("id", input.leaseId)
    .select("id");

  if (error) {
    // 23514 is the dates constraint: a lease cannot end before it began. The
    // raw text names the constraint, which means nothing to whoever is holding
    // the keys, so it is translated at the caller.
    if (error.code === "23514") return { ok: false, error: "lease-ends-before-start" };
    return { ok: false, error: error.message };
  }
  // No error and no row means row level security filtered the update out
  // rather than refusing it, which is what a caretaker's token would do.
  if (!data || data.length === 0) return { ok: false, error: "lease-not-writable" };

  revalidateDashboard(locale);
  return { ok: true };
}

/* ---------------------------------------------------------- building photo */

/**
 * The building's own photograph, uploaded to the private building-photos
 * bucket under <agency_id>/<building_id>/, which is what the storage policy
 * matches on. Fields: agencyId, buildingId, file, and optionally oldPath.
 */
export async function setBuildingPhoto(
  locale: string,
  form: FormData
): Promise<ActionResult> {
  const agencyId = String(form.get("agencyId") ?? "");
  const buildingId = String(form.get("buildingId") ?? "");
  const oldPath = String(form.get("oldPath") ?? "");
  const file = form.get("file");
  if (!agencyId || !buildingId || !(file instanceof File)) {
    return { ok: false, error: "missing building photo fields" };
  }

  const check = await validateImage(file);
  if (!check.ok) return { ok: false, error: `image rejected: ${check.reason}` };

  const supabase = await createClient();
  const path = `${agencyId}/${buildingId}/${crypto.randomUUID()}`;

  const { error: uploadError } = await supabase.storage
    .from("building-photos")
    .upload(path, file, { contentType: check.mime, upsert: false });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { error } = await supabase
    .from("buildings")
    .update({ photo_path: path })
    .eq("id", buildingId);
  if (error) return { ok: false, error: error.message };

  // Only once the row points at the new object, so a failure never leaves the
  // building with a path to something that is gone.
  if (oldPath) await supabase.storage.from("building-photos").remove([oldPath]);

  revalidateDashboard(locale);
  return { ok: true };
}

export async function removeBuildingPhoto(
  locale: string,
  input: { buildingId: string; storagePath: string }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("buildings")
    .update({ photo_path: null })
    .eq("id", input.buildingId);
  if (error) return { ok: false, error: error.message };
  if (input.storagePath) {
    await supabase.storage.from("building-photos").remove([input.storagePath]);
  }
  revalidateDashboard(locale);
  return { ok: true };
}

export async function updateBuilding(
  locale: string,
  input: { buildingId: string; name?: string; address?: string; city?: string }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("buildings")
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.city !== undefined && { city: input.city }),
    })
    .eq("id", input.buildingId);
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}


/**
 * An owner chooses a tier and a billing cycle.
 *
 * There is no card form yet, so this is the whole checkout: the choice is
 * recorded at the list price for the agency's country, the team is emailed
 * to invoice it, and the owner is told how to pay by mobile money. The plan
 * itself does not move here; the team moves it once the money has arrived,
 * which is why the subscription row cannot be written by anyone else.
 */
export async function requestPlan(
  locale: string,
  input: { agencyId: string; plan: string; cycle: string }
): Promise<ActionResult & { amount?: string | null }> {
  if (!isPlanCode(input.plan)) return { ok: false, error: "unknown plan" };
  const cycle: BillingCycle = input.cycle === "annual" ? "annual" : "monthly";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_plan", {
    target_agency: input.agencyId,
    plan_code: input.plan,
    cycle_in: cycle,
  });
  if (error) return { ok: false, error: error.message };
  const row = data?.[0];
  if (!row) return { ok: false, error: "the request was not recorded" };

  const amount = row.due === null || row.due === undefined
    ? null
    : formatMoney(Number(row.due), row.paid_in);

  // The request is on record whatever happens to the mail, so a mail outage
  // is logged and never shown as a failed request.
  if (isEmailConfigured()) {
    const [{ data: auth }, { data: agency }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("agencies").select("name, country, city, email").eq("id", input.agencyId).maybeSingle(),
    ]);
    const { data: me } = await supabase
      .from("memberships")
      .select("full_name")
      .eq("agency_id", input.agencyId)
      .eq("user_id", auth.user?.id ?? "")
      .maybeSingle();

    const ownerEmail = auth.user?.email ?? "";
    const fr = locale === "fr";
    const cycleLabel = cycle === "annual" ? (fr ? "annuel" : "annual") : fr ? "mensuel" : "monthly";
    const label = planName(input.plan, locale);

    const toTeam = planRequestEmail({
      agencyName: agency?.name ?? "",
      country: agency?.country ?? "",
      city: agency?.city ?? "",
      contactEmail: agency?.email || ownerEmail,
      requestedBy: me?.full_name || ownerEmail,
      planLabel: label,
      cycleLabel,
      amount,
      locale,
    });
    const sales = process.env.SALES_EMAIL || "hello@chartahome.com";
    const sentTeam = await sendEmail({ to: sales, ...toTeam });
    if (!sentTeam.ok) console.error("plan request email failed:", sentTeam.error);

    if (ownerEmail) {
      const receipt = planRequestReceiptEmail({
        agencyName: agency?.name ?? "",
        ownerName: me?.full_name || ownerEmail.split("@")[0],
        planLabel: label,
        cycleLabel,
        amount,
        orangeNumber: process.env.MOBILE_MONEY_ORANGE ?? "",
        mtnNumber: process.env.MOBILE_MONEY_MTN ?? "",
        settingsUrl: `${siteUrl()}/${locale}/dashboard/settings`,
        locale,
      });
      const sentOwner = await sendEmail({ to: ownerEmail, ...receipt });
      if (!sentOwner.ok) console.error("plan receipt email failed:", sentOwner.error);
    }
  }

  revalidateDashboard(locale);
  return { ok: true, id: row.request_id, amount };
}


/**
 * The owner types the code the desk sent them.
 *
 * Everything that matters is checked in the database under a row lock: the
 * code exists, belongs to an agency this person owns, has not been used and
 * has not expired. The message comes back as a short key so the settings
 * page can say it in the reader's language.
 */
export async function redeemPlanCode(
  locale: string,
  code: string
): Promise<
  | { ok: true; plan: string; until: string }
  | { ok: false; error: "not_found" | "used" | "expired" | "owner" | "other"; detail: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_plan_code", { code_in: code });
  if (error) {
    const m = error.message;
    const key = /not found/.test(m) ? "not_found"
      : /already used/.test(m) ? "used"
      : /expired/.test(m) ? "expired"
      : /only the owner/.test(m) ? "owner"
      : "other";
    return { ok: false, error: key, detail: m };
  }
  const row = data?.[0];
  if (!row) return { ok: false, error: "other", detail: "no row returned" };
  revalidateDashboard(locale);
  return { ok: true, plan: row.new_plan, until: row.active_until };
}


/**
 * Whether this agency can pay online at all.
 *
 * PayUnit collects in Cameroon, in XAF. Anywhere else the answer is the
 * manual path: a request by email and a code from the desk. Asked by the
 * settings page so it can show one button or the other rather than a
 * button that fails.
 */
export async function onlinePaymentAvailable(agencyId: string): Promise<boolean> {
  if (!isPayunitConfigured() || !isSiteUrlReachable()) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("agencies").select("country, currency").eq("id", agencyId).maybeSingle();
  return data?.country === "Cameroon" && data?.currency === "XAF";
}

/**
 * Opens a PayUnit checkout for a tier and sends back where to go.
 *
 * The payment row is written first, with a transaction id we chose, so the
 * gateway's answer can always be tied back to an agency and a tier even if
 * the owner closes the tab halfway. A gateway that refuses to open the
 * transaction marks the row failed rather than leaving it open forever.
 */
export async function startCheckout(
  locale: string,
  input: { agencyId: string; plan: string; cycle: string }
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isPlanCode(input.plan)) return { ok: false, error: "unknown plan" };
  const cycle: BillingCycle = input.cycle === "annual" ? "annual" : "monthly";
  if (!(await onlinePaymentAvailable(input.agencyId))) {
    return { ok: false, error: "online payment is not available for this agency" };
  }

  const supabase = await createClient();
  const ref = newTransactionId();
  const { data, error } = await supabase.rpc("begin_subscription_payment", {
    target_agency: input.agencyId,
    plan_code: input.plan,
    cycle_in: cycle,
    provider_ref_in: ref,
  });
  if (error) return { ok: false, error: error.message };
  const row = data?.[0];
  if (!row) return { ok: false, error: "the payment was not recorded" };

  const { data: agency } = await supabase.from("agencies").select("name, country").eq("id", input.agencyId).maybeSingle();
  const base = siteUrl();
  const opened = await initializePayment({
    amount: Number(row.due),
    currency: row.paid_in,
    transactionId: ref,
    returnUrl: `${base}/${locale}/dashboard/settings?payment=${row.payment_id}`,
    notifyUrl: `${base}/api/payunit/notify`,
    description: `Charta Home ${planName(input.plan, locale, agency?.country ?? "")} ${cycle} · ${agency?.name ?? ""}`.slice(0, 120),
  });
  if (!opened.ok) {
    // Nothing was collected; close the row so it does not sit as pending.
    const admin = createAdminClient();
    await admin.rpc("settle_subscription_payment", { payment_id_in: row.payment_id, final_status: "failed", raw_in: { error: opened.error } as never });
    return { ok: false, error: opened.error };
  }
  return { ok: true, url: opened.checkoutUrl };
}

/**
 * The owner is back from the checkout. Ask the gateway what happened.
 *
 * Only a payment of the reader's own agency is looked at, through row level
 * security; the settling itself runs with the service role in lib/billing.
 */
export async function confirmPayment(
  locale: string,
  paymentId: string
): Promise<
  | { ok: true; outcome: "paid" | "failed" | "cancelled" | "pending"; plan: string | null; until: string | null }
  | { ok: false; error: string }
> {
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return { ok: false, error: "unknown payment" };
  const supabase = await createClient();
  const { data: mine } = await supabase.from("subscription_payments").select("id").eq("id", paymentId).maybeSingle();
  if (!mine) return { ok: false, error: "unknown payment" };
  const result = await settlePayment({ paymentId });
  if (result.ok && result.outcome === "paid") revalidateDashboard(locale);
  return result;
}

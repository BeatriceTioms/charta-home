"use server";

import { revalidatePath } from "next/cache";
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

export async function createLease(
  locale: string,
  input: {
    apartmentId: string;
    residentName: string;
    residentPhone: string;
    rent: number;
    cycle: LeaseCycle;
    startsOn: string;
    deposit?: number;
    /** Fixed term leases end on a date; open ended ones leave this null. */
    endsOn?: string | null;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_lease", {
    target_apartment: input.apartmentId,
    resident_name: input.residentName,
    resident_phone: input.residentPhone,
    rent: input.rent,
    cycle_in: input.cycle,
    starts_on_in: input.startsOn,
    deposit_in: input.deposit ?? 0,
    ends_on_in: input.endsOn || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

export async function recordPayment(
  locale: string,
  input: {
    leaseId: string;
    amount: number;
    method: PaymentMethod;
    paidOn: string;
    reference?: string;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_payment", {
    target_lease: input.leaseId,
    payment_amount: input.amount,
    payment_method_in: input.method,
    paid_on_in: input.paidOn,
    reference_in: input.reference ?? null,
  });
  if (error) return { ok: false, error: error.message };
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
    phone_e164: input.phone ?? null,
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
      ...(input.phone !== undefined && { phone_e164: input.phone }),
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

export async function updateAgencySettings(
  locale: string,
  input: {
    agencyId: string;
    name: string;
    whatsappNumber: string;
    country: string;
    city: string;
    currency: string;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("agencies")
    .update({
      name: input.name,
      whatsapp_number: input.whatsappNumber || null,
      country: input.country,
      city: input.city,
      currency: input.currency,
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
  input: { agencyId: string; email: string; role: MemberRole }
): Promise<ActionResult> {
  const caller = await createClient();
  const { data: allowed } = await caller.rpc("has_role", {
    target_agency: input.agencyId,
    allowed: ["owner"],
  });
  if (!allowed) return { ok: false, error: "only the owner can invite" };

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    input.email
  );
  if (inviteError) return { ok: false, error: inviteError.message };

  const { error } = await admin.from("memberships").insert({
    user_id: invited.user.id,
    agency_id: input.agencyId,
    role: input.role,
    full_name: input.email.split("@")[0],
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
      ...(input.phone !== undefined && { phone_e164: input.phone }),
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
  const { error } = await supabase
    .from("leases")
    .update({ status: "ended", ends_on: input.endsOn })
    .eq("id", input.leaseId);
  if (error) return { ok: false, error: error.message };
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

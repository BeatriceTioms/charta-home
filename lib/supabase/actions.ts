"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./server";
import type { LeaseCycle, PaymentMethod, ReportChannel, TicketPriority } from "./types";

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

  const supabase = await createClient();
  const path = `${agencyId}/${apartmentId}/${crypto.randomUUID()}`;

  const { error: uploadError } = await supabase.storage
    .from("apartment-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
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
    const path = `${agencyId}/${apartmentId}/${crypto.randomUUID()}`;
    const { error: uploadError } = await supabase.storage
      .from("apartment-photos")
      .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
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

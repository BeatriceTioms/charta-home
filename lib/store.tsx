"use client";

/**
 * The dashboard's data store.
 *
 * Every mutation applies to local state first, so the interface answers
 * instantly, and when a Supabase project is configured the same mutation is
 * sent to the matching server action. router.refresh() then reloads the
 * portfolio through the layout and the store re-syncs to server truth, which
 * is how derived state such as a charge moving to paid comes back. Without a
 * project the local update is all there is, which keeps the demo working.
 */

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useI18n } from "@/lib/i18n/context";
import * as sb from "@/lib/supabase/actions";
import type { PaymentMethod } from "@/lib/supabase/types";
import {
  activity as seedActivity,
  buildings as seedBuildings,
  seedPhotos,
  technicians as seedTechnicians,
  tickets as seedTickets,
  type ActivityItem,
  type Apartment,
  type ApartmentPhoto,
  type Building,
  type RentStatus,
  type Technician,
  type Ticket,
  type TicketStatus,
} from "@/lib/data";

export type Toast = { id: number; message: string };

type StoreValue = {
  buildings: Building[];
  tickets: Ticket[];
  activity: ActivityItem[];
  agencyInfo: { name: string; city: string; country: string; whatsapp: string } | null;
  toasts: Toast[];
  /** The signed in agency, empty string on the mock. */
  agencyId: string;
  addBuilding: (input: { name: string; address: string; city: string }) => Promise<string | undefined>;
  notify: (message: string) => void;
  dismissToast: (id: number) => void;

  addApartment: (
    buildingId: string,
    input: {
      label: string;
      rooms: number;
      bathrooms: number;
      sqm: number;
      rent: number;
      cycle: "monthly" | "yearly";
      photos?: string[];
    }
  ) => void;
  addLease: (
    buildingId: string,
    apartmentId: string,
    input: {
      name: string;
      phone: string;
      rent: number;
      cycle: "monthly" | "yearly";
      since: string;
      /** Move out date on a fixed term lease, empty when open ended. */
      until?: string;
    }
  ) => void;
  recordPayment: (
    buildingId: string,
    apartmentId: string,
    input: { amount: number; method: string; paidOn: string; reference?: string }
  ) => void;
  markReminded: (buildingId: string, apartmentId: string) => void;

  addTicket: (input: {
    buildingId: string;
    title: string;
    apartment: string;
    /** Real unit id, needed for the live write. Null means common area. */
    apartmentId?: string | null;
    description: string;
    reportedVia: "whatsapp" | "phone" | "email";
    priority: "normal" | "high" | "urgent";
    tenant?: string;
  }) => void;
  updateTicket: (
    ticketId: string,
    patch: Partial<Pick<Ticket, "title" | "description" | "priority" | "apartment">> & {
      apartmentId?: string | null;
    }
  ) => void;
  deleteTicket: (ticketId: string) => void;
  assignTicket: (ticketId: string, technicianId: string, cost?: number) => void;
  resolveTicket: (ticketId: string, cost: number) => void;

  /* apartment photo gallery */
  photosFor: (buildingId: string, apartmentId: string) => ApartmentPhoto[];
  addPhoto: (buildingId: string, apartmentId: string, src: string, caption?: string) => void;
  updatePhoto: (buildingId: string, apartmentId: string, photoId: string, patch: { src?: string; caption?: string }) => void;
  deletePhoto: (buildingId: string, apartmentId: string, photoId: string) => void;

  /* technicians */
  technicians: Technician[];
  addTechnician: (input: Omit<Technician, "id">) => void;
  updateTechnician: (id: string, patch: Partial<Omit<Technician, "id">>) => void;
  deleteTechnician: (id: string) => void;

  remindedKeys: string[];
};

const StoreContext = createContext<StoreValue | null>(null);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Real rows when a project is configured, the mock portfolio otherwise. */
export type StoreSeed = {
  agencyId?: string;
  agencyInfo?: { name: string; city: string; country: string; whatsapp: string };
  buildings: Building[];
  tickets: Ticket[];
  technicians: Technician[];
  activity: ActivityItem[];
};

/** The dashboard form's payment methods, in the database's spelling. */
const METHODS: Record<string, PaymentMethod> = {
  cash: "cash",
  orange: "orange_money",
  mtn: "mtn_momo",
  bank: "bank_transfer",
};

/** Every unit gets a gallery: its own photos, or rotated stock covers. */
const decorate = (list: Building[]): Building[] =>
  list.map((b) => ({
    ...b,
    apartments: b.apartments.map((a, i) => {
      const cover = seedPhotos.covers[i % seedPhotos.covers.length];
      const rest = seedPhotos.default.filter((src) => src !== cover);
      return {
        ...a,
        photos:
          a.photos ??
          [cover, ...rest].map((src, n) => ({ id: `${b.id}-${a.id}-p${n}`, src })),
      };
    }),
  }));

/** Turns a picked image, data URL or bundled path alike, into an upload. */
async function toUploadForm(
  src: string,
  fields: Record<string, string>
): Promise<FormData> {
  const blob = await fetch(src).then((r) => r.blob());
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  form.set("file", new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" }));
  return form;
}

export function StoreProvider({
  children,
  seed,
}: {
  children: React.ReactNode;
  seed?: StoreSeed | null;
}) {
  const [buildings, setBuildings] = useState<Building[]>(() =>
    decorate(seed?.buildings ?? seedBuildings)
  );
  const [tickets, setTickets] = useState<Ticket[]>(() =>
    (seed?.tickets ?? seedTickets).map((t) => ({ ...t }))
  );
  const [technicians, setTechnicians] = useState<Technician[]>(() =>
    (seed?.technicians ?? seedTechnicians).map((t) => ({ ...t }))
  );
  const [activity, setActivity] = useState<ActivityItem[]>(
    () => seed?.activity ?? seedActivity
  );
  const [remindedKeys, setRemindedKeys] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const { locale, t } = useI18n();
  const router = useRouter();
  const live = Boolean(seed?.agencyId);
  const agencyId = seed?.agencyId ?? "";
  const agencyInfo = seed?.agencyInfo ?? null;

  const notify = useCallback((message: string) => {
    const id = toastId++;
    setToasts((list) => [...list, { id, message }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 4000);
  }, []);

  // After a server write the layout reloads the portfolio and hands down a new
  // seed. Adopting it replaces the optimistic guess with what actually landed,
  // including anything derived in the database, like a charge moving to paid.
  const seedRef = useRef(seed);
  useEffect(() => {
    if (!seed || seed === seedRef.current) return;
    seedRef.current = seed;
    setBuildings(decorate(seed.buildings));
    setTickets(seed.tickets.map((x) => ({ ...x })));
    setTechnicians(seed.technicians.map((x) => ({ ...x })));
    setActivity(seed.activity);
  }, [seed]);

  /** Sends a write to the server, surfaces failure, and pulls back truth. */
  const persist = useCallback(
    (run: () => Promise<{ ok: boolean } & { error?: string }>) => {
      if (!live) return;
      run()
        .then((result) => {
          if (!result.ok) {
            console.error("save failed:", result.error);
            notify(t.dash.common.saveFailed);
          }
          router.refresh();
        })
        .catch((err) => {
          console.error("save failed:", err);
          notify(t.dash.common.saveFailed);
          router.refresh();
        });
    },
    [live, notify, router, t]
  );

  const dismissToast = useCallback(
    (id: number) => setToasts((list) => list.filter((x) => x.id !== id)),
    []
  );

  const updateApartment = useCallback(
    (buildingId: string, apartmentId: string, patch: Partial<Apartment>) =>
      setBuildings((list) =>
        list.map((b) =>
          b.id !== buildingId
            ? b
            : {
                ...b,
                apartments: b.apartments.map((a) =>
                  a.id === apartmentId ? { ...a, ...patch } : a
                ),
              }
        )
      ),
    []
  );

  const addApartment = useCallback<StoreValue["addApartment"]>(
    (buildingId, input) => {
      setBuildings((list) =>
        list.map((b) => {
          if (b.id !== buildingId) return b;
          const id = `a${b.apartments.length + 1}-${Date.now().toString(36)}`;
          const apartment: Apartment = {
            id,
            label: input.label,
            rooms: input.rooms,
            bathrooms: input.bathrooms,
            sqm: input.sqm,
            rent: input.rent,
            cycle: input.cycle,
            rentStatus: "pending",
            netYield: 0,
            payments: [],
            // The first photo doubles as the cover shown in the apartment grid.
            photos: (input.photos ?? []).map((src, n) => ({ id: `${id}-p${n}`, src })),
          };
          return { ...b, apartments: [...b.apartments, apartment] };
        })
      );

      // The unit must exist before its photos can point at it, so this write
      // cannot go through persist(): it needs the new row's id back first.
      persist(async () => {
        const created = await sb.addApartment(locale, {
          buildingId,
          agencyId,
          label: input.label,
          rooms: input.rooms,
          bathrooms: input.bathrooms,
          sqm: input.sqm,
          baseRent: input.rent,
        });
        if (!created.ok || !created.id) return created;
        for (const src of input.photos ?? []) {
          await sb.addApartmentPhoto(
            locale,
            await toUploadForm(src, { agencyId, apartmentId: created.id })
          );
        }
        return created;
      });
    },
    [agencyId, locale, persist]
  );

  const addBuilding = useCallback<StoreValue["addBuilding"]>(
    async (input) => {
      if (!live) return undefined;
      const result = await sb.addBuilding(locale, { agencyId, ...input });
      if (!result.ok) {
        notify(t.dash.common.saveFailed);
        return undefined;
      }
      router.refresh();
      return result.id;
    },
    [live, locale, agencyId, notify, t, router]
  );

  const addLease = useCallback<StoreValue["addLease"]>(
    (buildingId, apartmentId, input) => {
      updateApartment(buildingId, apartmentId, {
        tenant: {
          name: input.name,
          phone: input.phone,
          since: input.since,
          until: input.until || undefined,
        },
        rent: input.rent,
        cycle: input.cycle,
        rentStatus: "pending",
        netYield: 8.5,
      });
      persist(() =>
        sb.createLease(locale, {
          apartmentId,
          residentName: input.name,
          residentPhone: input.phone,
          rent: input.rent,
          cycle: input.cycle,
          startsOn: input.since,
          endsOn: input.until || null,
        })
      );
    },
    [updateApartment, persist, locale]
  );

  const recordPayment = useCallback<StoreValue["recordPayment"]>(
    (buildingId, apartmentId, input) => {
      const leaseId = buildings
        .find((b) => b.id === buildingId)
        ?.apartments.find((a) => a.id === apartmentId)?.leaseId;
      if (leaseId) {
        persist(() =>
          sb.recordPayment(locale, {
            leaseId,
            amount: input.amount,
            method: METHODS[input.method] ?? "other",
            paidOn: input.paidOn,
            reference: input.reference || undefined,
          })
        );
      }
      setBuildings((list) =>
        list.map((b) => {
          if (b.id !== buildingId) return b;
          return {
            ...b,
            apartments: b.apartments.map((a) => {
              if (a.id !== apartmentId) return a;
              const paid: RentStatus = input.amount >= a.rent ? "paid" : "pending";
              const month = MONTHS[new Date().getMonth()] ?? "Aug";
              return {
                ...a,
                rentStatus: paid,
                payments: [
                  ...a.payments,
                  {
                    month: `${month} 2026`,
                    amount: input.amount,
                    paidOn: input.paidOn,
                    status: paid,
                  },
                ],
              };
            }),
          };
        })
      );
    },
    [buildings, persist, locale]
  );

  const markReminded = useCallback((buildingId: string, apartmentId: string) => {
    setRemindedKeys((keys) => {
      const key = `${buildingId}-${apartmentId}`;
      return keys.includes(key) ? keys : [...keys, key];
    });
  }, []);

  const addTicket = useCallback<StoreValue["addTicket"]>(
    (input) => {
      setTickets((list) => {
        const now = new Date();
        const ticket: Ticket = {
          id: `T-${1100 + list.length}`,
          title: input.title,
          buildingId: input.buildingId,
          apartment: input.apartment,
          status: "new",
          reportedVia: input.reportedVia,
          tenant: input.tenant,
          openedOn: `${now.getDate()} ${MONTHS[now.getMonth()]}`,
          daysOpen: 0,
          month: MONTHS[now.getMonth()] ?? "Aug",
          year: now.getFullYear(),
        };
        return [ticket, ...list];
      });
      persist(() =>
        sb.createTicket(locale, {
          agencyId,
          buildingId: input.buildingId,
          apartmentId: input.apartmentId ?? null,
          title: input.title,
          description: input.description || undefined,
          reportedVia: input.reportedVia,
          priority: input.priority,
        })
      );
    },
    [agencyId, locale, persist]
  );

  /** The row's uuid behind a display reference, absent on mock rows. */
  const dbIdOf = useCallback(
    (ticketId: string) => tickets.find((x) => x.id === ticketId)?.dbId,
    [tickets]
  );

  const updateTicket = useCallback<StoreValue["updateTicket"]>(
    (ticketId, patch) => {
      const { apartmentId, ...local } = patch;
      setTickets((list) => list.map((t) => (t.id === ticketId ? { ...t, ...local } : t)));
      const dbId = dbIdOf(ticketId);
      if (dbId) {
        persist(() =>
          sb.updateTicket(locale, {
            ticketId: dbId,
            title: patch.title,
            description: patch.description ?? null,
            priority: patch.priority,
            ...(apartmentId !== undefined && { apartmentId }),
          })
        );
      }
    },
    [dbIdOf, persist, locale]
  );

  const deleteTicket = useCallback(
    (ticketId: string) => {
      const dbId = dbIdOf(ticketId);
      setTickets((list) => list.filter((t) => t.id !== ticketId));
      if (dbId) persist(() => sb.deleteTicket(locale, dbId));
    },
    [dbIdOf, persist, locale]
  );

  const assignTicket = useCallback(
    (ticketId: string, technicianId: string, cost?: number) => {
      setTickets((list) =>
        list.map((t) => {
          if (t.id !== ticketId) return t;
          const tech = technicians.find((x) => x.id === technicianId);
          return {
            ...t,
            technicianId,
            assignee: tech ? `${tech.name}` : t.assignee,
            // Reassigning a resolved ticket keeps it resolved.
            status: t.status === "resolved" ? t.status : ("assigned" as TicketStatus),
            cost: cost ?? t.cost,
          };
        })
      );
      const dbId = dbIdOf(ticketId);
      if (dbId) {
        persist(() =>
          sb.assignTicket(locale, { ticketId: dbId, technicianId, estimatedCost: cost })
        );
      }
    },
    [technicians, dbIdOf, persist, locale]
  );

  /* ---------------------------------------------------- photo gallery */

  const photosFor = useCallback(
    (buildingId: string, apartmentId: string) =>
      buildings
        .find((b) => b.id === buildingId)
        ?.apartments.find((a) => a.id === apartmentId)?.photos ?? [],
    [buildings]
  );

  const mutatePhotos = useCallback(
    (
      buildingId: string,
      apartmentId: string,
      fn: (photos: ApartmentPhoto[]) => ApartmentPhoto[]
    ) =>
      setBuildings((list) =>
        list.map((b) =>
          b.id !== buildingId
            ? b
            : {
                ...b,
                apartments: b.apartments.map((a) =>
                  a.id === apartmentId ? { ...a, photos: fn(a.photos ?? []) } : a
                ),
              }
        )
      ),
    []
  );

  const findPhoto = useCallback(
    (buildingId: string, apartmentId: string, photoId: string) =>
      buildings
        .find((b) => b.id === buildingId)
        ?.apartments.find((a) => a.id === apartmentId)
        ?.photos?.find((p) => p.id === photoId),
    [buildings]
  );

  const addPhoto = useCallback<StoreValue["addPhoto"]>(
    (buildingId, apartmentId, src, caption) => {
      mutatePhotos(buildingId, apartmentId, (photos) => [
        ...photos,
        { id: `p-${Date.now().toString(36)}`, src, caption },
      ]);
      persist(async () =>
        sb.addApartmentPhoto(
          locale,
          await toUploadForm(src, { agencyId, apartmentId, caption: caption ?? "" })
        )
      );
    },
    [mutatePhotos, persist, locale, agencyId]
  );

  const updatePhoto = useCallback<StoreValue["updatePhoto"]>(
    (buildingId, apartmentId, photoId, patch) => {
      const existing = findPhoto(buildingId, apartmentId, photoId);
      mutatePhotos(buildingId, apartmentId, (photos) =>
        photos.map((p) => (p.id === photoId ? { ...p, ...patch } : p))
      );
      if (!existing) return;

      if (!existing.path) {
        // A stock placeholder is not stored anywhere, so editing it live means
        // the unit gets its first real photo.
        persist(async () =>
          sb.addApartmentPhoto(
            locale,
            await toUploadForm(patch.src ?? existing.src, {
              agencyId,
              apartmentId,
              caption: patch.caption ?? existing.caption ?? "",
            })
          )
        );
        return;
      }

      persist(async () => {
        const changedImage = patch.src !== undefined && patch.src !== existing.src;
        const form = changedImage
          ? await toUploadForm(patch.src!, {})
          : new FormData();
        form.set("photoId", photoId);
        form.set("agencyId", agencyId);
        form.set("apartmentId", apartmentId);
        form.set("oldPath", existing.path!);
        form.set("caption", patch.caption ?? existing.caption ?? "");
        return sb.replaceApartmentPhoto(locale, form);
      });
    },
    [mutatePhotos, findPhoto, persist, locale, agencyId]
  );

  const deletePhoto = useCallback<StoreValue["deletePhoto"]>(
    (buildingId, apartmentId, photoId) => {
      const existing = findPhoto(buildingId, apartmentId, photoId);
      mutatePhotos(buildingId, apartmentId, (photos) =>
        photos.filter((p) => p.id !== photoId)
      );
      // A stock placeholder has no stored object, so nothing to delete live.
      if (existing?.path) {
        persist(() =>
          sb.deleteApartmentPhoto(locale, { photoId, storagePath: existing.path! })
        );
      }
    },
    [mutatePhotos, findPhoto, persist, locale]
  );

  /* ------------------------------------------------------ technicians */

  const addTechnician = useCallback<StoreValue["addTechnician"]>(
    (input) => {
      setTechnicians((list) => [
        ...list,
        { ...input, id: `tech-${Date.now().toString(36)}` },
      ]);
      persist(() =>
        sb.addTechnician(locale, {
          agencyId,
          name: input.name,
          trade: input.trade || undefined,
          phone: input.phone ? input.phone.replace(/\s/g, "") : undefined,
          isExternal: input.isExternal,
        })
      );
    },
    [persist, locale, agencyId]
  );

  const updateTechnician = useCallback<StoreValue["updateTechnician"]>(
    (id, patch) => {
      setTechnicians((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      persist(() =>
        sb.updateTechnician(locale, {
          technicianId: id,
          name: patch.name,
          trade: patch.trade,
          phone: patch.phone ? patch.phone.replace(/\s/g, "") : patch.phone,
          isExternal: patch.isExternal,
        })
      );
    },
    [persist, locale]
  );

  const deleteTechnician = useCallback(
    (id: string) => {
      setTechnicians((list) => list.filter((t) => t.id !== id));
      // Unassign anything that pointed at them so no ticket is orphaned.
      setTickets((list) =>
        list.map((t) =>
          t.technicianId === id
            ? { ...t, technicianId: undefined, assignee: undefined }
            : t
        )
      );
      persist(() => sb.deleteTechnician(locale, id));
    },
    [persist, locale]
  );

  const resolveTicket = useCallback(
    (ticketId: string, cost: number) => {
      setTickets((list) =>
        list.map((t) =>
          t.id === ticketId ? { ...t, status: "resolved" as TicketStatus, cost } : t
        )
      );
      const dbId = dbIdOf(ticketId);
      if (dbId) persist(() => sb.resolveTicket(locale, { ticketId: dbId, cost }));
    },
    [dbIdOf, persist, locale]
  );

  const value = useMemo<StoreValue>(
    () => ({
      buildings,
      tickets,
      activity,
      agencyInfo,
      toasts,
      agencyId,
      addBuilding,
      notify,
      dismissToast,
      addApartment,
      addLease,
      recordPayment,
      markReminded,
      addTicket,
      updateTicket,
      deleteTicket,
      assignTicket,
      resolveTicket,
      photosFor,
      addPhoto,
      updatePhoto,
      deletePhoto,
      technicians,
      addTechnician,
      updateTechnician,
      deleteTechnician,
      remindedKeys,
    }),
    [
      buildings, tickets, activity, agencyInfo, toasts, agencyId, addBuilding, notify, dismissToast, addApartment, addLease,
      recordPayment, markReminded, addTicket, updateTicket, deleteTicket, assignTicket,
      resolveTicket, photosFor, addPhoto, updatePhoto, deletePhoto, technicians,
      addTechnician, updateTechnician, deleteTechnician, remindedKeys,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

let toastId = 1;

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

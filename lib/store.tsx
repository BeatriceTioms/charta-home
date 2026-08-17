"use client";

/**
 * Session data store.
 *
 * Every dashboard mutation goes through this provider, so buttons produce real
 * visible changes today. Each action below maps one to one onto the Supabase
 * mutation that will replace it, which keeps the swap mechanical.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  buildings as seedBuildings,
  seedPhotos,
  technicians as seedTechnicians,
  tickets as seedTickets,
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
  toasts: Toast[];
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
    }
  ) => void;
  addLease: (
    buildingId: string,
    apartmentId: string,
    input: { name: string; phone: string; rent: number; cycle: "monthly" | "yearly"; since: string }
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
    description: string;
    reportedVia: "whatsapp" | "phone" | "email";
    priority: "normal" | "high" | "urgent";
    tenant?: string;
  }) => void;
  updateTicket: (
    ticketId: string,
    patch: Partial<Pick<Ticket, "title" | "description" | "priority" | "apartment">>
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

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [buildings, setBuildings] = useState<Building[]>(() =>
    seedBuildings.map((b) => ({
      ...b,
      apartments: b.apartments.map((a, i) => ({
        ...a,
        photos:
          a.photos ??
          seedPhotos.default.map((src, n) => ({
            id: `${b.id}-${a.id}-p${n}`,
            src: n === 0 ? [b.interior, ...seedPhotos.default][i % 2 === 0 ? 0 : 1] ?? src : src,
          })),
      })),
    }))
  );
  const [tickets, setTickets] = useState<Ticket[]>(() => seedTickets.map((t) => ({ ...t })));
  const [technicians, setTechnicians] = useState<Technician[]>(() =>
    seedTechnicians.map((t) => ({ ...t }))
  );
  const [remindedKeys, setRemindedKeys] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string) => {
    const id = toastId++;
    setToasts((list) => [...list, { id, message }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 4000);
  }, []);

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

  const addApartment = useCallback<StoreValue["addApartment"]>((buildingId, input) => {
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
        };
        return { ...b, apartments: [...b.apartments, apartment] };
      })
    );
  }, []);

  const addLease = useCallback<StoreValue["addLease"]>(
    (buildingId, apartmentId, input) => {
      updateApartment(buildingId, apartmentId, {
        tenant: { name: input.name, phone: input.phone, since: input.since },
        rent: input.rent,
        cycle: input.cycle,
        rentStatus: "pending",
        netYield: 8.5,
      });
    },
    [updateApartment]
  );

  const recordPayment = useCallback<StoreValue["recordPayment"]>(
    (buildingId, apartmentId, input) => {
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
    []
  );

  const markReminded = useCallback((buildingId: string, apartmentId: string) => {
    setRemindedKeys((keys) => {
      const key = `${buildingId}-${apartmentId}`;
      return keys.includes(key) ? keys : [...keys, key];
    });
  }, []);

  const addTicket = useCallback<StoreValue["addTicket"]>((input) => {
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
        year: 2026,
      };
      return [ticket, ...list];
    });
  }, []);

  const updateTicket = useCallback<StoreValue["updateTicket"]>((ticketId, patch) => {
    setTickets((list) => list.map((t) => (t.id === ticketId ? { ...t, ...patch } : t)));
  }, []);

  const deleteTicket = useCallback((ticketId: string) => {
    setTickets((list) => list.filter((t) => t.id !== ticketId));
  }, []);

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
    },
    [technicians]
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

  const addPhoto = useCallback<StoreValue["addPhoto"]>(
    (buildingId, apartmentId, src, caption) =>
      mutatePhotos(buildingId, apartmentId, (photos) => [
        ...photos,
        { id: `p-${Date.now().toString(36)}`, src, caption },
      ]),
    [mutatePhotos]
  );

  const updatePhoto = useCallback<StoreValue["updatePhoto"]>(
    (buildingId, apartmentId, photoId, patch) =>
      mutatePhotos(buildingId, apartmentId, (photos) =>
        photos.map((p) => (p.id === photoId ? { ...p, ...patch } : p))
      ),
    [mutatePhotos]
  );

  const deletePhoto = useCallback<StoreValue["deletePhoto"]>(
    (buildingId, apartmentId, photoId) =>
      mutatePhotos(buildingId, apartmentId, (photos) =>
        photos.filter((p) => p.id !== photoId)
      ),
    [mutatePhotos]
  );

  /* ------------------------------------------------------ technicians */

  const addTechnician = useCallback<StoreValue["addTechnician"]>((input) => {
    setTechnicians((list) => [
      ...list,
      { ...input, id: `tech-${Date.now().toString(36)}` },
    ]);
  }, []);

  const updateTechnician = useCallback<StoreValue["updateTechnician"]>((id, patch) => {
    setTechnicians((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const deleteTechnician = useCallback((id: string) => {
    setTechnicians((list) => list.filter((t) => t.id !== id));
    // Unassign anything that pointed at them so no ticket is orphaned.
    setTickets((list) =>
      list.map((t) =>
        t.technicianId === id
          ? { ...t, technicianId: undefined, assignee: undefined }
          : t
      )
    );
  }, []);

  const resolveTicket = useCallback((ticketId: string, cost: number) => {
    setTickets((list) =>
      list.map((t) =>
        t.id === ticketId ? { ...t, status: "resolved" as TicketStatus, cost } : t
      )
    );
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      buildings,
      tickets,
      toasts,
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
      buildings, tickets, toasts, notify, dismissToast, addApartment, addLease,
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

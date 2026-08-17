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
  tickets as seedTickets,
  type Apartment,
  type Building,
  type RentStatus,
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
  assignTicket: (ticketId: string, technician: string, cost?: number) => void;
  resolveTicket: (ticketId: string, cost: number) => void;

  remindedKeys: string[];
};

const StoreContext = createContext<StoreValue | null>(null);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [buildings, setBuildings] = useState<Building[]>(() =>
    seedBuildings.map((b) => ({ ...b, apartments: b.apartments.map((a) => ({ ...a })) }))
  );
  const [tickets, setTickets] = useState<Ticket[]>(() => seedTickets.map((t) => ({ ...t })));
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

  const assignTicket = useCallback((ticketId: string, technician: string, cost?: number) => {
    setTickets((list) =>
      list.map((t) =>
        t.id === ticketId
          ? { ...t, assignee: technician, status: "assigned" as TicketStatus, cost: cost ?? t.cost }
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
      assignTicket,
      resolveTicket,
      remindedKeys,
    }),
    [
      buildings, tickets, toasts, notify, dismissToast, addApartment, addLease,
      recordPayment, markReminded, addTicket, assignTicket, resolveTicket, remindedKeys,
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

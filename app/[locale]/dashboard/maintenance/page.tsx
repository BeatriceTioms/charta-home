"use client";

import { useMemo, useState } from "react";
import { byOpenedDesc, type Ticket, type TicketStatus } from "@/lib/data";
import { useBuilding } from "@/lib/building-context";
import { useStore } from "@/lib/store";
import { useMoney } from "@/lib/money";
import { useI18n } from "@/lib/i18n/context";
import { PageTitle, StatCard, Tabs, TicketChip, ViaBadge } from "@/components/dashboard/ui";
import { Field, Modal, ModalActions, fieldCls } from "@/components/dashboard/Modal";
import { TechniciansPanel } from "@/components/dashboard/TechniciansPanel";

const selectCls =
  "rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 text-sm font-semibold text-azure-950 backdrop-blur-xl outline-none transition hover:bg-azure-900/5 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:[&>option]:bg-onyx";

function NewTicketModal({ onClose }: { onClose: () => void }) {
  const { t, f, s: ts } = useI18n();
  const { building } = useBuilding();
  const { addTicket, notify } = useStore();
  const m = t.dash.maintenance.newModal;
  const [error, setError] = useState<string>();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    if (!title) {
      setError(t.dash.common.required);
      return;
    }
    const aptId = String(data.get("apartment") ?? "");
    const apt = building.apartments.find((a) => a.id === aptId);

    addTicket({
      buildingId: building.id,
      title,
      apartment: apt ? apt.label : t.seed.commonArea,
      apartmentId: aptId || null,
      description: String(data.get("description") ?? ""),
      reportedVia: (data.get("via") as "whatsapp" | "phone" | "email") ?? "whatsapp",
      priority: (data.get("priority") as "normal" | "high" | "urgent") ?? "normal",
      tenant: apt?.tenant?.name,
    });
    notify(m.created);
    onClose();
  };

  return (
    <Modal title={m.title} subtitle={f(m.subtitle, { building: building.name })} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={m.titleField} error={error}>
          <input name="title" placeholder={m.titlePlaceholder} className={fieldCls} />
        </Field>
        <Field label={m.apartment}>
          <select name="apartment" defaultValue="" className={fieldCls}>
            <option value="">{m.commonArea}</option>
            {building.apartments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={m.description}>
          <textarea
            name="description"
            rows={3}
            placeholder={m.descriptionPlaceholder}
            className={`${fieldCls} resize-none`}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={m.via}>
            <select name="via" defaultValue="whatsapp" className={fieldCls}>
              <option value="whatsapp">{t.dash.maintenance.via.whatsapp}</option>
              <option value="phone">{t.dash.maintenance.via.phone}</option>
              <option value="email">{t.dash.maintenance.via.email}</option>
            </select>
          </Field>
          <Field label={m.priority}>
            <select name="priority" defaultValue="normal" className={fieldCls}>
              <option value="normal">{m.priorities.normal}</option>
              <option value="high">{m.priorities.high}</option>
              <option value="urgent">{m.priorities.urgent}</option>
            </select>
          </Field>
        </div>
        <ModalActions onCancel={onClose} submitLabel={m.submit} />
      </form>
    </Modal>
  );
}

/** Handles both first assignment and reassignment. */
function AssignModal({
  ticket,
  reassign,
  onClose,
}: {
  ticket: Ticket;
  reassign: boolean;
  onClose: () => void;
}) {
  const { t, f, s: ts } = useI18n();
  const { assignTicket, technicians, notify } = useStore();
  const m = reassign ? t.dash.maintenance.reassignModal : t.dash.maintenance.assignModal;

  const current = technicians.find(
    (x) => x.id === ticket.technicianId || ticket.assignee?.startsWith(x.name)
  );
  const options = reassign ? technicians.filter((x) => x.id !== current?.id) : technicians;
  const [techId, setTechId] = useState(options[0]?.id ?? "");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const tech = technicians.find((x) => x.id === techId);
    if (!tech) return;
    const cost = Number(new FormData(e.currentTarget).get("cost") ?? 0);
    assignTicket(ticket.id, tech.id, cost > 0 ? cost : undefined);
    notify(
      reassign
        ? f(t.dash.maintenance.reassignModal.reassigned, { name: tech.name })
        : f(t.dash.maintenance.assignModal.assigned, { name: tech.name })
    );
    onClose();
  };

  return (
    <Modal
      title={m.title}
      subtitle={
        reassign
          ? f(t.dash.maintenance.reassignModal.subtitle, {
              ticket: ticket.title,
              current: current?.name ?? t.dash.maintenance.unassigned,
            })
          : f(t.dash.maintenance.assignModal.subtitle, { ticket: ticket.title })
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        {reassign && current && (
          <Field label={t.dash.maintenance.reassignModal.current}>
            <div className="flex items-center gap-3 rounded-2xl border border-azure-900/10 bg-azure-900/5 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-azure-800 text-[11px] font-bold text-soft-500">
                {current.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
              </span>
              <span className="text-sm font-semibold text-azure-950 dark:text-white">
                {current.name} · {current.trade}
              </span>
            </div>
          </Field>
        )}

        <Field label={reassign ? t.dash.maintenance.reassignModal.newTech : t.dash.maintenance.assignModal.technician}>
          <select
            value={techId}
            onChange={(e) => setTechId(e.target.value)}
            className={fieldCls}
          >
            {options.length === 0 && <option disabled>{t.dash.technicians.empty}</option>}
            {options.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name} · {tech.trade}
              </option>
            ))}
          </select>
        </Field>

        {!reassign && (
          <Field label={t.dash.maintenance.assignModal.cost}>
            <input name="cost" type="number" min={0} step={5} className={fieldCls} />
          </Field>
        )}

        <ModalActions onCancel={onClose} submitLabel={m.submit} disabled={options.length === 0} />
      </form>
    </Modal>
  );
}

function EditTicketModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const { t, f, s: ts } = useI18n();
  const { building } = useBuilding();
  const { updateTicket, notify } = useStore();
  const m = t.dash.maintenance.editModal;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const aptId = String(data.get("apartment") ?? "");
    const apt = building.apartments.find((a) => a.id === aptId);
    updateTicket(ticket.id, {
      title: String(data.get("title") ?? ticket.title).trim() || ticket.title,
      description: String(data.get("description") ?? ""),
      priority: (data.get("priority") as "normal" | "high" | "urgent") ?? "normal",
      apartment: apt ? apt.label : t.seed.commonArea,
      apartmentId: aptId || null,
    });
    notify(m.updated);
    onClose();
  };

  const currentApt = building.apartments.find((a) => a.label === ticket.apartment);

  return (
    <Modal title={m.title} subtitle={f(m.subtitle, { ticket: ticket.title })} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t.dash.maintenance.newModal.titleField}>
          <input name="title" defaultValue={ticket.title} className={fieldCls} />
        </Field>
        <Field label={t.dash.maintenance.newModal.apartment}>
          <select name="apartment" defaultValue={currentApt?.id ?? ""} className={fieldCls}>
            <option value="">{t.dash.maintenance.newModal.commonArea}</option>
            {building.apartments.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </Field>
        <Field label={t.dash.maintenance.newModal.description}>
          <textarea
            name="description"
            rows={3}
            defaultValue={ticket.description ?? ""}
            className={`${fieldCls} resize-none`}
          />
        </Field>
        <Field label={t.dash.maintenance.newModal.priority}>
          <select name="priority" defaultValue={ticket.priority ?? "normal"} className={fieldCls}>
            <option value="normal">{t.dash.maintenance.newModal.priorities.normal}</option>
            <option value="high">{t.dash.maintenance.newModal.priorities.high}</option>
            <option value="urgent">{t.dash.maintenance.newModal.priorities.urgent}</option>
          </select>
        </Field>
        <ModalActions onCancel={onClose} submitLabel={m.submit} />
      </form>
    </Modal>
  );
}

function DeleteTicketModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const { t, f, s: ts } = useI18n();
  const { deleteTicket, notify } = useStore();
  const m = t.dash.maintenance.deleteConfirm;

  return (
    <Modal title={m.title} subtitle={f(m.subtitle, { ticket: ticket.title })} onClose={onClose}>
      <div className="flex gap-3">
        <button
          onClick={() => {
            deleteTicket(ticket.id);
            notify(m.deleted);
            onClose();
          }}
          className="flex-1 rounded-full bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          {m.submit}
        </button>
        <button
          onClick={onClose}
          className="rounded-full border border-azure-900/15 px-6 py-3 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
        >
          {t.dash.common.cancel}
        </button>
      </div>
    </Modal>
  );
}

function ResolveModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const { t, f, s: ts } = useI18n();
  const { resolveTicket, notify } = useStore();
  const m = t.dash.maintenance.resolveModal;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cost = Number(new FormData(e.currentTarget).get("cost") ?? 0);
    resolveTicket(ticket.id, cost);
    notify(m.resolved);
    onClose();
  };

  return (
    <Modal
      title={m.title}
      subtitle={f(m.subtitle, { ticket: ticket.title })}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label={m.cost}>
          <input
            name="cost"
            type="number"
            min={0}
            step={5}
            defaultValue={ticket.cost ?? 0}
            className={fieldCls}
          />
        </Field>
        <ModalActions onCancel={onClose} submitLabel={m.submit} />
      </form>
    </Modal>
  );
}

type View = "tickets" | "technicians";

export default function MaintenancePage() {
  const { building } = useBuilding();
  const { tickets, technicians } = useStore();
  const { t, f, s: ts } = useI18n();
  const { fmt } = useMoney();

  const [view, setView] = useState<View>("tickets");
  const [addingTech, setAddingTech] = useState(false);
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("all");
  const [status, setStatus] = useState("all");
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<{ ticket: Ticket; reassign: boolean } | null>(null);
  const [resolving, setResolving] = useState<Ticket | null>(null);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [deleting, setDeleting] = useState<Ticket | null>(null);

  const buildingTickets = tickets.filter((x) => x.buildingId === building.id);
  const months = [...new Set(buildingTickets.map((x) => x.month))];
  const years = [...new Set(buildingTickets.map((x) => x.year))].sort((a, b) => b - a);

  const filtered = useMemo(
    () =>
      buildingTickets
        .filter(
          (x) =>
            (month === "all" || x.month === month) &&
            (year === "all" || x.year === Number(year)) &&
            (status === "all" || x.status === status)
        )
        .sort(byOpenedDesc),
    [buildingTickets, month, year, status]
  );

  const open = filtered.filter((x) => x.status !== "resolved");
  const resolved = filtered.filter((x) => x.status === "resolved");
  const spent = filtered.reduce((s, x) => s + (x.cost ?? 0), 0);
  const avgDelay = resolved.length
    ? (resolved.reduce((s, x) => s + x.daysOpen, 0) / resolved.length).toFixed(1)
    : "0";

  return (
    <>
      <PageTitle
        title={t.dash.maintenance.title}
        subtitle={f(t.dash.maintenance.subtitle, { building: building.name })}
        action={
          view === "tickets" ? (
            <button
              onClick={() => setCreating(true)}
              className="rounded-full bg-onyx px-6 py-3 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
            >
              {t.dash.maintenance.newTicket}
            </button>
          ) : (
            <button
              onClick={() => setAddingTech(true)}
              className="rounded-full bg-onyx px-6 py-3 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
            >
              {t.dash.technicians.add}
            </button>
          )
        }
      />

      <Tabs
        active={view}
        onChange={setView}
        tabs={[
          { key: "tickets", label: t.dash.maintenance.tabs.tickets, count: buildingTickets.length },
          {
            key: "technicians",
            label: t.dash.maintenance.tabs.technicians,
            count: technicians.length,
          },
        ]}
      />

      {view === "technicians" ? (
        <TechniciansPanel
          adding={addingTech}
          onCloseAdd={() => setAddingTech(false)}
          tickets={buildingTickets}
        />
      ) : (
        <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard emphasis label={t.dash.maintenance.openTickets} value={String(open.length)} hint={t.dash.maintenance.inPeriod} />
          <StatCard label={t.dash.maintenance.resolved} value={String(resolved.length)} hint={t.dash.maintenance.inPeriod} />
          <StatCard label={t.dash.maintenance.moneySpent} value={fmt(spent)} hint={t.dash.maintenance.repairs} />
          <StatCard
            label={t.dash.maintenance.averageDelay}
            value={`${avgDelay} ${t.dash.common.days}`}
            hint={t.dash.maintenance.reportToFix}
          />
        </div>

        <div className="mt-6 rounded-3xl border border-white/70 bg-white/55 shadow-lg shadow-azure-900/5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6">
            <p className="text-lg font-bold text-azure-950 dark:text-white">
              {t.dash.maintenance.tickets}{" "}
              <span className="ml-1 text-sm font-medium text-onyx/40 dark:text-white/40">
                {t.dash.common.total} {filtered.length}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <select value={month} onChange={(e) => setMonth(e.target.value)} className={selectCls} aria-label={t.dash.common.allMonths}>
                <option value="all">{t.dash.common.allMonths}</option>
                {months.map((mm) => (
                  <option key={mm} value={mm}>{ts("months", mm)}</option>
                ))}
              </select>
              <select value={year} onChange={(e) => setYear(e.target.value)} className={selectCls} aria-label={t.dash.common.allYears}>
                <option value="all">{t.dash.common.allYears}</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls} aria-label={t.dash.common.allStatuses}>
                <option value="all">{t.dash.common.allStatuses}</option>
                <option value="new">{t.dash.status.new}</option>
                <option value="assigned">{t.dash.status.assigned}</option>
                <option value="in-progress">{t.dash.status.inProgress}</option>
                <option value="resolved">{t.dash.status.resolved}</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="border-y border-white/60 bg-white/40 text-xs text-onyx/45 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/40">
                  <th className="px-6 py-3.5 font-semibold">{t.dash.maintenance.ticket}</th>
                  <th className="py-3.5 pr-4 font-semibold">{t.dash.maintenance.tenant}</th>
                  <th className="py-3.5 pr-4 font-semibold">{t.dash.maintenance.apartment}</th>
                  <th className="py-3.5 pr-4 font-semibold">{t.dash.maintenance.technician}</th>
                  <th className="py-3.5 pr-4 font-semibold">{t.dash.maintenance.status}</th>
                  <th className="py-3.5 pr-4 font-semibold">{t.dash.maintenance.cost}</th>
                  <th className="py-3.5 pr-4 font-semibold">{t.dash.maintenance.delay}</th>
                  <th className="py-3.5 pr-6 font-semibold">{t.dash.rent.action}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-onyx/45 dark:text-white/45">
                      {t.dash.maintenance.empty}
                    </td>
                  </tr>
                )}
                {filtered.map((x) => (
                  <tr key={x.id} className="border-b border-azure-900/5 last:border-0 dark:border-white/5">
                    <td className="px-6 py-4">
                      <p className="font-bold text-azure-950 dark:text-white">{x.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-onyx/40 dark:text-white/40">{x.id}</span>
                        <ViaBadge via={x.reportedVia} />
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      {x.tenant ? (
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-azure-800 text-[10px] font-bold text-soft-500">
                            {x.tenant.split(" ").map((w) => w[0]).join("")}
                          </span>
                          <span className="whitespace-nowrap text-onyx/75 dark:text-white/75">{x.tenant}</span>
                        </div>
                      ) : (
                        <span className="text-onyx/40 dark:text-white/40">{t.dash.maintenance.building}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4 font-semibold text-azure-950 dark:text-white">
                      {x.apartment}
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4 text-onyx/70 dark:text-white/70">
                      {x.assignee ?? (
                        <span className="text-onyx/35 dark:text-white/35">{t.dash.maintenance.unassigned}</span>
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      <TicketChip status={x.status as TicketStatus} />
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4 font-bold text-azure-950 dark:text-white">
                      {x.cost !== undefined ? (
                        fmt(x.cost)
                      ) : (
                        <span className="font-medium text-onyx/40 dark:text-white/40">
                          {t.dash.common.pending}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4 text-onyx/60 dark:text-white/60">
                      {x.daysOpen} {x.daysOpen === 1 ? t.dash.common.day : t.dash.common.days}
                    </td>
                    <td className="py-4 pr-6">
                      <div className="flex flex-wrap items-center gap-2">
                        {x.status !== "resolved" && (
                          <>
                            <button
                              onClick={() => setAssigning({ ticket: x, reassign: Boolean(x.assignee) })}
                              className="whitespace-nowrap rounded-xl border border-azure-900/15 px-3.5 py-1.5 text-xs font-semibold text-azure-600 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-soft-500 dark:hover:bg-white/10"
                            >
                              {x.assignee ? t.dash.maintenance.reassign : t.dash.maintenance.assign}
                            </button>
                            <button
                              onClick={() => setResolving(x)}
                              className="whitespace-nowrap rounded-xl bg-onyx px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-azure-900 dark:bg-white dark:text-onyx dark:hover:bg-soft-400"
                            >
                              {t.dash.maintenance.resolve}
                            </button>
                        </>
                      )}
                      <button
                        onClick={() => setEditingTicket(x)}
                        aria-label={t.dash.maintenance.edit}
                        title={t.dash.maintenance.edit}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-azure-900/15 text-onyx/60 transition hover:bg-azure-900/5 hover:text-azure-950 dark:border-white/15 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleting(x)}
                        aria-label={t.dash.maintenance.delete}
                        title={t.dash.maintenance.delete}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-azure-900/15 text-red-600 transition hover:bg-red-50 dark:border-white/15 dark:hover:bg-red-500/10"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {creating && <NewTicketModal onClose={() => setCreating(false)} />}
      {assigning && (
        <AssignModal
          ticket={assigning.ticket}
          reassign={assigning.reassign}
          onClose={() => setAssigning(null)}
        />
      )}
      {resolving && <ResolveModal ticket={resolving} onClose={() => setResolving(null)} />}
      {editingTicket && <EditTicketModal ticket={editingTicket} onClose={() => setEditingTicket(null)} />}
      {deleting && <DeleteTicketModal ticket={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}

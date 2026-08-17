"use client";

import { useMemo, useState } from "react";
import { fmt, type Technician } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardTitle, PageTitle, StatCard } from "@/components/dashboard/ui";
import { Field, Modal, ModalActions, fieldCls } from "@/components/dashboard/Modal";

type Stats = {
  tech: Technician;
  jobsTotal: number;
  jobsOpen: number;
  jobsResolved: number;
  totalPaid: number;
  avgDays: number | null;
  lastJob: string | null;
};

function TechnicianForm({
  technician,
  onClose,
}: {
  technician?: Technician;
  onClose: () => void;
}) {
  const { t, f } = useI18n();
  const { addTechnician, updateTechnician, notify } = useStore();
  const tr = t.dash.technicians;
  const m = technician ? tr.editModal : tr.addModal;
  const [error, setError] = useState<string>();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    if (!name) {
      setError(t.dash.common.required);
      return;
    }
    const payload = {
      name,
      trade: String(data.get("trade") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
      isExternal: data.get("type") === "external",
      since: technician?.since ?? new Date().toLocaleDateString("fr-FR", { month: "short", year: "numeric" }),
    };

    if (technician) {
      updateTechnician(technician.id, payload);
      notify(f(tr.editModal.updated, { name }));
    } else {
      addTechnician(payload);
      notify(f(tr.addModal.added, { name }));
    }
    onClose();
  };

  return (
    <Modal
      title={m.title}
      subtitle={technician ? f(tr.editModal.subtitle, { name: technician.name }) : tr.addModal.subtitle}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label={tr.name} error={error}>
          <input
            name="name"
            defaultValue={technician?.name}
            placeholder={tr.addModal.namePlaceholder}
            className={fieldCls}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr.trade}>
            <input
              name="trade"
              defaultValue={technician?.trade}
              placeholder={tr.addModal.tradePlaceholder}
              className={fieldCls}
            />
          </Field>
          <Field label={tr.type}>
            <select
              name="type"
              defaultValue={technician?.isExternal === false ? "internal" : "external"}
              className={fieldCls}
            >
              <option value="external">{tr.external}</option>
              <option value="internal">{tr.internal}</option>
            </select>
          </Field>
        </div>
        <Field label={tr.phone}>
          <input
            name="phone"
            defaultValue={technician?.phone}
            placeholder={tr.addModal.phonePlaceholder}
            className={fieldCls}
          />
        </Field>
        <ModalActions onCancel={onClose} submitLabel={m.submit} />
      </form>
    </Modal>
  );
}

export default function TechniciansPage() {
  const { t, f, s: ts } = useI18n();
  const { technicians, tickets, deleteTechnician, notify } = useStore();
  const tr = t.dash.technicians;

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Technician | null>(null);
  const [removing, setRemoving] = useState<Technician | null>(null);

  const stats: Stats[] = useMemo(
    () =>
      technicians.map((tech) => {
        // Match on id, and fall back to the seeded assignee text for demo data.
        const mine = tickets.filter(
          (x) => x.technicianId === tech.id || x.assignee?.startsWith(tech.name)
        );
        const resolved = mine.filter((x) => x.status === "resolved");
        return {
          tech,
          jobsTotal: mine.length,
          jobsOpen: mine.length - resolved.length,
          jobsResolved: resolved.length,
          totalPaid: resolved.reduce((sum, x) => sum + (x.cost ?? 0), 0),
          avgDays: resolved.length
            ? Number(
                (resolved.reduce((sum, x) => sum + x.daysOpen, 0) / resolved.length).toFixed(1)
              )
            : null,
          lastJob: resolved.at(-1)?.openedOn ?? null,
        };
      }),
    [technicians, tickets]
  );

  const totalSpent = stats.reduce((sum, s) => sum + s.totalPaid, 0);
  const openJobs = stats.reduce((sum, s) => sum + s.jobsOpen, 0);

  return (
    <>
      <PageTitle
        title={tr.title}
        subtitle={f(tr.subtitle, { agency: "Horizon Realty" })}
        action={
          <button
            onClick={() => setAdding(true)}
            className="rounded-full bg-onyx px-6 py-3 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
          >
            {tr.add}
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard emphasis label={tr.activeCount} value={String(technicians.length)} hint={tr.title} />
        <StatCard label={tr.totalSpent} value={fmt(totalSpent)} hint={t.dash.maintenance.repairs} />
        <StatCard label={tr.openJobs} value={String(openJobs)} hint={t.dash.maintenance.inPeriod} />
      </div>

      <Card className="mt-6 overflow-hidden p-0">
        <div className="p-6">
          <CardTitle>
            {technicians.length} {tr.title.toLowerCase()}
          </CardTitle>
        </div>

        {technicians.length === 0 ? (
          <p className="px-6 pb-10 text-center text-sm text-onyx/45 dark:text-white/45">{tr.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-y border-white/60 bg-white/40 text-xs text-onyx/45 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/40">
                  <th className="px-6 py-3.5 font-semibold">{tr.name}</th>
                  <th className="py-3.5 font-semibold">{tr.phone}</th>
                  <th className="py-3.5 font-semibold">{tr.jobsTotal}</th>
                  <th className="py-3.5 font-semibold">{tr.jobsOpen}</th>
                  <th className="py-3.5 font-semibold">{tr.jobsResolved}</th>
                  <th className="py-3.5 font-semibold">{tr.totalPaid}</th>
                  <th className="py-3.5 font-semibold">{tr.avgDelay}</th>
                  <th className="py-3.5 pr-6 font-semibold">{tr.actions}</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(({ tech, jobsTotal, jobsOpen, jobsResolved, totalPaid, avgDays }) => (
                  <tr key={tech.id} className="border-b border-azure-900/5 last:border-0 dark:border-white/5">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-azure-800 text-[11px] font-bold text-soft-500">
                          {tech.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-azure-950 dark:text-white">{tech.name}</p>
                          <p className="text-xs text-onyx/45 dark:text-white/45">
                            {ts("trades", tech.trade) || tech.trade} ·{" "}
                            {tech.isExternal ? tr.external : tr.internal}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4 text-onyx/70 dark:text-white/70">
                      {tech.phone || "—"}
                    </td>
                    <td className="py-4 pr-4 font-bold text-azure-950 dark:text-white">{jobsTotal}</td>
                    <td className="py-4 pr-4">
                      {jobsOpen > 0 ? (
                        <span className="rounded-full bg-onyx px-2.5 py-1 text-[11px] font-bold text-white dark:bg-white dark:text-onyx">
                          {jobsOpen}
                        </span>
                      ) : (
                        <span className="text-onyx/35 dark:text-white/35">0</span>
                      )}
                    </td>
                    <td className="py-4 pr-4 text-onyx/70 dark:text-white/70">{jobsResolved}</td>
                    <td className="whitespace-nowrap py-4 pr-4 font-bold text-azure-950 dark:text-white">
                      {fmt(totalPaid)}
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4 text-onyx/60 dark:text-white/60">
                      {avgDays === null
                        ? tr.never
                        : `${avgDays} ${avgDays === 1 ? t.dash.common.day : t.dash.common.days}`}
                    </td>
                    <td className="py-4 pr-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditing(tech)}
                          className="rounded-xl border border-azure-900/15 px-3.5 py-1.5 text-xs font-semibold text-azure-950 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                        >
                          {t.dash.maintenance.edit}
                        </button>
                        <button
                          onClick={() => setRemoving(tech)}
                          className="rounded-xl border border-azure-900/15 px-3.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-white/15 dark:hover:bg-red-500/10"
                        >
                          {t.dash.maintenance.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {adding && <TechnicianForm onClose={() => setAdding(false)} />}
      {editing && <TechnicianForm technician={editing} onClose={() => setEditing(null)} />}

      {removing && (
        <Modal
          title={f(tr.deleteConfirm.title, { name: removing.name })}
          subtitle={tr.deleteConfirm.subtitle}
          onClose={() => setRemoving(null)}
        >
          <div className="flex gap-3">
            <button
              onClick={() => {
                deleteTechnician(removing.id);
                notify(f(tr.deleteConfirm.deleted, { name: removing.name }));
                setRemoving(null);
              }}
              className="flex-1 rounded-full bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              {tr.deleteConfirm.submit}
            </button>
            <button
              onClick={() => setRemoving(null)}
              className="rounded-full border border-azure-900/15 px-6 py-3 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              {t.dash.common.cancel}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

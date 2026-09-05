"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Lead } from "@/lib/types";
import { acquisitionChannels } from "@/lib/mock-data";
import { FunnelBucket, dateForBucket } from "@/lib/funnel";
import { cn, formatMoney } from "@/lib/utils";
import { Plus, Search } from "lucide-react";
import { FunnelBoard } from "@/components/funnel/funnel-board";
import { LeadModal, type StaffMember } from "@/components/funnel/lead-modal";

type View = "open" | "won" | "lost";

const VIEWS: { key: View; label: string }[] = [
  { key: "open", label: "Доска" },
  { key: "won", label: "Успешные" },
  { key: "lost", label: "Не реализованы" },
];

export default function FunnelPage() {
  const { can } = useAuth();
  const canEdit = can("leads.edit");

  const [view, setView] = useState<View>("open");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totals, setTotals] = useState({ count: 0, amount: 0 });
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [manager, setManager] = useState("");
  const [source, setSource] = useState("");

  const [editing, setEditing] = useState<Lead | null>(null);
  const [creating, setCreating] = useState(false);

  // Колонка вычисляется от текущей даты, поэтому вкладку, открытую со вчера,
  // надо пересчитывать. Раз в минуту — достаточно и почти бесплатно.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status: view });
    if (search.trim()) params.set("q", search.trim());
    if (manager) params.set("manager", manager);
    if (source) params.set("source", source);

    const res = await fetch(`/api/leads?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLeads(data.leads);
      setTotals(data.totals);
    }
    setLoading(false);
  }, [view, search, manager, source]);

  // Поиск не дёргает сервер на каждую букву
  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, search]);

  useEffect(() => {
    fetch("/api/staff")
      .then((r) => (r.ok ? r.json() : []))
      .then(setStaff)
      .catch(() => setStaff([]));
  }, []);

  /** Оптимистичное обновление: интерфейс двигается сразу, при ошибке откат */
  async function patchLead(lead: Lead, patch: Partial<Lead>) {
    const prev = leads;
    setLeads((list) => list.map((l) => (l.id === lead.id ? { ...l, ...patch } : l)));
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setLeads(prev);
      alert("Не удалось обновить заявку");
      return;
    }
    load();
  }

  function moveBucket(lead: Lead, bucket: FunnelBucket) {
    if (bucket === "unavailable") return patchLead(lead, { unavailable: true });
    patchLead(lead, { unavailable: false, neededAt: dateForBucket(bucket, now) });
  }

  if (!can("leads.view")) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-[13.5px] text-[var(--color-text-muted)]">
        Нет доступа к разделу «Воронка»
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="min-w-0">
          <h1 className="font-display text-[20px] font-bold">Воронка</h1>
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {totals.count} сделки — {formatMoney(totals.amount)}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-primary)] transition hover:bg-[var(--color-primary-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> Новая заявка
          </button>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
          <div className="col-span-2 flex items-center gap-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] p-1 sm:col-span-1">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => {
                  setView(v.key);
                  setLoading(true);
                }}
                className={cn(
                  "flex-1 whitespace-nowrap rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition sm:flex-none",
                  view === v.key ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)]"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="relative col-span-2 sm:min-w-[220px] sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по инструменту, клиенту, телефону, номеру"
              className="w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition focus:border-[var(--color-primary)]"
            />
          </div>

          <select
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            className="w-full min-w-0 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[13px] font-medium text-[var(--color-text-muted)] outline-none sm:w-auto"
          >
            <option value="">Все менеджеры</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full min-w-0 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[13px] font-medium text-[var(--color-text-muted)] outline-none sm:w-auto"
          >
            <option value="">Канал привлечения</option>
            {acquisitionChannels.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="py-10 text-center text-[13px] text-[var(--color-text-muted)]">Загрузка…</p>
        ) : view !== "open" ? (
          <ClosedList leads={leads} onOpen={setEditing} canEdit={canEdit} />
        ) : leads.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center card-shadow">
            <p className="text-[13.5px] text-[var(--color-text-muted)]">
              {canEdit ? "Заявок пока нет — создайте первую" : "Заявок пока нет"}
            </p>
          </div>
        ) : (
          <FunnelBoard
            leads={leads}
            now={now}
            canEdit={canEdit}
            onOpen={(l) => canEdit && setEditing(l)}
            onMoveBucket={moveBucket}
            onClose={(l, status) => patchLead(l, { status })}
          />
        )}
      </div>

      {creating && <LeadModal staff={staff} onClose={() => setCreating(false)} onSaved={load} />}
      {editing && <LeadModal lead={editing} staff={staff} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function ClosedList({ leads, onOpen, canEdit }: { leads: Lead[]; onOpen: (l: Lead) => void; canEdit: boolean }) {
  if (leads.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center card-shadow">
        <p className="text-[13.5px] text-[var(--color-text-muted)]">Пока пусто</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {leads.map((l) => (
        <button
          key={l.id}
          onClick={() => canEdit && onOpen(l)}
          className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left card-shadow transition hover:border-[var(--color-primary)]"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[13px] font-semibold uppercase text-[var(--color-primary)]">{l.title}</span>
            <span className="shrink-0 text-[11.5px] text-[var(--color-text-muted)]">№{l.number}</span>
          </div>
          <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            {l.clientName ?? "—"} · {l.phone ?? "—"}
          </div>
          <div className="mt-1.5 text-[12.5px] font-semibold">{formatMoney(l.amount)}</div>
        </button>
      ))}
    </div>
  );
}

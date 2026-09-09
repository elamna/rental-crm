"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Lead } from "@/lib/types";
import { acquisitionChannels } from "@/lib/mock-data";
import { FunnelBucket, patchForBucket } from "@/lib/funnel";
import { cn, formatMoney } from "@/lib/utils";
import { BarChart3, CalendarClock, Plus, Search, X } from "lucide-react";
import { FunnelBoard } from "@/components/funnel/funnel-board";
import { LeadModal, type StaffMember } from "@/components/funnel/lead-modal";
import { DaySummary } from "@/components/funnel/day-summary";

type View = "open" | "won" | "lost" | "unavailable" | "otherCity";

const VIEWS: { key: View; label: string }[] = [
  { key: "open", label: "Доска" },
  { key: "won", label: "Успешные" },
  { key: "lost", label: "Не реализованы" },
  { key: "unavailable", label: "Нет в наличии" },
  { key: "otherCity", label: "Другой город" },
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
  // Счётчики на вкладках: сколько заявок ждут поставки и сколько не из города
  const [unavailableCount, setUnavailableCount] = useState(0);
  const [otherCityCount, setOtherCityCount] = useState(0);
  const [creating, setCreating] = useState(false);
  // Кому назначаем день и час — по кнопке на карточке или переносом в «Дату»
  const [schedulingLead, setSchedulingLead] = useState<Lead | null>(null);
  // Сводка за день — то, что вечером отправляют владельцу в переписку
  const [showSummary, setShowSummary] = useState(false);

  // Колонка вычисляется от текущей даты, поэтому вкладку, открытую со вчера,
  // надо пересчитывать. Раз в минуту — достаточно и почти бесплатно.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    // «Нет в наличии» — те же открытые заявки, просто с флагом: отдельного
    // статуса у них нет, иначе заявка теряла бы историю при возврате на доску
    const params = new URLSearchParams({ status: view === "unavailable" || view === "otherCity" ? "open" : view });
    if (search.trim()) params.set("q", search.trim());
    if (manager) params.set("manager", manager);
    if (source) params.set("source", source);

    const res = await fetch(`/api/leads?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLeads(data.leads);
      setTotals(data.totals);
      if (view === "open" || view === "unavailable" || view === "otherCity") {
        const open = data.leads as Lead[];
        setUnavailableCount(open.filter((l) => l.unavailable).length);
        setOtherCityCount(open.filter((l) => !l.unavailable && l.otherCity).length);
      }
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

  // Доска показывает только заявки с датой; ждущие поставки и иногородние —
  // на своих вкладках: им нужна не дата, а поставка или расчёт доставки
  const boardLeads = leads.filter((l) => !l.unavailable && !l.otherCity);
  const waitingLeads = leads.filter((l) => l.unavailable);
  const otherCityLeads = leads.filter((l) => !l.unavailable && l.otherCity);

  function moveBucket(lead: Lead, bucket: FunnelBucket) {
    const patch = patchForBucket(bucket, new Date());
    // Для «Даты» нужны конкретные день и час — их спрашиваем, а не выдумываем
    if (!patch) return setSchedulingLead(lead);
    patchLead(lead, patch);
  }

  /** Дата назначена: клиент уходит из «Новых» и «Будущих» в «Дату» */
  function schedule(lead: Lead, iso: string) {
    setSchedulingLead(null);
    patchLead(lead, { unavailable: false, otherCity: false, future: false, neededAt: iso });
  }

  if (!can("leads.view")) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-[14.5px] text-[var(--color-text-muted)]">
        Нет доступа к разделу «Воронка»
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="min-w-0">
          <h1 className="font-display text-[20px] font-bold">Воронка</h1>
          <p className="text-[14px] text-[var(--color-text-muted)]">
            {totals.count} сделки — {formatMoney(totals.amount)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSummary(true)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[14px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
          >
            <BarChart3 className="h-3.5 w-3.5" /> Сводка за день
          </button>
        {canEdit && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[14px] font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-primary)] transition hover:bg-[var(--color-primary-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> Новая заявка
          </button>
        )}
        </div>
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
                  "flex-1 whitespace-nowrap rounded-[8px] px-3 py-1.5 text-[13.5px] font-semibold transition sm:flex-none",
                  view === v.key ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)]"
                )}
              >
                {v.label}
                {v.key === "unavailable" && unavailableCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-[#F1F2F6] px-1.5 py-0.5 text-[12px] text-[var(--color-text-muted)]">
                    {unavailableCount}
                  </span>
                )}
                {v.key === "otherCity" && otherCityCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-[#E9F0FE] px-1.5 py-0.5 text-[12px] text-[#2B5FD9]">{otherCityCount}</span>
                )}
              </button>
            ))}
          </div>

          <div className="relative col-span-2 sm:min-w-[220px] sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по инструменту, клиенту, телефону, номеру"
              className="w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-9 pr-3 text-[14.5px] outline-none transition focus:border-[var(--color-primary)]"
            />
          </div>

          <select
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            className="w-full min-w-0 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[14px] font-medium text-[var(--color-text-muted)] outline-none sm:w-auto"
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
            className="w-full min-w-0 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[14px] font-medium text-[var(--color-text-muted)] outline-none sm:w-auto"
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
          <p className="py-10 text-center text-[14px] text-[var(--color-text-muted)]">Загрузка…</p>
        ) : view === "unavailable" ? (
          <ClosedList leads={waitingLeads} onOpen={setEditing} canEdit={canEdit} empty="Все заявки с инструментом — на доске" />
        ) : view === "otherCity" ? (
          <ClosedList leads={otherCityLeads} onOpen={setEditing} canEdit={canEdit} empty="Иногородних заявок нет" />
        ) : view !== "open" ? (
          <ClosedList leads={leads} onOpen={setEditing} canEdit={canEdit} />
        ) : boardLeads.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center card-shadow">
            <p className="text-[14.5px] text-[var(--color-text-muted)]">
              {canEdit ? "Заявок пока нет — создайте первую" : "Заявок пока нет"}
            </p>
          </div>
        ) : (
          <FunnelBoard
            leads={boardLeads}
            now={now}
            canEdit={canEdit}
            onOpen={(l) => canEdit && setEditing(l)}
            onMoveBucket={moveBucket}
            onSetDate={setSchedulingLead}
            onToggleOnTheWay={(lead, minutes) =>
              // Пустая строка и ноль, а не undefined: undefined выпадает из JSON
              // и отметка бы не снялась
              patchLead(lead, {
                onTheWayAt: minutes ? new Date().toISOString() : "",
                onTheWayMinutes: minutes ?? 0,
              })
            }
            onClose={(l, status) => patchLead(l, { status })}
          />
        )}
      </div>

      {schedulingLead && (
        <ScheduleModal lead={schedulingLead} onClose={() => setSchedulingLead(null)} onSave={schedule} />
      )}
      {showSummary && <DaySummary onClose={() => setShowSummary(false)} />}
      {creating && <LeadModal staff={staff} onClose={() => setCreating(false)} onSaved={load} />}
      {editing && <LeadModal lead={editing} staff={staff} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function ClosedList({
  leads,
  onOpen,
  canEdit,
  empty = "Пока пусто",
}: {
  leads: Lead[];
  onOpen: (l: Lead) => void;
  canEdit: boolean;
  empty?: string;
}) {
  if (leads.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center card-shadow">
        <p className="text-[14.5px] text-[var(--color-text-muted)]">{empty}</p>
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
            <span className="text-[14px] font-semibold uppercase text-[var(--color-primary)]">{l.title}</span>
            <span className="shrink-0 text-[12.5px] text-[var(--color-text-muted)]">№{l.number}</span>
          </div>
          <div className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {l.clientName ?? "—"} · {l.phone ?? "—"}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[13.5px] font-semibold">{formatMoney(l.amount)}</span>
            {l.managerName && (
              <span className="rounded-[6px] bg-[var(--color-bg)] px-1.5 py-0.5 text-[11.5px] text-[var(--color-text-muted)]">
                {l.managerName}
              </span>
            )}
            {!l.unavailable && l.otherCity && (
              <span className="rounded-[6px] bg-[#E9F0FE] px-1.5 py-0.5 text-[11.5px] font-medium text-[#2B5FD9]">Другой город</span>
            )}
            {l.unavailable && (
              <span className="rounded-[6px] bg-[#F1F2F6] px-1.5 py-0.5 text-[11.5px] font-medium text-[#6E6C63]">Ждём поставки</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

/**
 * «Когда нужен инструмент» — короткий диалог на два поля.
 *
 * Колонка называется «Дата» именно потому, что без дня и часа она пустая:
 * подставлять их за менеджера нельзя — он для того клиенту и звонит.
 * Отсюда карточка уходит в «Дату» и сама вернётся в «Новые», когда время придёт.
 */
function ScheduleModal({
  lead,
  onClose,
  onSave,
}: {
  lead: Lead;
  onClose: () => void;
  onSave: (lead: Lead, iso: string) => void;
}) {
  const existing = lead.neededAt ? new Date(lead.neededAt) : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const [date, setDate] = useState(
    existing && !isNaN(existing.getTime())
      ? `${existing.getFullYear()}-${pad(existing.getMonth() + 1)}-${pad(existing.getDate())}`
      : ""
  );
  const [time, setTime] = useState(
    existing && !isNaN(existing.getTime()) ? `${pad(existing.getHours())}:${pad(existing.getMinutes())}` : ""
  );

  const ready = !!date && !!time;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-[20px] bg-[var(--color-surface)] p-5 pb-8 shadow-xl safe-bottom sm:rounded-[var(--radius-card)] sm:pb-5"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-[16px] font-semibold">
              <CalendarClock className="h-4 w-4 text-[var(--color-primary)]" /> Когда нужен инструмент
            </h3>
            <p className="text-[13px] text-[var(--color-text-muted)]">
              №{lead.number} · {lead.title}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] transition hover:text-[#C0272D]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[13.5px] font-semibold">Дата</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="crm-input" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13.5px] font-semibold">Время</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="crm-input" />
          </label>
        </div>

        <p className="mt-3 rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-text-muted)]">
          Карточка встанет в «Дату» и сама вернётся в «Новые», когда наступит это время.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-[10px] border border-[var(--color-border)] px-4 py-2.5 text-[14px] font-semibold text-[var(--color-text-muted)]">
            Отмена
          </button>
          <button
            disabled={!ready}
            onClick={() => onSave(lead, new Date(`${date}T${time}:00`).toISOString())}
            className="rounded-[10px] bg-[var(--color-primary)] px-5 py-2.5 text-[14px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Lead, LEAD_CONCERN_LABELS, LEAD_MOODS } from "@/lib/types";
import { BOARD_COLUMNS, FUNNEL_COLUMNS, FunnelBucket, groupLeads } from "@/lib/funnel";
import { cn, formatMoney } from "@/lib/utils";
import { useIsMobile } from "@/lib/use-is-mobile";
import { CalendarPlus, CheckCircle2, Phone, Timer, Truck, User, XCircle } from "lucide-react";

export function FunnelBoard({
  leads,
  now,
  canEdit,
  onOpen,
  onMoveBucket,
  onSetDate,
  onToggleOnTheWay,
  onClose,
}: {
  leads: Lead[];
  /** Текущее время приходит сверху: страница обновляет его сама, чтобы карточки
   *  переезжали в «сегодня» даже у вкладки, открытой со вчера */
  now: Date;
  canEdit: boolean;
  onOpen: (lead: Lead) => void;
  onMoveBucket: (lead: Lead, bucket: FunnelBucket) => void;
  /** Спросить у менеджера день и час — без них колонка «Дата» бессмысленна */
  onSetDate: (lead: Lead) => void;
  /** Клиент выехал (или передумал) — от этой отметки идёт таймер на карточке */
  onToggleOnTheWay: (lead: Lead, onTheWay: boolean) => void;
  onClose: (lead: Lead, status: "won" | "lost") => void;
}) {
  const isMobile = useIsMobile();
  const [dragging, setDragging] = useState<Lead | null>(null);
  const [dropZone, setDropZone] = useState<"won" | "lost" | null>(null);

  const grouped = groupLeads(leads, now);

  return (
    <div className="relative">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {BOARD_COLUMNS.map((col) => {
          const items = grouped.get(col.key) ?? [];
          const sum = items.reduce((s, l) => s + l.amount, 0);
          return (
            <div
              key={col.key}
              onDragOver={(e) => canEdit && e.preventDefault()}
              onDrop={() => {
                if (dragging && canEdit) onMoveBucket(dragging, col.key);
                setDragging(null);
              }}
              className="flex w-[280px] shrink-0 flex-col gap-2"
            >
              <div
                className={cn("rounded-[12px] border-l-[3px] px-3.5 py-2.5", col.bg)}
                style={{ borderLeftColor: col.accent }}
              >
                <div className="text-[14px] font-semibold" style={{ color: col.accent }}>
                  {col.label}
                </div>
                <div className="text-[12.5px] text-[var(--color-text-muted)]">
                  {items.length} сделки: {formatMoney(sum)}
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-[var(--color-text-muted)]">{col.hint}</div>
              </div>

              <div className="space-y-2">
                {items.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    now={now}
                    draggable={canEdit && !isMobile}
                    isMobile={isMobile}
                    canEdit={canEdit}
                    currentBucket={col.key}
                    onOpen={() => onOpen(lead)}
                    onDragStart={() => setDragging(lead)}
                    onMoveBucket={(b) => onMoveBucket(lead, b)}
                    onSetDate={() => onSetDate(lead)}
                    onToggleOnTheWay={(v) => onToggleOnTheWay(lead, v)}
                  />
                ))}
                {items.length === 0 && (
                  <p className="rounded-[10px] border border-dashed border-[var(--color-border)] py-5 text-center text-[13px] text-[var(--color-text-muted)]">
                    Пусто
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Полосы закрытия сделки — появляются, пока карточку тащат */}
      {dragging && canEdit && !isMobile && (
        <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex">
          {(
            [
              { key: "lost", label: "Не реализовано", icon: XCircle, cls: "bg-[var(--color-bg)] text-[var(--color-text-muted)]" },
              { key: "won", label: "Успешно завершено", icon: CheckCircle2, cls: "bg-[#1C8A46] text-white" },
            ] as const
          ).map((z) => {
            const Icon = z.icon;
            return (
              <div
                key={z.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropZone(z.key);
                }}
                onDragLeave={() => setDropZone(null)}
                onDrop={() => {
                  if (dragging) onClose(dragging, z.key);
                  setDragging(null);
                  setDropZone(null);
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 py-5 text-[15px] font-semibold transition",
                  z.cls,
                  dropZone === z.key && "brightness-95 ring-2 ring-inset ring-[var(--color-primary)]"
                )}
              >
                <Icon className="h-4 w-4" /> {z.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LeadCard({
  lead,
  now,
  draggable,
  isMobile,
  canEdit,
  currentBucket,
  onOpen,
  onDragStart,
  onMoveBucket,
  onSetDate,
  onToggleOnTheWay,
}: {
  lead: Lead;
  now: Date;
  draggable: boolean;
  isMobile: boolean;
  canEdit: boolean;
  currentBucket: FunnelBucket;
  onOpen: () => void;
  onDragStart: () => void;
  onMoveBucket: (b: FunnelBucket) => void;
  onSetDate: () => void;
  onToggleOnTheWay: (onTheWay: boolean) => void;
}) {
  // Время пришло вчера и раньше, а клиент всё ещё висит в «Новых» — это уже горит
  const overdue =
    !!lead.neededAt &&
    !lead.unavailable &&
    new Date(lead.neededAt).getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={cn(
        "rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 card-shadow transition hover:border-[var(--color-primary)]",
        draggable && "cursor-grab active:cursor-grabbing"
      )}
    >
      <button onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            {lead.mood ? <span className="shrink-0 text-[14px]">{LEAD_MOODS[lead.mood - 1]}</span> : null}
            <span className="text-[14px] font-semibold uppercase leading-tight text-[var(--color-primary)]">{lead.title}</span>
          </span>
          <span className="shrink-0 text-[12.5px] text-[var(--color-text-muted)]">№{lead.number}</span>
        </div>

        {lead.clientName && <div className="mt-1 truncate text-[13.5px] font-medium">{lead.clientName}</div>}

        <div className="mt-1.5 flex items-center justify-between gap-2 text-[13px]">
          <span className="flex min-w-0 items-center gap-1 text-[var(--color-text-muted)]">
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.phone ?? "—"}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[var(--color-text-muted)]">
            <User className="h-3 w-3" />
            {lead.managerName ?? "—"}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {lead.source && (
              <span className="rounded-[6px] bg-[var(--color-bg)] px-1.5 py-0.5 text-[11.5px] text-[var(--color-text-muted)]">{lead.source}</span>
            )}
            {lead.amount > 0 && (
              <span className="rounded-[6px] bg-[var(--color-primary-soft)] px-1.5 py-0.5 text-[11.5px] font-semibold text-[var(--color-primary)]">
                {formatMoney(lead.amount)}
              </span>
            )}
            {lead.otherCity && (
              <span className="rounded-[6px] bg-[#E9F0FE] px-1.5 py-0.5 text-[11.5px] font-medium text-[#2B5FD9]">Другой город</span>
            )}
            {lead.concerns?.map((c) => (
              <span key={c} className="rounded-[6px] bg-[#FFF4E5] px-1.5 py-0.5 text-[11.5px] font-medium text-[#B8620A]">
                {LEAD_CONCERN_LABELS[c]}
              </span>
            ))}
          </div>
          <span className={cn("text-[12.5px] text-[var(--color-text-muted)]", overdue && "font-semibold text-[#C0272D]")}>
            {lead.neededAt ? formatShortDate(lead.neededAt) : "дата не назначена"}
          </span>
        </div>
      </button>

      {/* Клиент выехал — на карточке идёт таймер, и видно, сколько его ждут */}
      {lead.onTheWayAt ? (
        <OnTheWayBadge since={lead.onTheWayAt} canEdit={canEdit} onCancel={() => onToggleOnTheWay(false)} />
      ) : (
        canEdit && (
          <button
            onClick={() => onToggleOnTheWay(true)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#2B5FD9] py-1.5 text-[13px] font-semibold text-[#2B5FD9] transition hover:bg-[#E9F0FE]"
          >
            <Truck className="h-3.5 w-3.5" /> В пути
          </button>
        )
      )}

      {/* В «Новом» и «Будущем» вся работа менеджера — узнать дату, поэтому кнопка прямо на карточке */}
      {canEdit && currentBucket !== "date" && (
        <button
          onClick={onSetDate}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[8px] border border-[var(--color-primary)] py-1.5 text-[13px] font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-soft)]"
        >
          <CalendarPlus className="h-3.5 w-3.5" /> Поставить дату
        </button>
      )}

      {/* На телефоне карточку не потащишь — колонка выбирается списком */}
      {canEdit && isMobile && (
        <select
          value={currentBucket}
          onChange={(e) => onMoveBucket(e.target.value as FunnelBucket)}
          className="mt-2 w-full rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[13px]"
        >
          {FUNNEL_COLUMNS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const pad = (n: number) => String(n).padStart(2, "0");
  // Полдень ставится по умолчанию при переносе карточки мышью — это не время встречи
  const noon = d.getHours() === 12 && d.getMinutes() === 0;
  return noon ? date : `${date}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Сколько минут клиенту дают на дорогу, прежде чем ожидание считается затянувшимся */
const WAY_MINUTES = 30;

/**
 * «Уже в пути» с живым таймером.
 *
 * Клиент сказал «выезжаю» — менеджер отмечает это одним нажатием, и дальше
 * карточка сама показывает, сколько его ждут. Полчаса идёт обратный отсчёт,
 * дальше время горит красным: столько человек уже опаздывает. Без такой отметки
 * «сейчас подъеду» живёт в голове менеджера и к вечеру теряется.
 */
function OnTheWayBadge({ since, canEdit, onCancel }: { since: string; canEdit: boolean; onCancel: () => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Таймер идёт в реальном времени, поэтому тикаем ежесекундно
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const started = new Date(since).getTime();
  if (isNaN(started)) return null;

  const passed = Math.max(0, Math.floor((now - started) / 1000));
  const left = WAY_MINUTES * 60 - passed;
  const late = left < 0;
  const shown = Math.abs(late ? left : left);
  const mm = String(Math.floor(shown / 60)).padStart(2, "0");
  const ss = String(shown % 60).padStart(2, "0");

  return (
    <div
      className={cn(
        "mt-2 flex items-center justify-between gap-2 rounded-[8px] px-2.5 py-1.5",
        late ? "bg-[#FDECEC]" : "bg-[#E9F0FE]"
      )}
    >
      <span className={cn("flex items-center gap-1.5 text-[13px] font-semibold", late ? "text-[#C0272D]" : "text-[#2B5FD9]")}>
        <Truck className="h-3.5 w-3.5" /> Уже в пути
      </span>
      <span className={cn("flex items-center gap-1 text-[13px] font-bold tabular-nums", late ? "text-[#C0272D]" : "text-[#2B5FD9]")}>
        <Timer className="h-3.5 w-3.5" />
        {late ? "+" : ""}
        {mm}:{ss}
      </span>
      {canEdit && (
        <button
          onClick={onCancel}
          title="Отменить отметку"
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)]"
        >
          <XCircle className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

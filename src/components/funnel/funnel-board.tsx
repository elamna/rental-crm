"use client";

import { useState } from "react";
import { Lead } from "@/lib/types";
import { FUNNEL_COLUMNS, FunnelBucket, groupLeads } from "@/lib/funnel";
import { cn, formatMoney } from "@/lib/utils";
import { useIsMobile } from "@/lib/use-is-mobile";
import { CheckCircle2, Phone, User, XCircle } from "lucide-react";

export function FunnelBoard({
  leads,
  now,
  canEdit,
  onOpen,
  onMoveBucket,
  onClose,
}: {
  leads: Lead[];
  /** Текущее время приходит сверху: страница обновляет его сама, чтобы карточки
   *  переезжали в «сегодня» даже у вкладки, открытой со вчера */
  now: Date;
  canEdit: boolean;
  onOpen: (lead: Lead) => void;
  onMoveBucket: (lead: Lead, bucket: FunnelBucket) => void;
  onClose: (lead: Lead, status: "won" | "lost") => void;
}) {
  const isMobile = useIsMobile();
  const [dragging, setDragging] = useState<Lead | null>(null);
  const [dropZone, setDropZone] = useState<"won" | "lost" | null>(null);

  const grouped = groupLeads(leads, now);

  return (
    <div className="relative">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {FUNNEL_COLUMNS.map((col) => {
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
                <div className="text-[13px] font-semibold" style={{ color: col.accent }}>
                  {col.label}
                </div>
                <div className="text-[11.5px] text-[var(--color-text-muted)]">
                  {items.length} сделки: {formatMoney(sum)}
                </div>
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
                  />
                ))}
                {items.length === 0 && (
                  <p className="rounded-[10px] border border-dashed border-[var(--color-border)] py-5 text-center text-[12px] text-[var(--color-text-muted)]">
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
                  "flex flex-1 items-center justify-center gap-2 py-5 text-[14px] font-semibold transition",
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
}) {
  const overdue =
    lead.neededAt && !lead.unavailable && new Date(lead.neededAt).getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

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
          <span className="text-[13px] font-semibold uppercase leading-tight text-[var(--color-primary)]">{lead.title}</span>
          <span className="shrink-0 text-[11.5px] text-[var(--color-text-muted)]">№{lead.number}</span>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px]">
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
              <span className="rounded-[6px] bg-[var(--color-bg)] px-1.5 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">{lead.source}</span>
            )}
            {lead.amount > 0 && (
              <span className="rounded-[6px] bg-[var(--color-primary-soft)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--color-primary)]">
                {formatMoney(lead.amount)}
              </span>
            )}
          </div>
          <span className={cn("text-[11.5px] text-[var(--color-text-muted)]", overdue && "font-semibold text-[#C0272D]")}>
            {lead.neededAt ? formatShortDate(lead.neededAt) : "без даты"}
          </span>
        </div>
      </button>

      {/* На телефоне карточку не потащишь — колонка выбирается списком */}
      {canEdit && isMobile && (
        <select
          value={currentBucket}
          onChange={(e) => onMoveBucket(e.target.value as FunnelBucket)}
          className="mt-2 w-full rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[12px]"
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
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

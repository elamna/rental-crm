"use client";

import { useEffect, useState } from "react";
import { RentalEvent, RentalPause } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PackagePlus, Pause, RotateCcw, Undo2, X } from "lucide-react";

function formatMoment(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EVENT_TONE: Record<RentalEvent["type"], string> = {
  created: "bg-[#F1F2F6] text-[#8A8F9C]",
  status: "bg-[#E9F0FE] text-[#2B5FD9]",
  payment: "bg-[#EAF7EE] text-[#1C8A46]",
  total: "bg-[#FFF4E5] text-[#B8620A]",
  items: "bg-[#EFEBFF] text-[#2B5FD9]",
  dates: "bg-[#FEF6E3] text-[#B8860B]",
  paused: "bg-[#FFF4E5] text-[#B8620A]",
  resumed: "bg-[#EAF7EE] text-[#1C8A46]",
  revert: "bg-[#FDECEC] text-[#C0272D]",
};

/** История аренды: кто, что и когда сделал, с возможностью откатить ошибку */
export function RentalHistoryModal({
  rentalId,
  canEdit,
  onClose,
  onReverted,
}: {
  rentalId: string;
  canEdit: boolean;
  onClose: () => void;
  onReverted: () => void;
}) {
  const [events, setEvents] = useState<RentalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/rentals/${rentalId}/events`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [rentalId]);

  async function revert(event: RentalEvent) {
    if (!confirm(`Отменить действие «${event.title}»? Значения вернутся к тому, что было до него.`)) return;
    setBusy(event.id);
    setError(null);
    const res = await fetch(`/api/rentals/${rentalId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: event.id }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Не удалось отменить действие");
      return;
    }
    setEvents(data.events);
    onReverted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-[20px] bg-[var(--color-surface)] shadow-xl safe-bottom sm:rounded-[var(--radius-card)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h3 className="font-display text-[16px] font-bold">История аренды</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="py-10 text-center text-[13px] text-[var(--color-text-muted)]">Загрузка…</p>
          ) : events.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[var(--color-text-muted)]">Пока ничего не происходило</p>
          ) : (
            events.map((e) => (
              <div
                key={e.id}
                className={cn(
                  "flex items-start gap-3 border-b border-[var(--color-border)] px-5 py-3 last:border-0",
                  e.reverted && "opacity-50"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-[8px] px-2.5 py-1 text-[12px] font-semibold", EVENT_TONE[e.type])}>{e.title}</span>
                    {e.actorName && <span className="text-[12px] text-[var(--color-text-muted)]">{e.actorName}</span>}
                    {e.reverted && <span className="text-[11.5px] text-[#C0272D]">отменено</span>}
                  </div>
                  {e.details && <p className="mt-1.5 text-[12.5px] text-[var(--color-text-muted)]">{e.details}</p>}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="whitespace-nowrap text-[11.5px] text-[var(--color-text-muted)]">{formatMoment(e.createdAt)}</span>
                  {/* Откатить можно только то, у чего записаны прежние значения */}
                  {canEdit && !e.reverted && e.before && (
                    <button
                      onClick={() => revert(e)}
                      disabled={busy === e.id}
                      title="Отменить это действие"
                      className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[#FDECEC] hover:text-[#C0272D] disabled:opacity-40"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {error && <p className="shrink-0 border-t border-[var(--color-border)] px-5 py-3 text-[12.5px] text-[#C0272D]">{error}</p>}
        <p className="shrink-0 border-t border-[var(--color-border)] px-5 py-3 text-[11.5px] text-[var(--color-text-muted)]">
          Кнопка отмены возвращает значения, которые были до действия. Сам журнал ничего не теряет: отмена тоже
          записывается отдельной строкой.
        </p>
      </div>
    </div>
  );
}

/** История пауз с длительностью каждого простоя */
export function RentalPausesModal({ rentalId, onClose }: { rentalId: string; onClose: () => void }) {
  const [pauses, setPauses] = useState<RentalPause[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/rentals/${rentalId}/pauses`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setPauses)
      .finally(() => setLoading(false));
  }, [rentalId]);

  const total = pauses.reduce((s, p) => s + p.hours, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[20px] bg-[var(--color-surface)] shadow-xl safe-bottom sm:rounded-[var(--radius-card)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h3 className="font-display text-[16px] font-bold">История пауз</h3>
            {pauses.length > 0 && (
              <p className="text-[12px] text-[var(--color-text-muted)]">Всего простоя: {Math.round(total * 10) / 10} ч</p>
            )}
          </div>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="py-10 text-center text-[13px] text-[var(--color-text-muted)]">Загрузка…</p>
          ) : pauses.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[var(--color-text-muted)]">Аренду ещё не ставили на паузу</p>
          ) : (
            pauses.map((p) => (
              <div key={p.id} className="flex items-start gap-3 border-b border-[var(--color-border)] px-5 py-3 last:border-0">
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-[8px]",
                    p.endedAt ? "bg-[#EAF7EE] text-[#1C8A46]" : "bg-[#FFF4E5] text-[#B8620A]"
                  )}
                >
                  {p.endedAt ? <RotateCcw className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">
                    {formatMoment(p.startedAt)} — {p.endedAt ? formatMoment(p.endedAt) : "идёт сейчас"}
                  </div>
                  <div className="text-[12px] text-[var(--color-text-muted)]">
                    {p.hours} ч{p.reason ? ` · ${p.reason}` : ""}
                    {p.actorName ? ` · ${p.actorName}` : ""}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <p className="shrink-0 border-t border-[var(--color-border)] px-5 py-3 text-[11.5px] text-[var(--color-text-muted)]">
          На паузе аренда не просрочивается и не копит штрафы, а при снятии дата возврата сдвигается на время простоя.
        </p>
      </div>
    </div>
  );
}

export { PackagePlus };

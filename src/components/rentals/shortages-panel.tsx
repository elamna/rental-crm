"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ReturnShortage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, PackageX, RotateCcw, X } from "lucide-react";

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Неполные возвраты: пылесос вернули, а трубку «потеряли».
 *
 * Отдельная кнопка в шапке аренд, а не строка в карточке: такие случаи легко
 * забываются, а вспоминают о них, когда инструмент уже уехал к следующему
 * клиенту. Пока вопрос не закрыт, счётчик висит на виду.
 */
export function ShortagesButton({ canEdit }: { canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [shortages, setShortages] = useState<ReturnShortage[]>([]);
  const [counts, setCounts] = useState({ open: 0, resolved: 0 });
  const [showResolved, setShowResolved] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/shortages?status=${showResolved ? "resolved" : "open"}`);
    if (res.ok) {
      const data = await res.json();
      setShortages(data.shortages);
      setCounts(data.counts);
    }
  }, [showResolved]);

  useEffect(() => {
    load();
  }, [load]);

  async function setResolved(id: string, resolved: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/shortages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      if (res.ok) load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[14px] font-medium transition",
          counts.open > 0
            ? "border-[#F3B7B7] bg-[#FDECEC] text-[#C0272D] hover:bg-[#FADFDF]"
            : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
        )}
        title="Вернули не полностью"
      >
        <PackageX className="h-3.5 w-3.5" /> Некомплект
        {counts.open > 0 && (
          <span className="rounded-full bg-[#C0272D] px-1.5 py-0.5 text-[12px] font-bold text-white">{counts.open}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4 sm:items-center sm:pb-0" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-[16px] bg-[var(--color-surface)] card-shadow"
          >
            <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
              <div>
                <h3 className="text-[16px] font-semibold">Вернули не полностью</h3>
                <p className="text-[13px] text-[var(--color-text-muted)]">
                  Инструмент приняли, но чего-то в комплекте не хватает
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-[10px] bg-[var(--color-bg)] p-1">
                  <button
                    onClick={() => setShowResolved(false)}
                    className={cn(
                      "rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition",
                      !showResolved ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)]"
                    )}
                  >
                    Открытые {counts.open}
                  </button>
                  <button
                    onClick={() => setShowResolved(true)}
                    className={cn(
                      "rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition",
                      showResolved ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)]"
                    )}
                  >
                    Закрытые {counts.resolved}
                  </button>
                </div>
                <button onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {shortages.length === 0 ? (
                <div className="py-12 text-center">
                  <Check className="mx-auto h-7 w-7 text-[#1C8A46]" />
                  <p className="mt-2 text-[14px] text-[var(--color-text-muted)]">
                    {showResolved ? "Закрытых записей нет" : "Всё возвращают в полном комплекте"}
                  </p>
                </div>
              ) : (
                shortages.map((s) => (
                  <div key={s.id} className="rounded-[12px] border border-[var(--color-border)] p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={cn("h-4 w-4 shrink-0", s.resolved ? "text-[var(--color-text-muted)]" : "text-[#C0272D]")} />
                          <span className="text-[14.5px] font-semibold">{s.itemName}</span>
                        </div>
                        {s.note && <p className="mt-1 text-[13.5px]">Не хватает: {s.note}</p>}
                        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                          {s.clientName ?? "—"}
                          {s.clientPhone ? ` · ${s.clientPhone}` : ""} · {formatDate(s.createdAt)}
                          {s.createdBy ? ` · принял ${s.createdBy}` : ""}
                        </p>
                        {s.resolved && (
                          <p className="mt-1 text-[13px] text-[#1C8A46]">
                            Закрыт {formatDate(s.resolvedAt)}
                            {s.resolvedBy ? ` · ${s.resolvedBy}` : ""}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {s.rentalNumber && (
                          <Link
                            href={`/rentals/${s.rentalId}`}
                            className="whitespace-nowrap text-[13.5px] text-[var(--color-primary)] underline-offset-2 hover:underline"
                          >
                            Аренда №{s.rentalNumber}
                          </Link>
                        )}
                        {canEdit && !s.resolved && (
                          <button
                            onClick={() => setResolved(s.id, true)}
                            disabled={busyId === s.id}
                            className="flex items-center gap-1.5 whitespace-nowrap rounded-[8px] border border-[#1C8A46] px-2.5 py-1.5 text-[13px] font-semibold text-[#1C8A46] transition hover:bg-[#EAF7EE] disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" /> Вопрос закрыт
                          </button>
                        )}
                        {canEdit && s.resolved && (
                          <button
                            onClick={() => setResolved(s.id, false)}
                            disabled={busyId === s.id}
                            className="flex items-center gap-1.5 whitespace-nowrap rounded-[8px] border border-[var(--color-border)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)] disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Вернуть в открытые
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

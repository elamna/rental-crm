"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { formatMoney } from "@/lib/utils";
import { Ban, ShieldOff, Siren } from "lucide-react";

export default function BlacklistPage() {
  const clients = useAppStore((s) => s.clients);
  const rentals = useAppStore((s) => s.rentals);
  const hydrated = useAppStore((s) => s.hydrated);
  const updateClient = useAppStore((s) => s.updateClient);

  const blacklisted = useMemo(() => clients.filter((c) => c.blacklisted), [clients]);

  const stolenByClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rentals) {
      if (r.status === "stolen") map.set(r.client.id, (map.get(r.client.id) ?? 0) + 1);
    }
    return map;
  }, [rentals]);

  async function handleUnblock(id: string) {
    if (!window.confirm("Убрать клиента из чёрного списка?")) return;
    await updateClient(id, { blacklisted: false });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-6 py-4 backdrop-blur">
        <h1 className="font-display text-[20px] font-bold">Чёрный список</h1>
        <p className="text-[13px] text-[var(--color-text-muted)]">
          Клиенты с ограничением доступа к аренде — попадают сюда автоматически (например, при краже товара) или вручную
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!hydrated ? (
          <p className="text-[13px] text-[var(--color-text-muted)]">Загрузка…</p>
        ) : blacklisted.length === 0 ? (
          <div className="mx-auto mt-16 max-w-md rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center card-shadow">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[14px] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Ban className="h-6 w-6" />
            </div>
            <h2 className="font-display text-[16px] font-bold">Чёрный список пуст</h2>
            <p className="mt-1.5 text-[13px] text-[var(--color-text-muted)]">
              Клиенты появятся здесь автоматически, если аренду отметят украденной, или их можно добавить вручную из карточки клиента.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {blacklisted.map((c) => {
              const stolenCount = stolenByClient.get(c.id) ?? 0;
              return (
                <div key={c.id} className="rounded-[var(--radius-card)] border border-[#F3B7B7] bg-[var(--color-surface)] p-4 card-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/clients/${c.id}`} className="min-w-0">
                      <div className="truncate text-[14px] font-semibold hover:underline">{c.name}</div>
                      <div className="text-[12.5px] text-[var(--color-text-muted)]">{c.phone}</div>
                    </Link>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#FDECEC] px-2 py-0.5 text-[11px] font-semibold text-[#C0272D]">
                      <Ban className="h-3 w-3" /> В ЧС
                    </span>
                  </div>

                  {stolenCount > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-[8px] bg-[#FDECEC] px-2.5 py-1.5 text-[12px] font-medium text-[#C0272D]">
                      <Siren className="h-3.5 w-3.5 shrink-0" />
                      Краж инструмента: {stolenCount}
                    </div>
                  )}

                  <div className="mt-2.5 space-y-1 text-[12.5px] text-[var(--color-text-muted)]">
                    <div className="flex justify-between">
                      <span>Аренд всего</span>
                      <span className="font-medium text-[var(--color-text)]">{c.totalRentals}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Потрачено</span>
                      <span className="font-medium text-[var(--color-text)]">{formatMoney(c.totalSpent)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUnblock(c.id)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-[var(--color-border)] py-2 text-[12.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
                  >
                    <ShieldOff className="h-3.5 w-3.5" /> Убрать из чёрного списка
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

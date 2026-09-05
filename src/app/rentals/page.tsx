"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { RentalCard } from "@/components/rentals/rental-card";
import { StatusTabs, TabKey } from "@/components/rentals/status-tabs";
import { FilterBar } from "@/components/rentals/filter-bar";
import { Download, Video } from "lucide-react";
import Link from "next/link";

export default function RentalsPage() {
  const allRentals = useAppStore((s) => s.rentals);
  const hydrated = useAppStore((s) => s.hydrated);
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => {
    let list = allRentals;
    if (tab === "debtors")
      list = list.filter((r) => (r.status === "active" || r.status === "overdue") && r.total - r.paid > 0);
    else if (tab !== "all" && tab !== "archive") list = list.filter((r) => r.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.client.name.toLowerCase().includes(q) ||
          r.client.phone.includes(q) ||
          r.number.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tab, search, allRentals]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div>
          <h1 className="font-display text-[20px] font-bold">Аренды</h1>
          <p className="text-[13px] text-[var(--color-text-muted)]">Все текущие и прошедшие аренды инструмента</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
            <Video className="h-3.5 w-3.5" /> Видео
          </button>
          <button className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
            <Download className="h-3.5 w-3.5" /> Экспорт
          </button>
          <Link
            href="/rentals/new"
            className="rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-primary)] transition hover:bg-[var(--color-primary-hover)]"
          >
            + Новая аренда
          </Link>
        </div>
      </header>

      <div className="space-y-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3">
        <StatusTabs rentals={allRentals} active={tab} onChange={setTab} />
        <FilterBar search={search} onSearch={setSearch} view={view} onView={setView} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {filtered.length === 0 ? (
          <div className="grid h-64 place-items-center text-center text-[var(--color-text-muted)]">
            {!hydrated ? (
              <p className="text-[13.5px]">Загрузка…</p>
            ) : allRentals.length === 0 ? (
              <div>
                <p className="text-[13.5px]">Аренд пока нет</p>
                <Link href="/rentals/new" className="mt-1 inline-block text-[13px] font-medium text-[var(--color-primary)]">
                  Оформить первую аренду →
                </Link>
              </div>
            ) : (
              "Ничего не найдено по текущим фильтрам"
            )}
          </div>
        ) : (
          <div
            className={
              view === "grid"
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                : "flex flex-col gap-3"
            }
          >
            {filtered.map((r, i) => (
              <div key={r.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(i * 25, 300)}ms` }}>
                <RentalCard rental={r} draggable />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { inventoryCategories, inventoryStatusLabels } from "@/lib/mock-data";
import { formatMoney, cn } from "@/lib/utils";
import { Search, Plus, Boxes, PackageX } from "lucide-react";

const statusColors: Record<string, { bg: string; text: string }> = {
  available: { bg: "bg-[#EAF7EE]", text: "text-[#1C8A46]" },
  rented: { bg: "bg-[#FFF4E5]", text: "text-[#B8620A]" },
  maintenance: { bg: "bg-[#FEF6E3]", text: "text-[#B8860B]" },
  repair: { bg: "bg-[#FDEDEC]", text: "text-[#C0272D]" },
  stolen: { bg: "bg-[#2A0E0E]", text: "text-[#FF6B6B]" },
  written_off: { bg: "bg-[#F1F2F6]", text: "text-[#8A8F9C]" },
};

export default function CatalogPage() {
  const inventory = useAppStore((s) => s.inventory);
  const hydrated = useAppStore((s) => s.hydrated);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => {
    let list = inventory;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || (i.serialNumber ?? "").toLowerCase().includes(q));
    }
    if (category) list = list.filter((i) => i.category === category);
    if (status) list = list.filter((i) => i.status === status);
    return list;
  }, [inventory, search, category, status]);

  const availableCount = inventory.filter((i) => i.status === "available").length;
  const rentedCount = inventory.filter((i) => i.status === "rented").length;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-white/70 px-6 py-4 backdrop-blur">
        <div>
          <h1 className="font-display text-[20px] font-bold">Каталог</h1>
          <p className="text-[13px] text-[var(--color-text-muted)]">Хранение и учёт инструмента</p>
        </div>
        <Link
          href="/catalog/new"
          className="flex items-center gap-1.5 rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_14px_-4px_rgba(109,74,255,0.7)] transition hover:bg-[var(--color-primary-hover)]"
        >
          <Plus className="h-3.5 w-3.5" /> Добавить инструмент
        </Link>
      </header>

      <div className="space-y-4 px-6 py-4">
        <div className="grid grid-cols-3 gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 card-shadow">
          <Stat value={inventory.length} label="всего в каталоге" />
          <Stat value={availableCount} label="свободно" />
          <Stat value={rentedCount} label="в аренде" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, артикулу, серийному номеру…"
              className="w-full rounded-[12px] border border-[var(--color-border)] bg-white py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)]"
            />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-[12px] border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)]">
            <option value="">Категория</option>
            {inventoryCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-[12px] border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)]">
            <option value="">Статус</option>
            {Object.entries(inventoryStatusLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-white py-16 text-center card-shadow">
            {!hydrated ? (
              <p className="text-[13.5px] text-[var(--color-text-muted)]">Загрузка…</p>
            ) : inventory.length === 0 ? (
              <>
                <Boxes className="h-8 w-8 text-[var(--color-text-muted)]" />
                <p className="text-[13.5px] text-[var(--color-text-muted)]">В каталоге пока нет инструмента</p>
                <Link href="/catalog/new" className="mt-1 text-[13px] font-medium text-[var(--color-primary)]">
                  Добавить первый инструмент →
                </Link>
              </>
            ) : (
              <>
                <PackageX className="h-8 w-8 text-[var(--color-text-muted)]" />
                <p className="text-[13.5px] text-[var(--color-text-muted)]">Ничего не найдено по текущим фильтрам</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => {
              const st = statusColors[item.status];
              return (
                <Link
                  key={item.id}
                  href={`/catalog/${item.id}`}
                  className="group rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 card-shadow card-shadow-hover transition hover:-translate-y-[2px]"
                >
                  <div className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-[10px] bg-[var(--color-bg)]">
                    {item.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <Boxes className="h-8 w-8 text-[var(--color-text-muted)]" />
                    )}
                  </div>
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <h3 className="text-[13.5px] font-semibold leading-tight">{item.name}</h3>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", st.bg, st.text)}>
                      {inventoryStatusLabels[item.status]}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[var(--color-text-muted)]">{item.sku || "без артикула"} · {item.branch}</p>
                  <p className="mt-2 text-[14px] font-bold">{formatMoney(item.rentalPricePerDay)} / сутки</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-display text-[20px] font-bold">{value}</div>
      <div className="text-[12px] text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}

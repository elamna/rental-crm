"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { formatTariffs, groupProducts, kitAvailability, kitPrice, servicePrice } from "@/lib/catalog-utils";
import { formatMoney } from "@/lib/utils";
import { Boxes, Check, Search, X } from "lucide-react";

interface Row {
  id: string;
  name: string;
  price: number;
  hint: string;
  disabled?: boolean;
}

interface Selection {
  row: Row;
  price: string;
  qty: string;
}

/** Выбор комплектов или услуг из каталога — аналог AddCatalogItemModal для товаров. */
export function AddCatalogBundleModal({
  category,
  onClose,
  onAdd,
}: {
  category: "kit" | "service";
  onClose: () => void;
  onAdd: (item: { name: string; pricePerDay: number; qty: number }) => void;
}) {
  const kits = useAppStore((s) => s.kits);
  const services = useAppStore((s) => s.services);
  const inventory = useAppStore((s) => s.inventory);
  const rentals = useAppStore((s) => s.rentals);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, Selection>>(new Map());

  const products = useMemo(() => groupProducts(inventory, rentals), [inventory, rentals]);

  const rows: Row[] = useMemo(() => {
    if (category === "kit") {
      return kits.map((k) => {
        const a = kitAvailability(k, products);
        return {
          id: k.id,
          name: k.name,
          price: kitPrice(k),
          hint: a.free === null ? `${k.lines.length} позиц.` : `${k.lines.length} позиц. · свободно ${a.free}/${a.total}`,
          disabled: a.free !== null && a.free === 0,
        };
      });
    }
    return services.map((s) => ({
      id: s.id,
      name: s.name,
      price: servicePrice(s),
      hint: formatTariffs(s) || "тариф не задан",
    }));
  }, [category, kits, services, products]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  function toggle(row: Row) {
    if (row.disabled) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, { row, price: String(row.price), qty: "1" });
      return next;
    });
  }

  function patch(id: string, p: Partial<Selection>) {
    setSelected((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (cur) next.set(id, { ...cur, ...p });
      return next;
    });
  }

  function submitAll() {
    for (const sel of selected.values()) {
      const price = Number(sel.price);
      const qty = Math.max(1, Number(sel.qty) || 1);
      if (price > 0) onAdd({ name: sel.row.name, pricePerDay: price, qty });
    }
    onClose();
  }

  const title = category === "kit" ? "Добавить комплект из каталога" : "Добавить услугу из каталога";
  const priceLabel = category === "kit" ? "Цена за сутки, ₸" : "Цена, ₸";
  const count = selected.size;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col rounded-t-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] card-shadow safe-bottom sm:rounded-[var(--radius-card)]"
        style={{ maxHeight: "88dvh" }}
      >
        <div className="flex shrink-0 items-center justify-between p-5 pb-3">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 px-5 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию…" className="crm-input pl-9" />
          </div>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto px-5 pb-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Boxes className="h-6 w-6 text-[var(--color-text-muted)]" />
              <p className="text-[12.5px] text-[var(--color-text-muted)]">
                {category === "kit" ? "Комплектов пока нет." : "Услуг пока нет."}
                <br />
                Добавьте их во вкладке «{category === "kit" ? "Комплекты" : "Услуги"}».
              </p>
              <Link href="/catalog" className="text-[12.5px] font-semibold text-[var(--color-primary)]">
                Перейти в каталог →
              </Link>
            </div>
          ) : (
            filtered.map((row) => {
              const sel = selected.get(row.id);
              const isSelected = Boolean(sel);
              return (
                <div
                  key={row.id}
                  className={`rounded-[10px] border transition ${
                    isSelected ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] hover:bg-[var(--color-bg)]"
                  } ${row.disabled ? "opacity-50" : ""}`}
                >
                  <button onClick={() => toggle(row)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                    <div
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-2 transition ${
                        isSelected ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-[var(--color-border)]"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-[var(--color-on-primary)]" strokeWidth={3} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{row.name}</div>
                      <div className="text-[11.5px] text-[var(--color-text-muted)]">{row.hint}</div>
                    </div>
                    <span className="shrink-0 text-[12.5px] font-semibold">{formatMoney(row.price)}</span>
                  </button>

                  {isSelected && sel && (
                    <div className="flex items-center gap-2 border-t border-[var(--color-primary)]/20 px-3 pb-2.5 pt-2">
                      <span className="text-[12px] text-[var(--color-text-muted)]">{priceLabel}</span>
                      <input
                        type="number"
                        min={0}
                        value={sel.price}
                        onChange={(e) => patch(row.id, { price: e.target.value })}
                        className="crm-input ml-auto w-24 text-right text-[13px] font-semibold"
                      />
                      <span className="text-[12px] text-[var(--color-text-muted)]">×</span>
                      <input
                        type="number"
                        min={1}
                        value={sel.qty}
                        onChange={(e) => patch(row.id, { qty: e.target.value })}
                        className="crm-input w-16 text-right text-[13px] font-semibold"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--color-border)] px-5 py-4">
          <button
            onClick={submitAll}
            disabled={count === 0}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--color-primary)] py-2.5 text-[13px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-40"
          >
            {count > 0 ? `Добавить (${count})` : category === "kit" ? "Выберите комплекты" : "Выберите услуги"}
          </button>
        </div>
      </div>
    </div>
  );
}

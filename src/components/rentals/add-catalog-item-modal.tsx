"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { InventoryItem } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { X, Search, Boxes } from "lucide-react";

export function AddCatalogItemModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (item: { name: string; pricePerDay: number; qty: number; inventoryItemId?: string }) => void;
}) {
  const inventory = useAppStore((s) => s.inventory);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");

  const available = useMemo(() => {
    const list = inventory.filter((i) => i.status === "available");
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
  }, [inventory, search]);

  function selectItem(item: InventoryItem) {
    setSelected(item);
    setPrice(String(item.rentalPricePerDay));
  }

  function submit() {
    if (!selected) return;
    const p = Number(price);
    const q = Number(qty);
    if (p > 0 && q > 0) onAdd({ name: selected.name, pricePerDay: p, qty: q, inventoryItemId: selected.id });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold">Добавить товар из каталога</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!selected ? (
          <>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по названию или артикулу…"
                className="crm-input pl-9"
              />
            </div>
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {available.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Boxes className="h-6 w-6 text-[var(--color-text-muted)]" />
                  <p className="text-[12.5px] text-[var(--color-text-muted)]">
                    Нет свободного инструмента.
                    <br />
                    Добавьте его в раздел «Каталог».
                  </p>
                </div>
              ) : (
                available.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectItem(item)}
                    className="flex w-full items-center justify-between rounded-[10px] border border-[var(--color-border)] px-3 py-2 text-left transition hover:bg-[var(--color-bg)]"
                  >
                    <div>
                      <div className="text-[13px] font-medium">{item.name}</div>
                      <div className="text-[11.5px] text-[var(--color-text-muted)]">{item.sku || "без артикула"}</div>
                    </div>
                    <span className="text-[12.5px] font-semibold">{formatMoney(item.rentalPricePerDay)}/сутки</span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div>
            <div className="mb-3 rounded-[10px] border border-[var(--color-border)] px-3 py-2">
              <div className="text-[13px] font-medium">{selected.name}</div>
              <div className="text-[11.5px] text-[var(--color-text-muted)]">{selected.sku || "без артикула"}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Цена за сутки, ₸</span>
                <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="crm-input" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Кол-во</span>
                <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="crm-input" />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setSelected(null)} className="rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-[13px] font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
                Назад
              </button>
              <button onClick={submit} className="rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[var(--color-primary-hover)]">
                Добавить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { InventoryItem } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { X, Search, Boxes, Check } from "lucide-react";

interface SelectedItem {
  item: InventoryItem;
  price: string;
}

export function AddCatalogItemModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (item: { name: string; pricePerDay: number; qty: number; inventoryItemId?: string }) => void;
}) {
  const inventory = useAppStore((s) => s.inventory);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(new Map());

  const available = useMemo(() => {
    const list = inventory.filter((i) => i.status === "available");
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
  }, [inventory, search]);

  function toggleItem(item: InventoryItem) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, { item, price: String(item.rentalPricePerDay) });
      }
      return next;
    });
  }

  function submitAll() {
    for (const { item, price } of selected.values()) {
      const p = Number(price);
      if (p > 0) onAdd({ name: item.name, pricePerDay: p, qty: 1, inventoryItemId: item.id });
    }
    onClose();
  }

  const selectedCount = selected.size;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white card-shadow flex flex-col" style={{ maxHeight: "85vh" }}>
        {/* Шапка */}
        <div className="flex items-center justify-between p-5 pb-3 shrink-0">
          <h3 className="text-[15px] font-semibold">Добавить товар из каталога</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Поиск */}
        <div className="px-5 pb-3 shrink-0">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию или артикулу…"
              className="crm-input pl-9"
            />
          </div>
        </div>

        {/* Список */}
        <div className="flex-1 overflow-y-auto px-5 space-y-1.5 pb-3">
          {available.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Boxes className="h-6 w-6 text-[var(--color-text-muted)]" />
              <p className="text-[12.5px] text-[var(--color-text-muted)]">
                Нет свободного инструмента.<br />Добавьте его в раздел «Каталог».
              </p>
            </div>
          ) : (
            available.map((item) => {
              const isSelected = selected.has(item.id);
              const sel = selected.get(item.id);
              return (
                <div key={item.id} className={`rounded-[10px] border transition ${isSelected ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] hover:bg-[var(--color-bg)]"}`}>
                  <button
                    onClick={() => toggleItem(item)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                  >
                    {/* Чекбокс */}
                    <div className={`grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-2 transition ${isSelected ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-[var(--color-border)]"}`}>
                      {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{item.name}</div>
                      <div className="text-[11.5px] text-[var(--color-text-muted)]">{item.sku || "без артикула"}</div>
                    </div>
                    <span className="shrink-0 text-[12.5px] font-semibold">{formatMoney(item.rentalPricePerDay)}/сутки</span>
                  </button>
                  {/* Поле цены при выборе */}
                  {isSelected && sel && (
                    <div className="flex items-center gap-2 border-t border-[var(--color-primary)]/20 px-3 pb-2.5 pt-2" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[12px] text-[var(--color-text-muted)]">Цена за сутки, ₸</span>
                      <input
                        type="number"
                        value={sel.price}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Map(prev);
                            const cur = next.get(item.id);
                            if (cur) next.set(item.id, { ...cur, price: e.target.value });
                            return next;
                          });
                        }}
                        className="crm-input ml-auto w-28 text-right text-[13px] font-semibold"
                        min={0}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Футер */}
        <div className="border-t border-[var(--color-border)] px-5 py-4 shrink-0">
          <button
            onClick={submitAll}
            disabled={selectedCount === 0}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--color-primary)] py-2.5 text-[13px] font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:opacity-40"
          >
            {selectedCount > 0 ? `Добавить ${selectedCount} товар${selectedCount > 1 ? "а" : ""}` : "Выберите товары"}
          </button>
        </div>
      </div>
    </div>
  );
}

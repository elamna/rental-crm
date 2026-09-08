"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShopProduct } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { Check, Search, Store, X } from "lucide-react";

interface Selection {
  product: ShopProduct;
  price: string;
  qty: string;
}

/**
 * Выбор товаров магазина в аренду. Список тянем прямо с сервера: товары
 * магазина сознательно не лежат в общем сторе — они не связаны с каталогом
 * аренды и не нужны на других страницах.
 */
export function AddShopItemModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (item: { name: string; pricePerDay: number; qty: number; inventoryItemId?: string; sku?: string }) => void;
}) {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, Selection>>(new Map());

  useEffect(() => {
    fetch("/api/shop")
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d) => setProducts(d.products ?? []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.serialNumber ?? "").toLowerCase().includes(q)
    );
  }, [products, search]);

  function toggle(product: ShopProduct) {
    if (product.qty <= 0) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(product.id)) next.delete(product.id);
      else next.set(product.id, { product, price: String(product.price), qty: "1" });
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
      // Больше, чем лежит на складе, продать нельзя
      const qty = Math.min(sel.product.qty, Math.max(1, Number(sel.qty) || 1));
      if (price > 0) {
        onAdd({
          name: sel.product.name,
          pricePerDay: price,
          qty,
          inventoryItemId: sel.product.id,
          sku: sel.product.sku,
        });
      }
    }
    onClose();
  }

  const count = selected.size;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col rounded-t-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] card-shadow safe-bottom sm:rounded-[var(--radius-card)]"
        style={{ maxHeight: "88dvh" }}
      >
        <div className="flex shrink-0 items-start justify-between p-5 pb-3">
          <div>
            <h3 className="text-[16px] font-semibold">Добавить товар из магазина</h3>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">Продаётся насовсем, цена не зависит от срока</p>
          </div>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 px-5 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Название, инвентарный или серийный номер…"
              className="crm-input with-icon"
            />
          </div>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto px-5 pb-3">
          {loading ? (
            <p className="py-8 text-center text-[13.5px] text-[var(--color-text-muted)]">Загрузка…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Store className="h-6 w-6 text-[var(--color-text-muted)]" />
              <p className="text-[13.5px] text-[var(--color-text-muted)]">
                {search ? "Ничего не нашлось." : "В магазине пока нет товаров."}
              </p>
              <Link href="/shop" className="text-[13.5px] font-semibold text-[var(--color-primary)]">
                Перейти в магазин →
              </Link>
            </div>
          ) : (
            filtered.map((product) => {
              const sel = selected.get(product.id);
              const isSelected = Boolean(sel);
              const outOfStock = product.qty <= 0;
              return (
                <div
                  key={product.id}
                  className={`rounded-[10px] border transition ${
                    isSelected ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] hover:bg-[var(--color-bg)]"
                  } ${outOfStock ? "opacity-50" : ""}`}
                >
                  <button onClick={() => toggle(product)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                    <div
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-2 transition ${
                        isSelected ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-[var(--color-border)]"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-[var(--color-on-primary)]" strokeWidth={3} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{product.name}</div>
                      <div className="text-[12.5px] text-[var(--color-text-muted)]">
                        {product.sku || "без номера"} · {outOfStock ? "нет в наличии" : `остаток ${product.qty} шт.`}
                      </div>
                    </div>
                    <span className="shrink-0 text-[13.5px] font-semibold">{formatMoney(product.price)}</span>
                  </button>

                  {isSelected && sel && (
                    <div className="flex items-center gap-2 border-t border-[var(--color-primary)]/20 px-3 pb-2.5 pt-2">
                      <span className="text-[13px] text-[var(--color-text-muted)]">Цена, ₸</span>
                      <input
                        type="number"
                        min={0}
                        value={sel.price}
                        onChange={(e) => patch(product.id, { price: e.target.value })}
                        className="crm-input ml-auto w-24 text-right text-[14px] font-semibold"
                      />
                      <span className="text-[13px] text-[var(--color-text-muted)]">×</span>
                      <input
                        type="number"
                        min={1}
                        max={product.qty}
                        value={sel.qty}
                        onChange={(e) => patch(product.id, { qty: e.target.value })}
                        className="crm-input w-16 text-right text-[14px] font-semibold"
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
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--color-primary)] py-2.5 text-[14px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-40"
          >
            {count > 0 ? `Добавить (${count})` : "Выберите товары"}
          </button>
        </div>
      </div>
    </div>
  );
}

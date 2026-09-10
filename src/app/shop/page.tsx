"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ShopProduct } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";

interface Summary {
  positions: number;
  units: number;
  value: number;
  outOfStock: number;
}

/**
 * Магазин — товары, которые продаются насовсем: перчатки, свёрла, смесь.
 * С каталогом аренды не пересекается ничем: свои номера, свой остаток,
 * возврата не предполагает.
 */
export default function ShopPage() {
  const { can } = useAuth();
  const canEdit = can("shop.edit");

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const params = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
    const res = await fetch(`/api/shop${params}`);
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products);
      setSummary(data.summary);
    }
    setLoading(false);
  }, [search]);

  // Поиск не дёргает сервер на каждую букву
  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, search]);

  async function remove(product: ShopProduct) {
    if (!confirm(`Удалить «${product.name}» из магазина?`)) return;
    await fetch(`/api/shop/${product.id}`, { method: "DELETE" });
    load();
  }

  if (!can("shop.view")) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-[14.5px] text-[var(--color-text-muted)]">
        Нет доступа к разделу «Магазин»
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="min-w-0">
          <h1 className="font-display text-[20px] font-bold">Магазин</h1>
          <p className="text-[14px] text-[var(--color-text-muted)]">
            Товары на продажу — уходят без возврата
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[14px] font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-primary)] transition hover:bg-[var(--color-primary-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> Добавить товар
          </button>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Позиций" value={String(summary.positions)} />
            <Metric label="Штук на складе" value={String(summary.units)} />
            <Metric label="Товара на сумму" value={formatMoney(summary.value)} />
            <Metric
              label="Закончилось"
              value={String(summary.outOfStock)}
              tone={summary.outOfStock > 0 ? "bad" : undefined}
            />
          </div>
        )}

        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию, инвентарному или серийному номеру"
            className="w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-9 pr-3 text-[14.5px] outline-none transition focus:border-[var(--color-primary)]"
          />
        </div>

        {loading ? (
          <p className="py-10 text-center text-[14px] text-[var(--color-text-muted)]">Загрузка…</p>
        ) : products.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center card-shadow">
            <Package className="mx-auto h-7 w-7 text-[var(--color-text-muted)]" />
            <p className="mt-2 text-[14.5px] text-[var(--color-text-muted)]">
              {search ? "Ничего не нашлось" : "Товаров пока нет. Добавьте первый — он появится в аренде на вкладке «Магазин»."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] card-shadow">
            <table className="w-full min-w-[720px] text-[14px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-left text-[13px] text-[var(--color-text-muted)]">
                  <th className="px-4 py-3 font-semibold">Наименование</th>
                  <th className="px-4 py-3 font-semibold">Инвентарный №</th>
                  <th className="px-4 py-3 font-semibold">Серийный №</th>
                  <th className="px-4 py-3 font-semibold">Цена</th>
                  <th className="px-4 py-3 font-semibold">Остаток</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.name}</div>
                      {p.category && <div className="text-[12.5px] text-[var(--color-text-muted)]">{p.category}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px] text-[var(--color-text-muted)]">{p.sku || "—"}</td>
                    <td className="px-4 py-3 font-mono text-[13px] text-[var(--color-text-muted)]">{p.serialNumber || "—"}</td>
                    <td className="px-4 py-3 font-semibold">{formatMoney(p.price)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[12.5px] font-semibold",
                          p.qty > 0 ? "bg-[#EAF7EE] text-[#1C8A46]" : "bg-[#FDECEC] text-[#C0272D]"
                        )}
                      >
                        {p.qty > 0 ? `${p.qty} шт.` : "нет в наличии"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canEdit && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditing(p)}
                            className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)] hover:text-[var(--color-primary-ink)]"
                            title="Редактировать"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => remove(p)}
                            className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[#FDECEC] hover:text-[#C0272D]"
                            title="Удалить"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && <ShopModal onClose={() => setCreating(false)} onSaved={load} />}
      {editing && <ShopModal product={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 card-shadow">
      <div className="text-[12.5px] text-[var(--color-text-muted)]">{label}</div>
      <div className={cn("font-display text-[18px] font-bold", tone === "bad" && "text-[#C0272D]")}>{value}</div>
    </div>
  );
}

function ShopModal({
  product,
  onClose,
  onSaved,
}: {
  product?: ShopProduct;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [serialNumber, setSerialNumber] = useState(product?.serialNumber ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  // Цену продажи и себестоимость правит только администратор
  const { user } = useAuth();
  const canEditPrice = !!user?.isAdmin;
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [purchaseCost, setPurchaseCost] = useState(product?.purchaseCost ? String(product.purchaseCost) : "");
  const [qty, setQty] = useState(product ? String(product.qty) : "");
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    const body = {
      name: name.trim(),
      sku: sku.trim(),
      serialNumber: serialNumber.trim(),
      category: category.trim(),
      price: Number(price) || 0,
      purchaseCost: purchaseCost ? Number(purchaseCost) : undefined,
      qty: Number(qty) || 0,
      notes: notes.trim(),
    };
    try {
      const res = await fetch(product ? `/api/shop/${product.id}` : "/api/shop", {
        method: product ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Не удалось сохранить товар");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить товар");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[20px] bg-[var(--color-surface)] p-4 pb-8 shadow-xl safe-bottom sm:rounded-[var(--radius-card)] sm:p-6 sm:pb-6"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-display text-[18px] font-bold">{product ? "Товар магазина" : "Новый товар"}</h2>
            <p className="text-[13.5px] text-[var(--color-text-muted)]">Продаётся безвозвратно, в аренду не выдаётся</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] transition hover:text-[#C0272D]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <Field label="Наименование" required>
          <input value={name} onChange={(e) => setName(e.target.value)} className="crm-input" placeholder="Перчатки строительные" autoFocus />
        </Field>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Инвентарный номер" hint="оставьте пустым — присвоим сами">
            <input value={sku} onChange={(e) => setSku(e.target.value)} className="crm-input" placeholder="МГ-1" />
          </Field>
          <Field label="Серийный номер">
            <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="crm-input" placeholder="номер производителя" />
          </Field>

          <Field label="Категория">
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="crm-input" placeholder="Расходники" />
          </Field>
          <Field label="Остаток, шт." required>
            <input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} className="crm-input" placeholder="0" />
          </Field>

          <Field label="Цена продажи, ₸" required>
            <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="crm-input" placeholder="0" disabled={!canEditPrice} />
          </Field>
          <Field label="Себестоимость, ₸" hint="для наценки в финансах">
            <input type="number" min={0} value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} className="crm-input" placeholder="0" disabled={!canEditPrice} />
          </Field>
        </div>

        <Field label="Заметка" className="mt-4">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="crm-input" placeholder="Поставщик, где лежит на складе" />
        </Field>

        {error && <p className="mt-3 text-[14px] text-[#C0272D]">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-[10px] border border-[var(--color-border)] px-4 py-2.5 text-[14.5px] font-semibold text-[var(--color-text-muted)]">
            Отмена
          </button>
          <button
            disabled={!name.trim() || saving}
            onClick={save}
            className="rounded-[10px] bg-[var(--color-primary)] px-5 py-2.5 text-[14.5px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13.5px] font-medium text-[var(--color-text-muted)]">
        {label} {required && <span className="text-[var(--color-primary-ink)]">*</span>}
        {hint && <span className="ml-1 text-[12.5px] opacity-70">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

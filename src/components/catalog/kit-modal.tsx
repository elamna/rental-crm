"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Kit, KitLine } from "@/lib/types";
import { inventoryCategories } from "@/lib/mock-data";
import { groupProducts } from "@/lib/catalog-utils";
import { formatMoney } from "@/lib/utils";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { Plus, Trash2, X } from "lucide-react";

export function KitModal({ kit, onClose }: { kit?: Kit; onClose: () => void }) {
  const inventory = useAppStore((s) => s.inventory);
  const rentals = useAppStore((s) => s.rentals);
  const addKit = useAppStore((s) => s.addKit);
  const updateKit = useAppStore((s) => s.updateKit);

  const products = useMemo(() => groupProducts(inventory, rentals), [inventory, rentals]);

  const [name, setName] = useState(kit?.name ?? "");
  const [category, setCategory] = useState(kit?.category ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(kit?.photoUrl);
  const [price, setPrice] = useState(kit?.price ? String(kit.price) : "");
  const [notes, setNotes] = useState(kit?.notes ?? "");
  const [lines, setLines] = useState<KitLine[]>(kit?.lines ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linesTotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const canSave = name.trim().length > 0 && !saving;

  function addLine() {
    setLines((prev) => [...prev, { id: `kl_${Date.now()}_${prev.length}`, name: "", qty: 1, price: 0 }]);
  }

  function setLine(id: string, patch: Partial<KitLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  /** Выбор продукта из каталога — подставляем название и цену */
  function linkProduct(id: string, key: string) {
    const g = products.find((p) => p.key === key);
    if (!g) {
      setLine(id, { inventoryName: undefined });
      return;
    }
    setLine(id, { inventoryName: g.name, name: g.name, price: g.price });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      category,
      photoUrl,
      price: Number(price) || 0,
      lines: lines.filter((l) => l.name.trim()),
      notes: notes.trim() || undefined,
    };
    try {
      if (kit) await updateKit(kit.id, payload);
      else await addKit(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить комплект");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[20px] bg-[var(--color-surface)] p-4 pb-8 shadow-xl safe-bottom sm:rounded-[var(--radius-card)] sm:p-6 sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-display text-[18px] font-bold">{kit ? "Комплект" : "Новый комплект"}</h2>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">Набор позиций, который выдаётся одной строкой в аренде</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] transition hover:text-[#C0272D]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">
                Название <span className="text-[var(--color-primary)]">*</span>
              </span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="crm-input" placeholder="Алмазное бурение (бур)" />
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Категория</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="crm-input">
                  <option value="">Категория</option>
                  {inventoryCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Цена за сутки, ₸</span>
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="crm-input"
                  placeholder={linesTotal ? String(linesTotal) : "0"}
                />
              </label>
            </div>
          </div>
          <PhotoUpload value={photoUrl} onChange={setPhotoUrl} />
        </div>

        <div className="my-5 border-t border-[var(--color-border)]" />

        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Состав комплекта</span>
          <button
            onClick={addLine}
            className="flex items-center gap-1 rounded-[8px] border border-[var(--color-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            <Plus className="h-3 w-3" /> Позиция
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-[var(--color-border)] py-5 text-center text-[12.5px] text-[var(--color-text-muted)]">
            Пока пусто. Позиции, привязанные к каталогу, ограничивают доступность комплекта.
          </p>
        ) : (
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.id} className="grid grid-cols-[1fr_28px] items-center gap-2 sm:grid-cols-[1fr_130px_70px_90px_28px]">
                <input
                  value={l.name}
                  onChange={(e) => setLine(l.id, { name: e.target.value })}
                  className="crm-input"
                  placeholder="Название позиции"
                />
                <select
                  value={l.inventoryName ? l.inventoryName.trim().toLowerCase() : ""}
                  onChange={(e) => linkProduct(l.id, e.target.value)}
                  className="crm-input !text-[12px]"
                  title="Привязка к продукту каталога"
                >
                  <option value="">Без привязки</option>
                  {products.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={l.qty}
                  onChange={(e) => setLine(l.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                  className="crm-input"
                />
                <input
                  type="number"
                  min={0}
                  value={l.price}
                  onChange={(e) => setLine(l.id, { price: Number(e.target.value) || 0 })}
                  className="crm-input"
                />
                <button
                  onClick={() => setLines((prev) => prev.filter((x) => x.id !== l.id))}
                  className="grid h-7 w-7 place-items-center text-[var(--color-text-muted)] transition hover:text-[#C0272D]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="pt-1 text-right text-[12.5px] text-[var(--color-text-muted)]">
              Сумма состава: <span className="font-semibold text-[var(--color-text)]">{formatMoney(linesTotal)}</span>
            </div>
          </div>
        )}

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Заметки</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="crm-input" />
        </label>

        {error && <p className="mt-3 text-[13px] text-[#C0272D]">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-[10px] border border-[var(--color-border)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--color-text-muted)]">
            Отмена
          </button>
          <button
            disabled={!canSave}
            onClick={save}
            className="rounded-[10px] bg-[var(--color-primary)] px-5 py-2.5 text-[13.5px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

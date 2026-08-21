"use client";

import { useState } from "react";
import { LineCategory } from "@/lib/types";
import { X } from "lucide-react";

const categoryTitles: Record<LineCategory, string> = {
  product: "Добавить товар",
  kit: "Добавить комплект",
  service: "Добавить услугу",
};

export function AddLineItemModal({
  category,
  onClose,
  onAdd,
}: {
  category: LineCategory;
  onClose: () => void;
  onAdd: (item: { name: string; pricePerDay: number; qty: number }) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const canSubmit = name.trim().length > 0 && Number(price) > 0 && Number(qty) > 0;

  function submit() {
    if (!canSubmit) return;
    onAdd({ name: name.trim(), pricePerDay: Number(price), qty: Number(qty) });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold">{categoryTitles[category]}</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Название</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="crm-input" placeholder="Например, Перфоратор Bosch GBH 5-40" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Цена за сутки, ₸</span>
              <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="crm-input" placeholder="6000" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Кол-во</span>
              <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="crm-input" />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-[13px] font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            Отмена
          </button>
          <button
            disabled={!canSubmit}
            onClick={submit}
            className="rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
}

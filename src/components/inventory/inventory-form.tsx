"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InventoryItem, InventoryStatus } from "@/lib/types";
import { branches, inventoryCategories, inventoryStatusLabels } from "@/lib/mock-data";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { ChevronLeft } from "lucide-react";

export interface InventoryFormValues {
  name: string;
  sku: string;
  category: string;
  subcategory: string;
  serialNumber: string;
  photoUrl?: string;
  purchasePrice: string;
  rentalPricePerDay: string;
  status: InventoryStatus;
  branch: string;
  notes: string;
}

const emptyValues: InventoryFormValues = {
  name: "",
  sku: "",
  category: "",
  subcategory: "",
  serialNumber: "",
  photoUrl: undefined,
  purchasePrice: "",
  rentalPricePerDay: "",
  status: "available",
  branch: "",
  notes: "",
};

export function InventoryForm({
  initial,
  title,
  onSubmit,
  submitting,
  error,
}: {
  initial?: Partial<InventoryItem>;
  title: string;
  onSubmit: (values: InventoryFormValues) => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<InventoryFormValues>({
    ...emptyValues,
    ...(initial
      ? {
          name: initial.name ?? "",
          sku: initial.sku ?? "",
          category: initial.category ?? "",
          subcategory: initial.subcategory ?? "",
          serialNumber: initial.serialNumber ?? "",
          photoUrl: initial.photoUrl ?? undefined,
          purchasePrice: initial.purchasePrice?.toString() ?? "",
          rentalPricePerDay: initial.rentalPricePerDay?.toString() ?? "",
          status: initial.status ?? "available",
          branch: initial.branch ?? "",
          notes: initial.notes ?? "",
        }
      : {}),
  });

  const canSubmit = values.name.trim().length > 0 && Number(values.rentalPricePerDay) > 0 && values.branch.trim().length > 0;

  function set<K extends keyof InventoryFormValues>(key: K, v: InventoryFormValues[K]) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <button onClick={() => router.back()} className="mb-4 flex items-center gap-1.5 text-[14px] font-semibold transition hover:text-[var(--color-primary)]">
        <ChevronLeft className="h-4 w-4" /> {title}
      </button>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-6 card-shadow">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1 space-y-4">
            <Field label="Название" required>
              <input value={values.name} onChange={(e) => set("name", e.target.value)} className="crm-input" placeholder="Перфоратор Bosch GBH 5-40" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Артикул (SKU)">
                <input value={values.sku} onChange={(e) => set("sku", e.target.value)} className="crm-input" placeholder="QS.0142" />
              </Field>
              <Field label="Серийный номер">
                <input value={values.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} className="crm-input" />
              </Field>
            </div>
          </div>
          <PhotoUpload value={values.photoUrl} onChange={(url) => set("photoUrl", url)} />
        </div>

        <div className="my-6 border-t border-[var(--color-border)]" />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Категория">
            <select value={values.category} onChange={(e) => set("category", e.target.value)} className="crm-input">
              <option value="">Категория</option>
              {inventoryCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Подкатегория">
            <input value={values.subcategory} onChange={(e) => set("subcategory", e.target.value)} className="crm-input" />
          </Field>
          <Field label="Стоимость покупки, ₸">
            <input type="number" min={0} value={values.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} className="crm-input" />
          </Field>
          <Field label="Стоимость аренды за сутки, ₸" required>
            <input type="number" min={0} value={values.rentalPricePerDay} onChange={(e) => set("rentalPricePerDay", e.target.value)} className="crm-input" />
          </Field>
          <Field label="Филиал" required>
            <select value={values.branch} onChange={(e) => set("branch", e.target.value)} className="crm-input">
              <option value="">Пункт проката</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Статус">
            <select value={values.status} onChange={(e) => set("status", e.target.value as InventoryStatus)} className="crm-input">
              {Object.entries(inventoryStatusLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Заметки">
            <textarea value={values.notes} onChange={(e) => set("notes", e.target.value)} className="crm-input" rows={3} />
          </Field>
        </div>

        {error && <p className="mt-3 text-[13px] text-[#C0272D]">{error}</p>}

        <div className="mt-6 flex justify-end">
          <button
            disabled={!canSubmit || submitting}
            onClick={() => onSubmit(values)}
            className="rounded-[10px] bg-[var(--color-primary)] px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">
        {label} {required && <span className="text-[var(--color-primary)]">*</span>}
      </span>
      {children}
    </label>
  );
}

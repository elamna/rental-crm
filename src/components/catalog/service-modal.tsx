"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Service, ServiceTariff, ServiceTariffType } from "@/lib/types";
import { serviceTariffLabels } from "@/lib/catalog-utils";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

const TARIFF_TYPES: ServiceTariffType[] = ["day", "once", "period"];

export function ServiceModal({ service, onClose }: { service?: Service; onClose: () => void }) {
  const addService = useAppStore((s) => s.addService);
  const updateService = useAppStore((s) => s.updateService);

  const [name, setName] = useState(service?.name ?? "");
  const [notes, setNotes] = useState(service?.notes ?? "");
  const [tariffs, setTariffs] = useState<ServiceTariff[]>(service?.tariffs ?? [{ type: "day", price: 0 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && !saving;

  function toggleTariff(type: ServiceTariffType) {
    setTariffs((prev) => (prev.some((t) => t.type === type) ? prev.filter((t) => t.type !== type) : [...prev, { type, price: 0 }]));
  }

  function setPrice(type: ServiceTariffType, price: number) {
    setTariffs((prev) => prev.map((t) => (t.type === type ? { ...t, price } : t)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload = { name: name.trim(), tariffs, notes: notes.trim() || undefined };
    try {
      if (service) await updateService(service.id, payload);
      else await addService(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить услугу");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-[var(--radius-card)] bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-display text-[18px] font-bold">{service ? "Услуга" : "Новая услуга"}</h2>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">Расходники и работы, которые добавляются в аренду отдельной строкой</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] transition hover:text-[#C0272D]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">
            Название <span className="text-[var(--color-primary)]">*</span>
          </span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="crm-input" placeholder="Сверло 18 (Магнитный дрел)" />
        </label>

        <div className="mt-5">
          <span className="mb-2 block text-[12.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Тарифы</span>
          <div className="space-y-2">
            {TARIFF_TYPES.map((type) => {
              const active = tariffs.find((t) => t.type === type);
              return (
                <div key={type} className="flex items-center gap-3">
                  <button
                    onClick={() => toggleTariff(type)}
                    className={cn(
                      "flex w-[150px] items-center gap-2 rounded-[10px] border px-3 py-2 text-[13px] font-medium transition",
                      active
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]"
                    )}
                  >
                    <span className={cn("grid h-4 w-4 place-items-center rounded-[4px] border", active ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)]")}>
                      {active && <span className="text-[10px] leading-none">✓</span>}
                    </span>
                    {serviceTariffLabels[type]}
                  </button>
                  <input
                    type="number"
                    min={0}
                    disabled={!active}
                    value={active?.price ?? ""}
                    onChange={(e) => setPrice(type, Number(e.target.value) || 0)}
                    placeholder="0"
                    className="crm-input flex-1 disabled:opacity-40"
                  />
                  <span className="text-[13px] text-[var(--color-text-muted)]">₸</span>
                </div>
              );
            })}
          </div>
        </div>

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
            className="rounded-[10px] bg-[var(--color-primary)] px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

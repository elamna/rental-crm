"use client";

import { useEffect, useState } from "react";
import { Delivery, DeliveryDirection, DeliveryKind, DELIVERY_DIRECTION_LABELS } from "@/lib/types";
import { branches } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Package, Trash2, Truck, X } from "lucide-react";

interface Staff {
  id: string;
  name: string;
}

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Заведение и правка доставки. Открывается и из раздела «Доставка»,
 * и из карточки аренды — поэтому клиент с телефоном и адрес выдачи
 * можно передать сверху, чтобы менеджер не перепечатывал.
 */
export function DeliveryModal({
  delivery,
  rentalId,
  defaults,
  onClose,
  onSaved,
}: {
  delivery?: Delivery;
  rentalId?: string;
  defaults?: { clientPhone?: string; addressFrom?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<DeliveryKind>(delivery?.kind ?? "delivery");
  const [direction, setDirection] = useState<DeliveryDirection>(delivery?.direction ?? "to");
  const [courierId, setCourierId] = useState(delivery?.courierId ?? "");
  const [deliverBy, setDeliverBy] = useState(toLocalInput(delivery?.deliverBy));
  const [addressFrom, setAddressFrom] = useState(delivery?.addressFrom ?? defaults?.addressFrom ?? branches[0] ?? "");
  const [addressTo, setAddressTo] = useState(delivery?.addressTo ?? "");
  const [clientPhone, setClientPhone] = useState(delivery?.clientPhone ?? defaults?.clientPhone ?? "");
  const [receiverPhone, setReceiverPhone] = useState(delivery?.receiverPhone ?? "");
  const [price, setPrice] = useState(delivery?.price ? String(delivery.price) : "");
  const [comment, setComment] = useState(delivery?.comment ?? "");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/staff")
      .then((r) => (r.ok ? r.json() : []))
      .then(setStaff)
      .catch(() => setStaff([]));
  }, []);

  // Вывоз — это дорога обратно: адреса меняются местами по смыслу
  const fromLabel = kind === "pickup" ? "Адрес, откуда забрать" : "Адрес выдачи";
  const toLabel = kind === "pickup" ? "Куда привезти" : "Адрес доставки";

  const canSave = addressTo.trim().length > 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const payload = {
      rentalId,
      kind,
      direction,
      courierId: courierId || undefined,
      deliverBy: deliverBy ? new Date(deliverBy).toISOString() : undefined,
      addressFrom: addressFrom.trim() || undefined,
      addressTo: addressTo.trim(),
      clientPhone: clientPhone.trim() || undefined,
      receiverPhone: receiverPhone.trim() || undefined,
      price: Number(price) || 0,
      comment: comment.trim() || undefined,
    };
    try {
      const res = await fetch(delivery ? `/api/deliveries/${delivery.id}` : "/api/deliveries", {
        method: delivery ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Не удалось сохранить доставку");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить доставку");
      setSaving(false);
    }
  }

  async function remove() {
    if (!delivery || !confirm(`Удалить доставку №${delivery.number}?`)) return;
    setSaving(true);
    await fetch(`/api/deliveries/${delivery.id}`, { method: "DELETE" });
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[20px] bg-[var(--color-surface)] p-4 pb-8 shadow-xl safe-bottom sm:rounded-[var(--radius-card)] sm:p-6 sm:pb-6"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-display text-[18px] font-bold">{delivery ? `Доставка №${delivery.number}` : "Доставка"}</h2>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">
              {delivery?.rentalNumber ? `По аренде №${delivery.rentalNumber}` : "Появится в разделе «Доставка» как новый запрос"}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] transition hover:text-[#C0272D]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Доставка или вывоз */}
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: "delivery", label: "Доставка", hint: "везём клиенту", icon: Truck },
              { value: "pickup", label: "Вывоз", hint: "забираем у клиента", icon: Package },
            ] as { value: DeliveryKind; label: string; hint: string; icon: React.ElementType }[]
          ).map((o) => {
            const Icon = o.icon;
            const active = kind === o.value;
            return (
              <button
                key={o.value}
                onClick={() => setKind(o.value)}
                className={cn(
                  "flex items-center gap-2.5 rounded-[12px] border p-3 text-left transition",
                  active ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] hover:border-[var(--color-primary)]"
                )}
              >
                <span
                  className={cn(
                    "grid h-4 w-4 shrink-0 place-items-center rounded-full border-2",
                    active ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"
                  )}
                >
                  {active && <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />}
                </span>
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]")} />
                <span>
                  <span className="block text-[13.5px] font-semibold">{o.label}</span>
                  <span className="block text-[11.5px] text-[var(--color-text-muted)]">{o.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Исполнитель">
            <select value={courierId} onChange={(e) => setCourierId(e.target.value)} className="crm-input">
              <option value="">Не назначен</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Доставить до">
            <input type="datetime-local" value={deliverBy} onChange={(e) => setDeliverBy(e.target.value)} className="crm-input" />
          </Field>

          <Field label={fromLabel}>
            <input value={addressFrom} onChange={(e) => setAddressFrom(e.target.value)} className="crm-input" placeholder="Пункт проката или адрес" />
          </Field>
          <Field label={toLabel} required>
            <input value={addressTo} onChange={(e) => setAddressTo(e.target.value)} className="crm-input" placeholder="Улица, дом, ориентир" />
          </Field>

          <Field label="Номер клиента">
            <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="crm-input" placeholder="+7 7XX XXX XX XX" />
          </Field>
          <Field label="Номер получателя">
            <input value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} className="crm-input" placeholder="если получает другой человек" />
          </Field>

          <Field label="Цена доставки, ₸">
            <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="crm-input" />
          </Field>
          <Field label="Маршрут">
            <select value={direction} onChange={(e) => setDirection(e.target.value as DeliveryDirection)} className="crm-input">
              {Object.entries(DELIVERY_DIRECTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Комментарий" className="mt-4">
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="crm-input" placeholder="Этаж, домофон, во сколько удобно" />
        </Field>

        {error && <p className="mt-3 text-[13px] text-[#C0272D]">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-2">
          {delivery && (
            <button
              onClick={remove}
              disabled={saving}
              className="mr-auto flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] px-3 py-2.5 text-[13px] font-semibold text-[#C0272D] transition hover:bg-[#FDECEC]"
            >
              <Trash2 className="h-3.5 w-3.5" /> Удалить
            </button>
          )}
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

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">
        {label} {required && <span className="text-[var(--color-primary)]">*</span>}
      </span>
      {children}
    </label>
  );
}

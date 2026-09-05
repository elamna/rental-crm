"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Lead } from "@/lib/types";
import { acquisitionChannels } from "@/lib/mock-data";
import { FUNNEL_COLUMNS, FunnelBucket, dateForBucket, leadBucket } from "@/lib/funnel";
import { cn } from "@/lib/utils";
import { FileSignature, Trash2, X } from "lucide-react";

export interface StaffMember {
  id: string;
  name: string;
  position: string;
}

function toDateInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function LeadModal({
  lead,
  staff,
  onClose,
  onSaved,
}: {
  lead?: Lead;
  staff: StaffMember[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(lead?.title ?? "");
  const [clientName, setClientName] = useState(lead?.clientName ?? "");
  const [phone, setPhone] = useState(lead?.phone ?? "+7");
  const [amount, setAmount] = useState(lead?.amount ? String(lead.amount) : "");
  const [managerId, setManagerId] = useState(lead?.managerId ?? "");
  const [source, setSource] = useState(lead?.source ?? "");
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const [unavailable, setUnavailable] = useState(lead?.unavailable ?? false);
  const [neededAt, setNeededAt] = useState(toDateInput(lead?.neededAt) || toDateInput(new Date().toISOString()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { can } = useAuth();

  // Колонка не выбирается вручную — она следует из даты. Показываем, куда попадёт карточка
  const previewBucket: FunnelBucket = unavailable
    ? "unavailable"
    : leadBucket(
        { ...(lead ?? ({} as Lead)), unavailable: false, neededAt: neededAt ? new Date(`${neededAt}T12:00:00`).toISOString() : undefined },
        new Date()
      );
  const previewColumn = FUNNEL_COLUMNS.find((c) => c.key === previewBucket);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      title: title.trim(),
      clientName: clientName.trim() || undefined,
      phone: phone.trim() === "+7" ? undefined : phone.trim(),
      amount: Number(amount) || 0,
      managerId: managerId || undefined,
      source: source || undefined,
      notes: notes.trim() || undefined,
      unavailable,
      neededAt: neededAt ? new Date(`${neededAt}T12:00:00`).toISOString() : undefined,
    };
    try {
      const res = await fetch(lead ? `/api/leads/${lead.id}` : "/api/leads", {
        method: lead ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Не удалось сохранить заявку");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить заявку");
      setSaving(false);
    }
  }

  async function setStatus(status: Lead["status"]) {
    if (!lead) return;
    setSaving(true);
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onSaved();
    onClose();
  }

  /**
   * Заявка → аренда: сервер находит клиента по телефону или создаёт нового,
   * дальше открывается обычная форма аренды с уже выбранным клиентом.
   * Заявка закроется как успешная, когда аренду забронируют.
   */
  async function convertToRental() {
    if (!lead) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/convert`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось оформить аренду");
      const params = new URLSearchParams({ client: data.clientId, lead: lead.id, title: lead.title });
      if (lead.neededAt) params.set("needed", lead.neededAt);
      router.push(`/rentals/new?${params}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось оформить аренду");
      setSaving(false);
    }
  }

  async function remove() {
    if (!lead || !confirm(`Удалить заявку №${lead.number}?`)) return;
    setSaving(true);
    await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[20px] bg-[var(--color-surface)] p-4 pb-8 shadow-xl safe-bottom sm:rounded-[var(--radius-card)] sm:p-6 sm:pb-6"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-display text-[18px] font-bold">{lead ? `Заявка №${lead.number}` : "Новая заявка"}</h2>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">Основная информация</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] transition hover:text-[#C0272D]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">
            Что нужно клиенту <span className="text-[var(--color-primary)]">*</span>
          </span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="crm-input" placeholder="Перфоратор, бетономешалка…" />
        </label>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Имя клиента</span>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="crm-input" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Номер телефона</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="crm-input" placeholder="+7 7XX XXX XX XX" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Сумма сделки, ₸</span>
            <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="crm-input" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Менеджер</span>
            <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className="crm-input">
              <option value="">Не назначен</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Источник заявки</span>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="crm-input">
              <option value="">Канал привлечения</option>
              {acquisitionChannels.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Когда нужен инструмент</span>
            <input type="date" value={neededAt} onChange={(e) => setNeededAt(e.target.value)} className="crm-input" disabled={unavailable} />
          </label>
        </div>

        <label className="mt-4 flex cursor-pointer select-none items-center gap-2 rounded-[10px] border border-[var(--color-border)] px-3 py-2.5">
          <input
            type="checkbox"
            checked={unavailable}
            onChange={(e) => setUnavailable(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          <span className="text-[13px] font-medium">Инструмента нет в наличии</span>
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Дополнительно</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="crm-input" />
        </label>

        {previewColumn && (
          <p className="mt-4 rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[12.5px] text-[var(--color-text-muted)]">
            Карточка встанет в колонку <span className="font-semibold text-[var(--color-text)]">«{previewColumn.label}»</span>
            {!unavailable && " и сама переедет, когда дата приблизится."}
          </p>
        )}

        {error && <p className="mt-3 text-[13px] text-[#C0272D]">{error}</p>}

        {lead && lead.status === "open" && can("rentals.edit") && (
          <button
            onClick={convertToRental}
            disabled={saving}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--color-primary)] py-2.5 text-[13.5px] font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            <FileSignature className="h-4 w-4" /> Оформить аренду
          </button>
        )}

        {lead && lead.status === "open" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setStatus("won")}
              disabled={saving}
              className="rounded-[10px] bg-[#1C8A46] py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#167A3C] disabled:opacity-50"
            >
              ✓ Успешно завершено
            </button>
            <button
              onClick={() => setStatus("lost")}
              disabled={saving}
              className="rounded-[10px] border border-[var(--color-border)] py-2.5 text-[13px] font-semibold text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)] disabled:opacity-50"
            >
              ✕ Не реализовано
            </button>
          </div>
        )}

        {lead && lead.status !== "open" && (
          <button
            onClick={() => setStatus("open")}
            disabled={saving}
            className="mt-5 w-full rounded-[10px] border border-[var(--color-border)] py-2.5 text-[13px] font-semibold text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
          >
            Вернуть на доску
          </button>
        )}

        <div className={cn("mt-6 flex items-center justify-end gap-2")}>
          {lead && (
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
            disabled={saving || !title.trim()}
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

export { dateForBucket };

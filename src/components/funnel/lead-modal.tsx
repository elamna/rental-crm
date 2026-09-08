"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useAppStore } from "@/lib/store";
import { ClientType, Lead, LeadConcern, LEAD_CONCERN_LABELS, LEAD_MOODS } from "@/lib/types";
import { acquisitionChannels } from "@/lib/mock-data";
import { FUNNEL_COLUMNS, FunnelBucket, dateForBucket, leadBucket } from "@/lib/funnel";
import { cn } from "@/lib/utils";
import { Calendar, Clock, FileSignature, Link2, Trash2, User, Users, Wrench, X } from "lucide-react";

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

function toTimeInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Телефон приводится к одному виду прямо при вводе: менеджеры набирают его
 * как придётся, а потом по этому номеру ищут клиента и не находят.
 */
function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  // Код страны отрезаем только у полного номера: иначе набранное «707…»
  // превращалось в «07…» — первую цифру принимали за код
  let rest = digits;
  if (rest.length === 11 && (rest[0] === "7" || rest[0] === "8")) rest = rest.slice(1);
  else if (rest.length > 11) rest = rest.slice(-10);
  rest = rest.slice(0, 10);
  const parts = [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 8), rest.slice(8, 10)];
  let out = "+7";
  if (parts[0]) out += ` (${parts[0]}`;
  if (parts[0].length === 3) out += ")";
  if (parts[1]) out += ` ${parts[1]}`;
  if (parts[2]) out += `-${parts[2]}`;
  if (parts[3]) out += `-${parts[3]}`;
  return out;
}

function digitsOf(phone: string) {
  return phone.replace(/\D/g, "");
}

/** Подпись поля: одинаковая во всей форме, со звёздочкой у обязательных */
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-[13.5px] font-semibold">
      {children} {required && <span className="text-[#C0272D]">*</span>}
    </span>
  );
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
  const [phone, setPhone] = useState(lead?.phone ? formatPhone(lead.phone) : "");
  const [amount, setAmount] = useState(lead?.amount ? String(lead.amount) : "");
  const [managerId, setManagerId] = useState(lead?.managerId ?? "");
  const [source, setSource] = useState(lead?.source ?? "");
  const [clientType, setClientType] = useState<ClientType>(lead?.clientType ?? "individual");
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const [unavailable, setUnavailable] = useState(lead?.unavailable ?? false);
  const [otherCity, setOtherCity] = useState(lead?.otherCity ?? false);
  const [concerns, setConcerns] = useState<LeadConcern[]>(lead?.concerns ?? []);
  const [mood, setMood] = useState<number | undefined>(lead?.mood);
  // Дата НЕ подставляется сама: менеджер должен спросить её у клиента,
  // иначе вся воронка забивается карточками «на сегодня»
  const [neededDate, setNeededDate] = useState(toDateInput(lead?.neededAt));
  const [neededTime, setNeededTime] = useState(toTimeInput(lead?.neededAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { can } = useAuth();

  // Названия из каталога — чтобы заявка и аренда назывались одинаково
  const inventory = useAppStore((s) => s.inventory);
  const toolNames = useMemo(
    () => [...new Set(inventory.map((i) => i.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")),
    [inventory]
  );

  // Клиент из другого города или инструмента нет — дату спрашивать не с чего
  const dateRequired = !unavailable && !otherCity;
  const dateMissing = dateRequired && (!neededDate || !neededTime);

  const filled =
    title.trim() &&
    clientName.trim() &&
    digitsOf(phone).length >= 11 &&
    Number(amount) > 0 &&
    managerId &&
    source &&
    !dateMissing;

  const neededAt =
    neededDate && !unavailable
      ? new Date(`${neededDate}T${neededTime || "12:00"}:00`).toISOString()
      : undefined;

  // Колонка не выбирается вручную — она следует из даты. Показываем, куда попадёт карточка
  const previewBucket: FunnelBucket = unavailable
    ? "unavailable"
    : leadBucket({ ...(lead ?? ({} as Lead)), unavailable: false, neededAt }, new Date());
  const previewColumn = FUNNEL_COLUMNS.find((c) => c.key === previewBucket);

  function toggleConcern(key: LeadConcern) {
    setConcerns((list) => (list.includes(key) ? list.filter((c) => c !== key) : [...list, key]));
  }

  async function save() {
    if (!filled) return;
    setSaving(true);
    setError(null);
    const payload = {
      title: title.trim(),
      clientName: clientName.trim() || undefined,
      phone: phone.trim() || undefined,
      amount: Number(amount) || 0,
      managerId: managerId || undefined,
      source: source || undefined,
      clientType,
      notes: notes.trim() || undefined,
      unavailable,
      otherCity,
      concerns,
      mood,
      neededAt,
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

  const fieldIcon = "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[20px] bg-[var(--color-surface)] p-5 pb-8 shadow-xl safe-bottom sm:rounded-[var(--radius-card)] sm:p-6 sm:pb-6"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-display text-[22px] font-bold">{lead ? `Заявка №${lead.number}` : "Новая заявка"}</h2>
            <p className="text-[14px] text-[var(--color-text-muted)]">Основная информация</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] transition hover:text-[#C0272D]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block">
          <FieldLabel required>Имя инструмента</FieldLabel>
          <span className="relative block">
            <Wrench className={fieldIcon} />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              list="lead-tool-names"
              className="crm-input pl-9"
              placeholder="Перфоратор, бетономешалка, виброплита…"
            />
          </span>
          <datalist id="lead-tool-names">
            {toolNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel required>Имя клиента</FieldLabel>
            <span className="relative block">
              <User className={fieldIcon} />
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="crm-input pl-9" placeholder="Иванов Иван" />
            </span>
          </label>

          <label className="block">
            <FieldLabel required>Номер телефона</FieldLabel>
            <input
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              inputMode="tel"
              className="crm-input"
              placeholder="+7 (___) ___-__-__"
            />
          </label>

          <label className="block">
            <FieldLabel required>Сумма инструмента, ₸</FieldLabel>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="crm-input"
              placeholder="Например: 10 000"
            />
          </label>

          <label className="block">
            <FieldLabel required>Менеджер</FieldLabel>
            <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className="crm-input">
              <option value="">Выбрать менеджера</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <FieldLabel required>Откуда пришёл</FieldLabel>
            <span className="relative block">
              <Link2 className={fieldIcon} />
              <select value={source} onChange={(e) => setSource(e.target.value)} className="crm-input pl-9">
                <option value="">Выбрать источник</option>
                {acquisitionChannels.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="block">
            <FieldLabel required>Тип клиента</FieldLabel>
            <span className="relative block">
              <Users className={fieldIcon} />
              <select value={clientType} onChange={(e) => setClientType(e.target.value as ClientType)} className="crm-input pl-9">
                <option value="individual">Физ. лицо</option>
                <option value="company">Компания</option>
              </select>
            </span>
          </label>

          <label className="block">
            <FieldLabel required={dateRequired}>Дата</FieldLabel>
            <span className="relative block">
              <Calendar className={fieldIcon} />
              <input
                type="date"
                value={neededDate}
                onChange={(e) => setNeededDate(e.target.value)}
                disabled={unavailable}
                className={cn("crm-input pl-9", dateRequired && !neededDate && "border-[#C0272D] bg-[#FDECEC]")}
              />
            </span>
          </label>

          <label className="block">
            <FieldLabel required={dateRequired}>Время</FieldLabel>
            <span className="relative block">
              <Clock className={fieldIcon} />
              <input
                type="time"
                value={neededTime}
                onChange={(e) => setNeededTime(e.target.value)}
                disabled={unavailable}
                className={cn("crm-input pl-9", dateRequired && !neededTime && "border-[#C0272D] bg-[#FDECEC]")}
              />
            </span>
          </label>
        </div>

        {dateMissing && (
          <p className="mt-2 text-[13px] font-medium text-[#C0272D]">
            Спросите у клиента, когда нужен инструмент — без даты заявку не сохранить.
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer select-none items-center gap-2 rounded-[10px] border border-[var(--color-border)] px-3 py-2.5">
            <input
              type="checkbox"
              checked={unavailable}
              onChange={(e) => setUnavailable(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            <span className="text-[14px] font-medium">Инструмента нет в наличии</span>
          </label>
          <label className="flex cursor-pointer select-none items-center gap-2 rounded-[10px] border border-[var(--color-border)] px-3 py-2.5">
            <input
              type="checkbox"
              checked={otherCity}
              onChange={(e) => setOtherCity(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            <span className="text-[14px] font-medium">Другой город</span>
          </label>
        </div>

        <div className="mt-4 rounded-[12px] bg-[var(--color-bg)] p-3.5">
          <p className="mb-2 text-[14px] font-bold">Что смущает клиента</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {(Object.keys(LEAD_CONCERN_LABELS) as LeadConcern[]).map((key) => (
              <label key={key} className="flex cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  checked={concerns.includes(key)}
                  onChange={() => toggleConcern(key)}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                <span className="text-[14px]">{LEAD_CONCERN_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="mt-4 block">
          <FieldLabel>Комментарий</FieldLabel>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="crm-input"
            placeholder="Дополнительная информация о клиенте. Например: спрашивал цену, перезвонить завтра"
          />
        </label>

        <div className="mt-4">
          <p className="mb-2 text-[14px] font-bold">Состояние клиента</p>
          <div className="flex flex-wrap gap-2">
            {LEAD_MOODS.map((face, i) => {
              const value = i + 1;
              return (
                <button
                  key={face}
                  type="button"
                  onClick={() => setMood(mood === value ? undefined : value)}
                  className={cn(
                    "grid h-11 w-14 place-items-center rounded-[10px] border text-[20px] transition",
                    mood === value
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                      : "border-[var(--color-border)] hover:bg-[var(--color-bg)]"
                  )}
                >
                  {face}
                </button>
              );
            })}
          </div>
        </div>

        {previewColumn && (
          <p className="mt-4 rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[13.5px] text-[var(--color-text-muted)]">
            Карточка встанет в колонку <span className="font-semibold text-[var(--color-text)]">«{previewColumn.label}»</span>
            {!unavailable && neededAt && " и сама переедет, когда дата приблизится."}
          </p>
        )}

        {error && <p className="mt-3 text-[14px] text-[#C0272D]">{error}</p>}

        {lead && lead.status === "open" && can("rentals.edit") && (
          <button
            onClick={convertToRental}
            disabled={saving}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--color-primary)] py-2.5 text-[14.5px] font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            <FileSignature className="h-4 w-4" /> Оформить аренду
          </button>
        )}

        {lead && lead.status === "open" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setStatus("won")}
              disabled={saving}
              className="rounded-[10px] bg-[#1C8A46] py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#167A3C] disabled:opacity-50"
            >
              ✓ Успешно завершено
            </button>
            <button
              onClick={() => setStatus("lost")}
              disabled={saving}
              className="rounded-[10px] border border-[var(--color-border)] py-2.5 text-[14px] font-semibold text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)] disabled:opacity-50"
            >
              ✕ Не реализовано
            </button>
          </div>
        )}

        {lead && lead.status !== "open" && (
          <button
            onClick={() => setStatus("open")}
            disabled={saving}
            className="mt-5 w-full rounded-[10px] border border-[var(--color-border)] py-2.5 text-[14px] font-semibold text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
          >
            Вернуть на доску
          </button>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          {lead && (
            <button
              onClick={remove}
              disabled={saving}
              className="mr-auto flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] px-3 py-2.5 text-[14px] font-semibold text-[#C0272D] transition hover:bg-[#FDECEC]"
            >
              <Trash2 className="h-3.5 w-3.5" /> Удалить
            </button>
          )}
          <button onClick={onClose} className="rounded-[10px] border border-[var(--color-border)] px-4 py-2.5 text-[14.5px] font-semibold text-[var(--color-text-muted)]">
            Отмена
          </button>
          <button
            disabled={saving || !filled}
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

export { dateForBucket };

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { formatMoney, formatDateTimeDisplay } from "@/lib/utils";
import { PhoneInput } from "@/components/ui/phone-input";
import { findBlacklistMatch, phoneDigits } from "@/lib/blacklist";

import { ClientTypeFilterToggle } from "@/components/ui/client-type-filter";
import { matchesClientType, type ClientTypeFilter } from "@/lib/client-type";
import { Ban, ShieldOff, Siren, Plus, X } from "lucide-react";

/** Частые причины — чтобы не набирать руками то, что пишут каждый раз */
const REASONS = ["Мошенник", "Сомнительный", "Не вернул инструмент", "Испортил инструмент", "Долг"];

export default function BlacklistPage() {
  const clients = useAppStore((s) => s.clients);
  const rentals = useAppStore((s) => s.rentals);
  const hydrated = useAppStore((s) => s.hydrated);
  const updateClient = useAppStore((s) => s.updateClient);
  const addClient = useAppStore((s) => s.addClient);
  const [adding, setAdding] = useState(false);

  const [clientType, setClientType] = useState<ClientTypeFilter>("all");
  const blacklisted = useMemo(
    () => clients.filter((c) => c.blacklisted && matchesClientType(c.type, clientType)),
    [clients, clientType]
  );

  const stolenByClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rentals) {
      if (r.status === "stolen") map.set(r.client.id, (map.get(r.client.id) ?? 0) + 1);
    }
    return map;
  }, [rentals]);

  async function handleUnblock(id: string) {
    if (!window.confirm("Убрать клиента из чёрного списка?")) return;
    await updateClient(id, { blacklisted: false });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-6 py-4 backdrop-blur">
        <div>
          <h1 className="font-display text-[20px] font-bold">Чёрный список</h1>
          <p className="text-[14px] text-[var(--color-text-muted)]">
            Клиенты с ограничением доступа к аренде — попадают сюда автоматически (например, при краже товара) или вручную
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[14px] font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-primary)] transition hover:bg-[var(--color-primary-hover)]"
        >
          <Plus className="h-4 w-4" /> Добавить
        </button>
      </header>

      {adding && (
        <AddToBlacklist
          clients={clients}
          onClose={() => setAdding(false)}
          onSave={async ({ name, phone, iin, reason }) => {
            // Человека ищем по телефону и по ИИН/БИН: номер меняют, документ — нет.
            // Если он уже в базе — блокируем его карточку, а не плодим двойника
            const digits = phoneDigits(phone);
            const doc = iin.trim();
            const existing = clients.find(
              (c) =>
                (digits && phoneDigits(c.phone) === digits) ||
                (doc && ((c.iin ?? "").trim() === doc || (c.bin ?? "").trim() === doc))
            );
            if (existing) {
              await updateClient(existing.id, {
                blacklisted: true,
                blacklistReason: reason,
                // Документ мог быть неизвестен раньше — сохраним заодно
                ...(doc && !existing.iin && !existing.bin ? { iin: doc } : {}),
              });
            } else {
              await addClient({
                name: name || phone || doc,
                phone,
                iin: doc || undefined,
                blacklisted: true,
                blacklistReason: reason,
              });
            }
            setAdding(false);
          }}
        />
      )}

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <ClientTypeFilterToggle value={clientType} onChange={setClientType} className="mb-3" />
        {!hydrated ? (
          <p className="text-[14px] text-[var(--color-text-muted)]">Загрузка…</p>
        ) : blacklisted.length === 0 ? (
          <div className="mx-auto mt-16 max-w-md rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center card-shadow">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[14px] bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]">
              <Ban className="h-6 w-6" />
            </div>
            <h2 className="font-display text-[17px] font-bold">Чёрный список пуст</h2>
            <p className="mt-1.5 text-[14px] text-[var(--color-text-muted)]">
              Клиенты появятся здесь автоматически, если аренду отметят украденной, или их можно добавить вручную из карточки клиента.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {blacklisted.map((c) => {
              const stolenCount = stolenByClient.get(c.id) ?? 0;
              return (
                <div key={c.id} className="rounded-[var(--radius-card)] border border-[#F3B7B7] bg-[var(--color-surface)] p-4 card-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/clients/${c.id}`} className="min-w-0">
                      <div className="truncate text-[15px] font-semibold hover:underline">{c.name}</div>
                      <div className="text-[13.5px] text-[var(--color-text-muted)]">{c.phone}</div>
                    </Link>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#FDECEC] px-2 py-0.5 text-[12px] font-semibold text-[#C0272D]">
                      <Ban className="h-3 w-3" /> В ЧС
                    </span>
                  </div>

                  {c.blacklistReason && (
                    <div className="mt-2 rounded-[8px] bg-[#FDECEC] px-2.5 py-1.5 text-[13px] font-medium text-[#C0272D]">
                      {c.blacklistReason}
                      {c.blacklistedAt && (
                        <span className="ml-1 font-normal opacity-80">· {formatDateTimeDisplay(c.blacklistedAt).split(",")[0]}</span>
                      )}
                    </div>
                  )}

                  {stolenCount > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-[8px] bg-[#FDECEC] px-2.5 py-1.5 text-[13px] font-medium text-[#C0272D]">
                      <Siren className="h-3.5 w-3.5 shrink-0" />
                      Краж инструмента: {stolenCount}
                    </div>
                  )}

                  <div className="mt-2.5 space-y-1 text-[13.5px] text-[var(--color-text-muted)]">
                    <div className="flex justify-between">
                      <span>Аренд всего</span>
                      <span className="font-medium text-[var(--color-text)]">{c.totalRentals}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Потрачено</span>
                      <span className="font-medium text-[var(--color-text)]">{formatMoney(c.totalSpent)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUnblock(c.id)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-[var(--color-border)] py-2 text-[13.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
                  >
                    <ShieldOff className="h-3.5 w-3.5" /> Убрать из чёрного списка
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Добавление в чёрный список вручную.
 *
 * Сюда попадают и те, кого в базе ещё нет: в прокат позвонил человек, которого
 * уже знают как мошенника, и записать его нужно до того, как он придёт.
 */
function AddToBlacklist({
  clients,
  onClose,
  onSave,
}: {
  clients: { id: string; name: string; phone: string; iin?: string; bin?: string; blacklisted?: boolean }[];
  onClose: () => void;
  onSave: (values: { name: string; phone: string; iin: string; reason: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [iin, setIin] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = phoneDigits(phone);
  const doc = iin.trim();
  // Показываем, если такой человек уже есть в базе — по телефону или по документу
  const match =
    digits.length >= 10 || doc.length >= 12
      ? clients.find(
          (c) =>
            (digits.length >= 10 && phoneDigits(c.phone) === digits) ||
            (doc.length >= 12 && ((c.iin ?? "").trim() === doc || (c.bin ?? "").trim() === doc))
        )
      : undefined;
  const finalReason = reason === "Другое" ? custom.trim() : reason;
  // Хватит либо телефона, либо документа: мошенника часто знают только по ИИН
  const ready = (digits.length >= 10 || doc.length >= 12) && finalReason.length > 0 && !match?.blacklisted;

  async function submit() {
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), phone: phone.trim(), iin: doc, reason: finalReason });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось добавить в чёрный список");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-t-[20px] bg-[var(--color-surface)] p-5 safe-bottom sm:rounded-[16px] card-shadow"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[16px] font-bold">В чёрный список</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="field-label">Номер телефона</span>
            <PhoneInput value={phone} onChange={setPhone} />
          </label>

          <label className="block">
            <span className="field-label">ИИН или БИН</span>
            <input
              value={iin}
              onChange={(e) => setIin(e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder="000000000000"
              inputMode="numeric"
              className="crm-input"
            />
            <span className="mt-1 block text-[12px] text-[var(--color-text-muted)]">
              Достаточно телефона или документа. По документу надёжнее: номер меняют, ИИН — нет.
            </span>
          </label>

          {match ? (
            <p className="rounded-[10px] bg-[var(--color-primary-soft)] px-3 py-2 text-[13px]">
              Это {match.name}{match.blacklisted ? " — он уже в чёрном списке" : " из базы. Заблокируем его карточку"}.
            </p>
          ) : (
            <label className="block">
              <span className="field-label">Имя</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Если известно" className="crm-input" />
            </label>
          )}

          <div>
            <span className="field-label">Причина *</span>
            <div className="flex flex-wrap gap-1.5">
              {[...REASONS, "Другое"].map((rsn) => (
                <button
                  key={rsn}
                  onClick={() => setReason(rsn)}
                  className={
                    "rounded-full border px-3 py-1.5 text-[13px] font-medium transition " +
                    (reason === rsn
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]"
                      : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]")
                  }
                >
                  {rsn}
                </button>
              ))}
            </div>
            {reason === "Другое" && (
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Своя формулировка"
                className="crm-input mt-2"
                autoFocus
              />
            )}
          </div>
        </div>

        {error && <p className="mt-3 text-[13px] text-[#C0272D]">{error}</p>}

        <button
          onClick={submit}
          disabled={!ready || saving}
          className="mt-4 w-full rounded-[10px] bg-[#C0272D] py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#A31F24] disabled:opacity-50"
        >
          {saving ? "Добавляем…" : "В чёрный список"}
        </button>
      </div>
    </div>
  );
}

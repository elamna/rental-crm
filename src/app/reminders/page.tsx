"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { ReminderItem, ReminderKind, ReminderTemplates, REMINDER_KIND_LABELS } from "@/lib/types";
import { cn, waLink } from "@/lib/utils";
import { BellRing, Check, ExternalLink, MessageCircle, Phone, RotateCcw, Settings2, X } from "lucide-react";

const KIND_TONES: Record<ReminderKind, { bg: string; text: string }> = {
  return_soon: { bg: "bg-[#FDECEC]", text: "text-[#C0272D]" },
  return_tomorrow: { bg: "bg-[#FFF4E5]", text: "text-[#B8620A]" },
  overdue: { bg: "bg-[#FDECEC]", text: "text-[#C0272D]" },
  debt: { bg: "bg-[#FEF6E3]", text: "text-[#B8860B]" },
  lead_silent: { bg: "bg-[#E9F0FE]", text: "text-[#2B5FD9]" },
  shortage: { bg: "bg-[#F1F2F6]", text: "text-[#6E6C63]" },
};

const VARIABLES = "{client} {rental} {item} {date} {time} {debt} {total} {days} {shortage} {title} {company}";

function formatWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * «Напоминания» — список тех, кому сегодня стоит написать.
 *
 * Отправляет живой менеджер из своего WhatsApp: официальная интеграция требует
 * верификации бизнеса в Meta, и до неё ещё дойти. Зато всё, что человек забывает,
 * система берёт на себя — кому, о чём и какими словами. Остаётся один клик.
 */
export default function RemindersPage() {
  const { user, can } = useAuth();
  const canSend = can("rentals.edit");

  const [items, setItems] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<ReminderKind | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  // Текст можно поправить перед отправкой — клиент клиенту рознь
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/reminders");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const map = new Map<ReminderKind, number>();
    for (const i of items) map.set(i.kind, (map.get(i.kind) ?? 0) + 1);
    return map;
  }, [items]);

  const visible = kind === "all" ? items : items.filter((i) => i.kind === kind);

  const keyOf = (item: ReminderItem) => `${item.kind}:${item.targetId}`;

  async function markSent(item: ReminderItem) {
    const key = keyOf(item);
    setBusy(key);
    try {
      const res = await fetch("/api/reminders/sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: item.kind,
          targetId: item.targetId,
          phone: item.phone,
          message: drafts[key] ?? item.message,
        }),
      });
      if (res.ok) setItems((list) => list.filter((i) => keyOf(i) !== key));
    } finally {
      setBusy(null);
    }
  }

  /** Открыть WhatsApp и сразу отметить — иначе половина отметок теряется */
  function writeAndMark(item: ReminderItem) {
    const key = keyOf(item);
    const link = waLink(item.phone, drafts[key] ?? item.message);
    if (link) window.open(link, "_blank", "noopener");
    markSent(item);
  }

  if (!can("rentals.view")) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-[14.5px] text-[var(--color-text-muted)]">
        Нет доступа к разделу «Напоминания»
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="min-w-0">
          <h1 className="font-display text-[20px] font-bold">Напоминания</h1>
          <p className="text-[14px] text-[var(--color-text-muted)]">
            {items.length === 0 ? "Сегодня писать некому" : `Написать сегодня: ${items.length}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[14px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Обновить
          </button>
          {user?.isAdmin && (
            <button
              onClick={() => setShowTemplates(true)}
              className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[14px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
            >
              <Settings2 className="h-3.5 w-3.5" /> Шаблоны
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-1 rounded-[10px] bg-[var(--color-bg)] p-1">
          <FilterTab active={kind === "all"} onClick={() => setKind("all")} label="Все" count={items.length} />
          {(Object.keys(REMINDER_KIND_LABELS) as ReminderKind[]).map((k) => (
            <FilterTab
              key={k}
              active={kind === k}
              onClick={() => setKind(k)}
              label={REMINDER_KIND_LABELS[k]}
              count={counts.get(k) ?? 0}
            />
          ))}
        </div>

        {loading ? (
          <p className="py-10 text-center text-[14px] text-[var(--color-text-muted)]">Загрузка…</p>
        ) : visible.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center card-shadow">
            <Check className="mx-auto h-7 w-7 text-[#1C8A46]" />
            <p className="mt-2 text-[14.5px] text-[var(--color-text-muted)]">
              {items.length === 0 ? "Все на связи — писать сегодня некому" : "По этому поводу никого нет"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visible.map((item) => {
              const key = keyOf(item);
              const tone = KIND_TONES[item.kind];
              const text = drafts[key] ?? item.message;
              const link = waLink(item.phone, text);

              return (
                <div key={key} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-shadow">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[12.5px] font-semibold", tone.bg, tone.text)}>
                          {REMINDER_KIND_LABELS[item.kind]}
                        </span>
                        {item.clientId ? (
                          <Link href={`/clients/${item.clientId}`} className="text-[15px] font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline">
                            {item.clientName}
                          </Link>
                        ) : (
                          <span className="text-[15px] font-semibold">{item.clientName}</span>
                        )}
                        {item.phone ? (
                          <a href={`tel:${item.phone}`} className="flex items-center gap-1 text-[14px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
                            <Phone className="h-3.5 w-3.5" /> {item.phone}
                          </a>
                        ) : (
                          <span className="text-[13.5px] font-medium text-[#C0272D]">телефон не указан</span>
                        )}
                      </div>
                      <p className="mt-1 text-[13.5px] text-[var(--color-text-muted)]">
                        {item.subtitle}
                        {item.dueAt ? ` · до ${formatWhen(item.dueAt)}` : ""}
                        {item.lastSentAt ? ` · писали ${formatWhen(item.lastSentAt)}` : ""}
                      </p>
                    </div>

                    <Link
                      href={item.url}
                      className="flex shrink-0 items-center gap-1 rounded-[8px] border border-[var(--color-border)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--color-primary)] transition hover:bg-[var(--color-bg)]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Открыть
                    </Link>
                  </div>

                  <textarea
                    value={text}
                    onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                    rows={2}
                    className="crm-input mt-3 resize-y text-[14px]"
                  />

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => writeAndMark(item)}
                      disabled={!link || !canSend || busy === key}
                      title={link ? "Откроется WhatsApp с готовым текстом" : "У клиента не указан телефон"}
                      className="flex items-center gap-1.5 rounded-[10px] bg-[#25D366] px-4 py-2 text-[14px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <MessageCircle className="h-4 w-4" /> Написать в WhatsApp
                    </button>
                    {canSend && (
                      <button
                        onClick={() => markSent(item)}
                        disabled={busy === key}
                        className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] px-3 py-2 text-[14px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)] disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> Уже связался
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[13px] text-[var(--color-text-muted)]">
          Сообщение отправляете вы сами — открывается WhatsApp с готовым текстом. После отправки повод гаснет:
          о возврате не напомним дважды, о долге — не чаще раза в три дня, о просрочке — раз в сутки.
        </p>
      </div>

      {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} onSaved={load} />}
    </div>
  );
}

function FilterTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13.5px] font-semibold transition",
        active ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)]"
      )}
    >
      {label}
      <span className="rounded-full bg-[var(--color-surface)] px-1.5 py-0.5 text-[12px]">{count}</span>
    </button>
  );
}

/** Тексты напоминаний: их правят под свою манеру разговора, не трогая код */
function TemplatesModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [templates, setTemplates] = useState<ReminderTemplates | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/reminders/templates")
      .then((r) => (r.ok ? r.json() : null))
      .then(setTemplates)
      .catch(() => setTemplates(null));
  }, []);

  async function save() {
    if (!templates) return;
    setSaving(true);
    try {
      const res = await fetch("/api/reminders/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templates),
      });
      if (res.ok) {
        onSaved();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-[20px] bg-[var(--color-surface)] safe-bottom sm:rounded-[var(--radius-card)]"
      >
        <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-[16px] font-semibold">
              <BellRing className="h-4 w-4 text-[var(--color-primary)]" /> Тексты напоминаний
            </h3>
            <p className="text-[13px] text-[var(--color-text-muted)]">
              Подстановки: <span className="font-mono">{VARIABLES}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] transition hover:text-[#C0272D]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {!templates ? (
            <p className="py-8 text-center text-[14px] text-[var(--color-text-muted)]">Загрузка…</p>
          ) : (
            (Object.keys(REMINDER_KIND_LABELS) as ReminderKind[]).map((k) => (
              <label key={k} className="block">
                <span className="mb-1.5 block text-[13.5px] font-semibold">{REMINDER_KIND_LABELS[k]}</span>
                <textarea
                  value={templates[k]}
                  onChange={(e) => setTemplates({ ...templates, [k]: e.target.value })}
                  rows={2}
                  className="crm-input resize-y text-[14px]"
                />
              </label>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
          <button onClick={onClose} className="rounded-[10px] border border-[var(--color-border)] px-4 py-2.5 text-[14px] font-semibold text-[var(--color-text-muted)]">
            Отмена
          </button>
          <button
            onClick={save}
            disabled={saving || !templates}
            className="rounded-[10px] bg-[var(--color-primary)] px-5 py-2.5 text-[14px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

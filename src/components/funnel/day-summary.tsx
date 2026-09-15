"use client";

import { useCallback, useEffect, useState } from "react";
import { FunnelDaySummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check, ClipboardCopy, X } from "lucide-react";

type PeriodKey = "day" | "week" | "month" | "year";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "day", label: "День" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "year", label: "Год" },
];

/**
 * Границы периода от выбранной даты.
 *
 * Неделя считается с понедельника, а не «минус семь дней»: владелец сверяет
 * её с рабочей неделей проката, а не со скользящим окном. Считает браузер —
 * только он знает часовой пояс пользователя.
 */
function periodRange(dateInput: string, period: PeriodKey) {
  const base = new Date(`${dateInput}T00:00:00`);
  const from = new Date(base);
  const to = new Date(base);

  if (period === "week") {
    const weekDay = (base.getDay() + 6) % 7; // понедельник = 0
    from.setDate(base.getDate() - weekDay);
    to.setDate(from.getDate() + 6);
  } else if (period === "month") {
    from.setDate(1);
    to.setMonth(base.getMonth() + 1, 0);
  } else if (period === "year") {
    from.setMonth(0, 1);
    to.setMonth(11, 31);
  }

  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString(), fromDate: from, toDate: to };
}

function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ruDate(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/**
 * Текст для отправки в переписку — ровно тот отчёт, который прокат и так шлёт
 * владельцу вечером, только собранный системой, а не руками.
 */
function asText(s: FunnelDaySummary, periodTitle: string, isDay: boolean) {
  const lines = [
    `📅 ${periodTitle}`,
    "",
    `📞 Всего обращений: ${s.calls}`,
    "",
    isDay ? "📈 Сегодня:" : "📈 За период:",
    `• Взяли в аренду: ${s.won}`,
    `• Отказались: ${s.lost}`,
    "",
    "📅 Кого ждём:",
    `• Завтра: ${s.tomorrow}`,
    `• На этой неделе: ${s.thisWeek}`,
    `• Позже: ${s.later}`,
  ];
  if (s.otherCity > 0) lines.push("", `🚚 Другой город: ${s.otherCity}`);
  if (s.unavailable > 0) {
    lines.push("", "❗️ Спрос, который не закрыли:", `• Нет в наличии: ${s.unavailable}`);
    for (const item of s.unavailableItems) lines.push(`   — ${item}`);
  }
  return lines.join("\n");
}

/**
 * Сводка воронки за день.
 *
 * Владельцу вечером нужны не карточки, а пять цифр: сколько людей обратилось,
 * сколько дошло до аренды, сколько отказалось, кого ждём завтра и чего не хватило
 * на складе. Последнее — самое ценное: это спрос, за который уже заплатили
 * рекламой, но не смогли обслужить.
 */
export function DaySummary({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const [period, setPeriod] = useState<PeriodKey>("day");
  const [data, setData] = useState<FunnelDaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const range = periodRange(date, period);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = periodRange(date, period);
    const res = await fetch(`/api/leads/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [date, period]);

  useEffect(() => {
    load();
  }, [load]);

  /** «Дата: 15.09.2026» или «Период: 01.09.2026 — 30.09.2026» */
  const periodTitle =
    period === "day"
      ? `Дата: ${ruDate(range.from)}`
      : `Период: ${ruDate(range.from)} — ${ruDate(range.to)}`;

  async function copy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(asText(data, periodTitle, period === "day"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер может быть закрыт политикой браузера — текст всё равно виден на экране
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[20px] bg-[var(--color-surface)] safe-bottom sm:rounded-[var(--radius-card)]"
      >
        <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h3 className="font-display text-[17px] font-bold">Сводка</h3>
            <p className="text-[13px] text-[var(--color-text-muted)]">{periodTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="crm-input w-auto py-1.5 text-[13.5px]"
            />
            <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Один и тот же отчёт за день, неделю, месяц или год */}
        <div className="flex gap-1.5 border-b border-[var(--color-border)] px-5 py-3">
          {PERIODS.map((pr) => (
            <button
              key={pr.key}
              onClick={() => setPeriod(pr.key)}
              className={cn(
                "flex-1 rounded-[10px] border px-3 py-1.5 text-[13.5px] font-semibold transition",
                period === pr.key
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
              )}
            >
              {pr.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading || !data ? (
            <p className="py-10 text-center text-[14px] text-[var(--color-text-muted)]">Загрузка…</p>
          ) : (
            <div className="space-y-4">
              <Stat label="📞 Всего обращений" value={data.calls} big />

              <Group title={period === "day" ? "📈 Сегодня" : "📈 За период"}>
                <Row label="Взяли в аренду" value={data.won} tone="#1C8A46" />
                <Row label="Отказались" value={data.lost} tone={data.lost > 0 ? "#C0272D" : undefined} />
              </Group>

              <Group title="📅 Кого ждём">
                <Row label="Завтра" value={data.tomorrow} />
                <Row label="На этой неделе" value={data.thisWeek} />
                <Row label="Позже" value={data.later} />
              </Group>

              {data.otherCity > 0 && (
                <Group title="🚚 Другой город">
                  <Row label="Заявок в работе" value={data.otherCity} />
                </Group>
              )}

              <Group title="❗️ Спрос, который не закрыли">
                <Row label="Нет в наличии" value={data.unavailable} tone={data.unavailable > 0 ? "#C0272D" : undefined} />
                {data.unavailableItems.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-[13.5px] text-[var(--color-text-muted)]">
                    {data.unavailableItems.map((item) => (
                      <li key={item}>— {item}</li>
                    ))}
                  </ul>
                )}
              </Group>

              <p className="text-[12.5px] text-[var(--color-text-muted)]">
                «Всего обращений» — заявки, заведённые за этот день. «Взяли в аренду» и «Отказались» —
                заявки, закрытые в этот день, независимо от того, когда они появились.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
          <button
            onClick={copy}
            disabled={!data}
            className={cn(
              "flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[14px] font-semibold transition disabled:opacity-50",
              copied ? "bg-[#EAF7EE] text-[#1C8A46]" : "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]"
            )}
          >
            {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
            {copied ? "Скопировано" : "Скопировать для отправки"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: number; big?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-[12px] bg-[var(--color-bg)] px-4 py-3">
      <span className="text-[14px] font-medium">{label}</span>
      <span className={cn("font-bold", big ? "text-[24px]" : "text-[17px]")}>{value}</span>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-[var(--color-border)] px-4 py-3">
      <h4 className="mb-2 text-[14px] font-bold">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[14px]">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="font-bold" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
    </div>
  );
}

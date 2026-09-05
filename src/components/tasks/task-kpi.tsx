"use client";

import { useEffect, useState } from "react";
import { TaskKpiRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const PERIODS = [
  { key: "week", label: "7 дней" },
  { key: "month", label: "30 дней" },
  { key: "quarter", label: "90 дней" },
  { key: "all", label: "Всё время" },
] as const;

export function TaskKpi() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("month");
  const [rows, setRows] = useState<TaskKpiRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/tasks/kpi?period=${period}`)
      .then((r) => r.json())
      .then((d: TaskKpiRow[]) => {
        // Ответ уже устарел, если пока грузили — переключили период
        if (!cancelled) setRows(Array.isArray(d) ? d : []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <div className="space-y-4">
      <div className="flex w-full items-center gap-1 overflow-x-auto rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] p-1 sm:w-auto sm:self-start">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium transition",
              period === p.key
                ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-[13px] text-[var(--color-text-muted)]">Считаем…</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-[var(--color-text-muted)]">Нет данных за период</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <div key={r.userId} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-shadow">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">{r.userName}</div>
                  <div className="text-[11.5px] text-[var(--color-text-muted)]">
                    {r.done} из {r.assigned} задач
                  </div>
                </div>
                <ScoreBadge score={r.score} />
              </div>

              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg)]">
                <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${r.score}%` }} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <Metric label="Баллы" value={String(r.points)} />
                <Metric label="В срок" value={String(r.onTime)} />
                <Metric label="С опозданием" value={String(r.late)} tone={r.late > 0 ? "bad" : undefined} />
                <Metric label="Среднее время" value={r.avgHours === null ? "—" : formatHours(r.avgHours)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[12px] text-[var(--color-text-muted)]">
        Оценка складывается из двух частей: 60% — доля закрытых задач, 40% — доля закрытых в срок.
        Задачи без срока считаются выполненными вовремя. Вес задачи в баллах задаётся при постановке.
      </p>
    </div>
  );
}

function formatHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)} мин`;
  if (h < 48) return `${h} ч`;
  return `${Math.round(h / 24)} дн`;
}

function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 80 ? "green" : score >= 50 ? "amber" : "red";
  const cls = {
    green: "bg-[#EAF7EE] text-[#1C8A46]",
    amber: "bg-[#FFF4E5] text-[#B8620A]",
    red: "bg-[#FDECEC] text-[#C0272D]",
  }[tone];
  return <span className={cn("shrink-0 rounded-[8px] px-2.5 py-1 font-display text-[15px] font-bold", cls)}>{score}</span>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="rounded-[8px] bg-[var(--color-bg)] px-2.5 py-1.5">
      <div className="text-[10.5px] text-[var(--color-text-muted)]">{label}</div>
      <div className={cn("text-[13px] font-semibold", tone === "bad" && "text-[#C0272D]")}>{value}</div>
    </div>
  );
}

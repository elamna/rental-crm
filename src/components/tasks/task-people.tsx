"use client";

import { useEffect, useState } from "react";
import { TaskWorkloadRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HandHelping, Users } from "lucide-react";

/**
 * «Люди» — экран руководителя.
 *
 * При двух десятках сотрудников доска превращается в несколько сотен карточек,
 * по которым ничего не понять. Здесь одна строка на человека: сколько висит,
 * сколько горит, сколько закрыто за неделю. Клик по строке открывает доску,
 * отфильтрованную по этому сотруднику, — вот там карточки уже уместны.
 */
export function TaskPeople({ onPick }: { onPick: (userId: string, userName: string) => void }) {
  const [rows, setRows] = useState<TaskWorkloadRow[]>([]);
  const [free, setFree] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks/workload")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setRows(data.rows);
          setFree(data.free);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="py-10 text-center text-[14px] text-[var(--color-text-muted)]">Загрузка…</p>;

  const totalOverdue = rows.reduce((s, r) => s + r.overdue, 0);
  const totalActive = rows.reduce((s, r) => s + r.todo + r.inProgress + r.review, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-[13.5px] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4" /> {rows.length} сотрудников · {totalActive} активных задач
        </span>
        {totalOverdue > 0 && <span className="font-semibold text-[#C0272D]">просрочено {totalOverdue}</span>}
        {free > 0 && (
          <span className="flex items-center gap-1.5">
            <HandHelping className="h-4 w-4" /> свободных задач: {free}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] card-shadow">
        <table className="w-full min-w-[640px] text-[14px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-left text-[13px] text-[var(--color-text-muted)]">
              <th className="px-4 py-3 font-semibold">Сотрудник</th>
              <th className="px-3 py-3 text-center font-semibold">Просрочено</th>
              <th className="px-3 py-3 text-center font-semibold">В работе</th>
              <th className="px-3 py-3 text-center font-semibold">Ждут</th>
              <th className="px-3 py-3 text-center font-semibold">На проверке</th>
              <th className="px-3 py-3 text-center font-semibold">Закрыто за неделю</th>
              <th className="px-3 py-3 text-right font-semibold">Среднее время</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const active = r.todo + r.inProgress + r.review;
              return (
                <tr
                  key={r.userId}
                  onClick={() => onPick(r.userId, r.userName)}
                  className="cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)]"
                  title="Открыть доску по этому сотруднику"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.userName}</div>
                    <div className="text-[12.5px] text-[var(--color-text-muted)]">
                      {active === 0 ? "свободен" : `${active} активных`}
                    </div>
                  </td>
                  <td className={cn("px-3 py-3 text-center font-bold", r.overdue > 0 ? "text-[#C0272D]" : "text-[var(--color-text-muted)]")}>
                    {r.overdue}
                  </td>
                  <td className="px-3 py-3 text-center font-semibold">{r.inProgress}</td>
                  <td className="px-3 py-3 text-center text-[var(--color-text-muted)]">{r.todo}</td>
                  <td className="px-3 py-3 text-center text-[var(--color-text-muted)]">{r.review}</td>
                  <td className="px-3 py-3 text-center font-semibold text-[#1C8A46]">{r.doneWeek}</td>
                  <td className="px-3 py-3 text-right text-[var(--color-text-muted)]">
                    {r.avgHours === null ? "—" : r.avgHours < 24 ? `${r.avgHours} ч` : `${Math.round(r.avgHours / 24)} дн`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[13px] text-[var(--color-text-muted)]">
        Строка кликабельна: открывается доска с задачами этого сотрудника. Автоматические задачи (просрочки, долги,
        некомплект) в KPI не учитываются — их ставит система, а не человек.
      </p>
    </div>
  );
}

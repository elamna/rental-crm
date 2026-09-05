"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, CreditCard, AlertCircle, Wallet,
  ShieldCheck, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { PeriodPicker } from "@/components/ui/period-picker";
import { periodQuery, type PeriodValue } from "@/lib/period";


type TxType = "all" | "income" | "expense" | "penalty" | "deposit";

interface Summary {
  totalIncome: number; totalExpenses: number; totalPenalties: number;
  totalDeposits: number; totalDebt: number; netProfit: number;
}

interface Transaction {
  id: string; date: string;
  type: "income" | "expense" | "penalty" | "deposit";
  amount: number; description: string;
  rentalNumber: string; clientName: string; rentalId: string;
}

interface DayChart { day: string; income: number; expense: number; }

interface FinanceData {
  summary: Summary;
  transactions: Transaction[];
  dailyChart: DayChart[];
}

const TYPE_LABELS: Record<TxType, string> = {
  all: "Все", income: "Доходы", expense: "Расходы", penalty: "Штрафы", deposit: "Залоги",
};

const TX_STYLES: Record<string, { color: string; bg: string; sign: string }> = {
  income:  { color: "text-[#1C8A46]", bg: "bg-[#EAF7EE]", sign: "+" },
  expense: { color: "text-[#C0272D]", bg: "bg-[#FDECEC]", sign: "−" },
  penalty: { color: "text-[#B8620A]", bg: "bg-[#FFF3E0]", sign: "+" },
  deposit: { color: "text-[#4F46E5]", bg: "bg-[#EEF2FF]", sign: "○" },
};

export default function FinancePage() {
  const [period, setPeriod] = useState<PeriodValue>({ key: "month" });
  const [typeFilter, setTypeFilter] = useState<TxType>("all");
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/finance?${periodQuery(period)}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [period]);

  const filtered = data?.transactions.filter((t) => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.clientName.toLowerCase().includes(q) ||
        t.rentalNumber.includes(q) ||
        t.description.toLowerCase().includes(q);
    }
    return true;
  }) ?? [];

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[20px] font-bold">Финансы</h1>
            <p className="text-[13px] text-[var(--color-text-muted)]">Доходы, расходы и движение средств</p>
          </div>
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : !data ? null : (
          <>
            {/* KPI */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <FinCard icon={TrendingUp} label="Поступления" value={formatMoney(data.summary.totalIncome)} color="success" />
              <FinCard icon={TrendingDown} label="Расходы" value={formatMoney(data.summary.totalExpenses)} color="danger" />
              <FinCard icon={Wallet} label="Чистая прибыль" value={formatMoney(data.summary.netProfit)}
                color={data.summary.netProfit >= 0 ? "success" : "danger"} />
              <FinCard icon={AlertCircle} label="Штрафы" value={formatMoney(data.summary.totalPenalties)} color="warning" />
              <FinCard icon={ShieldCheck} label="Залоги" value={formatMoney(data.summary.totalDeposits)} color="info" />
              <FinCard icon={CreditCard} label="Долги клиентов" value={formatMoney(data.summary.totalDebt)} color="danger"
                sub="активные и просроченные" />
            </div>

            {/* График */}
            {data.dailyChart.length > 1 && (
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
                <h2 className="mb-4 text-[15px] font-semibold">Движение средств</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data.dailyChart} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false}
                      tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v: unknown, name: unknown) => [formatMoney(Number(v ?? 0)), name === "income" ? "Доходы" : "Расходы"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--color-border)" }} />
                    <Area type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2} fill="url(#gradIncome)" />
                    <Area type="monotone" dataKey="expense" stroke="#EF4444" strokeWidth={2} fill="url(#gradExpense)" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-2 flex gap-4 justify-end">
                  <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]">
                    <span className="h-2 w-4 rounded-full bg-[#10B981]" /> Доходы
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]">
                    <span className="h-2 w-4 rounded-full bg-[#EF4444]" /> Расходы
                  </div>
                </div>
              </div>
            )}

            {/* Транзакции */}
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] card-shadow">
              <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] px-5 py-4">
                <h2 className="text-[15px] font-semibold">Транзакции</h2>
                <div className="flex gap-1 ml-auto">
                  {(["all", "income", "expense", "penalty", "deposit"] as TxType[]).map((t) => (
                    <button key={t} onClick={() => setTypeFilter(t)}
                      className={`rounded-[8px] px-2.5 py-1 text-[12px] font-medium transition ${typeFilter === t ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"}`}>
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по клиенту или №..."
                  className="crm-input w-48 text-[12.5px]"
                />
              </div>

              {filtered.length === 0 ? (
                <div className="py-12 text-center text-[13px] text-[var(--color-text-muted)]">
                  Нет транзакций за выбранный период
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {filtered.map((tx) => {
                    const style = TX_STYLES[tx.type];
                    return (
                      <div key={tx.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--color-bg)]">
                        {/* Иконка типа */}
                        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold ${style.bg} ${style.color}`}>
                          {style.sign}
                        </div>

                        {/* Описание */}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium">{tx.description}</div>
                          <div className="flex items-center gap-2 text-[11.5px] text-[var(--color-text-muted)]">
                            <span>{tx.clientName}</span>
                            <span>·</span>
                            <Link href={`/rentals/${tx.rentalId}`} className="hover:text-[var(--color-primary)] hover:underline">
                              Аренда №{tx.rentalNumber}
                            </Link>
                          </div>
                        </div>

                        {/* Дата */}
                        <div className="shrink-0 text-right">
                          <div className={`text-[14px] font-semibold ${style.color}`}>
                            {style.sign !== "○" ? style.sign : ""}{formatMoney(tx.amount)}
                          </div>
                          <div className="text-[11px] text-[var(--color-text-muted)]">
                            {new Date(tx.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {filtered.length > 0 && (
                <div className="border-t border-[var(--color-border)] px-5 py-3 flex justify-between text-[12.5px] text-[var(--color-text-muted)]">
                  <span>Показано {filtered.length} транзакций</span>
                  <span className="font-semibold text-[var(--color-text)]">
                    Итого: {formatMoney(filtered.filter((t) => t.type !== "expense").reduce((s, t) => s + t.amount, 0))}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FinCard({ icon: Icon, label, value, color, sub }: {
  icon: React.ElementType; label: string; value: string; color: string; sub?: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
    success: { bg: "bg-[#EAF7EE]", text: "text-[#1C8A46]", icon: "text-[#1C8A46]" },
    danger:  { bg: "bg-[#FDECEC]", text: "text-[#C0272D]", icon: "text-[#C0272D]" },
    warning: { bg: "bg-[#FFF3E0]", text: "text-[#B8620A]", icon: "text-[#B8620A]" },
    info:    { bg: "bg-[#EEF2FF]", text: "text-[#4F46E5]", icon: "text-[#4F46E5]" },
  };
  const s = colorMap[color] ?? colorMap.info;
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[var(--color-text-muted)]">{label}</p>
          <p className={`mt-1 text-[20px] font-bold leading-tight ${s.text}`}>{value}</p>
          {sub && <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{sub}</p>}
        </div>
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${s.bg}`}>
          <Icon className={`h-4 w-4 ${s.icon}`} />
        </div>
      </div>
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolvePeriod } from "@/lib/period";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { period, from, to, granularity } = resolvePeriod(req.nextUrl.searchParams);

  // Все аренды за период — JOIN с таблицей clients
  const rentals = db.prepare(`
    SELECT r.id, r.number, c.name as client_name, r.paid, r.total, r.status,
           r.created_at, r.penalties_json, r.expenses_json, r.deposit_json
    FROM rentals r
    LEFT JOIN clients c ON c.id = r.client_id
    WHERE r.created_at >= ? AND r.created_at <= ? AND r.status NOT IN ('cancelled')
    ORDER BY r.created_at DESC
  `).all(from, to) as {
    id: string; number: string; client_name: string | null;
    paid: number; total: number; status: string; created_at: string;
    penalties_json: string; expenses_json: string; deposit_json: string | null;
  }[];

  const transactions: {
    id: string; date: string; type: "income" | "expense" | "penalty" | "deposit";
    amount: number; description: string; rentalNumber: string; clientName: string; rentalId: string;
  }[] = [];

  let totalIncome = 0;
  let totalExpenses = 0;
  let totalPenalties = 0;
  let totalDeposits = 0;
  let totalDebt = 0;

  for (const r of rentals) {
    const clientName = r.client_name ?? "—";
    const penalties = JSON.parse(r.penalties_json || "[]") as { amount: number; reason?: string; createdAt?: string }[];
    const expenses = JSON.parse(r.expenses_json || "[]") as { amount: number; description?: string; createdAt?: string }[];
    const deposit = r.deposit_json ? JSON.parse(r.deposit_json) as { amount?: number } : null;

    if (r.paid > 0) {
      totalIncome += r.paid;
      transactions.push({
        id: `pay_${r.id}`, date: r.created_at, type: "income",
        amount: r.paid, description: `Оплата аренды №${r.number}`,
        rentalNumber: r.number, clientName, rentalId: r.id,
      });
    }

    if (r.total > r.paid && ["active", "overdue"].includes(r.status)) {
      totalDebt += r.total - r.paid;
    }

    for (const p of penalties) {
      totalPenalties += p.amount;
      transactions.push({
        id: `pen_${r.id}_${p.createdAt ?? Math.random()}`, date: p.createdAt ?? r.created_at,
        type: "penalty", amount: p.amount,
        description: p.reason ? `Штраф: ${p.reason}` : `Штраф по аренде №${r.number}`,
        rentalNumber: r.number, clientName, rentalId: r.id,
      });
    }

    for (const e of expenses) {
      totalExpenses += e.amount;
      transactions.push({
        id: `exp_${r.id}_${e.createdAt ?? Math.random()}`, date: e.createdAt ?? r.created_at,
        type: "expense", amount: e.amount,
        description: e.description ?? `Расход по аренде №${r.number}`,
        rentalNumber: r.number, clientName, rentalId: r.id,
      });
    }

    if (deposit?.amount) {
      totalDeposits += deposit.amount;
      transactions.push({
        id: `dep_${r.id}`, date: r.created_at, type: "deposit",
        amount: deposit.amount, description: `Залог по аренде №${r.number}`,
        rentalNumber: r.number, clientName, rentalId: r.id,
      });
    }
  }

  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const byDay: Record<string, { income: number; expense: number }> = {};
  for (const t of transactions) {
    // Сутки — по часам, длинный период — по месяцам, иначе по дням
    const day =
      granularity === "hour" ? `${t.date.slice(0, 13)}:00` : granularity === "month" ? t.date.slice(0, 7) : t.date.slice(0, 10);
    if (!byDay[day]) byDay[day] = { income: 0, expense: 0 };
    if (t.type === "income" || t.type === "penalty") byDay[day].income += t.amount;
    if (t.type === "expense") byDay[day].expense += t.amount;
  }
  const dailyChart = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v }));

  return NextResponse.json({
    period,
    granularity,
    from,
    to,
    summary: { totalIncome, totalExpenses, totalPenalties, totalDeposits, totalDebt, netProfit: totalIncome - totalExpenses },
    transactions: transactions.slice(0, 200),
    dailyChart,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const period = searchParams.get("period") ?? "month";

  const now = new Date();
  let fromDate: Date;
  if (period === "week") { fromDate = new Date(now); fromDate.setDate(now.getDate() - 7); }
  else if (period === "month") { fromDate = new Date(now); fromDate.setMonth(now.getMonth() - 1); }
  else if (period === "year") { fromDate = new Date(now); fromDate.setFullYear(now.getFullYear() - 1); }
  else { fromDate = new Date("2000-01-01"); }
  const from = fromDate.toISOString();

  // Все аренды за период
  const rentals = db.prepare(`
    SELECT id, number, client_json, paid, total, status, created_at,
           penalties_json, expenses_json, deposit_json, items_json
    FROM rentals
    WHERE created_at >= ? AND status NOT IN ('cancelled')
    ORDER BY created_at DESC
  `).all(from) as {
    id: string; number: string; client_json: string; paid: number; total: number;
    status: string; created_at: string; penalties_json: string;
    expenses_json: string; deposit_json: string | null; items_json: string;
  }[];

  // Формируем список транзакций
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
    const client = JSON.parse(r.client_json || "{}") as { name?: string };
    const clientName = client.name ?? "—";
    const penalties = JSON.parse(r.penalties_json || "[]") as { amount: number; reason?: string; createdAt?: string }[];
    const expenses = JSON.parse(r.expenses_json || "[]") as { amount: number; description?: string; createdAt?: string }[];
    const deposit = r.deposit_json ? JSON.parse(r.deposit_json) as { amount?: number } : null;

    // Оплата аренды
    if (r.paid > 0) {
      totalIncome += r.paid;
      transactions.push({
        id: `pay_${r.id}`, date: r.created_at, type: "income",
        amount: r.paid, description: `Оплата аренды №${r.number}`,
        rentalNumber: r.number, clientName, rentalId: r.id,
      });
    }

    // Долг
    if (r.total > r.paid && ["active", "overdue"].includes(r.status)) {
      totalDebt += r.total - r.paid;
    }

    // Штрафы
    for (const p of penalties) {
      totalPenalties += p.amount;
      transactions.push({
        id: `pen_${r.id}_${p.createdAt}`, date: p.createdAt ?? r.created_at,
        type: "penalty", amount: p.amount,
        description: p.reason ? `Штраф: ${p.reason}` : `Штраф по аренде №${r.number}`,
        rentalNumber: r.number, clientName, rentalId: r.id,
      });
    }

    // Расходы
    for (const e of expenses) {
      totalExpenses += e.amount;
      transactions.push({
        id: `exp_${r.id}_${e.createdAt}`, date: e.createdAt ?? r.created_at,
        type: "expense", amount: e.amount,
        description: e.description ?? `Расход по аренде №${r.number}`,
        rentalNumber: r.number, clientName, rentalId: r.id,
      });
    }

    // Залог
    if (deposit?.amount) {
      totalDeposits += deposit.amount;
      transactions.push({
        id: `dep_${r.id}`, date: r.created_at, type: "deposit",
        amount: deposit.amount, description: `Залог по аренде №${r.number}`,
        rentalNumber: r.number, clientName, rentalId: r.id,
      });
    }
  }

  // Сортируем по дате (новые первые)
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Итоги по дням для графика
  const byDay: Record<string, { income: number; expense: number }> = {};
  for (const t of transactions) {
    const day = t.date.slice(0, 10);
    if (!byDay[day]) byDay[day] = { income: 0, expense: 0 };
    if (t.type === "income" || t.type === "penalty") byDay[day].income += t.amount;
    if (t.type === "expense") byDay[day].expense += t.amount;
  }
  const dailyChart = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, ...v }));

  return NextResponse.json({
    summary: {
      totalIncome, totalExpenses, totalPenalties,
      totalDeposits, totalDebt,
      netProfit: totalIncome - totalExpenses,
    },
    transactions: transactions.slice(0, 200),
    dailyChart,
  });
}

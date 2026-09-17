import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolvePeriod } from "@/lib/period";
import type { WorkshopLine } from "@/lib/types";

/**
 * Расходы мастерской.
 *
 * Деньги, которые прокат тратит на собственный инструмент, раньше нигде не
 * сходились в одну цифру: суммы лежали построчно внутри заявок. Здесь они
 * собраны за период и разложены на запчасти и работу — выручка без этих
 * расходов показывает бизнес лучше, чем он есть.
 *
 * Заявка относится к периоду по дате создания: именно тогда принято решение
 * чинить. Незакрытые заявки считаются отдельно — это ещё не потраченные
 * деньги, а обязательство.
 */

interface TicketRow {
  id: string;
  number: string;
  status: string;
  reason: string;
  inventory_item_id: string;
  title: string;
  lines_json: string;
  created_at: string;
  updated_at: string;
}

function parseLines(json: string): WorkshopLine[] {
  try {
    const value = JSON.parse(json || "[]");
    return Array.isArray(value) ? (value as WorkshopLine[]) : [];
  } catch {
    return [];
  }
}

const lineSum = (line: WorkshopLine) => (Number(line.qty) || 0) * (Number(line.price) || 0);
const ticketSum = (lines: WorkshopLine[]) => lines.reduce((sum, line) => sum + lineSum(line), 0);

export async function GET(req: NextRequest) {
  try {
    await requireAuth("analytics.view");
  } catch (e) {
    return apiError(e);
  }

  const { period, from, to } = resolvePeriod(req.nextUrl.searchParams);

  const tickets = db
    .prepare(
      `SELECT id, number, status, reason, inventory_item_id, title, lines_json, created_at, updated_at
       FROM workshop_tickets
       WHERE created_at >= ? AND created_at <= ?`
    )
    .all(from, to) as TicketRow[];

  const names = new Map(
    (db.prepare(`SELECT id, name FROM inventory_items`).all() as { id: string; name: string }[]).map((r) => [r.id, r.name])
  );

  let parts = 0;
  let services = 0;
  const byReason: Record<string, { amount: number; count: number }> = {
    service: { amount: 0, count: 0 },
    maintenance: { amount: 0, count: 0 },
    repair: { amount: 0, count: 0 },
  };
  const perItem = new Map<string, { id: string; name: string; tickets: number; repairs: number; amount: number }>();
  const perPart = new Map<string, { name: string; qty: number; amount: number }>();

  let open = 0;
  let openAmount = 0;
  let waitingParts = 0;
  // Сколько дней заявка живёт до закрытия — по закрытым, от создания до
  // последнего изменения: другого следа о моменте закрытия в базе нет
  let closedCount = 0;
  let closedDays = 0;

  for (const ticket of tickets) {
    const lines = parseLines(ticket.lines_json);
    const amount = ticketSum(lines);

    for (const line of lines) {
      const sum = lineSum(line);
      if (line.type === "part") {
        parts += sum;
        const key = String(line.name || "").trim().toLowerCase();
        if (!key) continue;
        const entry = perPart.get(key) ?? { name: line.name, qty: 0, amount: 0 };
        entry.qty += Number(line.qty) || 0;
        entry.amount += sum;
        perPart.set(key, entry);
      } else {
        services += sum;
      }
    }

    const reason = byReason[ticket.reason] ?? (byReason[ticket.reason] = { amount: 0, count: 0 });
    reason.amount += amount;
    reason.count += 1;

    const itemId = ticket.inventory_item_id;
    const item = perItem.get(itemId) ?? {
      id: itemId,
      name: names.get(itemId) ?? "Списанный инструмент",
      tickets: 0,
      repairs: 0,
      amount: 0,
    };
    item.tickets += 1;
    if (ticket.reason === "repair") item.repairs += 1;
    item.amount += amount;
    perItem.set(itemId, item);

    if (ticket.status === "done" || ticket.status === "archived") {
      const started = Date.parse(ticket.created_at);
      const finished = Date.parse(ticket.updated_at);
      if (!isNaN(started) && !isNaN(finished) && finished >= started) {
        closedCount += 1;
        closedDays += (finished - started) / 86400000;
      }
    } else {
      open += 1;
      openAmount += amount;
      if (ticket.status === "waiting_parts") waitingParts += 1;
    }
  }

  const total = parts + services;

  // Расходы по месяцам — отдельным запросом, чтобы график не зависел от периода
  const monthly = db
    .prepare(`SELECT created_at, lines_json FROM workshop_tickets ORDER BY created_at DESC LIMIT 2000`)
    .all() as { created_at: string; lines_json: string }[];
  const months = new Map<string, { month: string; amount: number; count: number }>();
  for (const row of monthly) {
    const month = String(row.created_at).slice(0, 7);
    const entry = months.get(month) ?? { month, amount: 0, count: 0 };
    entry.amount += ticketSum(parseLines(row.lines_json));
    entry.count += 1;
    months.set(month, entry);
  }
  const byMonth = [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

  const allTimeRows = db.prepare(`SELECT lines_json FROM workshop_tickets`).all() as { lines_json: string }[];
  const allTimeTotal = allTimeRows.reduce((sum, row) => sum + ticketSum(parseLines(row.lines_json)), 0);

  return NextResponse.json({
    period,
    from,
    to,
    total,
    parts,
    services,
    tickets: tickets.length,
    avgTicket: tickets.length > 0 ? Math.round(total / tickets.length) : 0,
    byReason,
    open: { count: open, amount: openAmount, waitingParts },
    avgRepairDays: closedCount > 0 ? Math.round((closedDays / closedCount) * 10) / 10 : null,
    byMonth,
    topItems: [...perItem.values()].sort((a, b) => b.amount - a.amount).slice(0, 8),
    topParts: [...perPart.values()].sort((a, b) => b.amount - a.amount).slice(0, 8),
    allTime: { total: allTimeTotal, tickets: allTimeRows.length },
  });
}

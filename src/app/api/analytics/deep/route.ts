import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolvePeriod } from "@/lib/period";
import type { InventoryLine, WorkshopLine } from "@/lib/types";

/**
 * Подробный отчёт для владельца: клиенты и инструмент под микроскопом.
 *
 * Обычная аналитика отвечает «сколько заработали». Здесь другие вопросы:
 * кто из клиентов возвращается, а кто пропал; кто возвращает вовремя; какой
 * инструмент кормит, какой простаивает и какой уходит в ремонт чаще, чем
 * успевает окупиться.
 *
 * Отчёт только для администратора: в нём поимённая оценка клиентов и
 * себестоимость инструмента — это разговор владельца с самим собой, а не
 * рабочий экран менеджера.
 */

const DAY = 86400000;
/** Опоздание меньше часа не считаем опозданием: приехал в конце дня — нормально */
const LATE_GRACE = 3600000;
/** Клиент считается спящим, если последняя аренда была давно */
const SLEEPING_DAYS = 90;

interface RentalRow {
  id: string;
  client_id: string;
  status: string;
  start_at: string;
  end_at: string;
  returned_at: string | null;
  total: number;
  paid: number;
  items_json: string;
  created_at: string;
}

interface ClientRow {
  id: string;
  name: string;
  type: string;
  phone: string;
  blacklisted: number;
  acquisition_channel: string | null;
  created_at: string;
}

interface ItemRow {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  status: string;
  purchase_cost: number | null;
  created_at: string;
}

function parseItems(json: string): InventoryLine[] {
  try {
    const value = JSON.parse(json || "[]");
    return Array.isArray(value) ? (value as InventoryLine[]) : [];
  } catch {
    return [];
  }
}

function parseLines(json: string): WorkshopLine[] {
  try {
    const value = JSON.parse(json || "[]");
    return Array.isArray(value) ? (value as WorkshopLine[]) : [];
  } catch {
    return [];
  }
}

const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth("analytics.view");
    if (!user.isAdmin) throw new ApiError(403, "Подробный отчёт доступен только администратору");

    const { period, from, to } = resolvePeriod(req.nextUrl.searchParams);
    const now = Date.now();
    const periodStart = Date.parse(from);

    const rentals = db
      .prepare(
        `SELECT id, client_id, status, start_at, end_at, returned_at, total, paid, items_json, created_at
         FROM rentals
         WHERE status NOT IN ('cancelled') AND created_at >= ? AND created_at <= ?`
      )
      .all(from, to) as RentalRow[];

    const clients = db
      .prepare(`SELECT id, name, type, phone, blacklisted, acquisition_channel, created_at FROM clients`)
      .all() as ClientRow[];

    const items = db
      .prepare(`SELECT id, name, sku, category, status, purchase_cost, created_at FROM inventory_items`)
      .all() as ItemRow[];

    // ── Клиенты ────────────────────────────────────────────────────────────
    interface ClientStat {
      rentals: number;
      revenue: number;
      debt: number;
      days: number;
      late: number;
      returned: number;
      overdue: number;
      firstAt: string | null;
      lastAt: string | null;
    }
    const clientStats = new Map<string, ClientStat>();
    const statFor = (id: string) => {
      let stat = clientStats.get(id);
      if (!stat) {
        stat = { rentals: 0, revenue: 0, debt: 0, days: 0, late: 0, returned: 0, overdue: 0, firstAt: null, lastAt: null };
        clientStats.set(id, stat);
      }
      return stat;
    };

    interface ItemStat {
      rentals: number;
      days: number;
      revenue: number;
      tickets: number;
      repairs: number;
      repairCost: number;
      lastRepairAt: string | null;
    }
    const itemStats = new Map<string, ItemStat>();
    const itemStatFor = (id: string) => {
      let stat = itemStats.get(id);
      if (!stat) {
        stat = { rentals: 0, days: 0, revenue: 0, tickets: 0, repairs: 0, repairCost: 0, lastRepairAt: null };
        itemStats.set(id, stat);
      }
      return stat;
    };

    let onTime = 0;
    let lateTotal = 0;
    let lateHours = 0;
    // Строки без привязки к складу (позиция вписана руками) в отчёт по
    // инструменту не попадают — по ним нечего сопоставлять с ремонтами
    let unlinkedRevenue = 0;

    for (const rental of rentals) {
      const stat = statFor(rental.client_id);
      stat.rentals += 1;
      stat.revenue += num(rental.paid);
      stat.debt += Math.max(0, num(rental.total) - num(rental.paid));
      if (rental.status === "overdue") stat.overdue += 1;
      if (!stat.firstAt || rental.created_at < stat.firstAt) stat.firstAt = rental.created_at;
      if (!stat.lastAt || rental.created_at > stat.lastAt) stat.lastAt = rental.created_at;

      // Пунктуальность: сравниваем факт возврата со сроком
      if (rental.returned_at) {
        const returned = Date.parse(rental.returned_at);
        const due = Date.parse(rental.end_at);
        if (!isNaN(returned) && !isNaN(due)) {
          stat.returned += 1;
          if (returned > due + LATE_GRACE) {
            stat.late += 1;
            lateTotal += 1;
            lateHours += (returned - due) / 3600000;
          } else {
            onTime += 1;
          }
        }
      }

      // Сколько дней аренда реально шла. Будущее не считаем: бронь на месяц
      // вперёд иначе выглядела бы как месяц работы инструмента
      const start = Date.parse(rental.start_at);
      const endSource = Date.parse(rental.returned_at ?? rental.end_at);
      const end = Math.min(isNaN(endSource) ? now : endSource, now);
      const days = !isNaN(start) && start <= now && end > start ? Math.max(1, Math.round((end - start) / DAY)) : 0;
      stat.days += days;

      // Выручку разносим по позициям пропорционально их весу в заявке: так
      // скидка и частичная оплата делятся честно, а не падают на первую строку
      const lines = parseItems(rental.items_json);
      const weights = lines.map((line) => num(line.pricePerDay) * num(line.qty));
      const weightSum = weights.reduce((a, b) => a + b, 0);
      lines.forEach((line, i) => {
        const share = weightSum > 0 ? (num(rental.paid) * weights[i]) / weightSum : 0;
        if (line.category === "shop" || !line.inventoryItemId) {
          unlinkedRevenue += share;
          return;
        }
        const item = itemStatFor(line.inventoryItemId);
        item.rentals += 1;
        item.days += days * Math.max(1, num(line.qty));
        item.revenue += share;
      });
    }

    // Последняя аренда и общее число аренд за всё время — «спящие» и
    // «постоянные» нельзя считать внутри выбранного периода
    const lifetime = db
      .prepare(
        `SELECT client_id, COUNT(*) AS cnt, MAX(created_at) AS last_at
         FROM rentals WHERE status NOT IN ('cancelled') GROUP BY client_id`
      )
      .all() as { client_id: string; cnt: number; last_at: string }[];
    const lifetimeById = new Map(lifetime.map((r) => [r.client_id, r]));

    const clientRows = clients
      .map((client) => {
        const stat = clientStats.get(client.id);
        const life = lifetimeById.get(client.id);
        const lastAt = life?.last_at ?? null;
        const sinceDays = lastAt ? Math.floor((now - Date.parse(lastAt)) / DAY) : null;
        return {
          id: client.id,
          name: client.name,
          type: client.type,
          phone: client.phone,
          blacklisted: client.blacklisted === 1,
          channel: client.acquisition_channel || null,
          rentals: stat?.rentals ?? 0,
          revenue: Math.round(stat?.revenue ?? 0),
          debt: Math.round(stat?.debt ?? 0),
          days: stat?.days ?? 0,
          avgDays: stat && stat.rentals > 0 ? Math.round((stat.days / stat.rentals) * 10) / 10 : 0,
          avgCheck: stat && stat.rentals > 0 ? Math.round(stat.revenue / stat.rentals) : 0,
          late: stat?.late ?? 0,
          returned: stat?.returned ?? 0,
          overdue: stat?.overdue ?? 0,
          lifetimeRentals: life?.cnt ?? 0,
          lastAt,
          sinceDays,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const activeInPeriod = clientRows.filter((c) => c.rentals > 0).length;
    const repeat = clientRows.filter((c) => c.lifetimeRentals >= 2).length;
    const everRented = clientRows.filter((c) => c.lifetimeRentals > 0).length;
    const sleeping = clientRows.filter((c) => c.sinceDays !== null && c.sinceDays > SLEEPING_DAYS).length;
    const newInPeriod = clients.filter((c) => c.created_at >= from && c.created_at <= to).length;

    const channelMap = new Map<string, { channel: string; clients: number; rentals: number; revenue: number }>();
    for (const row of clientRows) {
      if (row.rentals === 0) continue;
      const key = row.channel || "Не указан";
      const entry = channelMap.get(key) ?? { channel: key, clients: 0, rentals: 0, revenue: 0 };
      entry.clients += 1;
      entry.rentals += row.rentals;
      entry.revenue += row.revenue;
      channelMap.set(key, entry);
    }

    // ── Мастерская по позициям ─────────────────────────────────────────────
    const tickets = db
      .prepare(
        `SELECT inventory_item_id, reason, lines_json, created_at
         FROM workshop_tickets WHERE created_at >= ? AND created_at <= ?`
      )
      .all(from, to) as { inventory_item_id: string; reason: string; lines_json: string; created_at: string }[];

    for (const ticket of tickets) {
      const stat = itemStatFor(ticket.inventory_item_id);
      stat.tickets += 1;
      stat.repairCost += parseLines(ticket.lines_json).reduce((sum, l) => sum + num(l.qty) * num(l.price), 0);
      if (ticket.reason === "repair") {
        stat.repairs += 1;
        if (!stat.lastRepairAt || ticket.created_at > stat.lastRepairAt) stat.lastRepairAt = ticket.created_at;
      }
    }

    const toolRows = items
      .map((item) => {
        const stat = itemStats.get(item.id);
        const revenue = Math.round(stat?.revenue ?? 0);
        const repairCost = Math.round(stat?.repairCost ?? 0);
        const days = stat?.days ?? 0;
        // Загрузка считается от того, сколько инструмент вообще был у нас
        // внутри периода: купленный вчера не должен выглядеть простаивающим
        const bornAt = Math.max(Date.parse(item.created_at) || periodStart, periodStart);
        const ageDays = Math.max(1, (now - bornAt) / DAY);
        return {
          id: item.id,
          name: item.name,
          sku: item.sku,
          category: item.category,
          status: item.status,
          purchaseCost: item.purchase_cost ?? null,
          rentals: stat?.rentals ?? 0,
          days,
          revenue,
          repairCost,
          profit: revenue - repairCost,
          tickets: stat?.tickets ?? 0,
          repairs: stat?.repairs ?? 0,
          lastRepairAt: stat?.lastRepairAt ?? null,
          utilization: Math.min(100, Math.round((days / ageDays) * 100)),
          avgDays: stat && stat.rentals > 0 ? Math.round((days / stat.rentals) * 10) / 10 : 0,
          // Наработка до поломки: сколько выдач выдерживает между ремонтами
          rentalsPerRepair: stat && stat.repairs > 0 ? Math.round((stat.rentals / stat.repairs) * 10) / 10 : null,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const toolRevenue = toolRows.reduce((sum, t) => sum + t.revenue, 0);
    const toolRepairCost = toolRows.reduce((sum, t) => sum + t.repairCost, 0);

    return NextResponse.json({
      period,
      from,
      to,
      clients: {
        totals: {
          all: clients.length,
          individuals: clients.filter((c) => c.type !== "company").length,
          companies: clients.filter((c) => c.type === "company").length,
          blacklisted: clients.filter((c) => c.blacklisted === 1).length,
          newInPeriod,
          activeInPeriod,
          everRented,
          neverRented: clients.length - everRented,
          repeat,
          repeatShare: everRented > 0 ? Math.round((repeat / everRented) * 100) : 0,
          sleeping,
        },
        punctuality: {
          onTime,
          late: lateTotal,
          share: onTime + lateTotal > 0 ? Math.round((onTime / (onTime + lateTotal)) * 100) : null,
          avgLateHours: lateTotal > 0 ? Math.round((lateHours / lateTotal) * 10) / 10 : 0,
        },
        channels: [...channelMap.values()].sort((a, b) => b.revenue - a.revenue),
        rows: clientRows,
      },
      tools: {
        totals: {
          items: items.length,
          rented: toolRows.filter((t) => t.rentals > 0).length,
          neverRented: toolRows.filter((t) => t.rentals === 0).length,
          inRepair: items.filter((i) => i.status === "repair" || i.status === "maintenance").length,
          revenue: toolRevenue,
          repairCost: toolRepairCost,
          profit: toolRevenue - toolRepairCost,
          days: toolRows.reduce((sum, t) => sum + t.days, 0),
          unlinkedRevenue: Math.round(unlinkedRevenue),
        },
        rows: toolRows,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}

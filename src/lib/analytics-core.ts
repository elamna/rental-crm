import { db } from "./db";
import { clientIdOfType, rentalIdOfType, type ClientTypeFilter } from "./client-type";
import type { InventoryLine, PaymentMethod } from "./types";

/**
 * Единые определения для всей аналитики.
 *
 * Раньше каждый экран считал по-своему, и цифры расходились: «выручка» брала
 * оплату аренд, оформленных в периоде, «поступления» — дату последнего
 * изменения оплаты, а долг в трёх местах одного отчёта давал три разных числа.
 * Клиенты видели, что цифры не сходятся, и справедливо считали это ошибкой.
 *
 * Теперь определения живут здесь, и все экраны берут их отсюда:
 *
 *  - ДЕНЬГИ ПРИШЛИ (поступления) — по дню, когда деньги реально приняли: строки
 *    чеков (`rental_payments`), для старых аренд без чеков — остаток оплаты на
 *    дату оплаты, плюс выполненные доставки. Возврат и отмена оплаты пишутся
 *    отрицательной строкой и уменьшают поступления в свой день.
 *  - АРЕНДА — всё, кроме отменённых и черновиков-запросов: запрос ещё не
 *    сделка, и считать его в «сколько аренд» и в среднем чеке нельзя.
 *  - ДОЛГ — остаток по арендам, где инструмент уже выдан: идёт, просрочена,
 *    завершена, украдена. Бронь и запрос — ещё не долг, клиент не обязан
 *    платить за то, что не получил.
 *  - ДЕНЬ, НЕДЕЛЯ, МЕСЯЦ — по времени Казахстана (часовой пояс браузера), а не
 *    по UTC: сервер Railway живёт в UTC, и аренда в два часа ночи попадала
 *    во «вчера».
 */

/** Аренда, а не черновик и не отмена */
export const REAL_RENTAL = `status NOT IN ('cancelled','request')`;
/** Статусы, в которых неоплаченный остаток — это долг */
export const DEBT_STATUSES = `status IN ('active','overdue','completed','stolen')`;
/** То же для запросов с псевдонимом таблицы аренд */
export const debtStatuses = (alias: string) => `${alias}.status IN ('active','overdue','completed','stolen')`;
export const realRental = (alias: string) => `${alias}.status NOT IN ('cancelled','request')`;

// ─── Часовой пояс ───────────────────────────────────────────────────────────

/** Казахстан живёт в UTC+5 с марта 2024 — это значение по умолчанию */
export const DEFAULT_TZ = 300;

/** Смещение браузера в минутах к востоку от UTC; всё странное — Казахстан */
export function parseTz(value: string | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n >= -720 && n <= 840 ? Math.round(n) : DEFAULT_TZ;
}

export type Granularity = "hour" | "day" | "month";

/** Ключ корзины по местному времени: час — 2026-09-18T14:00, день — 2026-09-18, месяц — 2026-09 */
export function localKey(iso: string, tz: number, granularity: Granularity) {
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const s = new Date(t + tz * 60000).toISOString();
  if (granularity === "hour") return `${s.slice(0, 13)}:00`;
  if (granularity === "month") return s.slice(0, 7);
  return s.slice(0, 10);
}

/** День недели по местному времени: 0 — понедельник */
export function localWeekday(iso: string, tz: number) {
  const t = Date.parse(iso);
  if (isNaN(t)) return -1;
  return (new Date(t + tz * 60000).getUTCDay() + 6) % 7;
}

/**
 * Все корзины периода подряд, включая пустые. Без пустых график сжимал
 * тихие дни, и три продажи за неделю выглядели как три дня подряд.
 */
export function bucketRange(fromIso: string, toIso: string, tz: number, granularity: Granularity): string[] {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (isNaN(from) || isNaN(to) || to < from) return [];
  const keys: string[] = [];
  const seen = new Set<string>();
  const step = granularity === "hour" ? 3600000 : 86400000;
  // Шаг — час или сутки; для месяцев идём сутками и собираем уникальные ключи
  for (let t = from; t <= to + step; t += step) {
    const key = localKey(new Date(Math.min(t, to)).toISOString(), tz, granularity);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
    if (keys.length > 800) break;
  }
  return keys;
}

// ─── Деньги ─────────────────────────────────────────────────────────────────

export interface CashEntry {
  /** Когда деньги приняли */
  at: string;
  amount: number;
  kind: "payment" | "legacy" | "delivery";
  /** Способ оплаты — только у строк чеков */
  method?: PaymentMethod;
  rentalId?: string;
  clientId?: string;
  createdBy?: string;
  paymentId?: string;
}

/**
 * Все поступления периода.
 *
 * «legacy» — аренды, по которым оплата внесена без строк чеков (импорт из
 * старой системы, правка суммы руками): часть оплаты, не покрытая чеками,
 * относится на дату оплаты аренды. Так итог сходится с суммой «оплачено» по
 * арендам, и ничего не считается дважды.
 */
export function cashEntries(from: string, to: string, type: ClientTypeFilter = "all"): CashEntry[] {
  const out: CashEntry[] = [];

  const payments = db
    .prepare(
      `SELECT p.id, p.created_at, p.amount, p.method, p.rental_id, p.created_by, r.client_id
       FROM rental_payments p LEFT JOIN rentals r ON r.id = p.rental_id
       WHERE p.created_at >= ? AND p.created_at <= ?${rentalIdOfType("p.rental_id", type)}`
    )
    .all(from, to) as { id: string; created_at: string; amount: number; method: string; rental_id: string; created_by: string | null; client_id: string | null }[];
  for (const p of payments) {
    out.push({
      at: p.created_at,
      amount: Number(p.amount) || 0,
      kind: "payment",
      method: p.method as PaymentMethod,
      rentalId: p.rental_id,
      clientId: p.client_id ?? undefined,
      createdBy: p.created_by ?? undefined,
      paymentId: p.id,
    });
  }

  const legacy = db
    .prepare(
      `SELECT r.id, r.client_id, COALESCE(r.paid_at, r.created_at) AS at,
              r.paid - COALESCE((SELECT SUM(amount) FROM rental_payments p WHERE p.rental_id = r.id), 0) AS rest
       FROM rentals r
       WHERE r.status <> 'cancelled' AND r.paid > 0
         AND COALESCE(r.paid_at, r.created_at) >= ? AND COALESCE(r.paid_at, r.created_at) <= ?${clientIdOfType("r.client_id", type)}`
    )
    .all(from, to) as { id: string; client_id: string; at: string; rest: number }[];
  for (const r of legacy) {
    if (r.rest > 0.5) out.push({ at: r.at, amount: Number(r.rest), kind: "legacy", rentalId: r.id, clientId: r.client_id });
  }

  const deliveries = db
    .prepare(
      `SELECT d.id, d.price, COALESCE(d.completed_at, d.created_at) AS at, d.rental_id
       FROM deliveries d
       WHERE d.status = 'done' AND d.price > 0
         AND COALESCE(d.completed_at, d.created_at) >= ? AND COALESCE(d.completed_at, d.created_at) <= ?${rentalIdOfType("d.rental_id", type)}`
    )
    .all(from, to) as { id: string; price: number; at: string; rental_id: string | null }[];
  for (const d of deliveries) out.push({ at: d.at, amount: Number(d.price), kind: "delivery", rentalId: d.rental_id ?? undefined });

  return out;
}

/**
 * Доля товаров магазина в каждой аренде — по весу строк состава. Деньги,
 * пришедшие за аренду, делятся на «инструмент» и «магазин» в этой пропорции:
 * частичная оплата не записывает весь товар в выручку сразу.
 */
export function shopShares(rentalIds: string[]): Map<string, number> {
  const shares = new Map<string, number>();
  const ids = [...new Set(rentalIds.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const rows = db
      .prepare(`SELECT id, items_json FROM rentals WHERE id IN (${chunk.map(() => "?").join(",")})`)
      .all(...chunk) as { id: string; items_json: string }[];
    for (const r of rows) {
      let lines: InventoryLine[] = [];
      try {
        const parsed = JSON.parse(r.items_json || "[]");
        lines = Array.isArray(parsed) ? parsed : [];
      } catch {
        lines = [];
      }
      const weight = (l: InventoryLine) => (Number(l.pricePerDay) || 0) * (Number(l.qty) || 0);
      const all = lines.reduce((s, l) => s + weight(l), 0);
      const shop = lines.filter((l) => l.category === "shop").reduce((s, l) => s + weight(l), 0);
      shares.set(r.id, all > 0 ? shop / all : 0);
    }
  }
  return shares;
}

/** Поступления, разложенные на аренду, магазин и доставку */
export function splitCash(entries: CashEntry[]) {
  const shares = shopShares(entries.filter((e) => e.kind !== "delivery").map((e) => e.rentalId ?? ""));
  let rent = 0;
  let shop = 0;
  let delivery = 0;
  for (const e of entries) {
    if (e.kind === "delivery") {
      delivery += e.amount;
      continue;
    }
    const s = shares.get(e.rentalId ?? "") ?? 0;
    shop += e.amount * s;
    rent += e.amount * (1 - s);
  }
  return { rent, shop, delivery, total: rent + shop + delivery };
}

/** Текущий долг клиентов — одна цифра на всю систему */
export function debtNow(type: ClientTypeFilter = "all") {
  return db
    .prepare(
      `SELECT COALESCE(SUM(total - paid), 0) AS amount, COUNT(DISTINCT client_id) AS debtors, COUNT(*) AS rentals
       FROM rentals WHERE total - paid > 0.5 AND ${DEBT_STATUSES}${clientIdOfType("client_id", type)}`
    )
    .get() as { amount: number; debtors: number; rentals: number };
}

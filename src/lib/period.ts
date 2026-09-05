export type PeriodKey = "day" | "week" | "month" | "year" | "all" | "custom";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  day: "24 часа",
  week: "7 дней",
  month: "30 дней",
  year: "12 месяцев",
  all: "Всё время",
  custom: "Свой период",
};

/** Выбор периода на странице. from/to — даты вида YYYY-MM-DD из полей ввода */
export interface PeriodValue {
  key: PeriodKey;
  from?: string;
  to?: string;
}

/** Шаг группировки для графика */
export type Granularity = "hour" | "day" | "month";

/**
 * Строит query-строку для API.
 * Границы своего периода считает браузер: только он знает часовой пояс
 * пользователя, а в базе время лежит в UTC. Сервер получает готовый ISO.
 */
export function periodQuery(value: PeriodValue): string {
  if (value.key !== "custom") return `period=${value.key}`;
  if (!value.from || !value.to) return "period=month";
  const from = new Date(`${value.from}T00:00:00`).toISOString();
  const to = new Date(`${value.to}T23:59:59.999`).toISOString();
  return `period=custom&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

export interface ResolvedPeriod {
  period: PeriodKey;
  from: string;
  to: string;
  granularity: Granularity;
}

const DAY = 86400000;

/** Разбор периода на стороне API */
export function resolvePeriod(params: URLSearchParams): ResolvedPeriod {
  const period = (params.get("period") ?? "month") as PeriodKey;
  const now = new Date();
  const to = now.toISOString();

  if (period === "custom") {
    const from = params.get("from");
    const customTo = params.get("to");
    if (from && customTo && !isNaN(Date.parse(from)) && !isNaN(Date.parse(customTo))) {
      const spanDays = (Date.parse(customTo) - Date.parse(from)) / DAY;
      return {
        period,
        from,
        to: customTo,
        // Сутки показываем по часам, длинные периоды — по месяцам,
        // иначе на графике сотни столбцов
        granularity: spanDays <= 2 ? "hour" : spanDays <= 92 ? "day" : "month",
      };
    }
  }

  if (period === "day") {
    return { period, from: new Date(now.getTime() - DAY).toISOString(), to, granularity: "hour" };
  }
  if (period === "week") {
    return { period, from: new Date(now.getTime() - 7 * DAY).toISOString(), to, granularity: "day" };
  }
  if (period === "year") {
    const d = new Date(now);
    d.setFullYear(now.getFullYear() - 1);
    return { period, from: d.toISOString(), to, granularity: "month" };
  }
  if (period === "all") {
    return { period, from: new Date("2000-01-01").toISOString(), to, granularity: "month" };
  }

  const d = new Date(now);
  d.setMonth(now.getMonth() - 1);
  return { period: "month", from: d.toISOString(), to, granularity: "day" };
}

/** Выражение SQLite для группировки по шагу */
export function bucketExpr(granularity: Granularity, column = "created_at") {
  if (granularity === "hour") return `strftime('%Y-%m-%dT%H:00', ${column})`;
  if (granularity === "month") return `strftime('%Y-%m', ${column})`;
  return `DATE(${column})`;
}

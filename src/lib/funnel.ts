import { Lead } from "./types";

/**
 * Колонка воронки НЕ хранится в базе — она вычисляется из даты, когда инструмент
 * нужен клиенту. Поэтому карточка «на завтра» сама оказывается в «сегодня»,
 * когда наступает завтра: не нужен фоновый job, который может не отработать,
 * и данные не разъезжаются, если сервер простоял ночь выключенным.
 */
export type FunnelBucket = "today" | "tomorrow" | "week" | "future" | "unavailable";

export const FUNNEL_COLUMNS: { key: FunnelBucket; label: string; accent: string; bg: string }[] = [
  { key: "today", label: "Клиенты на сегодня", accent: "#C0272D", bg: "bg-[#FDECEC]" },
  { key: "tomorrow", label: "Нужно на завтра", accent: "#B8620A", bg: "bg-[#FFF4E5]" },
  { key: "week", label: "Нужно на этой неделе", accent: "#B8860B", bg: "bg-[#FEF6E3]" },
  { key: "future", label: "Нужно в будущем", accent: "#2B5FD9", bg: "bg-[#E9F0FE]" },
  { key: "unavailable", label: "Нет в наличии", accent: "#6E6C63", bg: "bg-[#F1F2F6]" },
];

const DAY = 86400000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Сколько дней осталось до конца текущей недели (воскресенье включительно) */
function daysLeftInWeek(now: Date) {
  const isoDay = (now.getDay() + 6) % 7; // понедельник = 0
  return 6 - isoDay;
}

export function leadBucket(lead: Lead, now: Date = new Date()): FunnelBucket {
  if (lead.unavailable) return "unavailable";
  if (!lead.neededAt) return "future";

  const target = startOfDay(new Date(lead.neededAt));
  if (isNaN(target)) return "future";

  const diff = Math.round((target - startOfDay(now)) / DAY);

  // Просроченные не теряются: вчерашние и более старые тоже попадают в «сегодня»
  if (diff <= 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= daysLeftInWeek(now)) return "week";
  return "future";
}

/** Дата, которую надо проставить заявке при переносе карточки в колонку мышью */
export function dateForBucket(bucket: FunnelBucket, now: Date = new Date()): string | undefined {
  if (bucket === "unavailable") return undefined;
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  if (bucket === "today") return base.toISOString();
  if (bucket === "tomorrow") return new Date(base.getTime() + DAY).toISOString();
  if (bucket === "week") {
    const left = daysLeftInWeek(now);
    // Если неделя кончается завтра, «на этой неделе» смысла не имеет — ставим завтра
    return new Date(base.getTime() + Math.max(2, left) * DAY).toISOString();
  }
  return new Date(base.getTime() + (daysLeftInWeek(now) + 1) * DAY).toISOString();
}

export function groupLeads(leads: Lead[], now: Date = new Date()) {
  const map = new Map<FunnelBucket, Lead[]>();
  for (const c of FUNNEL_COLUMNS) map.set(c.key, []);
  for (const lead of leads) map.get(leadBucket(lead, now))?.push(lead);
  return map;
}

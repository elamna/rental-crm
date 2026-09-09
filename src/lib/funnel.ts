import { Lead } from "./types";

/**
 * Колонка воронки НЕ хранится в базе — она вычисляется из даты, когда инструмент
 * нужен клиенту. Поэтому карточка сама возвращается в «Новых», когда назначенное
 * время наступило: не нужен фоновый job, который может не отработать, и данные
 * не разъезжаются, если сервер простоял ночь выключенным.
 *
 * Схема заказчика:
 *   Новый клиент → Дата → время пришло → Новый клиент
 *   Новый клиент → Будущий клиент → поставили дату → Дата → Новый клиент
 */
export type FunnelBucket = "new" | "date" | "future" | "unavailable" | "otherCity";

export const FUNNEL_COLUMNS: { key: FunnelBucket; label: string; hint: string; accent: string; bg: string }[] = [
  {
    key: "new",
    label: "Новый клиент",
    hint: "Позвонил или написал — нужно связаться и узнать дату",
    accent: "#C0272D",
    bg: "bg-[#FDECEC]",
  },
  {
    key: "date",
    label: "Дата",
    hint: "Известны день и час — карточка вернётся в «Новые», когда время придёт",
    accent: "#2B5FD9",
    bg: "bg-[#E9F0FE]",
  },
  {
    key: "future",
    label: "Будущий клиент",
    hint: "Инструмент нужен когда-нибудь потом, точной даты нет",
    accent: "#6E6C63",
    bg: "bg-[#F1F2F6]",
  },
  {
    key: "unavailable",
    label: "Нет в наличии",
    hint: "Ждём поставки",
    accent: "#6E6C63",
    bg: "bg-[#F1F2F6]",
  },
  {
    key: "otherCity",
    label: "Другой город",
    hint: "Клиент не из города — доставка и сроки считаются отдельно",
    accent: "#2B5FD9",
    bg: "bg-[#E9F0FE]",
  },
];

/**
 * Колонки самой доски. «Нет в наличии» среди них нет: эти заявки ждут не даты,
 * а поставки, и на доске они только уводили её вправо за край экрана. Живут
 * отдельной вкладкой рядом с «Не реализованы».
 */
export const BOARD_COLUMNS = FUNNEL_COLUMNS.filter((c) => c.key !== "unavailable" && c.key !== "otherCity");

export function leadBucket(lead: Lead, now: Date = new Date()): FunnelBucket {
  if (lead.unavailable) return "unavailable";
  // Клиент из другого города ждёт не даты, а расчёта доставки — ему своя вкладка
  if (lead.otherCity) return "otherCity";
  // «Потом» — это осознанное решение менеджера, оно сильнее любой даты
  if (lead.future) return "future";
  if (!lead.neededAt) return "new";

  const target = new Date(lead.neededAt).getTime();
  if (isNaN(target)) return "new";

  // Время пришло — клиент снова горячий и возвращается в «Новые».
  // Просроченные попадают сюда же: о них нельзя забыть
  return target > now.getTime() ? "date" : "new";
}

/**
 * Что записать в заявку при переносе карточки в колонку мышью.
 *
 * Для «Даты» возвращается null: колонка называется «Дата» именно потому, что
 * без конкретных дня и часа она бессмысленна — интерфейс спрашивает их отдельно.
 */
export function patchForBucket(bucket: FunnelBucket, now: Date = new Date()): Partial<Lead> | null {
  if (bucket === "unavailable") return { unavailable: true };
  if (bucket === "otherCity") return { unavailable: false, otherCity: true };
  if (bucket === "future") return { unavailable: false, otherCity: false, future: true, neededAt: undefined };
  if (bucket === "new") {
    // Возврат в работу: срок — сейчас, значит карточка стоит в «Новых»
    return { unavailable: false, otherCity: false, future: false, neededAt: now.toISOString() };
  }
  return null;
}

export function groupLeads(leads: Lead[], now: Date = new Date()) {
  const map = new Map<FunnelBucket, Lead[]>();
  for (const c of FUNNEL_COLUMNS) map.set(c.key, []);
  for (const lead of leads) map.get(leadBucket(lead, now))?.push(lead);
  return map;
}

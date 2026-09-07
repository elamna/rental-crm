/**
 * Разбор выгрузок из прошлой системы. Файлы приходят «как есть»: даты в формате
 * `24-02-2026, 17:12`, телефоны с плюсом и пробелами, суммы с пробелами-разделителями.
 * Всё это приводим к виду, понятному базе.
 */

/** Заголовок колонки без регистра, лишних пробелов и неразрывных пробелов */
export function normalizeHeader(header: string) {
  return header.replace(/ /g, " ").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Дата из выгрузки. Ждём `ДД-ММ-ГГГГ` (с временем или без) — именно так выгружает
 * прошлая система. Excel умеет отдавать дату и числом, и объектом Date, поэтому
 * их тоже принимаем. Что не разобрали — возвращаем undefined: лучше пустая дата,
 * чем 1970 год.
 */
export function parseImportDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString();

  const raw = String(value).trim();
  if (!raw) return undefined;

  const m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/.exec(raw);
  if (m) {
    const [, dd, mm, yyyy, hh = "0", mi = "0"] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi));
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/** Число из ячейки: «15 000», «15000,50», «15000.5» — всё это 15000 и 15000.5 */
export function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;

  const cleaned = String(value)
    .replace(/ /g, "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/** Телефон в единый вид: +7 7XX XXX XX XX, если номер похож на казахстанский */
export function normalizePhone(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  // 8 707… и 7 707… — один и тот же номер, ведущую цифру приводим к 7
  const eleven = digits.length === 11 ? "7" + digits.slice(1) : digits.length === 10 ? "7" + digits : digits;
  if (eleven.length !== 11) return String(value ?? "").trim();
  return `+${eleven[0]} ${eleven.slice(1, 4)} ${eleven.slice(4, 7)} ${eleven.slice(7, 9)} ${eleven.slice(9)}`;
}

/**
 * Тарифная колонка каталога: «День (1 д.)», «3 дня (3 д.)», «Час (1 ч.)».
 * Возвращает длительность в сутках — по ней выбираем суточную цену.
 */
export function parseTariffHeader(header: string): { days: number } | null {
  const m = /\((\d+)\s*(д|дн|ч)\.?\)/i.exec(header.replace(/ /g, " "));
  if (!m) return null;
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  return { days: unit.startsWith("ч") ? value / 24 : value };
}

/** Итог импорта одной строкой: сколько легло, сколько пропущено и почему */
export function formatImportReport(
  subject: string,
  report: { added: number; skipped: number; reasons: Record<string, number>; units?: number }
) {
  const parts = [`${subject}: добавлено ${report.added}`];
  if (report.units !== undefined && report.units !== report.added) parts.push(`единиц ${report.units}`);
  if (report.skipped) parts.push(`пропущено ${report.skipped}`);

  const reasons = Object.entries(report.reasons)
    .map(([reason, count]) => `${reason} — ${count}`)
    .join(", ");
  return reasons ? `${parts.join(" · ")} (${reasons})` : parts.join(" · ");
}

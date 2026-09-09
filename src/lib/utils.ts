import { RentalStatus, PaymentStatus } from "./types";

export function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₸";
}

export function formatDateTimeDisplay(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d);
}

/**
 * Срок аренды в сутках. Секунды и миллисекунды отбрасываем: без этого аренда
 * «с 12:15 до 12:15 следующего дня» превращалась в двое суток из-за одной
 * лишней миллисекунды в дате, и клиенту насчитывался лишний день.
 */
export function durationDays(startIso: string, endIso: string) {
  const toMinutes = (iso: string) => Math.floor(new Date(iso).getTime() / 60000) * 60000;
  const start = toMinutes(startIso);
  const end = toMinutes(endIso);
  if (isNaN(start) || isNaN(end) || end <= start) return 1;
  return Math.max(1, Math.ceil((end - start) / 86400000));
}

export const statusLabels: Record<RentalStatus, string> = {
  request: "Запрос",
  booked: "Забронировано",
  active: "В аренде",
  completed: "Завершено",
  overdue: "Просрочено",
  stolen: "Украдено",
  cancelled: "Отменено",
};

export const paymentLabels: Record<PaymentStatus, string> = {
  paid: "Оплата произведена",
  pending: "Ожидает оплату",
  overdue: "Просрочена оплата",
  partial: "Частичная оплата",
};

// Tailwind-safe class groups per status (bg / text / border / dot)
export const statusStyles: Record<RentalStatus, { bg: string; text: string; border: string; dot: string }> = {
  active: { bg: "bg-[#FFF4E5]", text: "text-[#B8620A]", border: "border-[#FFDCA8]", dot: "bg-[#F59E0B]" },
  overdue: { bg: "bg-[#FDECEC]", text: "text-[#C0272D]", border: "border-[#F8C4C4]", dot: "bg-[#EF4444]" },
  stolen: { bg: "bg-[#2A0E0E]", text: "text-[#FF6B6B]", border: "border-[#5C1A1A]", dot: "bg-[#FF3B3B]" },
  completed: { bg: "bg-[#EAF7EE]", text: "text-[#1C8A46]", border: "border-[#BFE8CC]", dot: "bg-[#22C55E]" },
  booked: { bg: "bg-[#E9F0FE]", text: "text-[#2B5FD9]", border: "border-[#C8DAFB]", dot: "bg-[#2B5FD9]" },
  request: { bg: "bg-[#F1F2F6]", text: "text-[#565A6E]", border: "border-[#DDE0EA]", dot: "bg-[#9AA0B4]" },
  cancelled: { bg: "bg-[#F1F2F6]", text: "text-[#8A8F9C]", border: "border-[#E3E5EC]", dot: "bg-[#B4B8C4]" },
};

/**
 * Цвет шапки карточки аренды. Статус должен читаться с двух метров, не
 * вчитываясь в подпись: жёлтая — в работе, зелёная — закрыта, фиолетовая —
 * просрочена. Заливка плотная, текст поверх неё белый.
 */
export const statusHeaderStyles: Record<RentalStatus, { header: string; tile: string; chip: string }> = {
  request: { header: "bg-[#64748B]", tile: "bg-white/15", chip: "text-[#475569]" },
  booked: { header: "bg-[#2B5FD9]", tile: "bg-white/15", chip: "text-[#2B5FD9]" },
  active: { header: "bg-[#F5A623]", tile: "bg-white/25", chip: "text-[#A2620A]" },
  completed: { header: "bg-[#2E9E5B]", tile: "bg-white/18", chip: "text-[#1C8A46]" },
  overdue: { header: "bg-[#C13DD6]", tile: "bg-white/18", chip: "text-[#9A28AC]" },
  stolen: { header: "bg-[#8B1A1A]", tile: "bg-white/15", chip: "text-[#8B1A1A]" },
  cancelled: { header: "bg-[#9AA0B4]", tile: "bg-white/20", chip: "text-[#5E6478]" },
};

/** Долг — отдельная метка поверх статуса: он важнее оттенка стадии */
export const DEBTOR_HEADER = "bg-[#F0522B]";

export const paymentStyles: Record<PaymentStatus, { bg: string; text: string }> = {
  paid: { bg: "bg-[#EAF7EE]", text: "text-[#1C8A46]" },
  pending: { bg: "bg-[#FEF6E3]", text: "text-[#B8860B]" },
  overdue: { bg: "bg-[#FDECEC]", text: "text-[#C0272D]" },
  partial: { bg: "bg-[#EFF3FF]", text: "text-[#2E5FE0]" },
};

/**
 * Позиции, которые не тарифицируются по времени: услуга — это разовая работа,
 * товар магазина продаётся насовсем. Умножать их на срок аренды нельзя,
 * иначе перчатки за неделю подорожают в семь раз.
 */
export function isOneTimeLine(line: { category?: string }) {
  return line.category === "service" || line.category === "shop";
}

/** Сумма строки аренды с учётом того, тарифицируется она по дням или нет */
export function lineTotal(line: { pricePerDay: number; qty: number; category?: string }, days: number) {
  return line.pricePerDay * line.qty * (isOneTimeLine(line) ? 1 : Math.max(1, days));
}

/**
 * Долг по аренде. Считаем только те, где инструмент уже уехал к клиенту:
 * бронь без оплаты — это ещё не долг, а вот завершённая аренда с остатком —
 * долг, и она обязана оставаться на вкладке «Должники». Раньше возврат товара
 * прятал такую аренду из списка, и деньги терялись из виду.
 */
export function isDebtorRental(r: { status: string; total: number; paid: number }) {
  // Пока инструмент у клиента, он не должник: аренда идёт, оплата ещё впереди.
  // Долг появляется, когда вещь вернули (или не вернут уже никогда), а деньги нет
  const closed = r.status === "completed" || r.status === "stolen";
  return closed && r.total - r.paid > 0;
}

/**
 * Ссылка на переписку в WhatsApp с готовым текстом.
 *
 * wa.me открывает чат в приложении или в вебе и подставляет сообщение —
 * менеджеру остаётся нажать «отправить». Никаких токенов и интеграций для этого
 * не нужно: отправляет живой человек со своего номера.
 */
export function waLink(phone: string | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Казахстанские номера в базе лежат по-разному: +7…, 8…, 707… — берём последние 10
  const national = digits.slice(-10);
  return `https://wa.me/7${national}?text=${encodeURIComponent(text)}`;
}

/**
 * Телефон в едином виде: +7 (707) 123-45-67.
 *
 * Форматируется прямо при вводе. Код страны отрезается только у полного номера:
 * иначе набранное «707…» превращалось в «07…» — первую цифру принимали за код.
 */
export function formatPhoneInput(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  let rest = digits;
  if (rest.length === 11 && (rest[0] === "7" || rest[0] === "8")) rest = rest.slice(1);
  else if (rest.length > 11) rest = rest.slice(-10);
  rest = rest.slice(0, 10);

  const parts = [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 8), rest.slice(8, 10)];
  let out = "+7";
  if (parts[0]) out += ` (${parts[0]}`;
  if (parts[0].length === 3) out += ")";
  if (parts[1]) out += ` ${parts[1]}`;
  if (parts[2]) out += `-${parts[2]}`;
  if (parts[3]) out += `-${parts[3]}`;
  return out;
}

/** Только цифры номера — по ним сравнивают клиентов и собирают ссылки */
export function phoneDigits(phone: string | undefined) {
  return (phone ?? "").replace(/\D/g, "");
}

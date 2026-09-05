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

export function durationDays(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
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

export const paymentStyles: Record<PaymentStatus, { bg: string; text: string }> = {
  paid: { bg: "bg-[#EAF7EE]", text: "text-[#1C8A46]" },
  pending: { bg: "bg-[#FEF6E3]", text: "text-[#B8860B]" },
  overdue: { bg: "bg-[#FDECEC]", text: "text-[#C0272D]" },
  partial: { bg: "bg-[#EFF3FF]", text: "text-[#2E5FE0]" },
};

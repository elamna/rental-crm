import { Star } from "lucide-react";
import { ClientRatingBreakdown } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Рейтинг клиента. Вручную не выставляется — считается по истории аренд,
 * поэтому рядом всегда должно быть видно, из чего он сложился.
 */
export function RatingStars({ rating, size = "sm" }: { rating?: number; size?: "sm" | "lg" }) {
  if (!rating) return <span className="text-[var(--color-text-muted)]">—</span>;
  const star = size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(star, i <= rating ? "fill-[#F59E0B] text-[#F59E0B]" : "text-[var(--color-border)]")}
        />
      ))}
      <span className={cn("ml-1 font-semibold", size === "lg" ? "text-[13.5px]" : "text-[12.5px]")}>{rating}</span>
    </div>
  );
}

/** Расшифровка рейтинга: три полоски, по которым видно, за что он такой */
export function RatingBreakdown({ breakdown }: { breakdown?: ClientRatingBreakdown }) {
  if (!breakdown || breakdown.rentals === 0) {
    return (
      <p className="text-[12px] text-[var(--color-text-muted)]">
        Рейтинг появится после первой аренды: он складывается сам из того, как часто клиент обращается,
        платит и возвращает инструмент в срок.
      </p>
    );
  }

  const rows = [
    { label: "Обращается", value: breakdown.loyalty, hint: `${breakdown.rentals} аренд` },
    {
      label: "Платит",
      value: breakdown.payment,
      hint: breakdown.debt > 0 ? `долг ${Math.round(breakdown.debt).toLocaleString("ru-RU")} ₸` : "без долгов",
    },
    {
      label: "Возвращает в срок",
      value: breakdown.punctuality,
      hint: breakdown.lateReturns > 0 ? `опозданий: ${breakdown.lateReturns}` : "без опозданий",
    },
  ];

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[var(--color-text-muted)]">{r.label}</span>
            <span className="text-[var(--color-text-muted)]">{r.hint}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg)]">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                r.value >= 70 ? "bg-[#1C8A46]" : r.value >= 40 ? "bg-[#F59E0B]" : "bg-[#C0272D]"
              )}
              style={{ width: `${Math.max(4, r.value)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

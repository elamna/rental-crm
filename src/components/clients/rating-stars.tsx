import { Star } from "lucide-react";

export function RatingStars({ rating }: { rating?: number }) {
  if (!rating) return <span className="text-[var(--color-text-muted)]">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      <Star className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" />
      <span className="text-[12.5px] font-medium">{rating}</span>
    </div>
  );
}

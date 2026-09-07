"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PackageX } from "lucide-react";

/**
 * Счётчик неполных возвратов в шапке аренд.
 *
 * Сам список живёт на отдельной странице: разбираться с некомплектом почти
 * всегда значит смотреть клиента и его историю, а в модальном окне поверх аренд
 * для этого не было места. Здесь остаётся только напоминание — пока вопрос не
 * закрыт, счётчик висит на виду.
 */
export function ShortagesLink() {
  const [open, setOpen] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shortages?status=open")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setOpen(data.counts.open);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href="/shortages"
      className={cn(
        "flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[14px] font-medium transition",
        open > 0
          ? "border-[#F3B7B7] bg-[#FDECEC] text-[#C0272D] hover:bg-[#FADFDF]"
          : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
      )}
      title="Вернули не полностью"
    >
      <PackageX className="h-3.5 w-3.5" /> Некомплект
      {open > 0 && <span className="rounded-full bg-[#C0272D] px-1.5 py-0.5 text-[12px] font-bold text-white">{open}</span>}
    </Link>
  );
}

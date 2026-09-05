"use client";

import Link from "next/link";
import { Menu, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

/** Шапка вместо боковой панели на телефоне: бургер, логотип, быстрая аренда */
export function MobileTopBar({ onMenu }: { onMenu: () => void }) {
  const { can } = useAuth();

  return (
    <header
      className="sticky top-0 z-30 flex shrink-0 items-center gap-2 border-b border-[var(--color-sidebar-border)] px-3 py-2.5 safe-top"
      style={{ background: "var(--color-sidebar)" }}
    >
      <button
        onClick={onMenu}
        aria-label="Открыть меню"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-[var(--color-sidebar-muted)] transition active:bg-black/[0.06]"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Link href="/" className="flex min-w-0 items-center gap-2">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[var(--color-primary)] font-display text-[12px] font-bold text-[var(--color-on-primary)]">
          Q
        </div>
        <span className="truncate font-display text-[14px] font-bold text-[var(--color-sidebar-text)]">QURAL-SAIMAN</span>
      </Link>

      {can("rentals.edit") && (
        <Link
          href="/rentals/new"
          aria-label="Новая аренда"
          className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[var(--color-primary)] text-[var(--color-on-primary)] transition active:bg-[var(--color-primary-hover)]"
        >
          <Plus className="h-5 w-5" />
        </Link>
      )}
    </header>
  );
}

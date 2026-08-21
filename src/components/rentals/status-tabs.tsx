"use client";

import { Rental, RentalStatus } from "@/lib/types";
import { cn, statusLabels } from "@/lib/utils";

export type TabKey = "all" | RentalStatus | "debtors" | "archive";

const tabs: { key: TabKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "request", label: statusLabels.request },
  { key: "booked", label: statusLabels.booked },
  { key: "active", label: statusLabels.active },
  { key: "completed", label: statusLabels.completed },
  { key: "overdue", label: statusLabels.overdue },
  { key: "debtors", label: "Должники" },
  { key: "stolen", label: statusLabels.stolen },
  { key: "cancelled", label: statusLabels.cancelled },
  { key: "archive", label: "Архив" },
];

function countFor(rentals: Rental[], key: TabKey) {
  switch (key) {
    case "all":
      return rentals.length;
    case "debtors":
      return rentals.filter((r) => (r.status === "active" || r.status === "overdue") && r.total - r.paid > 0).length;
    case "archive":
      return 0;
    default:
      return rentals.filter((r) => r.status === key).length;
  }
}

export function StatusTabs({
  rentals,
  active,
  onChange,
}: {
  rentals: Rental[];
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        const count = countFor(rentals, tab.key);
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[13px] font-semibold transition-colors",
              isActive
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px]",
                isActive ? "bg-white/20" : "bg-[var(--color-border)]"
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

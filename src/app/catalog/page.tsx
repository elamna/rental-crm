"use client";

import { useState } from "react";
import Link from "next/link";
import { useCan } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import { Package, PackageX, Plus } from "lucide-react";
import { ProductsTab } from "@/components/catalog/products-tab";
import { KitsTab } from "@/components/catalog/kits-tab";
import { ServicesTab } from "@/components/catalog/services-tab";
import { InventoryCheckTab } from "@/components/catalog/inventory-check-tab";
import { ScheduleTab } from "@/components/catalog/schedule-tab";

const tabs = [
  { key: "products", label: "Продукты" },
  { key: "kits", label: "Комплекты" },
  { key: "services", label: "Услуги" },
  { key: "check", label: "Инвентаризация" },
  { key: "schedule", label: "График занятости" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function CatalogPage() {
  const canEdit = useCan("catalog.edit");
  const [tab, setTab] = useState<TabKey>("products");
  const [showInactive, setShowInactive] = useState(false);
  const [addKit, setAddKit] = useState(false);
  const [addService, setAddService] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-border)] bg-white/70 px-6 pt-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  if (t.key !== "products") setShowInactive(false);
                }}
                className={cn(
                  "relative px-3.5 pb-3 pt-1.5 text-[13.5px] font-semibold transition",
                  tab === t.key ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                )}
              >
                {t.label}
                {tab === t.key && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[var(--color-primary)]" />}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 pb-2.5">
            {/* Кнопка «Видео» появится, когда будут записаны видеоинструкции */}

            {tab === "products" && (
              <button
                onClick={() => setShowInactive((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-[10px] border px-3.5 py-2 text-[13px] font-semibold transition",
                  showInactive
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                    : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                )}
              >
                {showInactive ? <Package className="h-3.5 w-3.5" /> : <PackageX className="h-3.5 w-3.5" />}
                {showInactive ? "Активные инвентари" : "Неактивные инвентари"}
              </button>
            )}

            {canEdit && tab === "products" && (
              <Link
                href="/catalog/new"
                className="flex items-center gap-1.5 rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_14px_-4px_rgba(109,74,255,0.7)] transition hover:bg-[var(--color-primary-hover)]"
              >
                <Plus className="h-3.5 w-3.5" /> Добавить
              </Link>
            )}
            {canEdit && tab === "kits" && (
              <button
                onClick={() => setAddKit(true)}
                className="flex items-center gap-1.5 rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_14px_-4px_rgba(109,74,255,0.7)] transition hover:bg-[var(--color-primary-hover)]"
              >
                <Plus className="h-3.5 w-3.5" /> Добавить комплект
              </button>
            )}
            {canEdit && tab === "services" && (
              <button
                onClick={() => setAddService(true)}
                className="flex items-center gap-1.5 rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_14px_-4px_rgba(109,74,255,0.7)] transition hover:bg-[var(--color-primary-hover)]"
              >
                <Plus className="h-3.5 w-3.5" /> Создать услугу
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === "products" && <ProductsTab showInactive={showInactive} />}
        {tab === "kits" && <KitsTab editing={addKit} onCloseEditor={() => setAddKit(false)} />}
        {tab === "services" && <ServicesTab editing={addService} onCloseEditor={() => setAddService(false)} />}
        {tab === "check" && <InventoryCheckTab />}
        {tab === "schedule" && <ScheduleTab />}
      </div>
    </div>
  );
}

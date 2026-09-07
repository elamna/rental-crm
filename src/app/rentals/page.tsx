"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { RentalCard } from "@/components/rentals/rental-card";
import { StatusTabs, TabKey } from "@/components/rentals/status-tabs";
import { FilterBar } from "@/components/rentals/filter-bar";
import { cn, isDebtorRental } from "@/lib/utils";
import { CheckSquare, Download, Upload, Video, X } from "lucide-react";
import Link from "next/link";
import { SelectionBar, ConfirmDeleteModal } from "@/components/common/selection-bar";
import { ShortagesLink } from "@/components/rentals/shortages-panel";
import { parseRentalsFile } from "@/lib/rental-io";
import { formatImportReport } from "@/lib/import-utils";
import { useAuth } from "@/components/auth/auth-provider";

export default function RentalsPage() {
  const allRentals = useAppStore((s) => s.rentals);
  const hydrated = useAppStore((s) => s.hydrated);
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  // Три тысячи карточек разом браузер рисует секундами и потом тормозит
  // на каждом клике. Показываем порциями, фильтры при этом ищут по всему списку
  const PAGE_SIZE = 60;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [view, setView] = useState<"grid" | "list">("grid");

  // Режим выбора: включается кнопкой, чтобы обычный клик по карточке по-прежнему открывал аренду
  // Массовое удаление — только администратору
  const { user: me } = useAuth();
  const canEdit = !!me?.isAdmin;
  const deleteRentals = useAppStore((s) => s.deleteRentals);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Импорт истории аренд — разовая необратимая операция, только для владельца
  const canImport = !!me?.isOwner;
  const importRentals = useAppStore((s) => s.importRentals);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setImportMsg("Читаем файл…");
      const rows = await parseRentalsFile(file);
      setImportMsg(`Загружаем ${rows.length} аренд…`);
      const report = await importRentals(rows);
      // Артикулов, которых не было в каталоге, импорт заводит сам — об этом стоит сказать:
      // каталог после загрузки аренд станет больше, и это ожидаемо
      const parts = [];
      if (report.itemsCreated > 0) parts.push(`заведено единиц каталога: ${report.itemsCreated}`);
      if (report.itemsUnmatched > 0) parts.push(`позиций без артикула: ${report.itemsUnmatched}`);
      const tail = parts.length ? ` · ${parts.join(", ")}` : "";
      setImportMsg(formatImportReport("Аренды", report) + tail);
      setTimeout(() => setImportMsg(null), 15000);
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Не удалось прочитать файл. Поддерживаются .xlsx, .xls, .csv");
      setTimeout(() => setImportMsg(null), 8000);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelection() {
    setSelecting(false);
    setSelected(new Set());
  }

  async function removeSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      await deleteRentals(ids);
      setConfirming(false);
      exitSelection();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось удалить аренды");
    } finally {
      setDeleting(false);
    }
  }

  // Смена вкладки или поиска начинает показ заново
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tab, search]);

  const filtered = useMemo(() => {
    let list = allRentals;
    if (tab === "debtors")
      list = list.filter(isDebtorRental);
    else if (tab !== "all" && tab !== "archive") list = list.filter((r) => r.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.client.name.toLowerCase().includes(q) ||
          r.client.phone.includes(q) ||
          r.number.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tab, search, allRentals]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div>
          <h1 className="font-display text-[20px] font-bold">Аренды</h1>
          <p className="text-[14px] text-[var(--color-text-muted)]">Все текущие и прошедшие аренды инструмента</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Неполные возвраты — на виду: о них забывают, а вспоминают,
              когда инструмент уже уехал к следующему клиенту */}
          <ShortagesLink />
          <button className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[14px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
            <Video className="h-3.5 w-3.5" /> Видео
          </button>
          <button className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[14px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
            <Download className="h-3.5 w-3.5" /> Экспорт
          </button>
          {canImport && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[14px] font-medium text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              <Upload className="h-3.5 w-3.5" /> Импорт
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => (selecting ? exitSelection() : setSelecting(true))}
              className={cn(
                "flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[14px] font-medium transition",
                selecting
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
              )}
            >
              {selecting ? <X className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
              {selecting ? "Отменить выбор" : "Выбрать"}
            </button>
          )}
          <Link
            href="/rentals/new"
            className="rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[14px] font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-primary)] transition hover:bg-[var(--color-primary-hover)]"
          >
            + Новая аренда
          </Link>
        </div>
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFile} />
      </header>

      {importMsg && (
        <div className="mx-6 mt-3 rounded-[10px] bg-[var(--color-primary-soft)] px-3 py-2 text-[14px] font-medium text-[var(--color-primary)]">
          {importMsg}
        </div>
      )}

      <div className="space-y-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3">
        <StatusTabs rentals={allRentals} active={tab} onChange={setTab} />
        <FilterBar search={search} onSearch={setSearch} view={view} onView={setView} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {filtered.length === 0 ? (
          <div className="grid h-64 place-items-center text-center text-[var(--color-text-muted)]">
            {!hydrated ? (
              <p className="text-[14.5px]">Загрузка…</p>
            ) : allRentals.length === 0 ? (
              <div>
                <p className="text-[14.5px]">Аренд пока нет</p>
                <Link href="/rentals/new" className="mt-1 inline-block text-[14px] font-medium text-[var(--color-primary)]">
                  Оформить первую аренду →
                </Link>
              </div>
            ) : (
              "Ничего не найдено по текущим фильтрам"
            )}
          </div>
        ) : (
          <div
            className={
              view === "grid"
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                : "flex flex-col gap-3"
            }
          >
            {filtered.slice(0, visibleCount).map((r, i) => (
              <div key={r.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(i * 25, 300)}ms` }}>
                <RentalCard
                  rental={r}
                  draggable={!selecting}
                  selectable={selecting}
                  selected={selected.has(r.id)}
                  onToggleSelect={() => toggle(r.id)}
                />
              </div>
            ))}
          </div>
        )}

        {filtered.length > visibleCount && (
          <div className="mt-5 flex flex-col items-center gap-2">
            <span className="text-[13px] text-[var(--color-text-muted)]">
              Показано {visibleCount} из {filtered.length}
            </span>
            <button
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE * 2)}
              className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-2 text-[14px] font-semibold text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              Показать ещё
            </button>
          </div>
        )}
      </div>

      <SelectionBar
        count={selected.size}
        total={filtered.length}
        busy={deleting}
        noun={["аренда", "аренды", "аренд"]}
        onSelectAll={() => setSelected(new Set(filtered.map((r) => r.id)))}
        onClear={() => setSelected(new Set())}
        onDelete={() => setConfirming(true)}
      />

      {confirming && (
        <ConfirmDeleteModal
          title={`Удалить ${selected.size} ${selected.size === 1 ? "аренду" : "аренд(ы)"}?`}
          lines={[
            "Вместе с арендой удалится её история и связанные документы",
            "Инвентарь из этих аренд вернётся в каталог как свободный",
          ]}
          busy={deleting}
          confirmLabel="Удалить"
          onCancel={() => setConfirming(false)}
          onConfirm={removeSelected}
        />
      )}
    </div>
  );
}

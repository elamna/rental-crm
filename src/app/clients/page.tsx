"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { acquisitionChannels, clientTypeLabels } from "@/lib/mock-data";
import { formatMoney, cn } from "@/lib/utils";
import { exportClientsToCSV, exportClientsToExcel, parseClientsFile } from "@/lib/client-io";
import { RatingStars } from "@/components/clients/rating-stars";
import {
  Search,
  ChevronDown,
  Plus,
  Download,
  Upload,
  Users2,
  FileX2,
  Video,
  ArrowUpDown,
  Settings2,
  Trash2,
} from "lucide-react";

type SortKey = "name" | "totalSpent" | "totalRentals" | "lastRentalDate" | "rating";

export default function ClientsPage() {
  const clients = useAppStore((s) => s.clients);
  const hydrated = useAppStore((s) => s.hydrated);
  const deleteClient = useAppStore((s) => s.deleteClient);
  const importClients = useAppStore((s) => s.importClients);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [ratingFilter, setRatingFilter] = useState<string>("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const count = clients.length;
    const withRepeat = clients.filter((c) => c.repeatRentals > 0).length;
    const withOverdue = clients.filter((c) => c.overdueCount > 0).length;
    const totalSpent = clients.reduce((s, c) => s + c.totalSpent, 0);
    const totalRentalsCount = clients.reduce((s, c) => s + c.totalRentals, 0);
    return {
      count,
      repeatPct: count ? Math.round((withRepeat / count) * 100) : 0,
      withOverdue,
      avgCheck: totalRentalsCount ? Math.round(totalSpent / totalRentalsCount) : 0,
    };
  }, [clients]);

  const filtered = useMemo(() => {
    let list = clients;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.email ?? "").toLowerCase().includes(q));
    }
    if (typeFilter) list = list.filter((c) => c.type === typeFilter);
    if (channelFilter) list = list.filter((c) => c.acquisitionChannel === channelFilter);
    if (ratingFilter) list = list.filter((c) => String(c.rating ?? "") === ratingFilter);

    const sorted = [...list].sort((a, b) => {
      const dir = sort.dir;
      switch (sort.key) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "totalSpent":
          return (a.totalSpent - b.totalSpent) * dir;
        case "totalRentals":
          return (a.totalRentals - b.totalRentals) * dir;
        case "rating":
          return ((a.rating ?? 0) - (b.rating ?? 0)) * dir;
        case "lastRentalDate":
          return (a.lastRentalDate ?? "").localeCompare(b.lastRentalDate ?? "") * dir;
        default:
          return 0;
      }
    });
    return sorted;
  }, [clients, search, typeFilter, channelFilter, ratingFilter, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const rows = await parseClientsFile(file);
      const { added, skipped } = await importClients(rows);
      setImportMsg(`Импортировано: ${added}${skipped ? `, пропущено: ${skipped}` : ""}`);
      setTimeout(() => setImportMsg(null), 4000);
    } catch {
      setImportMsg("Не удалось прочитать файл. Поддерживаются .csv, .xlsx, .xls");
      setTimeout(() => setImportMsg(null), 4000);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-white/70 px-6 py-4 backdrop-blur">
        <div>
          <h1 className="font-display text-[20px] font-bold">Клиенты</h1>
          <p className="text-[13px] text-[var(--color-text-muted)]">База клиентов и история отношений</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
            <Video className="h-3.5 w-3.5" /> Видео
          </button>

          <div className="relative">
            <button
              onClick={() => {
                const menu = document.getElementById("export-menu");
                menu?.classList.toggle("hidden");
              }}
              className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
            >
              <Download className="h-3.5 w-3.5" /> Экспорт
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <div id="export-menu" className="hidden absolute right-0 top-[calc(100%+6px)] z-20 w-48 rounded-[12px] border border-[var(--color-border)] bg-white p-1.5 card-shadow">
              <button
                onClick={() => {
                  exportClientsToExcel(filtered);
                  document.getElementById("export-menu")?.classList.add("hidden");
                }}
                className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium hover:bg-[var(--color-bg)]"
              >
                Скачать Excel (.xlsx)
              </button>
              <button
                onClick={() => {
                  exportClientsToCSV(filtered);
                  document.getElementById("export-menu")?.classList.add("hidden");
                }}
                className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium hover:bg-[var(--color-bg)]"
              >
                Скачать CSV
              </button>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setAddMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_14px_-4px_rgba(109,74,255,0.7)] transition hover:bg-[var(--color-primary-hover)]"
            >
              <Plus className="h-3.5 w-3.5" /> Добавить
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {addMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-52 rounded-[12px] border border-[var(--color-border)] bg-white p-1.5 card-shadow">
                <Link
                  href="/clients/new"
                  className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13px] font-medium hover:bg-[var(--color-bg)]"
                  onClick={() => setAddMenuOpen(false)}
                >
                  <Plus className="h-3.5 w-3.5" /> Добавить клиента
                </Link>
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setAddMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium hover:bg-[var(--color-bg)]"
                >
                  <Upload className="h-3.5 w-3.5" /> Импорт клиентов
                </button>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
        </div>
      </header>

      {importMsg && (
        <div className="mx-6 mt-3 rounded-[10px] bg-[var(--color-primary-soft)] px-3 py-2 text-[13px] font-medium text-[var(--color-primary)]">
          {importMsg}
        </div>
      )}

      <div className="space-y-4 px-6 py-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени, телефону, email…"
              className="w-full rounded-[12px] border border-[var(--color-border)] bg-white py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)]"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-[12px] border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">Тип клиента</option>
            <option value="individual">{clientTypeLabels.individual}</option>
            <option value="company">{clientTypeLabels.company}</option>
          </select>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="rounded-[12px] border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">Канал привлечения</option>
            {acquisitionChannels.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="rounded-[12px] border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">Выберите рейтинг</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} ★
              </option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 card-shadow sm:grid-cols-4">
          <StatItem value={stats.count} label="кол-во клиентов" />
          <StatItem value={`${stats.repeatPct}%`} label="с повторными арендами" />
          <StatItem value={stats.withOverdue} label="с просрочками" highlight={stats.withOverdue > 0} />
          <StatItem value={formatMoney(stats.avgCheck)} label="средний чек" />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white card-shadow">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[12px] font-semibold text-[var(--color-text-muted)]">
                  <Th label="ФИО/Название компании" sortKey="name" sort={sort} onSort={toggleSort} />
                  <th className="px-4 py-3">Тип клиента</th>
                  <Th label="Сумма аренд" sortKey="totalSpent" sort={sort} onSort={toggleSort} />
                  <Th label="Кол-во аренд" sortKey="totalRentals" sort={sort} onSort={toggleSort} />
                  <th className="px-4 py-3">Канал привлечения</th>
                  <Th label="Дата последней аренды" sortKey="lastRentalDate" sort={sort} onSort={toggleSort} />
                  <Th label="Рейтинг" sortKey="rating" sort={sort} onSort={toggleSort} />
                  <th className="w-10 px-4 py-3">
                    <Settings2 className="h-3.5 w-3.5" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="group border-b border-[var(--color-border)] text-[13px] transition hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${c.id}`} className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[11px] font-bold text-[var(--color-primary)]">
                          {c.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{c.name}</div>
                          <div className="truncate text-[11.5px] text-[var(--color-text-muted)]">{c.phone}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">{clientTypeLabels[c.type]}</td>
                    <td className="px-4 py-3 font-medium">{formatMoney(c.totalSpent)}</td>
                    <td className="px-4 py-3">{c.totalRentals}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.acquisitionChannel || "—"}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.lastRentalDate || "—"}</td>
                    <td className="px-4 py-3">
                      <RatingStars rating={c.rating} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (confirm(`Удалить клиента «${c.name}»?`)) void deleteClient(c.id);
                        }}
                        className="hidden rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-white hover:text-[#C0272D] group-hover:block"
                        title="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                {!hydrated ? (
                  <p className="text-[13.5px] text-[var(--color-text-muted)]">Загрузка…</p>
                ) : (
                  <>
                    {clients.length === 0 ? <Users2 className="h-8 w-8 text-[var(--color-text-muted)]" /> : <FileX2 className="h-8 w-8 text-[var(--color-text-muted)]" />}
                    <p className="text-[13.5px] text-[var(--color-text-muted)]">
                      {clients.length === 0 ? "Нет данных" : "Ничего не найдено по текущим фильтрам"}
                    </p>
                    {clients.length === 0 && (
                      <Link href="/clients/new" className="mt-1 text-[13px] font-medium text-[var(--color-primary)]">
                        Добавить первого клиента →
                      </Link>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({ value, label, highlight }: { value: string | number; label: string; highlight?: boolean }) {
  return (
    <div>
      <div className={cn("font-display text-[20px] font-bold", highlight && "text-[#C0272D]")}>{value}</div>
      <div className="text-[12px] text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}

function Th({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className="px-4 py-3">
      <button onClick={() => onSort(sortKey)} className={cn("flex items-center gap-1 transition", active && "text-[var(--color-primary)]")}>
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")} />
      </button>
    </th>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/components/auth/auth-provider";
import { Client, ReturnShortage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowLeft, Ban, Check, PackageX, RotateCcw, ShieldOff, Star } from "lucide-react";

type TabKey = "open" | "resolved" | "all";

const TABS: { key: TabKey; label: string }[] = [
  { key: "open", label: "Открытые" },
  { key: "resolved", label: "Закрытые" },
  { key: "all", label: "Все" },
];

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Неполные возвраты отдельной страницей: пылесос вернули, а трубку «потеряли».
 *
 * Раньше это был список в модальном окне поверх аренд — из него нельзя было ни
 * дойти до клиента, ни что-то с ним сделать. А решение по такому возврату почти
 * всегда про клиента: посмотреть, кто он и часто ли так возвращает, и при
 * необходимости закрыть ему прокат.
 */
export default function ShortagesPage() {
  const { can } = useAuth();
  const canEdit = can("rentals.edit");
  const canBlock = can("clients.edit");

  const clients = useAppStore((s) => s.clients);
  const updateClient = useAppStore((s) => s.updateClient);

  const [tab, setTab] = useState<TabKey>("open");
  const [shortages, setShortages] = useState<ReturnShortage[]>([]);
  const [counts, setCounts] = useState({ open: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/shortages?status=${tab}`);
    if (res.ok) {
      const data = await res.json();
      setShortages(data.shortages);
      setCounts(data.counts);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  // Карточка клиента в сторе полнее, чем то, что приходит со списком:
  // там рейтинг и история аренд — ровно то, по чему принимают решение
  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const tabCounts: Record<TabKey, number> = {
    open: counts.open,
    resolved: counts.resolved,
    all: counts.open + counts.resolved,
  };

  async function setResolved(id: string, resolved: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/shortages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      if (res.ok) await load();
    } finally {
      setBusyId(null);
    }
  }

  async function setBlacklisted(clientId: string, blacklisted: boolean) {
    setBusyId(clientId);
    try {
      await updateClient(clientId, { blacklisted });
      // В записях лежит копия флага — обновляем, чтобы кнопка сразу переключилась
      setShortages((list) =>
        list.map((s) => (s.clientId === clientId ? { ...s, clientBlacklisted: blacklisted } : s))
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/rentals"
            className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--color-border)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
            title="К арендам"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-display text-[20px] font-bold">Некомплект</h1>
            <p className="text-[14px] text-[var(--color-text-muted)]">
              Инструмент приняли, но чего-то в комплекте не хватает
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-[10px] bg-[var(--color-bg)] p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-[14px] font-semibold transition",
                tab === t.key ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)]"
              )}
            >
              {t.label}
              <span className="rounded-full bg-[var(--color-surface)] px-1.5 py-0.5 text-[12.5px]">{tabCounts[t.key]}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <p className="py-10 text-center text-[14.5px] text-[var(--color-text-muted)]">Загрузка…</p>
        ) : shortages.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center card-shadow">
            <PackageX className="mx-auto h-7 w-7 text-[var(--color-text-muted)]" />
            <p className="mt-2 text-[14.5px] text-[var(--color-text-muted)]">
              {tab === "resolved" ? "Закрытых записей нет" : "Всё возвращают в полном комплекте"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {shortages.map((s) => (
              <ShortageRow
                key={s.id}
                shortage={s}
                client={s.clientId ? clientsById.get(s.clientId) : undefined}
                canEdit={canEdit}
                canBlock={canBlock}
                busy={busyId === s.id || busyId === s.clientId}
                onResolve={setResolved}
                onBlock={setBlacklisted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ShortageRow({
  shortage: s,
  client,
  canEdit,
  canBlock,
  busy,
  onResolve,
  onBlock,
}: {
  shortage: ReturnShortage;
  client?: Client;
  canEdit: boolean;
  canBlock: boolean;
  busy: boolean;
  onResolve: (id: string, resolved: boolean) => void;
  onBlock: (clientId: string, blacklisted: boolean) => void;
}) {
  const blacklisted = client?.blacklisted ?? s.clientBlacklisted ?? false;
  const name = client?.name ?? s.clientName ?? "Клиент удалён";
  const phone = client?.phone ?? s.clientPhone;
  const email = client?.email ?? s.clientEmail;
  const type = client?.type ?? s.clientType;

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border bg-[var(--color-surface)] p-4 card-shadow",
        s.resolved ? "border-[var(--color-border)]" : "border-[#F3B7B7]"
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* Чего не хватает */}
        <div className="min-w-0 lg:w-[34%]">
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn("h-4 w-4 shrink-0", s.resolved ? "text-[var(--color-text-muted)]" : "text-[#C0272D]")} />
            <span className="text-[15.5px] font-semibold">{s.itemName}</span>
          </div>
          {s.note && <p className="mt-1 text-[14.5px]">Не хватает: {s.note}</p>}
          <p className="mt-1 text-[13.5px] text-[var(--color-text-muted)]">
            {formatDate(s.createdAt)}
            {s.createdBy ? ` · принял ${s.createdBy}` : ""}
          </p>
          {s.resolved && (
            <p className="mt-1 text-[13.5px] font-medium text-[#1C8A46]">
              Вопрос закрыт {formatDate(s.resolvedAt)}
              {s.resolvedBy ? ` · ${s.resolvedBy}` : ""}
            </p>
          )}
        </div>

        {/* Клиент целиком: по нему и принимают решение */}
        <div className="min-w-0 lg:w-[36%]">
          <div className="flex flex-wrap items-center gap-2">
            {s.clientId ? (
              <Link
                href={`/clients/${s.clientId}`}
                className="text-[15px] font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
              >
                {name}
              </Link>
            ) : (
              <span className="text-[15px] font-semibold">{name}</span>
            )}
            {type && (
              <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[12.5px] text-[var(--color-text-muted)]">
                {type === "company" ? "Компания" : "Физлицо"}
              </span>
            )}
            {blacklisted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FDECEC] px-2 py-0.5 text-[12.5px] font-semibold text-[#C0272D]">
                <ShieldOff className="h-3 w-3" /> Заблокирован
              </span>
            )}
          </div>
          <div className="mt-1 space-y-0.5 text-[14px] text-[var(--color-text-muted)]">
            {phone && <div>{phone}</div>}
            {email && <div>{email}</div>}
            {client && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                {typeof client.rating === "number" && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-[#E6A100]" /> {client.rating.toFixed(1)}
                  </span>
                )}
                <span>аренд: {client.totalRentals}</span>
                {client.overdueCount > 0 && <span className="text-[#C0272D]">просрочек: {client.overdueCount}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Действия */}
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Link
            href={`/rentals/${s.rentalId}`}
            className="whitespace-nowrap rounded-[8px] border border-[var(--color-border)] px-3 py-1.5 text-[14px] font-medium text-[var(--color-primary)] transition hover:bg-[var(--color-bg)]"
          >
            Аренда{s.rentalNumber ? ` №${s.rentalNumber}` : ""}
          </Link>

          {canEdit && (
            <button
              onClick={() => onResolve(s.id, !s.resolved)}
              disabled={busy}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-[8px] border px-3 py-1.5 text-[14px] font-semibold transition disabled:opacity-50",
                s.resolved
                  ? "border-[var(--color-border)] font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
                  : "border-[#1C8A46] text-[#1C8A46] hover:bg-[#EAF7EE]"
              )}
            >
              {s.resolved ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5" /> Вернуть в открытые
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" /> Вопрос закрыт
                </>
              )}
            </button>
          )}

          {canBlock && s.clientId && (
            <button
              onClick={() => onBlock(s.clientId!, !blacklisted)}
              disabled={busy}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-[8px] border px-3 py-1.5 text-[14px] font-semibold transition disabled:opacity-50",
                blacklisted
                  ? "border-[var(--color-border)] font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
                  : "border-[#C0272D] text-[#C0272D] hover:bg-[#FDECEC]"
              )}
            >
              <Ban className="h-3.5 w-3.5" />
              {blacklisted ? "Разблокировать" : "Заблокировать клиента"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

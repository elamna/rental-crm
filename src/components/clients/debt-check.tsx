"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { DebtCheck } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { AlertTriangle, Bug, ExternalLink, HelpCircle, RotateCw, ShieldCheck, ShieldQuestion, X } from "lucide-react";

const REGISTRY_URL = "https://aisoip.adilet.gov.kz/debtors";

function formatWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/**
 * Проверка клиента в едином реестре должников по исполнительным производствам.
 *
 * Данные берутся с портала открытых данных (владелец — Минюст РК) серверным
 * запросом: ключ портала в браузер не попадает. Результат кешируется, поэтому
 * открытие карточки клиента не дёргает госсервис каждый раз.
 *
 * Проверка ничего не запрещает: решение о выдаче инструмента и размере залога
 * остаётся за менеджером, система только показывает, что известно государству.
 */
export function DebtCheckBlock({
  clientId,
  iin,
  bin,
  compact,
  canCheck = true,
}: {
  clientId?: string;
  iin?: string;
  bin?: string;
  /** Узкий вариант для формы аренды: одна строка вместо карточки */
  compact?: boolean;
  canCheck?: boolean;
}) {
  const value = (bin || iin || "").replace(/\D/g, "");
  const kind: "iin" | "bin" = bin ? "bin" : "iin";

  const [check, setCheck] = useState<DebtCheck | null>(null);
  const [configured, setConfigured] = useState(true);
  const [maxAgeDays, setMaxAgeDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Пока формат сервиса Минюста не подтверждён живым ответом, владельцу нужен
  // способ увидеть, что именно вернул портал: иначе «ответил непонятно» — тупик
  const { user } = useAuth();
  const [probe, setProbe] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);

  async function runProbe() {
    setProbing(true);
    setProbe(null);
    try {
      const res = await fetch(`/api/debt-check?value=${value}&debug=1`);
      setProbe(JSON.stringify(await res.json(), null, 2));
    } catch (err) {
      setProbe(String(err));
    } finally {
      setProbing(false);
    }
  }

  const load = useCallback(async () => {
    if (value.length !== 12) return;
    const res = await fetch(`/api/debt-check?value=${value}`);
    if (!res.ok) return;
    const data = await res.json();
    setCheck(data.check);
    setConfigured(data.configured);
    setMaxAgeDays(data.maxAgeDays ?? 30);
  }, [value]);

  useEffect(() => {
    load();
  }, [load]);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/debt-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, kind, clientId, force: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Проверка не удалась");
      setCheck(data.check);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Проверка не удалась");
    } finally {
      setLoading(false);
    }
  }

  if (value.length !== 12) {
    if (compact) return null;
    return (
      <Card>
        <Head />
        <p className="text-[13.5px] text-[var(--color-text-muted)]">
          Не указан {kind === "bin" ? "БИН" : "ИИН"} — проверять нечего. Заполните его в карточке клиента.
        </p>
      </Card>
    );
  }

  const stale = check && Date.now() - new Date(check.checkedAt).getTime() > maxAgeDays * 86400000;
  const tone =
    check?.status === "debtor"
      ? { bg: "bg-[#FDECEC]", border: "border-[#F3B7B7]", text: "text-[#C0272D]", Icon: AlertTriangle }
      : check?.status === "clean"
        ? { bg: "bg-[#EAF7EE]", border: "border-[#BFE3CB]", text: "text-[#1C8A46]", Icon: ShieldCheck }
        : { bg: "bg-[var(--color-bg)]", border: "border-[var(--color-border)]", text: "text-[var(--color-text-muted)]", Icon: ShieldQuestion };

  const title =
    check?.status === "debtor"
      ? `Есть исполнительные производства: ${check.cases}${check.amount > 0 ? ` на ${formatMoney(check.amount)}` : ""}`
      : check?.status === "clean"
        ? "В реестре должников не числится"
        : check?.status === "unknown"
          ? "Портал ответил непонятно — проверьте вручную"
          : "Ещё не проверяли";

  if (compact) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2 rounded-[10px] border px-3 py-2", tone.bg, tone.border)}>
        <tone.Icon className={cn("h-4 w-4 shrink-0", tone.text)} />
        <span className={cn("text-[13.5px] font-semibold", tone.text)}>{title}</span>
        {check?.travelBan && <span className="text-[13px] font-semibold text-[#C0272D]">· ограничен выезд из РК</span>}
        {check && (
          <span className="text-[12.5px] text-[var(--color-text-muted)]">
            проверено {formatWhen(check.checkedAt)}
            {stale ? " · пора обновить" : ""}
          </span>
        )}
        {canCheck && configured && (
          <button
            onClick={run}
            disabled={loading}
            className="ml-auto flex items-center gap-1 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[12.5px] font-medium transition hover:bg-[var(--color-bg)] disabled:opacity-50"
          >
            <RotateCw className={cn("h-3 w-3", loading && "animate-spin")} /> {check ? "Обновить" : "Проверить"}
          </button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <Head />

      <div className={cn("rounded-[10px] border px-3 py-2.5", tone.bg, tone.border)}>
        <div className="flex items-start gap-2">
          <tone.Icon className={cn("mt-[2px] h-4 w-4 shrink-0", tone.text)} />
          <div className="min-w-0">
            <p className={cn("text-[14px] font-semibold", tone.text)}>{title}</p>
            {check?.travelBan && <p className="mt-0.5 text-[13px] font-semibold text-[#C0272D]">Ограничен выезд из РК</p>}
            {check && (
              <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
                {formatWhen(check.checkedAt)}
                {check.checkedBy ? ` · ${check.checkedBy}` : ""}
                {stale ? " · проверка устарела" : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-[13px] font-medium text-[#C0272D]">{error}</p>}

      {!configured && (
        <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
          Автоматическая проверка не настроена: на сервере нет ключа портала открытых данных.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canCheck && configured && (
          <button
            onClick={run}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-primary)] px-3 py-2 text-[13.5px] font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-soft)] disabled:opacity-50"
          >
            <RotateCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            {loading ? "Проверяем…" : check ? "Проверить снова" : "Проверить"}
          </button>
        )}
        <a
          href={REGISTRY_URL}
          target="_blank"
          rel="noopener"
          className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] px-3 py-2 text-[13.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Открыть реестр
        </a>
        {user?.isOwner && configured && (
          <button
            onClick={runProbe}
            disabled={probing}
            title="Показать, что именно ответил портал"
            className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] px-3 py-2 text-[13.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)] disabled:opacity-50"
          >
            <Bug className="h-3.5 w-3.5" /> {probing ? "Спрашиваем портал…" : "Ответ портала"}
          </button>
        )}
      </div>

      {probe && (
        <div className="mt-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[13px] font-semibold">Ответ портала</span>
            <button onClick={() => setProbe(null)} className="text-[var(--color-text-muted)] hover:text-[#C0272D]">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-[11.5px] leading-snug text-[var(--color-text-muted)]">
            {probe}
          </pre>
        </div>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
      {children}
    </section>
  );
}

function Head() {
  return (
    <h3 className="mb-3 flex items-center gap-1.5 text-[14.5px] font-semibold">
      Реестр должников
      <span title="Единый реестр должников по исполнительным производствам, Министерство юстиции РК">
        <HelpCircle className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
      </span>
    </h3>
  );
}

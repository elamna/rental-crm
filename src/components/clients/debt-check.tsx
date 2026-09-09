"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { DebtCase, DebtCheck } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { AlertTriangle, Ban, ExternalLink, Pencil, Plus, RotateCw, ShieldCheck, ShieldQuestion, Trash2, X } from "lucide-react";

const REGISTRY_URL = "https://aisoip.adilet.gov.kz/debtors";

function formatWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/**
 * Проверка клиента в едином реестре должников по исполнительным производствам.
 *
 * Менеджер должен увидеть не «плохой/хороший», а то же, что показывает реестр:
 * кто взыскатель, на какую сумму, запрещён ли выезд. По этим цифрам принимают
 * решение — дать инструмент без залога, взять залог побольше или отказать.
 * Поэтому запись производства хранится целиком, а не сводится к одному флагу.
 *
 * Источник данных подключается отдельно (шлюз Минюста либо коммерческий сервис).
 * Пока его нет, данные вносит менеджер, посмотрев реестр глазами, — и хранятся
 * они точно так же, как пришедшие из сервиса.
 */
export function DebtCheckBlock({
  clientId,
  iin,
  bin,
  variant = "card",
  canEdit = true,
}: {
  clientId?: string;
  iin?: string;
  bin?: string;
  /** card — блок в карточке клиента, inline — строка в форме, row — строка сводки */
  variant?: "card" | "inline" | "row";
  canEdit?: boolean;
}) {
  const value = (bin || iin || "").replace(/\D/g, "");
  const kind: "iin" | "bin" = bin ? "bin" : "iin";

  const { user } = useAuth();
  const [check, setCheck] = useState<DebtCheck | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const load = useCallback(async () => {
    if (value.length !== 12) {
      setCheck(null);
      return;
    }
    const res = await fetch(`/api/debt-check?value=${value}`);
    if (!res.ok) return;
    const data = await res.json();
    setCheck(data.check);
    setConfigured(data.configured);
  }, [value]);

  useEffect(() => {
    load();
  }, [load]);

  /** Автоматическая проверка — когда источник подключён */
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
    if (variant !== "card") return null;
    return (
      <Card>
        <Title />
        <p className="text-[13.5px] text-[var(--color-text-muted)]">
          Укажите {kind === "bin" ? "БИН" : "ИИН"} — по нему проверяется реестр должников.
        </p>
      </Card>
    );
  }

  const records = check?.records ?? [];
  const first = records[0];
  const banned = records.filter((r) => r.travelBan);
  const status = check?.status ?? "none";

  const tone =
    status === "debtor"
      ? { bg: "bg-[#FDECEC]", border: "border-[#F3B7B7]", text: "text-[#C0272D]", Icon: AlertTriangle }
      : status === "clean"
        ? { bg: "bg-[#EAF7EE]", border: "border-[#BFE3CB]", text: "text-[#1C8A46]", Icon: ShieldCheck }
        : { bg: "bg-[var(--color-bg)]", border: "border-[var(--color-border)]", text: "text-[var(--color-text-muted)]", Icon: ShieldQuestion };

  const label =
    status === "debtor"
      ? "Есть задолженность"
      : status === "clean"
        ? "Задолженности нет"
        : status === "unknown"
          ? "Реестр не ответил"
          : "Не проверялся";

  // Строка сводки: два бейджа, как в списке реквизитов клиента
  if (variant === "row") {
    return (
      <>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => status === "debtor" && setShowTable(true)}
            disabled={status !== "debtor"}
            className={cn("rounded-full px-2.5 py-1 text-[12.5px] font-semibold", tone.bg, tone.text)}
          >
            {status === "debtor" ? `Есть долг ${records.length ? `· ${records.length}` : ""} ›` : label}
          </button>
          {banned.length > 0 && (
            <button
              onClick={() => setShowTable(true)}
              className="rounded-full bg-[#FDECEC] px-2.5 py-1 text-[12.5px] font-semibold text-[#C0272D]"
            >
              Был запрет ›
            </button>
          )}
        </div>
        {showTable && check && <CasesModal check={check} onClose={() => setShowTable(false)} />}
      </>
    );
  }

  return (
    <>
      <div className={variant === "card" ? "" : "mt-3"}>
        {variant === "card" && <Title />}

        <div className={cn("rounded-[12px] border p-3.5", tone.border, "bg-[var(--color-surface)]")}>
          {/* Шапка: статус слева, ссылка на полный список справа */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-[13px] font-bold", tone.bg, tone.text)}>
              <tone.Icon className="h-3.5 w-3.5" /> {label}
            </span>
            {records.length > 0 && (
              <button onClick={() => setShowTable(true)} className="text-[13.5px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
                Посмотреть все
              </button>
            )}
          </div>

          {/* Первое производство — то, что видно без раскрытия */}
          {first && (
            <dl className="mt-3 space-y-1.5 text-[13.5px]">
              <Row label="Должник" value={first.debtor} strong />
              <Row label="Дата исп. пр-ва" value={formatWhen(first.startedAt)} strong />
              <Row label="Исполнитель" value={first.officer} strong />
              <Row label="Орган" value={first.issuedBy} strong />
              <Row label="Взыскатель" value={first.claimant} strong />
              {first.amount ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[var(--color-text-muted)]">Сумма взыскания</dt>
                  <dd className="text-right font-bold text-[#C0272D]">{formatMoney(first.amount)}</dd>
                </div>
              ) : null}
            </dl>
          )}

          {banned.length > 0 && (
            <div className="mt-3 rounded-[10px] bg-[#FDECEC] px-3 py-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#F8D3D3] px-2 py-0.5 text-[12.5px] font-bold text-[#C0272D]">
                <Ban className="h-3 w-3" /> Выезд запрещался
              </span>
              {banned[0].travelBanFrom && (
                <p className="mt-1.5 text-[13px] text-[var(--color-text-muted)]">
                  Дата начала запрета: {formatWhen(banned[0].travelBanFrom)}
                </p>
              )}
            </div>
          )}

          {check && (
            <p className="mt-3 text-[12.5px] text-[var(--color-text-muted)]">
              Проверено {formatWhen(check.checkedAt)}
              {check.checkedBy ? ` · ${check.checkedBy}` : ""}
              {check.manual ? " · внесено вручную" : ""}
            </p>
          )}

          {error && <p className="mt-2 text-[13px] font-medium text-[#C0272D]">{error}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {configured && canEdit && (
              <button
                onClick={run}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-primary)] px-3 py-1.5 text-[13px] font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-soft)] disabled:opacity-50"
              >
                <RotateCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> {check ? "Обновить" : "Проверить"}
              </button>
            )}
            <a
              href={REGISTRY_URL}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Открыть реестр
            </a>
            {canEdit && (
              <button
                onClick={() => setShowEditor(true)}
                className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
              >
                <Pencil className="h-3.5 w-3.5" /> Внести данные
              </button>
            )}
          </div>

          {!configured && user?.isOwner && (
            <p className="mt-2 text-[12.5px] text-[var(--color-text-muted)]">
              Автоматическая проверка появится, когда подключим источник. Пока данные вносятся вручную из реестра.
            </p>
          )}
        </div>
      </div>

      {showTable && check && <CasesModal check={check} onClose={() => setShowTable(false)} />}
      {showEditor && (
        <CasesEditor
          value={value}
          kind={kind}
          clientId={clientId}
          existing={check}
          onClose={() => setShowEditor(false)}
          onSaved={(saved) => {
            setCheck(saved);
            setShowEditor(false);
          }}
        />
      )}
    </>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
      {children}
    </section>
  );
}

function Title() {
  return <h3 className="mb-3 text-[14.5px] font-semibold">Реестр должников</h3>;
}

function Row({ label, value, strong }: { label: string; value?: string; strong?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[var(--color-text-muted)]">{label}</dt>
      <dd className={cn("text-right", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}

/** Полный список производств — та же таблица, что показывает реестр */
function CasesModal({ check, onClose }: { check: DebtCheck; onClose: () => void }) {
  const records = check.records ?? [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-6xl flex-col rounded-[16px] bg-[var(--color-surface)] card-shadow"
      >
        <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h3 className="text-[16px] font-semibold">Исполнительные производства</h3>
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {records.length} шт. на сумму {formatMoney(check.amount)} · проверено {formatWhen(check.checkedAt)}
            </p>
          </div>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <table className="w-full min-w-[900px] text-[13.5px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-left align-top text-[12.5px] text-[var(--color-text-muted)]">
                <th className="px-3 py-2.5 font-semibold">Должник</th>
                <th className="px-3 py-2.5 font-semibold">Дата исполнительного производства</th>
                <th className="px-3 py-2.5 font-semibold">Орган исп. пр-ва, судебный исполнитель</th>
                <th className="px-3 py-2.5 font-semibold">Орган, выдавший исполнительный документ</th>
                <th className="px-3 py-2.5 font-semibold">Запрет на выезд из РК</th>
                <th className="px-3 py-2.5 font-semibold">Взыскатель</th>
                <th className="px-3 py-2.5 text-right font-semibold">Сумма взыскания</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i} className="border-b border-[var(--color-border)] align-top last:border-0">
                  <td className="px-3 py-3 font-medium">{r.debtor ?? "—"}</td>
                  <td className="px-3 py-3">{formatWhen(r.startedAt) || "—"}</td>
                  <td className="px-3 py-3">{r.officer ?? "—"}</td>
                  <td className="px-3 py-3">{r.issuedBy ?? "—"}</td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-[8px] px-2 py-1 text-[12.5px] font-semibold",
                        r.travelBan ? "bg-[#FDECEC] text-[#C0272D]" : "bg-[#EAF7EE] text-[#1C8A46]"
                      )}
                    >
                      {r.travelBan ? "Выезд запрещен" : "Не имеется запрет"}
                    </span>
                    {r.travelBan && r.travelBanFrom && (
                      <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">с {formatWhen(r.travelBanFrom)}</div>
                    )}
                  </td>
                  <td className="px-3 py-3">{r.claimant ?? "—"}</td>
                  <td className="px-3 py-3 text-right font-semibold text-[#C0272D]">{r.amount ? formatMoney(r.amount) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const EMPTY_CASE: DebtCase = { debtor: "", startedAt: "", officer: "", issuedBy: "", claimant: "", amount: 0, travelBan: false };

/**
 * Ручной ввод данных реестра.
 *
 * Временная замена автоматическому источнику — и одновременно страховка:
 * если государственный сервис снова ляжет, работа проката не остановится.
 */
function CasesEditor({
  value,
  kind,
  clientId,
  existing,
  onClose,
  onSaved,
}: {
  value: string;
  kind: "iin" | "bin";
  clientId?: string;
  existing: DebtCheck | null;
  onClose: () => void;
  onSaved: (check: DebtCheck) => void;
}) {
  const [clean, setClean] = useState(existing ? existing.status === "clean" : true);
  const [records, setRecords] = useState<DebtCase[]>(existing?.records?.length ? existing.records : [{ ...EMPTY_CASE }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(index: number, patch: Partial<DebtCase>) {
    setRecords((list) => list.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = clean
        ? { status: "clean", records: [] }
        : { status: "debtor", records: records.filter((r) => r.debtor || r.claimant || r.amount) };

      const res = await fetch("/api/debt-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, kind, clientId, manual: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить");
      onSaved(data.check);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-t-[20px] bg-[var(--color-surface)] safe-bottom sm:rounded-[16px]"
      >
        <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h3 className="text-[16px] font-semibold">Данные из реестра должников</h3>
            <p className="text-[13px] text-[var(--color-text-muted)]">
              Откройте реестр по ИИН и перенесите сюда то, что там показано
            </p>
          </div>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex items-center gap-1 rounded-[10px] bg-[var(--color-bg)] p-1">
            <button
              onClick={() => setClean(true)}
              className={cn(
                "flex-1 rounded-[8px] px-3 py-2 text-[13.5px] font-semibold transition",
                clean ? "bg-[var(--color-surface)] text-[#1C8A46] shadow-sm" : "text-[var(--color-text-muted)]"
              )}
            >
              В реестре не числится
            </button>
            <button
              onClick={() => setClean(false)}
              className={cn(
                "flex-1 rounded-[8px] px-3 py-2 text-[13.5px] font-semibold transition",
                !clean ? "bg-[var(--color-surface)] text-[#C0272D] shadow-sm" : "text-[var(--color-text-muted)]"
              )}
            >
              Есть задолженность
            </button>
          </div>

          {!clean &&
            records.map((r, i) => (
              <div key={i} className="rounded-[12px] border border-[var(--color-border)] p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-[var(--color-text-muted)]">Производство {i + 1}</span>
                  {records.length > 1 && (
                    <button
                      onClick={() => setRecords((list) => list.filter((_, idx) => idx !== i))}
                      className="grid h-6 w-6 place-items-center rounded text-[var(--color-text-muted)] hover:bg-[#FDECEC] hover:text-[#C0272D]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Должник">
                    <input value={r.debtor ?? ""} onChange={(e) => update(i, { debtor: e.target.value })} className="crm-input" />
                  </Field>
                  <Field label="Дата исполнительного производства">
                    <input type="date" value={r.startedAt ?? ""} onChange={(e) => update(i, { startedAt: e.target.value })} className="crm-input" />
                  </Field>
                  <Field label="Судебный исполнитель и орган">
                    <input value={r.officer ?? ""} onChange={(e) => update(i, { officer: e.target.value })} className="crm-input" />
                  </Field>
                  <Field label="Орган, выдавший документ">
                    <input value={r.issuedBy ?? ""} onChange={(e) => update(i, { issuedBy: e.target.value })} className="crm-input" />
                  </Field>
                  <Field label="Взыскатель">
                    <input value={r.claimant ?? ""} onChange={(e) => update(i, { claimant: e.target.value })} className="crm-input" />
                  </Field>
                  <Field label="Сумма взыскания, ₸">
                    <input
                      type="number"
                      min={0}
                      value={r.amount || ""}
                      onChange={(e) => update(i, { amount: Number(e.target.value) || 0 })}
                      className="crm-input"
                    />
                  </Field>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer select-none items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!r.travelBan}
                      onChange={(e) => update(i, { travelBan: e.target.checked })}
                      className="h-4 w-4 accent-[#C0272D]"
                    />
                    <span className="text-[13.5px] font-medium">Выезд запрещён</span>
                  </label>
                  {r.travelBan && (
                    <label className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
                      с
                      <input
                        type="date"
                        value={r.travelBanFrom ?? ""}
                        onChange={(e) => update(i, { travelBanFrom: e.target.value })}
                        className="crm-input w-auto py-1"
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}

          {!clean && (
            <button
              onClick={() => setRecords((list) => [...list, { ...EMPTY_CASE }])}
              className="flex items-center gap-1.5 rounded-[10px] border border-dashed border-[var(--color-border)] px-3 py-2 text-[13.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
            >
              <Plus className="h-3.5 w-3.5" /> Ещё производство
            </button>
          )}

          {error && <p className="text-[13px] font-medium text-[#C0272D]">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
          <button onClick={onClose} className="rounded-[10px] border border-[var(--color-border)] px-4 py-2.5 text-[14px] font-semibold text-[var(--color-text-muted)]">
            Отмена
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-[10px] bg-[var(--color-primary)] px-5 py-2.5 text-[14px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-[var(--color-text-muted)]">{label}</span>
      {children}
    </label>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RentalDocument } from "@/lib/types";
import { cn } from "@/lib/utils";
import { printDocument } from "@/lib/print-document";
import { Check, ExternalLink, FileText, Printer, Search, X } from "lucide-react";

type StatusKey = "all" | "signed" | "pending";

const TABS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "signed", label: "Подписано" },
  { key: "pending", label: "Ожидает подписания" },
];

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Реестр напечатанных документов: что, по какой аренде, кому и подписано ли.
 * Раньше документ жил только внутри своей аренды — чтобы понять, кто не подписал,
 * приходилось открывать каждую по очереди.
 */
export function DocumentsRegistry({ canEdit }: { canEdit: boolean }) {
  const [status, setStatus] = useState<StatusKey>("all");
  const [search, setSearch] = useState("");
  const [documents, setDocuments] = useState<RentalDocument[]>([]);
  const [counts, setCounts] = useState({ all: 0, signed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<RentalDocument | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status });
    if (search.trim()) params.set("q", search.trim());
    const res = await fetch(`/api/documents?${params}`);
    if (res.ok) {
      const data = await res.json();
      setDocuments(data.documents);
      setCounts(data.counts);
    }
    setLoading(false);
  }, [status, search]);

  // Поиск не дёргает сервер на каждую букву
  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, search]);

  async function setSigned(doc: RentalDocument, signed: boolean) {
    setBusyId(doc.id);
    try {
      const res = await fetch(`/api/rental-documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signed }),
      });
      if (res.ok) load();
    } finally {
      setBusyId(null);
    }
  }

  /** Тело документа в списке не приходит — забираем его при открытии или печати */
  async function withBody(doc: RentalDocument) {
    if (doc.body) return doc;
    const res = await fetch(`/api/rental-documents/${doc.id}`);
    return res.ok ? ((await res.json()) as RentalDocument) : doc;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Документ, клиент, телефон или номер аренды"
            className="w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-9 pr-3 text-[14.5px] outline-none transition focus:border-[var(--color-primary)]"
          />
        </div>

        <div className="flex items-center gap-1 rounded-[10px] bg-[var(--color-bg)] p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={cn(
                "flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-[13.5px] font-semibold transition",
                status === t.key ? "bg-[var(--color-surface)] text-[var(--color-primary-ink)] shadow-sm" : "text-[var(--color-text-muted)]"
              )}
            >
              {t.label}
              <span className="rounded-full bg-[var(--color-surface)] px-1.5 py-0.5 text-[12px]">{counts[t.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-[14px] text-[var(--color-text-muted)]">Загрузка…</p>
      ) : documents.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center card-shadow">
          <FileText className="mx-auto h-7 w-7 text-[var(--color-text-muted)]" />
          <p className="mt-2 text-[14.5px] text-[var(--color-text-muted)]">
            {search || status !== "all"
              ? "Ничего не нашлось"
              : "Документов пока нет. Они появляются здесь, когда их создают в карточке аренды."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] card-shadow">
          <table className="w-full min-w-[900px] text-[14px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-left text-[13px] text-[var(--color-text-muted)]">
                <th className="px-4 py-3 font-semibold">Документ</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Дата подписания</th>
                <th className="px-4 py-3 font-semibold">Способ</th>
                <th className="px-4 py-3 font-semibold">Отметил</th>
                <th className="px-4 py-3 font-semibold">Клиент</th>
                <th className="px-4 py-3 font-semibold">Аренда</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                      <span className="font-medium">{doc.name}</span>
                    </div>
                    <div className="mt-0.5 pl-6 text-[12.5px] text-[var(--color-text-muted)]">
                      создан {formatDateTime(doc.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-[12.5px] font-semibold",
                        doc.signed ? "bg-[#EAF7EE] text-[#1C8A46]" : "bg-[#FFF8EA] text-[#B8620A]"
                      )}
                    >
                      {doc.signed ? "Подписано" : "Ожидает подписания"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{doc.signed ? formatDateTime(doc.signedAt) : "—"}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{doc.signMethod ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{doc.signedBy ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{doc.clientName ?? "—"}</div>
                    {doc.clientPhone && <div className="text-[12.5px] text-[var(--color-text-muted)]">{doc.clientPhone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {doc.rentalNumber ? (
                      <Link href={`/rentals/${doc.rentalId}`} className="text-[var(--color-primary-ink)] underline-offset-2 hover:underline">
                        Аренда №{doc.rentalNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && !doc.signed && (
                        <button
                          onClick={() => setSigned(doc, true)}
                          disabled={busyId === doc.id}
                          className="flex items-center gap-1 rounded-[8px] border border-[#1C8A46] px-2.5 py-1.5 text-[12.5px] font-semibold text-[#1C8A46] transition hover:bg-[#EAF7EE] disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" /> Подписать
                        </button>
                      )}
                      {canEdit && doc.signed && (
                        <button
                          onClick={() => setSigned(doc, false)}
                          disabled={busyId === doc.id}
                          className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[#FDECEC] hover:text-[#C0272D]"
                          title="Снять отметку о подписи"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={async () => setPreview(await withBody(doc))}
                        className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)] hover:text-[var(--color-primary-ink)]"
                        title="Просмотр"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          const full = await withBody(doc);
                          printDocument(full.body, full.name);
                        }}
                        className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)] hover:text-[var(--color-primary-ink)]"
                        title="Печать"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreview(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-[16px] bg-[var(--color-surface)] card-shadow"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-[16px] font-semibold">{preview.name}</h3>
                <p className="text-[13px] text-[var(--color-text-muted)]">
                  {preview.clientName ?? "—"}
                  {preview.rentalNumber ? ` · аренда №${preview.rentalNumber}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => printDocument(preview.body, preview.name)}
                  className="flex items-center gap-1.5 rounded-[8px] border border-[var(--color-border)] px-3 py-1.5 text-[13.5px] hover:bg-[var(--color-bg)]"
                >
                  <Printer className="h-3.5 w-3.5" /> Печать
                </button>
                <button onClick={() => setPreview(null)} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#EBEBEB] p-4">
              {/* Лист ровно A4: как ляжет на бумагу, так и показываем */}
              <div className="doc-render mx-auto bg-white p-[12mm] shadow-[0_2px_12px_rgba(0,0,0,0.12)]" style={{ width: "210mm", minHeight: "297mm" }}>
                <div dangerouslySetInnerHTML={{ __html: preview.body }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter, notFound } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { inventoryStatusLabels } from "@/lib/mock-data";
import { formatMoney } from "@/lib/utils";
import { InventoryForm, InventoryFormValues } from "@/components/inventory/inventory-form";
import { QrCode } from "@/components/inventory/qr-code";
import { ArrowLeft, Trash2, Pencil, ClipboardList, Wrench } from "lucide-react";

export default function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const inventory = useAppStore((s) => s.inventory);
  const hydrated = useAppStore((s) => s.hydrated);
  const rentals = useAppStore((s) => s.rentals);
  const workshopTickets = useAppStore((s) => s.workshopTickets);
  const updateInventoryItem = useAppStore((s) => s.updateInventoryItem);
  const deleteInventoryItem = useAppStore((s) => s.deleteInventoryItem);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const item = inventory.find((i) => i.id === id);

  if (!item) {
    if (!hydrated) return <div className="grid h-full place-items-center text-[13.5px] text-[var(--color-text-muted)]">Загрузка…</div>;
    return notFound();
  }

  const relatedRentals = rentals.filter((r) => r.items.some((it) => it.inventoryItemId === item.id));
  const relatedWorkshopTickets = workshopTickets.filter((ticket) => ticket.inventoryItemId === item.id);

  async function handleSubmit(values: InventoryFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      await updateInventoryItem(item!.id, {
        name: values.name.trim(),
        sku: values.sku.trim(),
        category: values.category || undefined,
        subcategory: values.subcategory || undefined,
        serialNumber: values.serialNumber || undefined,
        photoUrl: values.photoUrl || undefined,
        purchasePrice: values.purchasePrice ? Number(values.purchasePrice) : undefined,
        rentalPricePerDay: Number(values.rentalPricePerDay),
        status: values.status,
        branch: values.branch,
        notes: values.notes || undefined,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить изменения");
    } finally {
      setSubmitting(false);
    }
  }

  if (editing) {
    return <InventoryForm title={item.name} initial={item} onSubmit={handleSubmit} submitting={submitting} error={error} />;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-white/70 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link href="/catalog" className="grid h-8 w-8 place-items-center rounded-[10px] border border-[var(--color-border)] transition hover:bg-[var(--color-bg)]">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-display text-[18px] font-bold">{item.name}</h1>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">{item.sku || "без артикула"} · {item.branch}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] font-medium transition hover:bg-[var(--color-bg)]">
            <Pencil className="h-3.5 w-3.5" /> Изменить
          </button>
          <button
            onClick={async () => {
              if (confirm(`Удалить «${item.name}» из каталога?`)) {
                await deleteInventoryItem(item.id);
                router.push("/catalog");
              }
            }}
            className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] font-medium text-[#C0272D] transition hover:bg-[#FDECEC]"
          >
            <Trash2 className="h-3.5 w-3.5" /> Удалить
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-1">
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
            <div className="mb-4 flex h-40 items-center justify-center overflow-hidden rounded-[12px] bg-[var(--color-bg)]">
              {item.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[12px] text-[var(--color-text-muted)]">Нет фото</span>
              )}
            </div>
            <Row label="Категория" value={item.category || "—"} />
            {item.subcategory && <Row label="Подкатегория" value={item.subcategory} />}
            {item.serialNumber && <Row label="Серийный номер" value={item.serialNumber} />}
            <Row label="Стоимость аренды" value={`${formatMoney(item.rentalPricePerDay)} / сутки`} />
            {item.purchasePrice ? <Row label="Стоимость покупки" value={formatMoney(item.purchasePrice)} /> : null}
            <Row label="Статус" value={inventoryStatusLabels[item.status]} />
            {item.notes && (
              <div className="mt-3 rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[12.5px]">{item.notes}</div>
            )}
          </section>

          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 text-center card-shadow">
            <h3 className="mb-3 text-[13.5px] font-semibold">QR-код</h3>
            <div className="flex justify-center">
              <QrCode value={item.sku || item.id} />
            </div>
            <p className="mt-2 text-[11.5px] text-[var(--color-text-muted)]">{item.sku || item.id}</p>
          </section>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[var(--color-primary)]" />
              <h2 className="font-display text-[15px] font-bold">История аренды</h2>
            </div>
            {relatedRentals.length === 0 ? (
              <div className="grid h-32 place-items-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-white text-[13px] text-[var(--color-text-muted)]">
                Этот инструмент ещё не сдавался в аренду
              </div>
            ) : (
              <div className="space-y-2">
                {relatedRentals.map((r) => (
                  <Link
                    key={r.id}
                    href={`/rentals/${r.id}`}
                    className="flex items-center justify-between rounded-[10px] border border-[var(--color-border)] bg-white px-4 py-3 text-[13px] transition hover:bg-[var(--color-bg)]"
                  >
                    <span className="font-medium">{r.number}</span>
                    <span className="text-[var(--color-text-muted)]">{r.client.name}</span>
                    <span className="text-[var(--color-text-muted)]">{formatMoney(r.total)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-[var(--color-primary)]" />
              <h2 className="font-display text-[15px] font-bold">История обслуживания</h2>
            </div>
            {relatedWorkshopTickets.length === 0 ? (
              <div className="grid h-24 place-items-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-white text-[13px] text-[var(--color-text-muted)]">
                Заявок на ремонт и профилактику пока нет
              </div>
            ) : (
              <div className="space-y-2">
                {relatedWorkshopTickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href="/workshop"
                    className="flex items-center justify-between rounded-[10px] border border-[var(--color-border)] bg-white px-4 py-3 text-[13px] transition hover:bg-[var(--color-bg)]"
                  >
                    <span className="font-medium">{ticket.number}</span>
                    <span className="text-[var(--color-text-muted)]">{ticket.title}</span>
                    <span className="font-semibold">{formatMoney(ticket.total)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border)] py-2 text-[13px] last:border-none">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

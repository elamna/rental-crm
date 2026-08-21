"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { clientTypeLabels } from "@/lib/mock-data";
import { formatMoney } from "@/lib/utils";
import { RatingStars } from "@/components/clients/rating-stars";
import { RentalCard } from "@/components/rentals/rental-card";
import { ArrowLeft, Phone, Mail, Calendar, Percent, ClipboardList, Trash2, Ban } from "lucide-react";

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const clients = useAppStore((s) => s.clients);
  const hydrated = useAppStore((s) => s.hydrated);
  const rentals = useAppStore((s) => s.rentals);
  const deleteClient = useAppStore((s) => s.deleteClient);

  const client = clients.find((c) => c.id === id);
  if (!client) {
    if (!hydrated) {
      return <div className="grid h-full place-items-center text-[13.5px] text-[var(--color-text-muted)]">Загрузка…</div>;
    }
    return notFound();
  }

  const clientRentals = rentals.filter((r) => r.client.id === client.id);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-white/70 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link href="/clients" className="grid h-8 w-8 place-items-center rounded-[10px] border border-[var(--color-border)] transition hover:bg-[var(--color-bg)]">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[18px] font-bold">{client.name}</h1>
              {client.blacklisted && (
                <span className="flex items-center gap-1 rounded-full bg-[#FDECEC] px-2 py-0.5 text-[11px] font-semibold text-[#C0272D]">
                  <Ban className="h-3 w-3" /> В чёрном списке
                </span>
              )}
            </div>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">{clientTypeLabels[client.type]}</p>
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm(`Удалить клиента «${client.name}»?`)) {
              deleteClient(client.id).then(() => router.push("/clients"));
            }
          }}
          className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] font-medium text-[#C0272D] transition hover:bg-[#FDECEC]"
        >
          <Trash2 className="h-3.5 w-3.5" /> Удалить
        </button>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-1">
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
            <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[16px] font-bold text-[var(--color-primary)]">
              {client.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
            </div>
            <InfoRow icon={Phone} label="Телефон" value={client.phone} />
            {client.email && <InfoRow icon={Mail} label="Email" value={client.email} />}
            {client.birthDate && <InfoRow icon={Calendar} label="Дата рождения" value={client.birthDate} />}
            {client.discount ? <InfoRow icon={Percent} label="Постоянная скидка" value={`${client.discount}%`} /> : null}
            <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
              <span className="text-[12.5px] text-[var(--color-text-muted)]">Рейтинг</span>
              <RatingStars rating={client.rating} />
            </div>
          </section>

          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
            <h3 className="mb-3 text-[13.5px] font-semibold">Статистика</h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <Stat value={client.totalRentals} label="аренд всего" />
              <Stat value={formatMoney(client.totalSpent)} label="потрачено" />
              <Stat value={client.repeatRentals} label="повторных" />
              <Stat value={client.overdueCount} label="просрочек" highlight={client.overdueCount > 0} />
            </div>
          </section>

          {client.iin && (
            <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
              <h3 className="mb-3 text-[13.5px] font-semibold">Документ</h3>
              <div className="space-y-1.5 text-[12.5px]">
                <Row label="ИИН" value={client.iin} />
                {client.documentNumber && <Row label="Номер документа" value={client.documentNumber} />}
                {client.documentIssuedBy && <Row label="Кем выдан" value={client.documentIssuedBy} />}
                {client.documentIssuedAt && <Row label="Дата выдачи" value={client.documentIssuedAt} />}
                {client.documentExpiresAt && <Row label="Истекает" value={client.documentExpiresAt} />}
              </div>
            </section>
          )}
        </div>

        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[var(--color-primary)]" />
            <h2 className="font-display text-[15px] font-bold">История аренд</h2>
          </div>
          {clientRentals.length === 0 ? (
            <div className="grid h-40 place-items-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-white text-[13px] text-[var(--color-text-muted)]">
              У клиента пока нет аренд
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {clientRentals.map((r) => (
                <RentalCard key={r.id} rental={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] py-2 text-[13px] last:border-none">
      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="ml-auto font-medium">{value}</span>
    </div>
  );
}

function Stat({ value, label, highlight }: { value: string | number; label: string; highlight?: boolean }) {
  return (
    <div className="rounded-[10px] bg-[var(--color-bg)] py-3">
      <div className={`font-display text-[17px] font-bold ${highlight ? "text-[#C0272D]" : ""}`}>{value}</div>
      <div className="text-[11px] text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

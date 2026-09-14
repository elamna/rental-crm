"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { ClientForm, ClientFormValues } from "@/components/clients/client-form";
import { useAppStore } from "@/lib/store";

/**
 * Правка карточки клиента.
 *
 * Раньше исправить опечатку в имени или телефоне было нечем: карточка умела
 * только показывать и удалять. Форма та же, что и при создании, — иначе поля
 * разъезжались бы между двумя экранами.
 */
export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const clients = useAppStore((s) => s.clients);
  const hydrated = useAppStore((s) => s.hydrated);
  const updateClient = useAppStore((s) => s.updateClient);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = clients.find((c) => c.id === id);
  if (!client) {
    if (!hydrated) {
      return <div className="grid h-full place-items-center text-[14.5px] text-[var(--color-text-muted)]">Загрузка…</div>;
    }
    return notFound();
  }

  async function handleSubmit(values: ClientFormValues) {
    setSaving(true);
    setError(null);
    try {
      await updateClient(id, {
        name: values.name.trim(),
        type: values.type,
        phone: values.phone.trim(),
        photoUrl: values.photoUrl || undefined,
        email: values.email || undefined,
        iin: values.iin || undefined,
        birthDate: values.birthDate || undefined,
        documentNumber: values.documentNumber || undefined,
        documentIssuedBy: values.documentIssuedBy || undefined,
        documentIssuedAt: values.documentIssuedAt || undefined,
        documentExpiresAt: values.documentExpiresAt || undefined,
        bin: values.bin || undefined,
        legalAddress: values.legalAddress || undefined,
        companyDirector: values.companyDirector || undefined,
        bankAccount: values.bankAccount || undefined,
        bank: values.bank || undefined,
        bik: values.bik || undefined,
        acquisitionChannel: values.acquisitionChannel || undefined,
        discount: values.discount ? Number(values.discount) : undefined,
      });
      router.push(`/clients/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить клиента");
      setSaving(false);
    }
  }

  return (
    <div>
      <ClientForm title="Редактирование клиента" initial={client} onSubmit={handleSubmit} />
      {error && <p className="mx-auto -mt-4 max-w-3xl px-6 text-[14px] text-[#C0272D]">{error}</p>}
      {saving && <p className="mx-auto -mt-4 max-w-3xl px-6 text-[14px] text-[var(--color-text-muted)]">Сохранение…</p>}
    </div>
  );
}

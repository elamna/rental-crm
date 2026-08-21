"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientForm, ClientFormValues } from "@/components/clients/client-form";
import { useAppStore } from "@/lib/store";

export default function NewClientPage() {
  const router = useRouter();
  const addClient = useAppStore((s) => s.addClient);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: ClientFormValues) {
    setSaving(true);
    setError(null);
    try {
      const client = await addClient({
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
        acquisitionChannel: values.acquisitionChannel || undefined,
        discount: values.discount ? Number(values.discount) : undefined,
        rating: values.rating ? Number(values.rating) : undefined,
      });
      router.push(`/clients/${client.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить клиента");
      setSaving(false);
    }
  }

  return (
    <div>
      <ClientForm title="Новый клиент" onSubmit={handleSubmit} />
      {error && <p className="mx-auto -mt-4 max-w-3xl px-6 text-[13px] text-[#C0272D]">{error}</p>}
      {saving && <p className="mx-auto -mt-4 max-w-3xl px-6 text-[13px] text-[var(--color-text-muted)]">Сохранение…</p>}
    </div>
  );
}

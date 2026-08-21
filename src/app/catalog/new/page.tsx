"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InventoryForm, InventoryFormValues } from "@/components/inventory/inventory-form";
import { useAppStore } from "@/lib/store";

export default function NewInventoryItemPage() {
  const router = useRouter();
  const addInventoryItem = useAppStore((s) => s.addInventoryItem);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: InventoryFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const item = await addInventoryItem({
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
      router.push(`/catalog/${item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить инструмент");
      setSubmitting(false);
    }
  }

  return <InventoryForm title="Новый инструмент" onSubmit={handleSubmit} submitting={submitting} error={error} />;
}

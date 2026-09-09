"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Client, ClientType } from "@/lib/types";
import { acquisitionChannels } from "@/lib/mock-data";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { ChevronLeft } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { DebtCheckBlock } from "@/components/clients/debt-check";

export interface ClientFormValues {
  name: string;
  type: ClientType;
  phone: string;
  photoUrl?: string;
  iin: string;
  birthDate: string;
  documentNumber: string;
  documentIssuedBy: string;
  documentIssuedAt: string;
  documentExpiresAt: string;
  bin: string;
  legalAddress: string;
  companyDirector: string;
  bankAccount: string;
  bank: string;
  bik: string;
  email: string;
  acquisitionChannel: string;
  discount: string;
  rating: string;
}

const emptyValues: ClientFormValues = {
  name: "",
  type: "individual",
  phone: "",
  photoUrl: undefined,
  iin: "",
  birthDate: "",
  documentNumber: "",
  documentIssuedBy: "",
  documentIssuedAt: "",
  documentExpiresAt: "",
  bin: "",
  legalAddress: "",
  companyDirector: "",
  bankAccount: "",
  bank: "",
  bik: "",
  email: "",
  acquisitionChannel: "",
  discount: "",
  rating: "",
};

export function ClientForm({
  initial,
  title,
  onSubmit,
}: {
  initial?: Partial<Client>;
  title: string;
  onSubmit: (values: ClientFormValues) => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ClientFormValues>({
    ...emptyValues,
    ...(initial
      ? {
          name: initial.name ?? "",
          type: initial.type ?? "individual",
          phone: initial.phone ?? "",
          photoUrl: initial.photoUrl ?? undefined,
          iin: initial.iin ?? "",
          birthDate: initial.birthDate ?? "",
          documentNumber: initial.documentNumber ?? "",
          documentIssuedBy: initial.documentIssuedBy ?? "",
          documentIssuedAt: initial.documentIssuedAt ?? "",
          documentExpiresAt: initial.documentExpiresAt ?? "",
          bin: initial.bin ?? "",
          legalAddress: initial.legalAddress ?? "",
          companyDirector: initial.companyDirector ?? "",
          bankAccount: initial.bankAccount ?? "",
          bank: initial.bank ?? "",
          bik: initial.bik ?? "",
          email: initial.email ?? "",
          acquisitionChannel: initial.acquisitionChannel ?? "",
          discount: initial.discount?.toString() ?? "",
          rating: initial.rating?.toString() ?? "",
        }
      : {}),
  });

  const canSubmit = values.name.trim().length > 0 && values.phone.trim().length > 0;

  function set<K extends keyof ClientFormValues>(key: K, v: ClientFormValues[K]) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1.5 text-[15px] font-semibold text-[var(--color-text)] transition hover:text-[var(--color-primary)]"
      >
        <ChevronLeft className="h-4 w-4" /> {title}
      </button>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 card-shadow">
        <h2 className="mb-4 text-[15px] font-semibold">Основная информация</h2>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1 space-y-4">
            <Field label="ФИО/Название компании" required>
              <input
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                className="crm-input"
                placeholder="Например, Иванов Иван"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Тип клиента" required>
                <select value={values.type} onChange={(e) => set("type", e.target.value as ClientType)} className="crm-input">
                  <option value="individual">Физ. лицо</option>
                  <option value="company">Юр. лицо</option>
                </select>
              </Field>
              <Field label="Номер телефона" required>
                <PhoneInput value={values.phone} onChange={(v) => set("phone", v)} />
              </Field>
            </div>
          </div>
          <div className="shrink-0">
            <PhotoUpload value={values.photoUrl} onChange={(url) => set("photoUrl", url)} />
          </div>
        </div>

        <div className="my-6 border-t border-[var(--color-border)]" />

        <h2 className="mb-4 text-[15px] font-semibold">Документ клиента</h2>

        {/* Реестр должников — сразу, как только введён номер: смотреть на человека
            надо до того, как инструмент уехал, а не после */}
        <div className="mb-4">
          <DebtCheckBlock
            clientId={initial?.id}
            iin={values.type === "company" ? undefined : values.iin}
            bin={values.type === "company" ? values.bin : undefined}
            variant="inline"
          />
        </div>
        {values.type === "company" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="БИН">
              <input value={values.bin} onChange={(e) => set("bin", e.target.value)} className="crm-input" maxLength={12} />
            </Field>
            <Field label="Юридический адрес (офис)">
              <input value={values.legalAddress} onChange={(e) => set("legalAddress", e.target.value)} className="crm-input" />
            </Field>
            <Field label="Руководитель компании">
              <input value={values.companyDirector} onChange={(e) => set("companyDirector", e.target.value)} className="crm-input" />
            </Field>
            <Field label="ИИК (Номер счёта)">
              <input value={values.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} className="crm-input" />
            </Field>
            <Field label="Банк">
              <input value={values.bank} onChange={(e) => set("bank", e.target.value)} className="crm-input" />
            </Field>
            <Field label="БИК">
              <input value={values.bik} onChange={(e) => set("bik", e.target.value)} className="crm-input" placeholder="БИК" />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="ИИН">
              <input value={values.iin} onChange={(e) => set("iin", e.target.value)} className="crm-input" />
            </Field>
            <Field label="Дата рождения">
              <input type="date" value={values.birthDate} onChange={(e) => set("birthDate", e.target.value)} className="crm-input" />
            </Field>
            <Field label="Номер документа">
              <input value={values.documentNumber} onChange={(e) => set("documentNumber", e.target.value)} className="crm-input" />
            </Field>
            <Field label="Где или кем выдан">
              <input value={values.documentIssuedBy} onChange={(e) => set("documentIssuedBy", e.target.value)} className="crm-input" />
            </Field>
            <Field label="Дата выдачи">
              <input type="date" value={values.documentIssuedAt} onChange={(e) => set("documentIssuedAt", e.target.value)} className="crm-input" />
            </Field>
            <Field label="Дата истечения срока">
              <input type="date" value={values.documentExpiresAt} onChange={(e) => set("documentExpiresAt", e.target.value)} className="crm-input" />
            </Field>
          </div>
        )}

        <div className="my-6 border-t border-[var(--color-border)]" />

        <h2 className="mb-4 text-[15px] font-semibold">Дополнительно</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Эл. почта">
            <input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} className="crm-input" />
          </Field>
          <Field label="Канал привлечения">
            <select value={values.acquisitionChannel} onChange={(e) => set("acquisitionChannel", e.target.value)} className="crm-input">
              <option value="">Канал привлечения</option>
              {acquisitionChannels.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Постоянная скидка (%)">
            <input type="number" min={0} max={100} value={values.discount} onChange={(e) => set("discount", e.target.value)} className="crm-input" />
          </Field>
          {/* Рейтинг вручную не ставится: он складывается из истории аренд */}
          <div className="sm:col-span-1">
            <span className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">Рейтинг</span>
            <p className="rounded-[10px] bg-[var(--color-bg)] px-3 py-2.5 text-[13.5px] text-[var(--color-text-muted)]">
              Считается сам: как часто обращается, платит и возвращает в срок
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            disabled={!canSubmit}
            onClick={() => onSubmit(values)}
            className="rounded-[10px] bg-[var(--color-primary)] px-5 py-2.5 text-[14.5px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Создать и сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13.5px] font-medium text-[var(--color-text-muted)]">
        {label} {required && <span className="text-[var(--color-primary)]">*</span>}
      </span>
      {children}
    </label>
  );
}

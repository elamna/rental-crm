"use client";

import { useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Client, ClientType } from "@/lib/types";
import { X, Upload } from "lucide-react";

export function QuickClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: (client: Client) => void }) {
  const addClient = useAppStore((s) => s.addClient);

  // Основная информация
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<ClientType>("individual");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);

  // Документ
  const [iin, setIin] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentIssuedBy, setDocumentIssuedBy] = useState("");
  const [documentIssuedAt, setDocumentIssuedAt] = useState("");
  const [documentExpiresAt, setDocumentExpiresAt] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSubmit = name.trim().length > 0 && phone.trim().length > 0 && !saving;

  async function handlePhoto(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) setPhotoUrl(data.url);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const client = await addClient({
        name: name.trim(),
        phone: phone.trim(),
        type,
        photoUrl,
        iin: iin.trim() || undefined,
        birthDate: birthDate || undefined,
        documentNumber: documentNumber.trim() || undefined,
        documentIssuedBy: documentIssuedBy.trim() || undefined,
        documentIssuedAt: documentIssuedAt || undefined,
        documentExpiresAt: documentExpiresAt || undefined,
      });
      onCreated(client);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать клиента");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white card-shadow"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h3 className="text-[16px] font-bold">Новый клиент</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Основная информация */}
          <div>
            <h4 className="mb-3 text-[13.5px] font-semibold">Основная информация</h4>
            <div className="flex gap-4">
              <div className="flex-1 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">
                    ФИО / Название компании <span className="text-[var(--color-primary)]">*</span>
                  </span>
                  <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="crm-input" placeholder="Иванов Иван Иванович" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">
                      Тип клиента <span className="text-[var(--color-primary)]">*</span>
                    </span>
                    <select value={type} onChange={(e) => setType(e.target.value as ClientType)} className="crm-input">
                      <option value="individual">Физ. лицо</option>
                      <option value="company">Юр. лицо</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">
                      Номер телефона <span className="text-[var(--color-primary)]">*</span>
                    </span>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} className="crm-input" placeholder="+7 7XX XXX XX XX" />
                  </label>
                </div>
              </div>

              {/* Фото */}
              <div className="w-[120px] shrink-0">
                <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Фото</span>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-[90px] w-full flex-col items-center justify-center gap-1.5 rounded-[10px] border-2 border-dashed border-[var(--color-border)] text-center transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                  style={photoUrl ? { backgroundImage: `url(${photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
                >
                  {!photoUrl && (
                    <>
                      <Upload className="h-5 w-5 text-[var(--color-primary)]" />
                      <span className="text-[11px] font-medium text-[var(--color-primary)]">
                        {uploading ? "Загрузка…" : "Выберите файл"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Документ клиента */}
          <div>
            <h4 className="mb-3 text-[13.5px] font-semibold">Документ клиента</h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">ИИН</span>
                <input value={iin} onChange={(e) => setIin(e.target.value)} className="crm-input" placeholder="000000000000" maxLength={12} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Дата рождения</span>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="crm-input" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Номер документа</span>
                <input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} className="crm-input" placeholder="AB1234567" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Где или кем выдан</span>
                <input value={documentIssuedBy} onChange={(e) => setDocumentIssuedBy(e.target.value)} className="crm-input" placeholder="МВД РК" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Дата выдачи</span>
                <input type="date" value={documentIssuedAt} onChange={(e) => setDocumentIssuedAt(e.target.value)} className="crm-input" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Дата истечения срока</span>
                <input type="date" value={documentExpiresAt} onChange={(e) => setDocumentExpiresAt(e.target.value)} className="crm-input" />
              </label>
            </div>
          </div>
        </div>

        {/* Футер */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-4">
          {error && <p className="text-[12px] text-[#C0272D]">{error}</p>}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-[13px] font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
              Отмена
            </button>
            <button
              disabled={!canSubmit}
              onClick={submit}
              className="rounded-[10px] bg-[var(--color-primary)] px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Создание…" : "Создать клиента"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

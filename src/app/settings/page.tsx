"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { CompanySettings } from "@/lib/repo";
import { Building2, Phone, Mail, MapPin, CreditCard, User, Upload, Save, Wrench, Palette, Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/components/layout/theme-provider";
import { cn } from "@/lib/utils";

const EMPTY: CompanySettings = {
  company_name: "", company_bin: "", company_address: "",
  company_phone: "", company_email: "", company_bank: "",
  company_bik: "", company_account: "", company_director: "",
  company_logo_url: "", currency: "₸", city: "",
};

const THEME_OPTIONS: { value: ThemeChoice; label: string; hint: string; icon: React.ElementType }[] = [
  { value: "light", label: "Светлая", hint: "Тёплый песочный интерфейс", icon: Sun },
  { value: "dark", label: "Тёмная", hint: "Чёрный фон, мятный акцент", icon: Moon },
  { value: "system", label: "Как в системе", hint: "Следовать настройке устройства", icon: Monitor },
];

function ThemePicker() {
  const { theme, resolved, setTheme } = useTheme();

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {THEME_OPTIONS.map((o) => {
          const active = theme === o.value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              onClick={() => setTheme(o.value)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-[12px] border p-3.5 text-left transition",
                active
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                  : "border-[var(--color-border)] hover:border-[var(--color-primary)]"
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-[10px]",
                  active ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "bg-[var(--color-bg)] text-[var(--color-text-muted)]"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[13.5px] font-semibold">{o.label}</span>
              <span className="text-[11.5px] leading-tight text-[var(--color-text-muted)]">{o.hint}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">
        Тема сохраняется в этом браузере и не влияет на других пользователей.
        {theme === "system" && ` Сейчас применена ${resolved === "dark" ? "тёмная" : "светлая"}.`}
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const { user, can } = useAuth();
  const [settings, setSettings] = useState<CompanySettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => { setSettings(d); setLoading(false); });
  }, []);

  async function handleSave() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleLogoUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) setSettings((s) => ({ ...s, company_logo_url: data.url }));
    setUploading(false);
  }

  function set(key: keyof CompanySettings, val: string) {
    setSettings((s) => ({ ...s, [key]: val }));
  }

  const isAdmin = user?.isAdmin;

  if (loading) return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" /></div>;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[20px] font-bold">Настройки</h1>
            <p className="text-[13px] text-[var(--color-text-muted)]">Данные компании, реквизиты и параметры системы</p>
          </div>
          {isAdmin && (
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60">
              <Save className="h-4 w-4" />
              {saving ? "Сохранение…" : saved ? "Сохранено ✓" : "Сохранить"}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Оформление — настройка браузера, доступна всем */}
          <Section icon={Palette} title="Оформление">
            <ThemePicker />
          </Section>

          {/* Логотип */}
          <Section icon={Building2} title="Логотип компании">
            <div className="flex items-center gap-5">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[14px] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden">
                {settings.company_logo_url
                  ? <img src={settings.company_logo_url} alt="Логотип" className="h-full w-full object-contain p-1" />
                  : <Wrench className="h-8 w-8 text-[var(--color-text-muted)]" />
                }
              </div>
              {isAdmin && (
                <div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-[13px] font-medium hover:bg-[var(--color-bg)]">
                    <Upload className="h-4 w-4" />
                    {uploading ? "Загрузка…" : "Загрузить логотип"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                  </label>
                  <p className="mt-1.5 text-[12px] text-[var(--color-text-muted)]">PNG, JPG до 8 МБ. Отображается в документах.</p>
                </div>
              )}
            </div>
          </Section>

          {/* Основные данные */}
          <Section icon={Building2} title="Основные данные">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="col-span-2 block">
                <span className="field-label">Название компании / ИП</span>
                <input value={settings.company_name} onChange={(e) => set("company_name", e.target.value)} className="crm-input" placeholder="ИП Иванов Иван Иванович" disabled={!isAdmin} />
              </label>
              <label className="block">
                <span className="field-label">БИН / ИИН</span>
                <input value={settings.company_bin} onChange={(e) => set("company_bin", e.target.value)} className="crm-input" placeholder="123456789012" disabled={!isAdmin} />
              </label>
              <label className="block">
                <span className="field-label">Город</span>
                <input value={settings.city} onChange={(e) => set("city", e.target.value)} className="crm-input" placeholder="Атырау" disabled={!isAdmin} />
              </label>
              <label className="col-span-2 block">
                <span className="field-label">Юридический адрес</span>
                <input value={settings.company_address} onChange={(e) => set("company_address", e.target.value)} className="crm-input" placeholder="г. Атырау, ул. Абая, 1" disabled={!isAdmin} />
              </label>
              <label className="block">
                <span className="field-label">ФИО руководителя</span>
                <input value={settings.company_director} onChange={(e) => set("company_director", e.target.value)} className="crm-input" placeholder="Иванов И.И." disabled={!isAdmin} />
              </label>
              <label className="block">
                <span className="field-label">Валюта</span>
                <select value={settings.currency} onChange={(e) => set("currency", e.target.value)} className="crm-input" disabled={!isAdmin}>
                  <option value="₸">₸ Тенге (KZT)</option>
                  <option value="₽">₽ Рубль (RUB)</option>
                  <option value="$">$ Доллар (USD)</option>
                </select>
              </label>
            </div>
          </Section>

          {/* Контакты */}
          <Section icon={Phone} title="Контакты">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Телефон</span>
                <input value={settings.company_phone} onChange={(e) => set("company_phone", e.target.value)} className="crm-input" placeholder="+7 700 000 00 00" disabled={!isAdmin} />
              </label>
              <label className="block">
                <span className="field-label">Email</span>
                <input type="email" value={settings.company_email} onChange={(e) => set("company_email", e.target.value)} className="crm-input" placeholder="info@company.kz" disabled={!isAdmin} />
              </label>
            </div>
          </Section>

          {/* Банковские реквизиты */}
          <Section icon={CreditCard} title="Банковские реквизиты">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="col-span-2 block">
                <span className="field-label">Банк</span>
                <input value={settings.company_bank} onChange={(e) => set("company_bank", e.target.value)} className="crm-input" placeholder="АО «Kaspi Bank»" disabled={!isAdmin} />
              </label>
              <label className="block">
                <span className="field-label">БИК</span>
                <input value={settings.company_bik} onChange={(e) => set("company_bik", e.target.value)} className="crm-input" placeholder="CASPKZKA" disabled={!isAdmin} />
              </label>
              <label className="block">
                <span className="field-label">Номер счёта (IBAN)</span>
                <input value={settings.company_account} onChange={(e) => set("company_account", e.target.value)} className="crm-input" placeholder="KZ00 0000 0000 0000 0000" disabled={!isAdmin} />
              </label>
            </div>
          </Section>

          {/* Переменные для шаблонов — подсказка */}
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <p className="text-[12.5px] font-semibold text-[var(--color-text-muted)] mb-2">Переменные для шаблонов документов</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                ["{{company_name}}", "Название компании"],
                ["{{company_bin}}", "БИН / ИИН"],
                ["{{company_director}}", "ФИО руководителя"],
                ["{{company_phone}}", "Телефон"],
                ["{{company_email}}", "Email"],
                ["{{company_address}}", "Адрес"],
                ["{{company_bank}}", "Банк"],
                ["{{company_bik}}", "БИК"],
                ["{{company_account}}", "Номер счёта"],
                ["{{city}}", "Город"],
              ].map(([key, label]) => (
                <div key={key} className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[10.5px] text-[var(--color-primary)]">{key}</span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">— {label}</span>
                </div>
              ))}
            </div>
          </div>

          {!isAdmin && (
            <p className="text-center text-[12.5px] text-[var(--color-text-muted)]">
              Только главный администратор может изменять настройки
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-[8px] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-[14px] font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

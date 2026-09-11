"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { CompanySettings } from "@/lib/repo";
import { Building2, Phone, Mail, MapPin, CreditCard, User, Upload, Save, Wrench, Palette, Sun, Moon, Monitor, DatabaseBackup, Download, HardDriveDownload, KeyRound, Eye, EyeOff, Check, Store, Plus, Trash2 } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/components/layout/theme-provider";
import { cn } from "@/lib/utils";
import { PhoneInput } from "@/components/ui/phone-input";
import { useAppStore } from "@/lib/store";

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

interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} в ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Резервные копии базы.
 *
 * Копии на сервере спасают от испорченного импорта и ошибочного удаления, но
 * лежат на том же диске, что и база. От потери диска спасает только скачанный
 * файл, поэтому кнопка скачивания стоит первой и об этом сказано прямо.
 */
function BackupSection() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error((await res.json()).error ?? "Не удалось получить список копий");
      const data = await res.json();
      setBackups(data.backups ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось получить список копий");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function makeNow() {
    setMaking(true);
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Не удалось сделать копию");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сделать копию");
    } finally {
      setMaking(false);
    }
  }

  const last = backups[0];

  return (
    <Section icon={DatabaseBackup} title="Резервные копии базы">
      <p className="mb-4 text-[13.5px] text-[var(--color-text-muted)]">
        Вся система хранится в одном файле: аренды, клиенты, деньги, документы. Копия снимается
        автоматически раз в сутки и хранится две недели. Копии лежат на том же диске, что и база,
        поэтому раз в неделю скачивайте файл себе — это единственная защита от потери диска.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href="/api/backup/download"
          className="flex items-center gap-1.5 rounded-[10px] bg-[var(--color-primary)] px-4 py-2.5 text-[14px] font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-primary)] transition hover:bg-[var(--color-primary-hover)]"
        >
          <HardDriveDownload className="h-4 w-4" /> Скачать базу сейчас
        </a>
        <button
          onClick={makeNow}
          disabled={making}
          className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] px-4 py-2.5 text-[14px] font-semibold text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-ink)] disabled:opacity-60"
        >
          <DatabaseBackup className="h-4 w-4" /> {making ? "Делаем копию…" : "Сделать копию на сервере"}
        </button>
      </div>
      <p className="mt-2 text-[12.5px] text-[var(--color-text-muted)]">
        Копию на сервере стоит сделать перед импортом или массовой правкой — к ней можно вернуться.
      </p>

      {error && <p className="mt-3 text-[13.5px] text-[#C0272D]">{error}</p>}

      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[13.5px] font-semibold">Копии на сервере</span>
          <span className="text-[12.5px] text-[var(--color-text-muted)]">
            {last ? `последняя — ${formatWhen(last.createdAt)}` : "пока ни одной"}
          </span>
        </div>

        {loading ? (
          <p className="text-[13.5px] text-[var(--color-text-muted)]">Загрузка…</p>
        ) : backups.length === 0 ? (
          <p className="text-[13.5px] text-[var(--color-text-muted)]">
            Первая копия появится в ближайший час работы системы.
          </p>
        ) : (
          <div className="space-y-1.5">
            {backups.map((b) => (
              <div
                key={b.name}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--color-border)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium">{formatWhen(b.createdAt)}</div>
                  <div className="truncate text-[12px] text-[var(--color-text-muted)]">
                    {b.name} · {formatSize(b.size)}
                  </div>
                </div>
                <a
                  href={`/api/backup/download?file=${encodeURIComponent(b.name)}`}
                  title="Скачать эту копию"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)] hover:text-[var(--color-primary-ink)]"
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

const MIN_PASSWORD_LENGTH = 6;

/**
 * Смена собственного пароля.
 *
 * Доступна всем, кто вошёл: раньше пароль менял только администратор через
 * «Пользователей», из-за чего пароли передавались в переписке и оставались
 * известны посторонним.
 */
function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const mismatch = repeat.length > 0 && next !== repeat;
  const ready = current.length > 0 && next.length >= MIN_PASSWORD_LENGTH && next === repeat;

  async function submit() {
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Не удалось сменить пароль");
      setCurrent("");
      setNext("");
      setRepeat("");
      setDone(true);
      setTimeout(() => setDone(false), 6000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сменить пароль");
    } finally {
      setSaving(false);
    }
  }

  const field = "crm-input pr-10";

  return (
    <Section icon={KeyRound} title="Мой пароль">
      <p className="mb-4 text-[13.5px] text-[var(--color-text-muted)]">
        Меняете только себе. Текущий пароль спрашиваем на случай, если за вашим компьютером
        сел кто-то другой при открытой системе.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="field-label">Текущий пароль</span>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              className={field}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              title={show ? "Скрыть" : "Показать"}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="field-label">Новый пароль</span>
          <input
            type={show ? "text" : "password"}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoComplete="new-password"
            className="crm-input"
          />
        </label>

        <label className="block">
          <span className="field-label">Новый пароль ещё раз</span>
          <input
            type={show ? "text" : "password"}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoComplete="new-password"
            className="crm-input"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={submit}
          disabled={!ready || saving}
          className="rounded-[10px] bg-[var(--color-primary)] px-4 py-2.5 text-[14px] font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:shadow-none"
        >
          {saving ? "Меняем…" : "Сменить пароль"}
        </button>

        {tooShort && (
          <span className="text-[13px] text-[#B8620A]">Не короче {MIN_PASSWORD_LENGTH} символов</span>
        )}
        {mismatch && <span className="text-[13px] text-[#C0272D]">Пароли не совпадают</span>}
        {error && <span className="text-[13px] text-[#C0272D]">{error}</span>}
        {done && (
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-[#1C8A46]">
            <Check className="h-4 w-4" /> Пароль изменён — на других устройствах придётся войти заново
          </span>
        )}
      </div>
    </Section>
  );
}

interface BranchUsage {
  name: string;
  rentals: number;
  inventory: number;
}

/**
 * Пункты проката.
 *
 * Раньше список был вписан в код: третья точка означала правку исходников и
 * новую выкладку. В арендах филиал хранится строкой, поэтому переименование
 * не переписывает историю — прошлая аренда так и останется выданной из старого
 * пункта. Об этом сказано прямо, иначе переименование выглядит как потеря данных.
 */
function BranchesSection() {
  const branches = useAppStore((s) => s.branches);
  const saveBranches = useAppStore((s) => s.saveBranches);

  const [list, setList] = useState<string[]>(branches);
  const [usage, setUsage] = useState<BranchUsage[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setList(branches);
  }, [branches]);

  useEffect(() => {
    fetch("/api/branches?usage=1")
      .then((res) => (res.ok ? res.json() : []))
      .then(setUsage)
      .catch(() => setUsage([]));
  }, [branches]);

  const dirty = list.length !== branches.length || list.some((b, i) => b !== branches[i]);

  function usageFor(name: string) {
    return usage.find((u) => u.name === name);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveBranches(list.map((b) => b.trim()).filter(Boolean));
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить пункты проката");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section icon={Store} title="Пункты проката">
      <p className="mb-4 text-[13.5px] text-[var(--color-text-muted)]">
        Этот список виден в новой аренде, в карточке инструмента и в доставке. Аренды хранят название
        пункта текстом, поэтому переименование не меняет прошлые записи — они останутся со старым названием.
      </p>

      <div className="space-y-2">
        {list.map((branch, i) => {
          const used = usageFor(branch);
          return (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1">
                <input
                  value={branch}
                  onChange={(e) => setList((prev) => prev.map((b, idx) => (idx === i ? e.target.value : b)))}
                  placeholder="Название пункта"
                  className="crm-input"
                />
                {used && (used.rentals > 0 || used.inventory > 0) && (
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    Используется: аренд — {used.rentals}, позиций каталога — {used.inventory}
                  </p>
                )}
              </div>
              <button
                onClick={() => setList((prev) => prev.filter((_, idx) => idx !== i))}
                disabled={list.length <= 1}
                title={list.length <= 1 ? "Нужен хотя бы один пункт" : "Убрать пункт"}
                className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-[var(--color-border)] text-[var(--color-text-muted)] transition hover:border-[#C0272D] hover:text-[#C0272D] disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setList((prev) => [...prev, ""])}
          className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] px-3.5 py-2 text-[13.5px] font-semibold text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-ink)]"
        >
          <Plus className="h-4 w-4" /> Добавить пункт
        </button>
        <button
          onClick={save}
          disabled={!dirty || saving || list.every((b) => !b.trim())}
          className="rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13.5px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          {saving ? "Сохраняем…" : "Сохранить пункты"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-[#1C8A46]">
            <Check className="h-4 w-4" /> Сохранено
          </span>
        )}
        {error && <span className="text-[13px] text-[#C0272D]">{error}</span>}
      </div>
    </Section>
  );
}

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
              <span className="text-[14.5px] font-semibold">{o.label}</span>
              <span className="text-[12.5px] leading-tight text-[var(--color-text-muted)]">{o.hint}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] text-[var(--color-text-muted)]">
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
            <p className="text-[14px] text-[var(--color-text-muted)]">Данные компании, реквизиты и параметры системы</p>
          </div>
          {isAdmin && (
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[14px] font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60">
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
          {/* Свой пароль меняет любой вошедший, права тут ни при чём */}
          <PasswordSection />

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
                  <label className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-[14px] font-medium hover:bg-[var(--color-bg)]">
                    <Upload className="h-4 w-4" />
                    {uploading ? "Загрузка…" : "Загрузить логотип"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                  </label>
                  <p className="mt-1.5 text-[13px] text-[var(--color-text-muted)]">PNG, JPG до 8 МБ. Отображается в документах.</p>
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
                <PhoneInput value={settings.company_phone} onChange={(v) => set("company_phone", v)} disabled={!isAdmin} />
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

          {/* Пункты проката: список для форм, меняет администратор */}
          {isAdmin && <BranchesSection />}

          {/* Копии базы — только у главного администратора: это вся система целиком */}
          {user?.isOwner && <BackupSection />}

          {/* Переменные для шаблонов — подсказка */}
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <p className="text-[13.5px] font-semibold text-[var(--color-text-muted)] mb-2">Переменные для шаблонов документов</p>
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
                  <span className="font-mono text-[11.5px] text-[var(--color-primary-ink)]">{key}</span>
                  <span className="text-[12px] text-[var(--color-text-muted)]">— {label}</span>
                </div>
              ))}
            </div>
          </div>

          {!isAdmin && (
            <p className="text-center text-[13.5px] text-[var(--color-text-muted)]">
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
        <div className="grid h-8 w-8 place-items-center rounded-[8px] bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

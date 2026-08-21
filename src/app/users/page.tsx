"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { AppUser, Permission, ALL_PERMISSIONS, PERMISSION_LABELS } from "@/lib/types";
import { Plus, Pencil, Trash2, X, ShieldCheck, ShieldOff, KeyRound, Lock, Unlock } from "lucide-react";

// Группировка прав по разделам для UI
const PERMISSION_GROUPS = [
  { label: "Главная", permissions: ["dashboard.view"] as Permission[] },
  { label: "Аренда", permissions: ["rentals.view", "rentals.edit"] as Permission[] },
  { label: "Каталог", permissions: ["catalog.view", "catalog.edit"] as Permission[] },
  { label: "Клиенты", permissions: ["clients.view", "clients.edit"] as Permission[] },
  { label: "Мастерская", permissions: ["workshop.view", "workshop.edit"] as Permission[] },
  { label: "Документы", permissions: ["documents.view", "documents.edit"] as Permission[] },
  { label: "Чёрный список", permissions: ["blacklist.view"] as Permission[] },
  { label: "Аналитика", permissions: ["analytics.view"] as Permission[] },
  { label: "Финансы", permissions: ["finance.view"] as Permission[] },
  { label: "Настройки", permissions: ["settings.view"] as Permission[] },
  { label: "Пользователи", permissions: ["users.view", "users.edit"] as Permission[] },
];

export default function UsersPage() {
  const { can } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | "password" | null>(null);
  const [selected, setSelected] = useState<AppUser | null>(null);

  if (!can("users.view")) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="text-[48px]">🔒</div>
          <h2 className="mt-3 text-[18px] font-bold">Нет доступа</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">У вас нет прав для просмотра этого раздела</p>
        </div>
      </div>
    );
  }

  async function load() {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { load(); }, []);

  async function toggleActive(u: AppUser) {
    if (u.isAdmin) return;
    await fetch(`/api/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !u.isActive }) });
    load();
  }

  async function deleteUser(u: AppUser) {
    if (u.isAdmin) return;
    if (!confirm(`Удалить пользователя «${u.name}»?`)) return;
    await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--color-border)] bg-white/70 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[20px] font-bold">Пользователи</h1>
            <p className="text-[13px] text-[var(--color-text-muted)]">Управление доступом к системе</p>
          </div>
          {can("users.edit") && (
            <button onClick={() => { setSelected(null); setModal("create"); }} className="flex items-center gap-2 rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[var(--color-primary-hover)]">
              <Plus className="h-4 w-4" /> Новый пользователь
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="text-[13px] text-[var(--color-text-muted)]">Загрузка…</p>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white card-shadow">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
                  <th className="px-4 py-3 text-left text-[12px] font-semibold text-[var(--color-text-muted)]">Пользователь</th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold text-[var(--color-text-muted)]">Логин</th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold text-[var(--color-text-muted)]">Должность</th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold text-[var(--color-text-muted)]">Права</th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold text-[var(--color-text-muted)]">Статус</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[11px] font-bold text-[var(--color-primary)]">
                          {u.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{u.name}</div>
                          {u.isAdmin && <span className="text-[11px] font-semibold text-[var(--color-primary)]">Главный администратор</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[var(--color-text-muted)]">{u.login}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{u.position ?? "—"}</td>
                    <td className="px-4 py-3">
                      {u.isAdmin ? (
                        <span className="flex items-center gap-1 text-[var(--color-primary)]"><ShieldCheck className="h-3.5 w-3.5" /> Полный доступ</span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">{u.permissions.length} разрешений</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.isActive ? "bg-[#EAF7EE] text-[#1C8A46]" : "bg-[#F1F2F6] text-[#8A8F9C]"}`}>
                        {u.isActive ? "Активен" : "Заблокирован"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {can("users.edit") && !u.isAdmin && (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setSelected(u); setModal("edit"); }} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)]" title="Редактировать"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => { setSelected(u); setModal("password"); }} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]" title="Сменить пароль"><KeyRound className="h-3.5 w-3.5" /></button>
                          <button onClick={() => toggleActive(u)} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]" title={u.isActive ? "Заблокировать" : "Разблокировать"}>
                            {u.isActive ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => deleteUser(u)} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[#FDECEC] hover:text-[#C0272D]" title="Удалить"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(modal === "create" || modal === "edit") && (
        <UserModal
          user={selected}
          onClose={() => { setModal(null); setSelected(null); }}
          onSaved={() => { setModal(null); setSelected(null); load(); }}
        />
      )}

      {modal === "password" && selected && (
        <PasswordModal
          user={selected}
          onClose={() => { setModal(null); setSelected(null); }}
          onSaved={() => { setModal(null); setSelected(null); }}
        />
      )}
    </div>
  );
}

// ─── Модалка создания/редактирования пользователя ───────────────────────────

function UserModal({ user, onClose, onSaved }: { user: AppUser | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!user;
  const [name, setName] = useState(user?.name ?? "");
  const [login, setLogin] = useState(user?.login ?? "");
  const [password, setPassword] = useState("");
  const [position, setPosition] = useState(user?.position ?? "");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [permissions, setPermissions] = useState<Permission[]>(user?.permissions ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function togglePerm(p: Permission) {
    setPermissions((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }
  function selectAll() { setPermissions([...ALL_PERMISSIONS]); }
  function selectNone() { setPermissions([]); }

  async function submit() {
    if (!name.trim() || !login.trim()) return;
    if (!isEdit && !password) { setError("Укажите пароль"); return; }
    setSaving(true);
    setError("");
    const body: Record<string, unknown> = { name, login, position, isActive, permissions };
    if (password) body.password = password;
    const res = await fetch(isEdit ? `/api/users/${user!.id}` : "/api/users", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Ошибка"); setSaving(false); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-8">
      <div className="w-full max-w-2xl rounded-[16px] bg-white card-shadow mb-8">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h3 className="text-[15px] font-bold">{isEdit ? "Редактировать пользователя" : "Новый пользователь"}</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Основные данные */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block col-span-2">
              <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">ФИО *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="crm-input" placeholder="Иванов Иван Иванович" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Логин *</span>
              <input value={login} onChange={(e) => setLogin(e.target.value)} className="crm-input" placeholder="ivanov" disabled={isEdit} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">{isEdit ? "Новый пароль (оставьте пустым чтобы не менять)" : "Пароль *"}</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="crm-input" placeholder="••••••••" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Должность</span>
              <input value={position} onChange={(e) => setPosition(e.target.value)} className="crm-input" placeholder="Менеджер" />
            </label>
            <label className="flex items-center gap-2 pt-5">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
              <span className="text-[13px] font-medium">Активен</span>
            </label>
          </div>

          {/* Права доступа */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13.5px] font-semibold">Права доступа</span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="flex items-center gap-1 rounded-[8px] border border-[var(--color-border)] px-2.5 py-1 text-[12px] hover:bg-[var(--color-bg)]">
                  <ShieldCheck className="h-3.5 w-3.5" /> Выбрать все
                </button>
                <button onClick={selectNone} className="flex items-center gap-1 rounded-[8px] border border-[var(--color-border)] px-2.5 py-1 text-[12px] hover:bg-[var(--color-bg)]">
                  <ShieldOff className="h-3.5 w-3.5" /> Снять все
                </button>
              </div>
            </div>
            <div className="rounded-[12px] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] font-medium">{group.label}</span>
                  <div className="flex gap-3">
                    {group.permissions.map((p) => (
                      <label key={p} className="flex items-center gap-1.5 text-[12.5px] text-[var(--color-text-muted)]">
                        <input
                          type="checkbox"
                          checked={permissions.includes(p)}
                          onChange={() => togglePerm(p)}
                          className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                        />
                        {p.endsWith(".edit") ? "Редактирование" : "Просмотр"}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="px-5 pb-2 text-[12px] text-[#C0272D]">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
          <button onClick={onClose} className="rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-[13px] hover:bg-[var(--color-bg)]">Отмена</button>
          <button onClick={submit} disabled={saving || !name || !login} className="rounded-[10px] bg-[var(--color-primary)] px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-50 hover:bg-[var(--color-primary-hover)]">
            {saving ? "Сохранение…" : isEdit ? "Сохранить" : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Модалка смены пароля ────────────────────────────────────────────────────

function PasswordModal({ user, onClose, onSaved }: { user: AppUser; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!password) return;
    setSaving(true);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Ошибка"); setSaving(false); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-[16px] bg-white p-5 card-shadow">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-bold">Сменить пароль</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-3 text-[12.5px] text-[var(--color-text-muted)]">Новый пароль для пользователя <strong>{user.name}</strong></p>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="crm-input mb-3" placeholder="Новый пароль" autoFocus />
        {error && <p className="mb-2 text-[12px] text-[#C0272D]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-[13px] hover:bg-[var(--color-bg)]">Отмена</button>
          <button onClick={submit} disabled={saving || !password} className="rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

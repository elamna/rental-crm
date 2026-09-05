"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Wrench } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!login || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Ошибка входа"); return; }
      // Обновляем состояние AuthProvider, затем редиректим
      await refresh();
      router.push("/");
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-[var(--color-sidebar)] to-[var(--color-bg)] p-4 safe-top safe-bottom">
      <div className="w-full max-w-[380px]">
        {/* Логотип */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-[16px] bg-[var(--color-primary)] shadow-[var(--shadow-primary)]">
            <Wrench className="h-7 w-7 text-white" />
          </div>
          <h1 className="font-display text-[22px] font-bold text-[var(--color-text)]">QURAL-SAIMAN</h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">Управление прокатом инструмента</p>
        </div>

        {/* Форма */}
        <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 card-shadow">
          <h2 className="mb-5 font-display text-[16px] font-semibold">Вход в систему</h2>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--color-text-muted)]">Логин</span>
              <input
                autoFocus
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="admin"
                className="crm-input"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--color-text-muted)]">Пароль</span>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="••••••••"
                  className="crm-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
          </div>

          {error && (
            <div className="mt-3 rounded-[8px] bg-[#FDECEC] px-3 py-2 text-[12.5px] text-[#C0272D]">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !login || !password}
            className="mt-5 w-full rounded-[10px] bg-[var(--color-primary)] py-2.5 text-[13px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {loading ? "Входим…" : "Войти"}
          </button>
        </div>
      </div>
    </div>
  );
}

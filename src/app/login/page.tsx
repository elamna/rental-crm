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
    <div className="min-h-screen bg-gradient-to-br from-[#15121F] to-[#1E1A2E] flex items-center justify-center p-4">
      <div className="w-full max-w-[380px]">
        {/* Логотип */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-[16px] bg-[#6D4AFF]">
            <Wrench className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-[22px] font-bold text-white">QURAL-SAIMAN</h1>
          <p className="mt-1 text-[13px] text-white/50">Управление прокатом инструмента</p>
        </div>

        {/* Форма */}
        <div className="rounded-[16px] border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-5 text-[16px] font-semibold text-white">Вход в систему</h2>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-white/60">Логин</span>
              <input
                autoFocus
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="admin"
                className="w-full rounded-[10px] border border-white/10 bg-white/10 px-3 py-2.5 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-[#6D4AFF] focus:bg-white/15 transition"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-white/60">Пароль</span>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="••••••••"
                  className="w-full rounded-[10px] border border-white/10 bg-white/10 px-3 py-2.5 pr-10 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-[#6D4AFF] focus:bg-white/15 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
          </div>

          {error && (
            <div className="mt-3 rounded-[8px] bg-red-500/15 px-3 py-2 text-[12.5px] text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !login || !password}
            className="mt-5 w-full rounded-[10px] bg-[#6D4AFF] py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#5A3AE8] disabled:opacity-50"
          >
            {loading ? "Входим…" : "Войти"}
          </button>
        </div>
      </div>
    </div>
  );
}

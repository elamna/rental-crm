"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "qs-theme";

interface ThemeCtx {
  /** Что выбрал пользователь */
  theme: ThemeChoice;
  /** Что реально применено сейчас (system уже разрешён в light/dark) */
  resolved: "light" | "dark";
  setTheme: (t: ThemeChoice) => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "system", resolved: "light", setTheme: () => {} });

function systemTheme(): "light" | "dark" {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(resolved: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Первое чтение — уже после монтирования; до этого тему проставил
  // блокирующий скрипт в layout.tsx, поэтому мигания нет
  useEffect(() => {
    const saved = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeChoice | null) ?? "system";
    const next = saved === "system" ? systemTheme() : saved;
    setThemeState(saved);
    setResolved(next);
    apply(next);
  }, []);

  // Пока выбран «как в системе» — следим за системной темой
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = systemTheme();
      setResolved(next);
      apply(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t: ThemeChoice) => {
    localStorage.setItem(THEME_STORAGE_KEY, t);
    const next = t === "system" ? systemTheme() : t;
    setThemeState(t);
    setResolved(next);
    apply(next);
  }, []);

  return <Ctx.Provider value={{ theme, resolved, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}

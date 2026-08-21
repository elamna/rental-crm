"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { StoreHydrator } from "./store-hydrator";
import { useAuth } from "@/components/auth/auth-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isLoginPage = pathname === "/login";
  // Предотвращаем hydration mismatch — рендерим только на клиенте
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Страница логина — без обёртки
  if (isLoginPage) return <>{children}</>;

  // До монтирования — пустой контейнер (избегаем mismatch)
  if (!mounted) return <div className="flex h-screen w-full overflow-hidden">{children}</div>;

  // Загрузка сессии
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  // Нет сессии — middleware перенаправит, просто показываем спиннер
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <StoreHydrator />
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </>
  );
}

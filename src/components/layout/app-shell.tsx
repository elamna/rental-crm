"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { StoreHydrator } from "./store-hydrator";
import { useAuth } from "@/components/auth/auth-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLoginPage = pathname === "/login";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Редирект на логин если нет сессии после загрузки
  useEffect(() => {
    if (mounted && !loading && !user && !isLoginPage) {
      router.replace("/login");
    }
  }, [mounted, loading, user, isLoginPage, router]);

  // Страница логина — без обёртки
  if (isLoginPage) return <>{children}</>;

  // До монтирования
  if (!mounted) return <div className="flex h-screen w-full overflow-hidden" />;

  // Загрузка или нет пользователя — спиннер
  if (loading || !user) {
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

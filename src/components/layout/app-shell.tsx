"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { MobileTopBar } from "./mobile-topbar";
import { StoreHydrator } from "./store-hydrator";
import { useAuth } from "@/components/auth/auth-provider";
import { useIsMobile } from "@/lib/use-is-mobile";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLoginPage = pathname === "/login";
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  // Переход по ссылке в меню — закрываем его
  useEffect(() => setNavOpen(false), [pathname]);

  // Под открытым меню страница не должна прокручиваться
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  // Редирект на логин если нет сессии после загрузки
  useEffect(() => {
    if (mounted && !loading && !user && !isLoginPage) {
      router.replace("/login");
    }
  }, [mounted, loading, user, isLoginPage, router]);

  // Страница логина — без обёртки
  if (isLoginPage) return <>{children}</>;

  // До монтирования
  if (!mounted) return <div className="flex h-[100dvh] w-full overflow-hidden" />;

  // Загрузка или нет пользователя — спиннер
  if (loading || !user) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <StoreHydrator />
      <div className="flex h-[100dvh] w-full overflow-hidden">
        <Sidebar mobile={isMobile} open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          {isMobile && <MobileTopBar onMenu={() => setNavOpen(true)} />}
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </>
  );
}

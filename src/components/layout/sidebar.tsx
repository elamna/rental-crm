"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, Boxes, Users, BarChart3,
  Ban, FileText, Wallet, Wrench, Settings, Plus, Gauge, Filter,
  ChevronsLeft, LogOut, UserCog, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Permission } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: Permission;
}

const mainNav: NavItem[] = [
  { href: "/", label: "Главная", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/rentals", label: "Аренды", icon: ClipboardList, permission: "rentals.view" },
  { href: "/catalog", label: "Каталог", icon: Boxes, permission: "catalog.view" },
  { href: "/workshop", label: "Мастерская", icon: Wrench, permission: "workshop.view" },
  { href: "/clients", label: "Клиенты", icon: Users, permission: "clients.view" },
  { href: "/funnel", label: "Воронка", icon: Filter, permission: "leads.view" },
  { href: "/analytics", label: "Аналитика", icon: BarChart3, permission: "analytics.view" },
];

const secondaryNav: NavItem[] = [
  { href: "/finance", label: "Финансы", icon: Wallet, permission: "finance.view" },
  { href: "/documents", label: "Документы", icon: FileText, permission: "documents.view" },
  { href: "/blacklist", label: "Чёрный список", icon: Ban, permission: "blacklist.view" },
];

const bottomNav: NavItem[] = [
  { href: "/tasks", label: "Темп", icon: Gauge, permission: "tasks.view" },
  { href: "/settings", label: "Настройки", icon: Settings, permission: "settings.view" },
  { href: "/users", label: "Пользователи", icon: UserCog, permission: "users.view" },
];

export function Sidebar({
  mobile = false,
  open = false,
  onClose,
}: {
  /** На телефоне панель превращается в выдвижное меню поверх контента */
  mobile?: boolean;
  open?: boolean;
  onClose?: () => void;
} = {}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user, can, logout } = useAuth();

  // В мобильном меню сворачивать нечего — оно и так на весь экран
  const isCollapsed = mobile ? false : collapsed;

  function visible(item: NavItem) {
    if (!item.permission) return true;
    return can(item.permission);
  }

  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
    : "?";

  return (
    <>
      {/* Подложка под выдвижным меню */}
      {mobile && (
        <div
          onClick={onClose}
          className={cn(
            "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden",
            open ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        />
      )}

      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-[var(--color-sidebar-border)] transition-all duration-300 ease-out",
          mobile
            ? cn(
                "fixed inset-y-0 left-0 z-50 h-[100dvh] w-[272px] max-w-[85vw] shadow-2xl",
                open ? "translate-x-0" : "-translate-x-full"
              )
            : cn("h-[100dvh]", collapsed ? "w-[76px]" : "w-[248px]")
        )}
        style={{ background: "var(--color-sidebar)" }}
      >
      {/* Логотип */}
      <div className="flex items-center justify-between px-4 pb-4 pt-5 safe-top">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--color-primary)] font-display text-sm font-bold text-[var(--color-on-primary)]">Q</div>
            <span className="font-display text-[15px] font-bold text-[var(--color-sidebar-text)]">QURAL-SAIMAN</span>
          </div>
        )}
        {mobile ? (
          <button onClick={onClose} aria-label="Закрыть меню" className="grid h-9 w-9 place-items-center rounded-md text-[var(--color-sidebar-muted)] transition hover:bg-black/[0.05] hover:text-[var(--color-sidebar-text)]">
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button onClick={() => setCollapsed((c) => !c)} aria-label="Свернуть меню" className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-sidebar-muted)] transition hover:bg-black/[0.05] hover:text-[var(--color-sidebar-text)]">
            <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      {/* Новая аренда */}
      {can("rentals.edit") && (
        <div className="px-3">
          <Link
            href="/rentals/new"
            className={cn(
              "flex items-center gap-2 rounded-[12px] bg-[var(--color-primary)] px-3 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-primary)] transition hover:bg-[var(--color-primary-hover)]",
              isCollapsed && "justify-center px-0"
            )}
          >
            <Plus className="h-4 w-4 shrink-0" />
            {!isCollapsed && "Новая аренда"}
          </Link>
        </div>
      )}

      {/* Навигация */}
      <nav className="mt-5 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <div className="space-y-0.5">
          {mainNav.filter(visible).map((item) => (
            <SidebarLink key={item.href} {...item} active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)} collapsed={isCollapsed} />
          ))}
        </div>
        {secondaryNav.some(visible) && (
          <div>
            {!isCollapsed && <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sidebar-muted)]/70">Разделы</div>}
            <div className="space-y-0.5">
              {secondaryNav.filter(visible).map((item) => (
                <SidebarLink key={item.href} {...item} active={pathname.startsWith(item.href)} collapsed={isCollapsed} />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Низ */}
      <div className="space-y-0.5 border-t border-[var(--color-sidebar-border)] px-3 py-3 safe-bottom">
        {bottomNav.filter(visible).map((item) => (
          <SidebarLink key={item.href} {...item} active={pathname.startsWith(item.href)} collapsed={isCollapsed} />
        ))}

        {/* Профиль + выход */}
        <div className={cn("mt-2 flex items-center gap-2.5 rounded-[12px] px-2.5 py-2 hover:bg-black/[0.04]", isCollapsed && "justify-center px-0")}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-xs font-bold text-[var(--color-primary)]">
            {initials}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-[var(--color-sidebar-text)]">{user?.name}</div>
              <div className="truncate text-[11px] text-[var(--color-sidebar-muted)]">{user?.isAdmin ? "Администратор" : "Менеджер"}</div>
            </div>
          )}
          {!isCollapsed && (
            <button onClick={logout} title="Выйти" className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--color-sidebar-muted)] transition hover:bg-black/[0.06] hover:text-[var(--color-sidebar-text)]">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      </aside>
    </>
  );
}

function SidebarLink({ href, label, icon: Icon, active, collapsed }: {
  href: string; label: string; icon: React.ElementType; active: boolean; collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-[12px] px-3 py-2 text-[13.5px] font-medium transition-colors",
        active ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "text-[var(--color-sidebar-muted)] hover:bg-black/[0.05] hover:text-[var(--color-sidebar-text)]",
        collapsed && "justify-center px-0"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-[var(--color-on-primary)]" : "text-[var(--color-sidebar-muted)] group-hover:text-[var(--color-sidebar-text)]")} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

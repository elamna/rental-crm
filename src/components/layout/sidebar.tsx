"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, Boxes, Users, BarChart3,
  Ban, FileText, Wallet, Wrench, Settings, Plus,
  ChevronsLeft, LogOut, UserCog,
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
  { href: "/analytics", label: "Аналитика", icon: BarChart3, permission: "analytics.view" },
];

const secondaryNav: NavItem[] = [
  { href: "/finance", label: "Финансы", icon: Wallet, permission: "finance.view" },
  { href: "/documents", label: "Документы", icon: FileText, permission: "documents.view" },
  { href: "/blacklist", label: "Чёрный список", icon: Ban, permission: "blacklist.view" },
];

const bottomNav: NavItem[] = [
  { href: "/settings", label: "Настройки", icon: Settings, permission: "settings.view" },
  { href: "/users", label: "Пользователи", icon: UserCog, permission: "users.view" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user, can, logout } = useAuth();

  function visible(item: NavItem) {
    if (!item.permission) return true;
    return can(item.permission);
  }

  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
    : "?";

  return (
    <aside
      className={cn(
        "flex h-screen flex-col shrink-0 transition-all duration-300 ease-out",
        collapsed ? "w-[76px]" : "w-[248px]"
      )}
      style={{ background: "var(--color-sidebar)" }}
    >
      {/* Логотип */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--color-primary)] font-display text-sm font-bold text-white">П</div>
            <span className="font-display text-[15px] font-bold text-white">ПрокатCRM</span>
          </div>
        )}
        <button onClick={() => setCollapsed((c) => !c)} className="grid h-7 w-7 place-items-center rounded-md text-white/40 transition hover:bg-white/10 hover:text-white/80">
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Новая аренда */}
      {can("rentals.edit") && (
        <div className="px-3">
          <Link
            href="/rentals/new"
            className={cn(
              "flex items-center gap-2 rounded-[12px] bg-[var(--color-primary)] px-3 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(109,74,255,0.7)] transition hover:bg-[var(--color-primary-hover)]",
              collapsed && "justify-center px-0"
            )}
          >
            <Plus className="h-4 w-4 shrink-0" />
            {!collapsed && "Новая аренда"}
          </Link>
        </div>
      )}

      {/* Навигация */}
      <nav className="mt-5 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <div className="space-y-0.5">
          {mainNav.filter(visible).map((item) => (
            <SidebarLink key={item.href} {...item} active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)} collapsed={collapsed} />
          ))}
        </div>
        {secondaryNav.some(visible) && (
          <div>
            {!collapsed && <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">Разделы</div>}
            <div className="space-y-0.5">
              {secondaryNav.filter(visible).map((item) => (
                <SidebarLink key={item.href} {...item} active={pathname.startsWith(item.href)} collapsed={collapsed} />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Низ */}
      <div className="border-t border-white/[0.06] px-3 py-3 space-y-0.5">
        {bottomNav.filter(visible).map((item) => (
          <SidebarLink key={item.href} {...item} active={pathname.startsWith(item.href)} collapsed={collapsed} />
        ))}

        {/* Профиль + выход */}
        <div className={cn("mt-2 flex items-center gap-2.5 rounded-[12px] px-2.5 py-2 hover:bg-white/[0.06]", collapsed && "justify-center px-0")}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-xs font-bold text-[var(--color-primary)]">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-white">{user?.name}</div>
              <div className="truncate text-[11px] text-white/40">{user?.isAdmin ? "Администратор" : "Менеджер"}</div>
            </div>
          )}
          {!collapsed && (
            <button onClick={logout} title="Выйти" className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white/30 hover:bg-white/10 hover:text-white/70 transition">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
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
        active ? "bg-[var(--color-primary)] text-white" : "text-white/55 hover:bg-white/[0.07] hover:text-white",
        collapsed && "justify-center px-0"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-white/45 group-hover:text-white/80")} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

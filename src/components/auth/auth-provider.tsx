"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SessionUser, Permission } from "@/lib/types";

interface AuthCtx {
  user: SessionUser | null;
  loading: boolean;
  can: (permission: Permission) => boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, loading: true,
  can: () => false,
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const can = useCallback((permission: Permission): boolean => {
    if (!user) return false;
    if (user.isAdmin) return true;
    return user.permissions.includes(permission);
  }, [user]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  }, [router]);

  return <Ctx.Provider value={{ user, loading, can, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() { return useContext(Ctx); }
export function useCan(permission: Permission) { return useContext(Ctx).can(permission); }

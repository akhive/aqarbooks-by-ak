import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../supabase";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  ready: boolean;
  /** Superuser — can delete anything */
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

function readAdminEmails(): string[] {
  try {
    const raw = (import.meta as any).env?.VITE_ADMIN_EMAILS || "";
    return String(raw)
      .split(",")
      .map((s: string) => s.trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function isUserAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const meta = (user.app_metadata || {}) as Record<string, unknown>;
  const umeta = (user.user_metadata || {}) as Record<string, unknown>;
  const role = String(meta.role || umeta.role || "").toLowerCase();
  if (role === "admin" || role === "superuser" || role === "super") return true;
  const email = (user.email || "").toLowerCase();
  if (email && readAdminEmails().includes(email)) return true;
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setReady(true);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      user: session?.user ?? null,
      ready,
      isAdmin: isUserAdmin(session?.user),
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      session: null,
      user: null,
      ready: true,
      isAdmin: false,
      signOut: async () => {},
    };
  }
  return ctx;
}

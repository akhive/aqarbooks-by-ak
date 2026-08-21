import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  LayoutDashboard,
  Users,
  Banknote,
  DoorOpen,
  FileBarChart2,
  LogOut,
  Save,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "../supabase";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tenants", label: "Tenants", icon: Users },
  { to: "/contracts", label: "Contracts", icon: FileBarChart2 },
  { to: "/cheques", label: "Cheques (PDC)", icon: Banknote },
  { to: "/reconciliation", label: "Bank Reconciliation", icon: FileBarChart2 },
  { to: "/units", label: "Units", icon: DoorOpen },
  { to: "/expenses", label: "Expenses", icon: Banknote },
  { to: "/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/backup", label: "Backup", icon: Save },
  { to: "/banks", label: "Bank names", icon: Building2 },
  { to: "/deposits", label: "Deposits", icon: Banknote },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  // Close menu when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar — only logo + menu button */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="size-5" />
              </span>
              <span className="leading-tight">
                <span className="block text-base font-semibold tracking-tight">Aqar Books</span>
                <span className="block text-xs text-muted-foreground">Built by AK</span>
              </span>
            </Link>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="mr-1 size-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Dark overlay when menu is open */}
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Side menu (hidden by default) */}
      <aside
        className={`fixed top-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-4" />
            </span>
            <span className="text-sm font-semibold">Menu</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <X className="size-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {nav.map(({ to, label, icon: Icon }) => {
              const active =
                to === "/"
                  ? pathname === "/"
                  : pathname === to || pathname.startsWith(`${to}/`);
              return (
                <li key={to}>
                  <Link
                    to={to}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border p-3">
          <Button variant="outline" className="w-full justify-start" onClick={logout}>
            <LogOut className="mr-2 size-4" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

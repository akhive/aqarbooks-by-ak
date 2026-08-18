import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, LayoutDashboard, Users, Banknote, DoorOpen, FileBarChart2, LogOut, Save } from "lucide-react";
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
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-semibold tracking-tight">Aqar Books</span>
              <span className="block text-xs text-muted-foreground">Built by AK</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <nav className="-mx-1 flex gap-1 overflow-x-auto">
              {nav.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  activeOptions={{ exact: to === "/" }}
                  className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-primary/10 text-primary hover:bg-primary/10" }}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
            </nav>
            <Button variant="outline" size="sm" onClick={logout} className="shrink-0">
              <LogOut className="mr-1 size-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>
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

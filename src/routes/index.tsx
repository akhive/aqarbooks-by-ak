import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, CalendarClock, DoorOpen, Wallet } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { currency, daysUntil, fmtDate, useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Estate Manager" },
      {
        name: "description",
        content:
          "Track rental income, expenses, profit trends, upcoming post-dated cheques and vacant units in one place.",
      },
      { property: "og:title", content: "Dashboard — Estate Manager" },
      {
        property: "og:description",
        content: "Rental income, expenses, profit trends, upcoming PDCs and vacant units at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive" ? "text-success" : tone === "negative" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 pt-6">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={`mt-1 text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { data } = useStore();
  const year = new Date().getFullYear();

  const { income, expense, monthly } = useMemo(() => {
    const monthly = MONTHS.map((m) => ({ month: m, income: 0, expense: 0, profit: 0 }));
    let income = 0;
    let expense = 0;
    data.cheques.forEach((c) => {
      const dt = new Date(c.chequeDate);
      if (dt.getFullYear() !== year || c.status === "Bounced") return;
      if (c.status === "Cleared" || c.status === "Deposited") {
        income += c.amount;
        monthly[dt.getMonth()]!.income += c.amount;
      }
    });
    data.expenses.forEach((e) => {
      const dt = new Date(e.date);
      if (dt.getFullYear() !== year) return;
      expense += e.amount;
      monthly[dt.getMonth()]!.expense += e.amount;
    });
    monthly.forEach((m) => (m.profit = m.income - m.expense));
    return { income, expense, monthly };
  }, [data, year]);

  const upcoming = useMemo(
    () =>
      data.cheques
        .filter((c) => c.status === "PDC" && daysUntil(c.chequeDate) >= -3)
        .sort((a, b) => a.chequeDate.localeCompare(b.chequeDate))
        .slice(0, 6),
    [data.cheques],
  );

  const occupied = new Set(data.tenants.filter((t) => t.status !== "Expired").map((t) => t.flatNo));
  const vacant = data.units.filter((u) => !occupied.has(u.flatNo));
  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "Unknown";

  return (
    <AppShell>
      <PageHeader title="Dashboard" description={`Portfolio performance for ${year}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Income (collected)" value={currency(income)} icon={ArrowUpRight} tone="positive" />
        <Stat label="Expenses" value={currency(expense)} icon={ArrowDownRight} tone="negative" />
        <Stat
          label="Net profit"
          value={currency(income - expense)}
          hint={income ? `${Math.round(((income - expense) / income) * 100)}% margin` : undefined}
          icon={Wallet}
        />
        <Stat
          label="Occupancy"
          value={`${data.units.length - vacant.length}/${data.units.length}`}
          hint={`${vacant.length} vacant unit(s)`}
          icon={DoorOpen}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Profit trend</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly} margin={{ left: 4, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={60}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                formatter={(v: number, n: string) => [currency(v), n]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-card)",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#profitFill)"
                name="Profit"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Upcoming PDCs</CardTitle>
            <CalendarClock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming cheques.</p>
            ) : (
              upcoming.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{tenantName(c.tenantId)}</p>
                    <p className="text-xs text-muted-foreground">
                      #{c.chequeNo} · {c.bank} · {fmtDate(c.chequeDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{currency(c.amount)}</p>
                    <p className="text-xs text-muted-foreground">in {daysUntil(c.chequeDate)}d</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Vacant units</CardTitle>
            <DoorOpen className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {vacant.length === 0 ? (
              <p className="text-sm text-muted-foreground">All units are occupied.</p>
            ) : (
              vacant.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">Flat {u.flatNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.building} · {u.type}
                    </p>
                  </div>
                  <Badge variant="secondary">{currency(u.marketRent)}/yr</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

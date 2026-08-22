import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, CalendarClock, DoorOpen, TrendingUp, Wallet } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currency, daysUntil, fmtDate, useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Aqar Books" },
      {
        name: "description",
        content: "Rental income, expenses, occupancy, average rent and trends.",
      },
    ],
  }),
  component: Dashboard,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PIE_COLORS = ["#0f766e", "#2563eb", "#d97706"];

function rentInYear(startDate: string, endDate: string, rent: number, year: number) {
  if (!startDate || !endDate || !rent) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const yStart = new Date(year, 0, 1);
  const yEnd = new Date(year, 11, 31);
  const from = start > yStart ? start : yStart;
  const to = end < yEnd ? end : yEnd;
  if (to < from) return 0;
  const days = Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1;
  return Math.round((rent / 365) * days);
}

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
    tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-destructive" : "text-foreground";
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
  const today = new Date().toISOString().slice(0, 10);

  const { income, expense, monthly } = useMemo(() => {
    const monthly = MONTHS.map((m) => ({ month: m, income: 0, expense: 0, profit: 0 }));
    let income = 0;
    let expense = 0;
    data.cheques.forEach((c) => {
      if (!c.chequeDate) return;
      const dt = new Date(c.chequeDate);
      if (dt.getFullYear() !== year || c.status === "Bounced") return;
      if ((c.kind || "rent") === "deposit") return;
      if (c.status === "Cleared" || c.status === "Deposited") {
        income += c.amount;
        monthly[dt.getMonth()]!.income += c.amount;
      }
    });
    data.expenses.forEach((e) => {
      if (!e.date) return;
      const dt = new Date(e.date);
      if (dt.getFullYear() !== year) return;
      expense += e.amount;
      monthly[dt.getMonth()]!.expense += e.amount;
    });
    monthly.forEach((m) => {
      m.profit = m.income - m.expense;
    });
    return { income, expense, monthly };
  }, [data, year]);

  // Occupancy from ACTIVE contracts covering today
  const { occupiedCount, vacant, totalUnits } = useMemo(() => {
    const occupiedUnitIds = new Set<string>();
    data.contracts.forEach((c) => {
      if ((c.status || "Active") !== "Active") return;
      if (!c.unitId) return;
      if (c.startDate && c.startDate > today) return;
      if (c.endDate && c.endDate < today) return;
      occupiedUnitIds.add(c.unitId);
    });
    const vacant = data.units.filter((u) => !occupiedUnitIds.has(u.id));
    return {
      occupiedCount: occupiedUnitIds.size,
      vacant,
      totalUnits: data.units.length,
    };
  }, [data.contracts, data.units, today]);

  // Average yearly rental = average of active contract annual rents
  const { avgRent, prevAvgRent, hikePct } = useMemo(() => {
    const active = data.contracts.filter((c) => {
      if ((c.status || "Active") !== "Active") return false;
      if (c.startDate && c.startDate > today) return false;
      if (c.endDate && c.endDate < today) return false;
      return true;
    });
    const avgRent =
      active.length > 0 ? Math.round(active.reduce((s, c) => s + (c.rent || 0), 0) / active.length) : 0;

    // Previous year average from contracts that overlapped previous year
    const prevYear = year - 1;
    const prevStart = `${prevYear}-01-01`;
    const prevEnd = `${prevYear}-12-31`;
    const prevContracts = data.contracts.filter((c) => {
      if (!c.startDate || !c.endDate) return false;
      if (c.endDate < prevStart || c.startDate > prevEnd) return false;
      return true;
    });
    const prevAvgRent =
      prevContracts.length > 0
        ? Math.round(prevContracts.reduce((s, c) => s + (c.rent || 0), 0) / prevContracts.length)
        : 0;

    let hikePct: number | null = null;
    if (prevAvgRent > 0 && avgRent > 0) {
      hikePct = Math.round(((avgRent - prevAvgRent) / prevAvgRent) * 1000) / 10; // 1 decimal
    }
    return { avgRent, prevAvgRent, hikePct };
  }, [data.contracts, today, year]);

  // Pie: rent accrual last 3 calendar years (auto rolls: 2024/25/26 → next year 2025/26/27)
  const pieData = useMemo(() => {
    const years = [year - 2, year - 1, year];
    return years.map((y) => {
      let total = 0;
      data.contracts.forEach((c) => {
        total += rentInYear(c.startDate, c.endDate, c.rent, y);
      });
      return { name: String(y), value: total, year: y };
    });
  }, [data.contracts, year]);

  const upcoming = useMemo(
    () =>
      data.cheques
        .filter((c) => c.status === "PDC" && (c.kind || "rent") !== "deposit" && daysUntil(c.chequeDate) >= -3)
        .sort((a, b) => a.chequeDate.localeCompare(b.chequeDate))
        .slice(0, 6),
    [data.cheques],
  );

  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "Unknown";

  const hikeHint =
    hikePct == null
      ? prevAvgRent === 0
        ? "No previous-year average"
        : undefined
      : hikePct >= 0
        ? `${hikePct}% ⬆️ vs ${year - 1}`
        : `${Math.abs(hikePct)}% ⬇️ vs ${year - 1}`;

  return (
    <AppShell>
      <PageHeader title="Dashboard" description={`Portfolio performance for ${year}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
          value={`${occupiedCount}/${totalUnits}`}
          hint={`${vacant.length} vacant unit(s)`}
          icon={DoorOpen}
        />
        <Stat
          label="Average Yearly Rental (AED)"
          value={currency(avgRent)}
          hint={hikeHint}
          icon={TrendingUp}
          tone={hikePct != null && hikePct >= 0 ? "positive" : hikePct != null ? "negative" : "default"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Profit trend ({year})</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.25} />
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Rent by year ({year - 2} / {year - 1} / {year})
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) =>
                    `${name} (${((percent || 0) * 100).toFixed(0)}%)`
                  }
                >
                  {pieData.map((_, i) => (
                    <Cell key={pieData[i].name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => currency(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {pieData.map((p, i) => (
                <div key={p.name} className="flex justify-between">
                  <span style={{ color: PIE_COLORS[i] }}>{p.name}</span>
                  <span className="font-medium text-foreground">{currency(p.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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
              vacant.slice(0, 12).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">Flat {u.flatNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.building || "—"} · {u.bedroomType || "—"}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">{currency(u.marketRent)}/yr</p>
                </div>
              ))
            )}
            {vacant.length > 12 && (
              <p className="text-xs text-muted-foreground">+{vacant.length - 12} more</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

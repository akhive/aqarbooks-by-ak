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
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  DoorOpen,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currency, daysUntil, fmtDate, useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Dashboard — Aqar Books" }],
  }),
  component: Dashboard,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PIE_COLORS = ["#0f766e", "#2563eb", "#d97706"];

function effectiveRent(c: { rent: number; actualRent?: number }) {
  return c.actualRent && c.actualRent > 0 ? c.actualRent : c.rent;
}

function effectiveEnd(c: { endDate: string; endedAt?: string; status?: string }) {
  if (
    (c.status === "Broken" || c.status === "Cancelled" || c.status === "Ended") &&
    c.endedAt
  ) {
    return c.endedAt;
  }
  return c.endDate;
}

/** Accrue rent into calendar year using rent ÷ lease-days */
function rentInYear(startDate: string, endDate: string, rent: number, y: number) {
  if (!startDate || !endDate || !rent) return 0;
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  if (end < start) return 0;
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (totalDays <= 0) return 0;

  const yStart = new Date(y, 0, 1, 12, 0, 0);
  const yEnd = new Date(y, 11, 31, 12, 0, 0);
  const from = start > yStart ? start : yStart;
  const to = end < yEnd ? end : yEnd;
  if (to < from) return 0;
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  return Math.round((rent / totalDays) * days);
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
  const valueClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-red-600"
        : "text-foreground";
  const iconWrap =
    tone === "positive"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "negative"
        ? "bg-red-50 text-red-700"
        : "bg-primary/10 text-primary";

  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 pb-5 pt-5">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={`mt-1 truncate text-2xl font-semibold tracking-tight ${valueClass}`}>{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconWrap}`}>
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

  /**
   * Income (accrual) = this year rent share only (incl. prior deferred into this year)
   * NO penalty / other income
   * Net profit = income − expenses
   */
  const { income, expense, monthly, otherIncome } = useMemo(() => {
    const monthly = MONTHS.map((m) => ({ month: m, income: 0, expense: 0, profit: 0 }));
    let income = 0;       // rent only (for Income card)
    let otherIncome = 0;  // penalty + extra this year
    let expense = 0;

    data.contracts.forEach((c) => {
      if ((c.status || "Active") === "Draft") return;

      const r = effectiveRent(c); // actual if set, else contract rent — for accrual income
      const end = effectiveEnd(c);
      const yearAmt = rentInYear(c.startDate, end, r, year);
      income += yearAmt;

      // monthly chart based on rent accrual
      if (yearAmt > 0 && c.startDate && end) {
        const start = new Date(c.startDate + "T12:00:00");
        const endD = new Date(end + "T12:00:00");
        const totalDays = Math.round((endD.getTime() - start.getTime()) / 86400000) + 1;
        if (totalDays > 0) {
          for (let m = 0; m < 12; m++) {
            const mStart = new Date(year, m, 1, 12, 0, 0);
            const mEnd = new Date(year, m + 1, 0, 12, 0, 0);
            const from = start > mStart ? start : mStart;
            const to = endD < mEnd ? endD : mEnd;
            if (to < from) continue;
            const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
            monthly[m]!.income += Math.round((r / totalDays) * days);
          }
        }
      }

      // penalty + extra in year lease ended (for Net profit only)
      const pen = (c.penalty || 0) + (c.extraCharges || 0);
      if (pen > 0) {
        const endIso = c.endedAt || c.endDate;
        if (endIso && new Date(endIso).getFullYear() === year) {
          otherIncome += pen;
          const m = new Date(endIso).getMonth();
          monthly[m]!.income += pen; // include in profit trend
        }
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
      m.profit = m.income - m.expense; // rent + other − expense per month
    });

    return { income, expense, monthly, otherIncome };
  }, [data, year]);

  const { occupiedCount, vacant, totalUnits } = useMemo(() => {
    const occupiedUnitIds = new Set<string>();
    data.contracts.forEach((c) => {
      if ((c.status || "Active") === "Draft") return;
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

  /**
   * Average Yearly Rental = avg of this-year rent shares
   * Hike % = (totalThis − totalPrev) / totalPrev × 100
   */
  const { avgRent, hikePct } = useMemo(() => {
    let totalThis = 0;
    let totalPrev = 0;
    let countThis = 0;

    data.contracts.forEach((c) => {
      if ((c.status || "Active") === "Draft") return;
      const r = c.rent; // contract rent only — not actualRent
      const end = effectiveEnd(c);

      const amtThis = rentInYear(c.startDate, end, r, year);
      if (amtThis > 0) {
        totalThis += amtThis;
        countThis += 1;
      }
      totalPrev += rentInYear(c.startDate, end, r, year - 1);
    });

    const avgRent = countThis > 0 ? Math.round(totalThis / countThis) : 0;

    let hikePct: number | null = null;
    if (totalPrev > 0) {
      hikePct = Math.round(((totalThis - totalPrev) / totalPrev) * 1000) / 10;
    }

    return { avgRent, hikePct };
  }, [data.contracts, year]);

  const pieData = useMemo(() => {
    const years = [year - 2, year - 1, year];
    return years.map((y) => {
      let total = 0;
      data.contracts.forEach((c) => {
        if ((c.status || "Active") === "Draft") return;
        total += rentInYear(c.startDate, effectiveEnd(c), effectiveRent(c), y);
      });
      return { name: String(y), value: total };
    });
  }, [data.contracts, year]);

  const upcoming = useMemo(
    () =>
      data.cheques
        .filter((c) => {
          if (c.status !== "PDC") return false;
          if ((c.kind || "rent") === "deposit") return false;
          const contract = data.contracts.find((x) => x.id === c.contractId);
          if (contract && contract.status === "Draft") return false;
          const d = daysUntil(c.chequeDate);
          return d >= -3 && d <= 120;
        })
        .sort((a, b) => a.chequeDate.localeCompare(b.chequeDate))
        .slice(0, 10),
    [data.cheques, data.contracts],
  );

  const upcomingRenewals = useMemo(
    () =>
      data.contracts
        .filter((c) => {
          if ((c.status || "Active") === "Draft") return false;
          if ((c.status || "Active") !== "Active") return false;
          if (!c.endDate) return false;
          const d = daysUntil(c.endDate);
          return d >= 0 && d <= 120;
        })
        .sort((a, b) => a.endDate.localeCompare(b.endDate))
        .slice(0, 10),
    [data.contracts],
  );

  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "Unknown";

  const hikeHint =
    hikePct == null
      ? "No previous-year total"
      : hikePct >= 0
        ? `${hikePct}% ⬆️ vs ${year - 1} total`
        : `${Math.abs(hikePct)}% ⬇️ vs ${year - 1} total`;

  const profit = income - expense;

  return (
    <AppShell>
      <PageHeader title="Dashboard" description={`Accrual performance for ${year}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat
          label="Income (accrual)"
          value={currency(income)}
          hint="This year rent share (incl. prior deferred)"
          icon={ArrowUpRight}
          tone="positive"
        />
        <Stat label="Expenses" value={currency(expense)} icon={ArrowDownRight} tone="negative" />
        <Stat
          label="Net profit"
          value={currency(profit)}
          hint={
            otherIncome > 0
              ? `Rent + penalty/extra ${currency(otherIncome)} − expenses`
              : "This-year rent + penalty/extra − expenses"
          }
          icon={Wallet}
          tone={profit >= 0 ? "positive" : "negative"}
        />
        <Stat
          label="Occupancy"
          value={`${occupiedCount}/${totalUnits}`}
          hint={`${vacant.length} vacant unit(s)`}
          icon={DoorOpen}
          tone={occupiedCount > 0 ? "positive" : "default"}
        />
        <Stat
          label="Average Yearly Rental (AED)"
          value={currency(avgRent)}
          hint={hikeHint}
          icon={TrendingUp}
          tone={hikePct == null ? "default" : hikePct >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="border-border/80 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Profit trend ({year})</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f766e" stopOpacity={0.85} />
                    <stop offset="55%" stopColor="#0f766e" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#0f766e" stopOpacity={0.15} />
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
                  stroke="#0f766e"
                  strokeWidth={3}
                  fill="url(#profitFill)"
                  fillOpacity={1}
                  name="Profit"
                  isAnimationActive={true}
                  animationBegin={0}
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Rent by year ({year - 2} / {year - 1} / {year})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    label={false}
                    isAnimationActive={true}
                    animationBegin={200}
                    animationDuration={1000}
                    animationEasing="ease-out"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={pieData[i].name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => currency(v)} />
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 space-y-1.5 border-t pt-3">
              {pieData.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    {p.name}
                  </span>
                  <span className="font-medium">{currency(p.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Upcoming PDCs (120 days)</CardTitle>
            <CalendarClock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No PDCs in the next 120 days.</p>
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

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Upcoming renewals</CardTitle>
            <CalendarClock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingRenewals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No renewals in the next 120 days.</p>
            ) : (
              upcomingRenewals.map((c) => {
                const unit = data.units.find((u) => u.id === c.unitId);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {c.leaseNo || "—"} · {tenantName(c.tenantId)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Flat {unit?.flatNo || "—"} · ends {fmtDate(c.endDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{currency(c.rent)}</p>
                      <p className="text-xs text-muted-foreground">in {daysUntil(c.endDate)}d</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  Maximize2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { currency, daysUntil, fmtDate, useStore } from "@/lib/store";
import { APP_VERSION, APP_VERSION_LABEL, loadVersionMeta } from "@/lib/version";

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

function localToday() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  palette = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  tone?: "default" | "positive" | "negative";
  palette?: "emerald" | "rose" | "teal" | "blue" | "amber" | "violet" | "slate";
}) {
  const skins: Record<string, { card: string; value: string; icon: string }> = {
    emerald: {
      card: "border-emerald-300 bg-gradient-to-br from-emerald-50 to-white shadow-sm",
      value: "text-emerald-700",
      icon: "bg-emerald-500 text-white",
    },
    rose: {
      card: "border-rose-300 bg-gradient-to-br from-rose-50 to-white shadow-sm",
      value: "text-rose-700",
      icon: "bg-rose-500 text-white",
    },
    teal: {
      card: "border-teal-300 bg-gradient-to-br from-teal-50 to-white shadow-sm",
      value: "text-teal-800",
      icon: "bg-teal-500 text-white",
    },
    blue: {
      card: "border-blue-300 bg-gradient-to-br from-blue-50 to-white shadow-sm",
      value: "text-blue-800",
      icon: "bg-blue-500 text-white",
    },
    amber: {
      card: "border-amber-300 bg-gradient-to-br from-amber-50 to-white shadow-sm",
      value: "text-amber-800",
      icon: "bg-amber-500 text-white",
    },
    violet: {
      card: "border-violet-300 bg-gradient-to-br from-violet-50 to-white shadow-sm",
      value: "text-violet-800",
      icon: "bg-violet-500 text-white",
    },
    slate: {
      card: "border-slate-300 bg-gradient-to-br from-slate-50 to-white shadow-sm",
      value: "text-slate-800",
      icon: "bg-slate-600 text-white",
    },
  };
  const skin = skins[palette] || skins.slate;
  const valueClass =
    tone === "negative" ? "text-rose-700" : tone === "positive" ? skin.value : skin.value;

  return (
    <Card className={`border-2 ${skin.card}`}>
      <CardContent className="flex items-start justify-between gap-3 pb-5 pt-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <p className={`mt-1 truncate text-xl font-semibold tracking-tight ${valueClass}`}>
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${skin.icon}`}>
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { data } = useStore();
  const year = new Date().getFullYear();
  const today = localToday();
  const [listModal, setListModal] = useState<
    null | "pdc" | "renewals" | "expired" | "vacant"
  >(null);

  const { income, expense, otherIncome, incomePrev } = useMemo(() => {
    let income = 0;
    let incomePrev = 0;
    let otherIncome = 0;
    let expense = 0;

    data.contracts.forEach((c) => {
      if ((c.status || "Active") === "Draft") return;
      const r = effectiveRent(c);
      const end = effectiveEnd(c);
      income += rentInYear(c.startDate, end, r, year);
      incomePrev += rentInYear(c.startDate, end, r, year - 1);

      const pen = (c.penalty || 0) + (c.extraCharges || 0);
      if (pen > 0) {
        const endIso = c.endedAt || c.endDate;
        if (endIso && new Date(endIso).getFullYear() === year) {
          otherIncome += pen;
        }
      }
    });

    data.expenses.forEach((e) => {
      if (!e.date) return;
      if (new Date(e.date).getFullYear() !== year) return;
      expense += e.amount;
    });

    return { income, expense, otherIncome, incomePrev };
  }, [data, year]);

  const profit = income + otherIncome - expense;

  const monthly = useMemo(() => {
    const rows = MONTHS.map((m) => ({ month: m, income: 0, expense: 0, profit: 0 }));

    data.cheques.forEach((c) => {
      if ((c.kind || "rent") === "deposit") return;
      if (c.status !== "Cleared" && c.status !== "Deposited") return;
      const dateStr = c.clearedDate || c.chequeDate;
      if (!dateStr) return;
      const dt = new Date(dateStr);
      if (dt.getFullYear() !== year) return;
      const contract = data.contracts.find((x) => x.id === c.contractId);
      if (contract && contract.status === "Draft") return;
      rows[dt.getMonth()]!.income += c.amount || 0;
    });

    data.expenses.forEach((e) => {
      if (!e.date) return;
      const dt = new Date(e.date);
      if (dt.getFullYear() !== year) return;
      rows[dt.getMonth()]!.expense += e.amount;
    });

    rows.forEach((m) => {
      m.profit = m.income - m.expense;
    });

    return rows;
  }, [data.cheques, data.contracts, data.expenses, year]);

  const { occupiedCount, vacant, totalUnits, coveringToday, activeLeaseCount } = useMemo(() => {
    // Occupied = status Active or Draft (user has not End/Vacate/Cancel/Broken)
    // Period ended by date but still Active = still occupied (renewal delayed)
    const holding = data.contracts.filter((c) => {
      const st = (c.status || "Active").trim();
      return st === "Active" || st === "Draft";
    });

    const statusActive = holding.filter((c) => (c.status || "Active").trim() === "Active");

    const covering = statusActive.filter((c) => {
      if (c.startDate && c.startDate > today) return false;
      if (c.endDate && c.endDate < today) return false;
      return true;
    });

    const occupiedUnitIds = new Set(
      holding.map((c) => c.unitId).filter(Boolean) as string[],
    );

    const vacantList = data.units.filter((u) => !occupiedUnitIds.has(u.id));

    return {
      occupiedCount: occupiedUnitIds.size,
      vacant: vacantList,
      totalUnits: data.units.length,
      coveringToday: covering.length,
      activeLeaseCount: statusActive.length,
    };
  }, [data.contracts, data.units, today]);

  const yoyChange = income - incomePrev;
  const hikePct =
    incomePrev > 0 ? Math.round((yoyChange / incomePrev) * 1000) / 10 : null;

  const rentalHint =
    hikePct == null
      ? "No previous-year income"
      : hikePct >= 0
        ? `${hikePct}% ⬆️ vs ${year - 1}`
        : `${Math.abs(hikePct)}% ⬇️ vs ${year - 1}`;

  const pieData = useMemo(() => {
    const years = [year - 1, year, year + 1];
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
        .sort((a, b) => a.chequeDate.localeCompare(b.chequeDate)),
    [data.cheques, data.contracts],
  );

  const upcomingRenewals = useMemo(
    () =>
      data.contracts
        .filter((c) => {
          if ((c.status || "Active") !== "Active") return false;
          if (!c.endDate) return false;
          const d = daysUntil(c.endDate);
          return d >= 0 && d <= 120;
        })
        .sort((a, b) => a.endDate.localeCompare(b.endDate)),
    [data.contracts],
  );

  const expiredContracts = useMemo(
    () =>
      data.contracts
        .filter((c) => {
          if ((c.status || "Active") !== "Active") return false;
          if (!c.endDate || c.endDate > today) return false;
          return true;
        })
        .sort((a, b) => (b.endDate || "").localeCompare(a.endDate || "")),
    [data.contracts, today],
  );

  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "Unknown";

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description={`Accrual performance for ${year} · App ${APP_VERSION}`}
        action={
          <Link
            to="/backup"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Backup & versions
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat
          label="Income"
          value={currency(income)}
          hint=""
          icon={ArrowUpRight}
          tone="positive"
          palette="emerald"
        />
        <Stat
          label="Expenses"
          value={currency(expense)}
          icon={ArrowDownRight}
          tone="negative"
          palette="rose"
        />
        <Stat
          label="Net profit"
          value={currency(profit)}
          hint={
            otherIncome > 0
              ? `Includes penalty/extra ${currency(otherIncome)}`
              : undefined
          }
          icon={Wallet}
          tone={profit >= 0 ? "positive" : "negative"}
          palette={profit >= 0 ? "emerald" : "emerald"}
        />
        <Stat
          label="Occupancy"
          value={`${occupiedCount}/${totalUnits}`}
          icon={DoorOpen}
          tone={occupiedCount > 0 ? "positive" : "default"}
          palette="emerald"
        />
        <Stat
          label="Average Yearly Rental (AED)"
          value={currency(yoyChange)}
          hint={rentalHint}
          icon={TrendingUp}
          tone={yoyChange >= 0 ? "positive" : "negative"}
          palette="emerald"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/80 to-white shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">PDC received trend ({year})</CardTitle>
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
                  name="Received − expense"
                  isAnimationActive
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Rent by year ({year - 1} / {year} / {year + 1})
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
                    isAnimationActive
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

      {/* Four equal cards — fixed height + scroll */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="flex flex-col border-2 border-emerald-300 bg-gradient-to-br from-sky-50 to-white shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base text-emerald-900">Upcoming PDCs (120 days)</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 text-emerald-700 hover:bg-emerald-100"
                title="Maximize"
                onClick={() => setListModal("pdc")}
              >
                <Maximize2 className="size-4" />
              </Button>
              <CalendarClock className="size-4 shrink-0 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="h-72 space-y-2 overflow-y-auto pt-0">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No PDCs in the next 120 days.</p>
            ) : (
              upcoming.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white/80 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{tenantName(c.tenantId)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      #{c.chequeNo} · {c.bank} · {fmtDate(c.chequeDate)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">{currency(c.amount)}</p>
                    <p className="text-xs text-muted-foreground">in {daysUntil(c.chequeDate)}d</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base text-emerald-900">Upcoming renewals</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 text-emerald-700 hover:bg-emerald-100"
                title="Maximize"
                onClick={() => setListModal("renewals")}
              >
                <Maximize2 className="size-4" />
              </Button>
              <CalendarClock className="size-4 shrink-0 text-violet-600" />
            </div>
          </CardHeader>
          <CardContent className="h-72 space-y-2 overflow-y-auto pt-0">
            {upcomingRenewals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No renewals in the next 120 days.</p>
            ) : (
              upcomingRenewals.map((c) => {
                const unit = data.units.find((u) => u.id === c.unitId);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white/80 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.leaseNo || "—"} · {tenantName(c.tenantId)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        Flat {unit?.flatNo || "—"} · ends {fmtDate(c.endDate)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{currency(c.rent)}</p>
                      <p className="text-xs text-muted-foreground">in {daysUntil(c.endDate)}d</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-white shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base text-rose-900">Expired contracts</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 text-rose-700 hover:bg-rose-100"
                title="Maximize"
                onClick={() => setListModal("expired")}
              >
                <Maximize2 className="size-4" />
              </Button>
              <CalendarClock className="size-4 shrink-0 text-rose-600" />
            </div>
          </CardHeader>
          <CardContent className="h-72 space-y-2 overflow-y-auto pt-0">
            {expiredContracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expired contracts.</p>
            ) : (
              expiredContracts.map((c) => {
                const unit = data.units.find((u) => u.id === c.unitId);
                const overdue = daysUntil(c.endDate);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-white/80 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.leaseNo || "—"} · {tenantName(c.tenantId)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        Flat {unit?.flatNo || "—"} · ended {fmtDate(c.endDate)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{currency(c.rent)}</p>
                      <p className="text-xs text-red-600">
                        {overdue === 0 ? "Ends today" : `${Math.abs(overdue)}d overdue`}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base text-emerald-900">Vacant units</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 text-emerald-700 hover:bg-emerald-100"
                title="Maximize"
                onClick={() => setListModal("vacant")}
              >
                <Maximize2 className="size-4" />
              </Button>
              <DoorOpen className="size-4 shrink-0 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="h-72 space-y-2 overflow-y-auto pt-0">
            {vacant.length === 0 ? (
              <p className="text-sm text-muted-foreground">All units are occupied.</p>
            ) : (
              vacant.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white/80 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">Flat {u.flatNo}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.building || "—"} · {u.bedroomType || "—"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm text-muted-foreground">
                    {currency(u.marketRent)}/yr
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={listModal !== null} onOpenChange={(o) => !o && setListModal(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>
              {listModal === "pdc" && `Upcoming PDCs (${upcoming.length})`}
              {listModal === "renewals" && `Upcoming renewals (${upcomingRenewals.length})`}
              {listModal === "expired" && `Expired contracts (${expiredContracts.length})`}
              {listModal === "vacant" && `Vacant units (${vacant.length})`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto p-4">
            {listModal === "pdc" &&
              (upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No PDCs in the next 120 days.</p>
              ) : (
                upcoming.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2"
                  >
                    <div className="min-w-0 break-words">
                      <p className="text-sm font-medium">{tenantName(c.tenantId)}</p>
                      <p className="text-xs text-muted-foreground">
                        #{c.chequeNo} · {c.bank} · {fmtDate(c.chequeDate)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{currency(c.amount)}</p>
                      <p className="text-xs text-muted-foreground">in {daysUntil(c.chequeDate)}d</p>
                    </div>
                  </div>
                ))
              ))}

            {listModal === "renewals" &&
              (upcomingRenewals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No renewals in the next 120 days.</p>
              ) : (
                upcomingRenewals.map((c) => {
                  const unit = data.units.find((u) => u.id === c.unitId);
                  return (
                    <div
                      key={c.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2"
                    >
                      <div className="min-w-0 break-words">
                        <p className="text-sm font-medium">
                          {c.leaseNo || "—"} · {tenantName(c.tenantId)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Flat {unit?.flatNo || "—"} · ends {fmtDate(c.endDate)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">{currency(c.rent)}</p>
                        <p className="text-xs text-muted-foreground">in {daysUntil(c.endDate)}d</p>
                      </div>
                    </div>
                  );
                })
              ))}

            {listModal === "expired" &&
              (expiredContracts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expired contracts.</p>
              ) : (
                expiredContracts.map((c) => {
                  const unit = data.units.find((u) => u.id === c.unitId);
                  const overdue = daysUntil(c.endDate);
                  return (
                    <div
                      key={c.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50/50 px-3 py-2"
                    >
                      <div className="min-w-0 break-words">
                        <p className="text-sm font-medium">
                          {c.leaseNo || "—"} · {tenantName(c.tenantId)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Flat {unit?.flatNo || "—"} · ended {fmtDate(c.endDate)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">{currency(c.rent)}</p>
                        <p className="text-xs text-red-600">
                          {overdue === 0 ? "Ends today" : `${Math.abs(overdue)}d overdue`}
                        </p>
                      </div>
                    </div>
                  );
                })
              ))}

            {listModal === "vacant" &&
              (vacant.length === 0 ? (
                <p className="text-sm text-muted-foreground">All units occupied.</p>
              ) : (
                vacant.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2"
                  >
                    <div className="min-w-0 break-words">
                      <p className="text-sm font-medium">Flat {u.flatNo}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.building || "—"} · {u.bedroomType || "—"}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm text-muted-foreground">
                      {currency(u.marketRent)}/yr
                    </p>
                  </div>
                ))
              ))}
          </div>
        </DialogContent>
      </Dialog>

    </AppShell>
  );
}

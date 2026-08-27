import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, daysUntil, fmtDate, useStore } from "@/lib/store";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [{ title: "Reports — Aqar Books" }],
  }),
  component: ReportsPage,
});

function splitByYear(startDate: string, endDate: string, rent: number) {
  if (!startDate || !endDate || !rent) return {} as Record<number, number>;
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  if (end < start) return {};
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (totalDays <= 0) return {};
  const daily = rent / totalDays;
  const result: Record<number, number> = {};
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    const yStart = new Date(y, 0, 1, 12, 0, 0);
    const yEnd = new Date(y, 11, 31, 12, 0, 0);
    const from = start > yStart ? start : yStart;
    const to = end < yEnd ? end : yEnd;
    if (to < from) continue;
    const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    result[y] = Math.round(daily * days);
  }
  return result;
}

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

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportActions({ onExport }: { onExport: () => void }) {
  return (
    <div className="flex flex-wrap gap-2 no-print">
      <Button variant="outline" size="sm" onClick={onExport}>
        <Download className="mr-2 h-4 w-4" />
        Export Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" />
        Print / PDF
      </Button>
    </div>
  );
}

function LeaseLink({ id, leaseNo }: { id: string; leaseNo?: string }) {
  if (!id) return <span>{leaseNo || "—"}</span>;
  return (
    <Link
      to="/contract/$contractId"
      params={{ contractId: id }}
      className="font-medium text-primary underline-offset-2 hover:underline"
    >
      {leaseNo || "—"}
    </Link>
  );
}

function ReportsPage() {
  const { data } = useStore();
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const year = now.getFullYear();
  const prevYear = year - 1;

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");
  const [flatSearch, setFlatSearch] = useState("");
  const [leaseSort, setLeaseSort] = useState<"asc" | "desc">("asc");
  const [incomeSort, setIncomeSort] = useState<"asc" | "desc">("asc");
  const [pdcSort, setPdcSort] = useState<"asc" | "desc">("asc");
  const [depositSort, setDepositSort] = useState<"asc" | "desc">("asc");
  const [includeExpiredInRenewals, setIncludeExpiredInRenewals] = useState(false);

  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "—";
  const unitLabel = (id: string) => {
    const u = data.units.find((x) => x.id === id);
    return u ? `${u.flatNo}${u.building ? ` — ${u.building}` : ""}` : "—";
  };

  const matchTenantFlat = (tenantId: string, unitId?: string) => {
    const tq = tenantSearch.trim().toLowerCase();
    const fq = flatSearch.trim().toLowerCase();
    if (tq) {
      const name = (data.tenants.find((t) => t.id === tenantId)?.name || "").toLowerCase();
      if (!name.includes(tq)) return false;
    }
    if (fq) {
      const flat = (data.units.find((u) => u.id === unitId)?.flatNo || "").toLowerCase();
      if (!flat.includes(fq)) return false;
    }
    return true;
  };

  const periodLabel =
    from || to ? `${from ? fmtDate(from) : "…"} → ${to ? fmtDate(to) : "…"}` : "All periods";

  const leaseRows = useMemo(() => {
    const rows = data.contracts.filter((c) => {
      if ((c.status || "Active") === "Draft") return false;
      if (from && c.endDate < from) return false;
      if (to && c.startDate > to) return false;
      if (!matchTenantFlat(c.tenantId, c.unitId)) return false;
      return true;
    });
    return [...rows].sort((a, b) => {
      const an = a.leaseNo || "";
      const bn = b.leaseNo || "";
      return leaseSort === "asc"
        ? an.localeCompare(bn, undefined, { numeric: true })
        : bn.localeCompare(an, undefined, { numeric: true });
    });
  }, [data.contracts, data.tenants, data.units, from, to, tenantSearch, flatSearch, leaseSort]);

  const leaseTotal = leaseRows.reduce((s, c) => s + effectiveRent(c), 0);

  const incomeRows = useMemo(() => {
    const rows = data.contracts
      .filter((c) => {
        if ((c.status || "Active") === "Draft") return false;
        if (from && c.endDate < from) return false;
        if (to && c.startDate > to) return false;
        if (!matchTenantFlat(c.tenantId, c.unitId)) return false;
        return true;
      })
      .map((c) => {
        const byYear = splitByYear(c.startDate, effectiveEnd(c), effectiveRent(c));
        const previous = byYear[prevYear] || 0;
        const current = byYear[year] || 0;
        let deferred = 0;
        Object.entries(byYear).forEach(([y, amt]) => {
          if (Number(y) > year) deferred += amt;
        });
        return { ...c, previous, current, deferred, total: effectiveRent(c) };
      });
    return [...rows].sort((a, b) => {
      const an = a.leaseNo || "";
      const bn = b.leaseNo || "";
      return incomeSort === "asc"
        ? an.localeCompare(bn, undefined, { numeric: true })
        : bn.localeCompare(an, undefined, { numeric: true });
    });
  }, [
    data.contracts,
    data.tenants,
    data.units,
    year,
    prevYear,
    from,
    to,
    tenantSearch,
    flatSearch,
    incomeSort,
  ]);

  const incomeTotals = useMemo(
    () => ({
      previous: incomeRows.reduce((s, r) => s + (r.previous || 0), 0),
      current: incomeRows.reduce((s, r) => s + (r.current || 0), 0),
      deferred: incomeRows.reduce((s, r) => s + (r.deferred || 0), 0),
      total: incomeRows.reduce((s, r) => s + (r.total || 0), 0),
    }),
    [incomeRows],
  );

  const upcoming = useMemo(() => {
    const rows = data.cheques.filter((c) => {
      if (c.status !== "PDC") return false;
      if ((c.kind || "rent") === "deposit") return false;
      if (from && c.chequeDate < from) return false;
      if (to && c.chequeDate > to) return false;
      const contract = data.contracts.find((x) => x.id === c.contractId);
      if (contract && contract.status === "Draft") return false;
      if (!matchTenantFlat(c.tenantId, contract?.unitId)) return false;
      return true;
    });
    return [...rows].sort((a, b) =>
      pdcSort === "asc"
        ? (a.chequeDate || "").localeCompare(b.chequeDate || "")
        : (b.chequeDate || "").localeCompare(a.chequeDate || ""),
    );
  }, [data.cheques, data.contracts, data.tenants, data.units, from, to, tenantSearch, flatSearch, pdcSort]);

  const pdcTotal = useMemo(
    () => upcoming.reduce((s, c) => s + (c.amount || 0), 0),
    [upcoming],
  );

  const yearly = useMemo(() => {
    const map = new Map<number, { income: number; expense: number }>();

    data.contracts.forEach((c) => {
      if ((c.status || "Active") === "Draft") return;
      if (!matchTenantFlat(c.tenantId, c.unitId)) return;

      const byYear = splitByYear(c.startDate, effectiveEnd(c), effectiveRent(c));
      Object.entries(byYear).forEach(([y, amt]) => {
        const yr = Number(y);
        if (from && `${yr}-12-31` < from) return;
        if (to && `${yr}-01-01` > to) return;
        const row = map.get(yr) ?? { income: 0, expense: 0 };
        row.income += amt;
        map.set(yr, row);
      });

      const other = (c.penalty || 0) + (c.extraCharges || 0);
      if (other > 0) {
        const endIso = c.endedAt || c.endDate;
        if (endIso) {
          const yr = new Date(endIso).getFullYear();
          if (!(from && `${yr}-12-31` < from) && !(to && `${yr}-01-01` > to)) {
            const row = map.get(yr) ?? { income: 0, expense: 0 };
            row.income += other;
            map.set(yr, row);
          }
        }
      }
    });

    data.expenses.forEach((e) => {
      if (!e.date) return;
      if (from && e.date < from) return;
      if (to && e.date > to) return;
      const y = new Date(e.date).getFullYear();
      const row = map.get(y) ?? { income: 0, expense: 0 };
      row.expense += e.amount;
      map.set(y, row);
    });

    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [data.contracts, data.expenses, data.tenants, data.units, from, to, tenantSearch, flatSearch]);

  const profitTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    yearly.forEach(([, r]) => {
      income += r.income;
      expense += r.expense;
    });
    return { income, expense, profit: income - expense };
  }, [yearly]);

  /** Upcoming renewals: Active, end in 0–120 days. Optional: also Active + end ≤ today */
  const renewals = useMemo(() => {
    const rows = data.contracts.filter((c) => {
      if ((c.status || "Active") !== "Active") return false;
      if (!c.endDate) return false;
      if (!matchTenantFlat(c.tenantId, c.unitId)) return false;
      if (from && c.endDate < from) return false;
      if (to && c.endDate > to) return false;

      const d = daysUntil(c.endDate);
      const isUpcoming = d >= 0 && d <= 120;
      const isExpired = c.endDate <= today;

      if (includeExpiredInRenewals) {
        return isUpcoming || isExpired;
      }
      return isUpcoming;
    });

    return [...rows].sort((a, b) => a.endDate.localeCompare(b.endDate));
  }, [
    data.contracts,
    data.tenants,
    data.units,
    from,
    to,
    tenantSearch,
    flatSearch,
    today,
    includeExpiredInRenewals,
  ]);

  /** Expired tab: Active only + end ≤ today (not Broken/Cancelled/Ended) */
  const expired = useMemo(
    () =>
      data.contracts
        .filter((c) => {
          if ((c.status || "Active") !== "Active") return false;
          if (!c.endDate || c.endDate > today) return false;
          if (from && c.endDate < from) return false;
          if (to && c.endDate > to) return false;
          if (!matchTenantFlat(c.tenantId, c.unitId)) return false;
          return true;
        })
        .sort((a, b) => (b.endDate || "").localeCompare(a.endDate || "")),
    [data.contracts, data.tenants, data.units, today, from, to, tenantSearch, flatSearch],
  );

  const vacant = useMemo(() => {
    const occupied = new Set(
      data.contracts
        .filter(
          (c) =>
            (c.status || "Active") === "Active" &&
            c.startDate <= today &&
            c.endDate >= today,
        )
        .map((c) => c.unitId)
        .filter(Boolean),
    );
    const fq = flatSearch.trim().toLowerCase();
    return data.units.filter((u) => {
      if (occupied.has(u.id)) return false;
      if (fq && !(u.flatNo || "").toLowerCase().includes(fq)) return false;
      return true;
    });
  }, [data.units, data.contracts, today, flatSearch]);

  const depositRows = useMemo(() => {
    const rows = data.cheques
      .filter((c) => c.kind === "deposit")
      .map((c) => {
        const contract = data.contracts.find((x) => x.id === c.contractId);
        return {
          id: c.id,
          contractId: c.contractId || "",
          leaseNo: contract?.leaseNo || "",
          tenantId: c.tenantId || contract?.tenantId || "",
          unitId: contract?.unitId || "",
          startDate: contract?.startDate || "",
          endDate: contract?.endDate || "",
          chequeNo: c.chequeNo || "",
          bank: c.bank || "",
          depositAmount: c.amount || 0,
        };
      })
      .filter((r) => {
        if (from && r.endDate && r.endDate < from) return false;
        if (to && r.startDate && r.startDate > to) return false;
        if (!matchTenantFlat(r.tenantId, r.unitId)) return false;
        return true;
      });

    return [...rows].sort((a, b) => {
      const an = a.leaseNo || "";
      const bn = b.leaseNo || "";
      return depositSort === "asc"
        ? an.localeCompare(bn, undefined, { numeric: true })
        : bn.localeCompare(an, undefined, { numeric: true });
    });
  }, [data.cheques, data.contracts, data.tenants, data.units, from, to, tenantSearch, flatSearch, depositSort]);

  const depositTotal = depositRows.reduce((s, r) => s + r.depositAmount, 0);

  const otherIncomeRows = useMemo(() => {
    return data.contracts
      .filter((c) => {
        const p = c.penalty || 0;
        const e = c.extraCharges || 0;
        if (p <= 0 && e <= 0) return false;
        if (from && c.endedAt && c.endedAt < from) return false;
        if (to && c.endedAt && c.endedAt > to) return false;
        if (!matchTenantFlat(c.tenantId, c.unitId)) return false;
        return true;
      })
      .map((c) => {
        const penalty = c.penalty || 0;
        const otherIncome = c.extraCharges || 0;
        return { ...c, penalty, otherIncome, total: penalty + otherIncome };
      })
      .sort((a, b) => (b.endedAt || b.endDate || "").localeCompare(a.endedAt || a.endDate || ""));
  }, [data.contracts, data.tenants, data.units, from, to, tenantSearch, flatSearch]);

  const otherIncomeTotals = useMemo(
    () =>
      otherIncomeRows.reduce(
        (acc, r) => ({
          penalty: acc.penalty + r.penalty,
          otherIncome: acc.otherIncome + r.otherIncome,
          total: acc.total + r.total,
        }),
        { penalty: 0, otherIncome: 0, total: 0 },
      ),
    [otherIncomeRows],
  );

  return (
    <AppShell>
      <div className="print-only mb-6 hidden border-b pb-4 print:block">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            AK
          </div>
          <div>
            <h1 className="text-xl font-bold">Report</h1>
            <p className="text-sm text-muted-foreground">Period: {periodLabel}</p>
            <p className="text-xs text-muted-foreground">Aqar Books — Built by AK</p>
          </div>
        </div>
      </div>

      <div className="no-print">
        <PageHeader
          title="Reports"
          description="Actual rent used when set · Period / tenant / flat filters"
        />
      </div>

      <Card className="mb-4 no-print">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <Label>From Date</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To Date</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="w-full max-w-[200px]">
            <Label>Tenant</Label>
            <Input
              placeholder="Search tenant"
              value={tenantSearch}
              onChange={(e) => setTenantSearch(e.target.value)}
            />
          </div>
          <div className="w-full max-w-[140px]">
            <Label>Flat No.</Label>
            <Input
              placeholder="e.g. 101"
              value={flatSearch}
              onChange={(e) => setFlatSearch(e.target.value)}
            />
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setFrom("");
              setTo("");
              setTenantSearch("");
              setFlatSearch("");
            }}
          >
            Clear
          </Button>
          <p className="w-full text-xs text-muted-foreground">Active period: {periodLabel}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="lease" className="space-y-4">
        <TabsList className="no-print flex h-auto flex-wrap gap-1">
          <TabsTrigger value="lease">Lease report</TabsTrigger>
          <TabsTrigger value="income">Income breakdown</TabsTrigger>
          <TabsTrigger value="pdc">Upcoming PDCs</TabsTrigger>
          <TabsTrigger value="profit">Yearly profit</TabsTrigger>
          <TabsTrigger value="renewal">Contract renewals</TabsTrigger>
          <TabsTrigger value="expired">Expired contracts</TabsTrigger>
          <TabsTrigger value="vacant">Vacant units</TabsTrigger>
          <TabsTrigger value="deposit">Deposits</TabsTrigger>
          <TabsTrigger value="other-income">Other incomes</TabsTrigger>
        </TabsList>

        <TabsContent value="lease">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Lease report</CardTitle>
                <CardDescription>{leaseRows.length} lease(s)</CardDescription>
              </div>
              <ReportActions
                onExport={() =>
                  exportCSV(
                    `lease_report.csv`,
                    ["Lease No", "Tenant", "Unit", "Start", "End", "Rent", "Actual Rent"],
                    leaseRows.map((c) => [
                      c.leaseNo,
                      tenantName(c.tenantId),
                      unitLabel(c.unitId),
                      c.startDate,
                      effectiveEnd(c),
                      c.rent,
                      effectiveRent(c),
                    ]),
                  )
                }
              />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        className="font-medium hover:underline"
                        onClick={() => setLeaseSort((s) => (s === "asc" ? "desc" : "asc"))}
                      >
                        Lease No {leaseSort === "asc" ? "↑" : "↓"}
                      </button>
                    </TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="text-right">Rent</TableHead>
                    <TableHead className="text-right">Actual rent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaseRows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <LeaseLink id={c.id} leaseNo={c.leaseNo} />
                      </TableCell>
                      <TableCell>{tenantName(c.tenantId)}</TableCell>
                      <TableCell>{unitLabel(c.unitId)}</TableCell>
                      <TableCell>{fmtDate(c.startDate)}</TableCell>
                      <TableCell>{fmtDate(effectiveEnd(c))}</TableCell>
                      <TableCell className="text-right">{currency(c.rent)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {currency(effectiveRent(c))}
                      </TableCell>
                    </TableRow>
                  ))}
                  {leaseRows.length > 0 && (
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell colSpan={6}>TOTAL (actual rent)</TableCell>
                      <TableCell className="text-right">{currency(leaseTotal)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Income breakdown</CardTitle>
                <CardDescription>
                  Based on actual rent · {prevYear} · {year} · Deferred
                </CardDescription>
              </div>
              <ReportActions
                onExport={() =>
                  exportCSV(
                    `income_breakdown.csv`,
                    ["Lease No", "Tenant", "Actual Rent", String(prevYear), String(year), "Deferred"],
                    incomeRows.map((r) => [
                      r.leaseNo,
                      tenantName(r.tenantId),
                      r.total,
                      r.previous,
                      r.current,
                      r.deferred,
                    ]),
                  )
                }
              />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        className="font-medium hover:underline"
                        onClick={() => setIncomeSort((s) => (s === "asc" ? "desc" : "asc"))}
                      >
                        Lease No {incomeSort === "asc" ? "↑" : "↓"}
                      </button>
                    </TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Actual rent</TableHead>
                    <TableHead className="text-right">{prevYear}</TableHead>
                    <TableHead className="text-right">{year}</TableHead>
                    <TableHead className="text-right">Deferred</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <LeaseLink id={r.id} leaseNo={r.leaseNo} />
                      </TableCell>
                      <TableCell>{tenantName(r.tenantId)}</TableCell>
                      <TableCell>
                        {fmtDate(r.startDate)} → {fmtDate(effectiveEnd(r))}
                      </TableCell>
                      <TableCell className="text-right">{currency(r.total)}</TableCell>
                      <TableCell className="text-right">{currency(r.previous)}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {currency(r.current)}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        {currency(r.deferred)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {incomeRows.length > 0 && (
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell colSpan={3}>TOTAL</TableCell>
                      <TableCell className="text-right">{currency(incomeTotals.total)}</TableCell>
                      <TableCell className="text-right">{currency(incomeTotals.previous)}</TableCell>
                      <TableCell className="text-right">{currency(incomeTotals.current)}</TableCell>
                      <TableCell className="text-right">{currency(incomeTotals.deferred)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdc">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Upcoming PDCs</CardTitle>
                <CardDescription>{upcoming.length} cheque(s)</CardDescription>
              </div>
              <ReportActions
                onExport={() =>
                  exportCSV(
                    `upcoming_pdcs.csv`,
                    ["Date", "Tenant", "Cheque No", "Bank", "Amount", "Due Days"],
                    upcoming.map((c) => [
                      c.chequeDate,
                      tenantName(c.tenantId),
                      c.chequeNo,
                      c.bank,
                      c.amount,
                      daysUntil(c.chequeDate),
                    ]),
                  )
                }
              />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        className="font-medium hover:underline"
                        onClick={() => setPdcSort((s) => (s === "asc" ? "desc" : "asc"))}
                      >
                        Date {pdcSort === "asc" ? "↑" : "↓"}
                      </button>
                    </TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Cheque no.</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Due in</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcoming.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{fmtDate(c.chequeDate)}</TableCell>
                      <TableCell className="font-medium">{tenantName(c.tenantId)}</TableCell>
                      <TableCell>{c.chequeNo || "—"}</TableCell>
                      <TableCell>{c.bank || "—"}</TableCell>
                      <TableCell className="text-right">{currency(c.amount)}</TableCell>
                      <TableCell className="text-right">{daysUntil(c.chequeDate)} days</TableCell>
                    </TableRow>
                  ))}
                  {upcoming.length > 0 && (
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell colSpan={4}>TOTAL</TableCell>
                      <TableCell className="text-right">{currency(pdcTotal)}</TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profit">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Yearly profit</CardTitle>
                <CardDescription>
                  Actual rent + penalty + extra charges − expenses
                </CardDescription>
              </div>
              <ReportActions
                onExport={() =>
                  exportCSV(
                    `yearly_profit.csv`,
                    ["Year", "Income", "Expense", "Profit"],
                    yearly.map(([y, r]) => [y, r.income, r.expense, r.income - r.expense]),
                  )
                }
              />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead className="text-right">Income</TableHead>
                    <TableHead className="text-right">Expense</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearly.map(([y, r]) => (
                    <TableRow key={y}>
                      <TableCell className="font-medium">{y}</TableCell>
                      <TableCell className="text-right">{currency(r.income)}</TableCell>
                      <TableCell className="text-right text-red-600">{currency(r.expense)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {currency(r.income - r.expense)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {yearly.length > 0 && (
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">{currency(profitTotals.income)}</TableCell>
                      <TableCell className="text-right text-red-600">
                        {currency(profitTotals.expense)}
                      </TableCell>
                      <TableCell className="text-right">{currency(profitTotals.profit)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RENEWALS + include expired checkbox */}
        <TabsContent value="renewal">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Contract renewals</CardTitle>
                <CardDescription>
                  Active · ending within 120 days
                  {includeExpiredInRenewals ? " + expired (Active, period ended)" : ""} ·{" "}
                  {renewals.length}
                </CardDescription>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm no-print">
                  <input
                    type="checkbox"
                    className="size-4 rounded border"
                    checked={includeExpiredInRenewals}
                    onChange={(e) => setIncludeExpiredInRenewals(e.target.checked)}
                  />
                  Include expired contracts (Active, end date ≤ today)
                </label>
              </div>
              <ReportActions
                onExport={() =>
                  exportCSV(
                    `contract_renewals.csv`,
                    ["Lease No", "Tenant", "Unit", "End Date", "Rent", "Days Left", "Note"],
                    renewals.map((c) => {
                      const d = daysUntil(c.endDate);
                      const note = d < 0 ? "Expired" : "Upcoming";
                      return [
                        c.leaseNo,
                        tenantName(c.tenantId),
                        unitLabel(c.unitId),
                        c.endDate,
                        c.rent,
                        d,
                        note,
                      ];
                    }),
                  )
                }
              />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lease No</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="text-right">Rent</TableHead>
                    <TableHead className="text-right">Days left</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renewals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No matching contracts.
                      </TableCell>
                    </TableRow>
                  )}
                  {renewals.map((c) => {
                    const d = daysUntil(c.endDate);
                    const expiredRow = d < 0 || c.endDate <= today;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <LeaseLink id={c.id} leaseNo={c.leaseNo} />
                        </TableCell>
                        <TableCell>{tenantName(c.tenantId)}</TableCell>
                        <TableCell>{unitLabel(c.unitId)}</TableCell>
                        <TableCell>{fmtDate(c.endDate)}</TableCell>
                        <TableCell className="text-right">{currency(c.rent)}</TableCell>
                        <TableCell
                          className={`text-right ${expiredRow ? "text-red-600" : ""}`}
                        >
                          {expiredRow
                            ? d === 0
                              ? "Ends today"
                              : `${Math.abs(d)}d overdue`
                            : `${d} days`}
                        </TableCell>
                        <TableCell>
                          {expiredRow ? (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                              Expired
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                              Upcoming
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expired">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Expired contracts</CardTitle>
                <CardDescription>
                  Status Active · period ended on or before today · {expired.length}
                  <span className="block text-xs">
                    Broken / Cancelled / Ended are not listed here — see Status on the lease
                  </span>
                </CardDescription>
              </div>
              <ReportActions
                onExport={() =>
                  exportCSV(
                    `expired_contracts.csv`,
                    ["Lease No", "Tenant", "Unit", "Start", "End", "Rent", "Days overdue"],
                    expired.map((c) => [
                      c.leaseNo,
                      tenantName(c.tenantId),
                      unitLabel(c.unitId),
                      c.startDate,
                      c.endDate,
                      c.rent,
                      Math.abs(Math.min(0, daysUntil(c.endDate))),
                    ]),
                  )
                }
              />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lease No</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Rent</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expired.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No expired Active contracts.
                      </TableCell>
                    </TableRow>
                  )}
                  {expired.map((c) => {
                    const overdue = daysUntil(c.endDate);
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <LeaseLink id={c.id} leaseNo={c.leaseNo} />
                        </TableCell>
                        <TableCell>{tenantName(c.tenantId)}</TableCell>
                        <TableCell>{unitLabel(c.unitId)}</TableCell>
                        <TableCell>{fmtDate(c.startDate)}</TableCell>
                        <TableCell>{fmtDate(c.endDate)}</TableCell>
                        <TableCell>Active</TableCell>
                        <TableCell className="text-right">{currency(c.rent)}</TableCell>
                        <TableCell className="text-right text-red-600">
                          {overdue === 0 ? "Ends today" : `${Math.abs(overdue)} days`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vacant">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Vacant units</CardTitle>
                <CardDescription>{vacant.length} unit(s)</CardDescription>
              </div>
              <ReportActions
                onExport={() =>
                  exportCSV(
                    `vacant_units.csv`,
                    ["Flat", "Building", "Type", "Market Rent"],
                    vacant.map((u) => [u.flatNo, u.building || "", u.bedroomType || "", u.marketRent || 0]),
                  )
                }
              />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Flat</TableHead>
                    <TableHead>Building</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Market rent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vacant.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.flatNo}</TableCell>
                      <TableCell>{u.building || "—"}</TableCell>
                      <TableCell>{u.bedroomType || "—"}</TableCell>
                      <TableCell className="text-right">{currency(u.marketRent || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deposit">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Deposits</CardTitle>
                <CardDescription>{depositRows.length} deposit cheque(s)</CardDescription>
              </div>
              <ReportActions
                onExport={() =>
                  exportCSV(
                    `deposits.csv`,
                    ["Lease No", "Tenant", "Unit", "Start", "End", "Cheque No", "Bank", "Amount"],
                    depositRows.map((r) => [
                      r.leaseNo,
                      tenantName(r.tenantId),
                      unitLabel(r.unitId),
                      r.startDate,
                      r.endDate,
                      r.chequeNo,
                      r.bank,
                      r.depositAmount,
                    ]),
                  )
                }
              />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        className="font-medium hover:underline"
                        onClick={() => setDepositSort((s) => (s === "asc" ? "desc" : "asc"))}
                      >
                        Lease No {depositSort === "asc" ? "↑" : "↓"}
                      </button>
                    </TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Cheque no.</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Deposit Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {depositRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No deposit cheques match filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {depositRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.contractId ? (
                          <LeaseLink id={r.contractId} leaseNo={r.leaseNo} />
                        ) : (
                          r.leaseNo || "—"
                        )}
                      </TableCell>
                      <TableCell>{tenantName(r.tenantId)}</TableCell>
                      <TableCell>{unitLabel(r.unitId)}</TableCell>
                      <TableCell>{fmtDate(r.startDate)}</TableCell>
                      <TableCell>{fmtDate(r.endDate)}</TableCell>
                      <TableCell>{r.chequeNo || "—"}</TableCell>
                      <TableCell>{r.bank || "—"}</TableCell>
                      <TableCell className="text-right">{currency(r.depositAmount)}</TableCell>
                    </TableRow>
                  ))}
                  {depositRows.length > 0 && (
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell colSpan={7}>TOTAL</TableCell>
                      <TableCell className="text-right">{currency(depositTotal)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="other-income">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Other incomes</CardTitle>
                <CardDescription>Penalty + extra charges from break/cancel</CardDescription>
              </div>
              <ReportActions
                onExport={() =>
                  exportCSV(
                    `other_incomes.csv`,
                    ["Lease No", "Tenant", "Period", "Penalty", "Other", "Total"],
                    otherIncomeRows.map((r) => [
                      r.leaseNo,
                      tenantName(r.tenantId),
                      `${r.startDate} → ${r.endDate}`,
                      r.penalty,
                      r.otherIncome,
                      r.total,
                    ]),
                  )
                }
              />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lease No</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Penalty</TableHead>
                    <TableHead className="text-right">Other income</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otherIncomeRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No penalty / extra charges yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {otherIncomeRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <LeaseLink id={r.id} leaseNo={r.leaseNo} />
                      </TableCell>
                      <TableCell>{tenantName(r.tenantId)}</TableCell>
                      <TableCell>
                        {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
                        {r.endedAt ? (
                          <span className="block text-xs text-muted-foreground">
                            Ended {fmtDate(r.endedAt)} · {r.status}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">{currency(r.penalty)}</TableCell>
                      <TableCell className="text-right">{currency(r.otherIncome)}</TableCell>
                      <TableCell className="text-right font-medium">{currency(r.total)}</TableCell>
                    </TableRow>
                  ))}
                  {otherIncomeRows.length > 0 && (
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell colSpan={3}>TOTAL</TableCell>
                      <TableCell className="text-right">
                        {currency(otherIncomeTotals.penalty)}
                      </TableCell>
                      <TableCell className="text-right">
                        {currency(otherIncomeTotals.otherIncome)}
                      </TableCell>
                      <TableCell className="text-right">
                        {currency(otherIncomeTotals.total)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          header, nav, aside { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </AppShell>
  );
}

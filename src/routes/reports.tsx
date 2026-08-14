import { createFileRoute } from "@tanstack/react-router";
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
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daily = rent / 365;
  const result: Record<number, number> = {};
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    const yStart = new Date(y, 0, 1);
    const yEnd = new Date(y, 11, 31);
    const from = start > yStart ? start : yStart;
    const to = end < yEnd ? end : yEnd;
    if (to < from) continue;
    const days = Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1;
    result[y] = Math.round(daily * days);
  }
  return result;
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

function ReportActions({
  title,
  period,
  onExport,
}: {
  title: string;
  period?: string;
  onExport: () => void;
}) {
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

function ReportsPage() {
  const { data } = useStore();
  const today = new Date().toISOString().slice(0, 10);
  const year = new Date().getFullYear();
  const prevYear = year - 1;

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Sorting state (inside component)
  const [leaseSort, setLeaseSort] = useState<"asc" | "desc">("asc");
  const [incomeSort, setIncomeSort] = useState<"asc" | "desc">("asc");
  const [pdcSort, setPdcSort] = useState<"asc" | "desc">("asc");

  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "—";
  const unitLabel = (id: string) => {
    const u = data.units.find((x) => x.id === id);
    return u ? `${u.flatNo}${u.building ? ` — ${u.building}` : ""}` : "—";
  };

  const periodLabel =
    from || to ? `${from ? fmtDate(from) : "…"} → ${to ? fmtDate(to) : "…"}` : "All periods";

  // Lease report
  const leaseRows = useMemo(() => {
    const rows = data.contracts.filter((c) => {
      if (from && c.endDate < from) return false;
      if (to && c.startDate > to) return false;
      return true;
    });
    return rows.sort((a, b) => {
      const an = a.leaseNo || "";
      const bn = b.leaseNo || "";
      return leaseSort === "asc"
        ? an.localeCompare(bn, undefined, { numeric: true })
        : bn.localeCompare(an, undefined, { numeric: true });
    });
  }, [data.contracts, from, to, leaseSort]);

  const leaseTotal = leaseRows.reduce((s, c) => s + c.rent, 0);

  // Income breakdown
  const incomeRows = useMemo(() => {
    const rows = data.contracts
      .filter((c) => {
        if (from && c.endDate < from) return false;
        if (to && c.startDate > to) return false;
        return true;
      })
      .map((c) => {
        const byYear = splitByYear(c.startDate, c.endDate, c.rent);
        const previous = byYear[prevYear] || 0;
        const current = byYear[year] || 0;
        let deferred = 0;
        Object.entries(byYear).forEach(([y, amt]) => {
          if (Number(y) > year) deferred += amt;
        });
        return { ...c, previous, current, deferred, total: c.rent };
      });
    return rows.sort((a, b) => {
      const an = a.leaseNo || "";
      const bn = b.leaseNo || "";
      return incomeSort === "asc"
        ? an.localeCompare(bn, undefined, { numeric: true })
        : bn.localeCompare(an, undefined, { numeric: true });
    });
  }, [data.contracts, year, prevYear, from, to, incomeSort]);

  const incomeTotals = useMemo(
    () =>
      incomeRows.reduce(
        (s, r) => ({
          previous: s.previous + r.previous,
          current: s.current + r.current,
          deferred: s.deferred + r.deferred,
          total: s.total + r.total,
        }),
        { previous: 0, current: 0, deferred: 0, total: 0 },
      ),
    [incomeRows],
  );

  // Upcoming PDCs
  const upcoming = useMemo(() => {
    const rows = data.cheques.filter((c) => {
      if (c.status !== "PDC") return false;
      if (from && c.chequeDate < from) return false;
      if (to && c.chequeDate > to) return false;
      return true;
    });
    return rows.sort((a, b) =>
      pdcSort === "asc"
        ? a.chequeDate.localeCompare(b.chequeDate)
        : b.chequeDate.localeCompare(a.chequeDate),
    );
  }, [data.cheques, from, to, pdcSort]);

  // Yearly profit
  const yearly = useMemo(() => {
    const map = new Map<number, { income: number; expense: number }>();
    data.contracts.forEach((c) => {
      const byYear = splitByYear(c.startDate, c.endDate, c.rent);
      Object.entries(byYear).forEach(([y, amt]) => {
        const yr = Number(y);
        if (from && `${yr}-12-31` < from) return;
        if (to && `${yr}-01-01` > to) return;
        const row = map.get(yr) ?? { income: 0, expense: 0 };
        row.income += amt;
        map.set(yr, row);
      });
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
  }, [data.contracts, data.expenses, from, to]);

  // Renewals
  const renewals = useMemo(
    () =>
      data.contracts
        .filter((c) => {
          const d = daysUntil(c.endDate);
          if (d < 0 || d > 120) return false;
          if (from && c.endDate < from) return false;
          if (to && c.endDate > to) return false;
          return true;
        })
        .sort((a, b) => a.endDate.localeCompare(b.endDate)),
    [data.contracts, from, to],
  );

  // Vacant
  const vacant = useMemo(() => {
    const occupiedUnitIds = new Set(
      data.contracts
        .filter((c) => c.startDate <= today && c.endDate >= today)
        .map((c) => c.unitId)
        .filter(Boolean),
    );
    return data.units.filter((u) => !occupiedUnitIds.has(u.id));
  }, [data.units, data.contracts, today]);

  return (
    <AppShell>
      {/* Print header */}
      <div className="print-only hidden print:block mb-6 border-b pb-4">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
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
          description="All reports with period filter, sorting, Excel export and Print/PDF"
        />
      </div>

      {/* Global period filter */}
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
          <Button
            variant="ghost"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Clear period
          </Button>
          <p className="text-sm text-muted-foreground self-center">
            Active period: <strong>{periodLabel}</strong>
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="lease">
        <TabsList className="flex-wrap no-print">
          <TabsTrigger value="lease">Lease report</TabsTrigger>
          <TabsTrigger value="income">Income breakdown</TabsTrigger>
          <TabsTrigger value="pdc">Upcoming PDCs</TabsTrigger>
          <TabsTrigger value="profit">Yearly profit</TabsTrigger>
          <TabsTrigger value="renewal">Contract renewals</TabsTrigger>
          <TabsTrigger value="vacant">Vacant units</TabsTrigger>
        </TabsList>

        {/* LEASE REPORT */}
        <TabsContent value="lease">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Lease report</CardTitle>
                <CardDescription>
                  {leaseRows.length} contract(s) · Total rent {currency(leaseTotal)}
                </CardDescription>
              </div>
              <ReportActions
                title="Lease Report"
                period={periodLabel}
                onExport={() =>
                  exportCSV(
                    `lease_report.csv`,
                    ["Lease No", "Tenant", "Unit", "Start", "End", "Rent"],
                    leaseRows.map((c) => [
                      c.leaseNo,
                      tenantName(c.tenantId),
                      unitLabel(c.unitId),
                      c.startDate,
                      c.endDate,
                      c.rent,
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
                        className="flex items-center gap-1 font-medium hover:underline"
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaseRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No contracts in this period.
                      </TableCell>
                    </TableRow>
                  )}
                  {leaseRows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.leaseNo || "—"}</TableCell>
                      <TableCell>{tenantName(c.tenantId)}</TableCell>
                      <TableCell>{unitLabel(c.unitId)}</TableCell>
                      <TableCell>{fmtDate(c.startDate)}</TableCell>
                      <TableCell>{fmtDate(c.endDate)}</TableCell>
                      <TableCell className="text-right">{currency(c.rent)}</TableCell>
                    </TableRow>
                  ))}
                  {leaseRows.length > 0 && (
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell colSpan={5}>TOTAL</TableCell>
                      <TableCell className="text-right">{currency(leaseTotal)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INCOME BREAKDOWN */}
        <TabsContent value="income">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Income breakdown</CardTitle>
                <CardDescription>
                  {prevYear} · {year} (current) · Deferred
                </CardDescription>
              </div>
              <ReportActions
                title="Income Breakdown"
                period={periodLabel}
                onExport={() =>
                  exportCSV(
                    `income_breakdown.csv`,
                    ["Lease No", "Tenant", "Total Rent", String(prevYear), String(year), "Deferred"],
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
                        className="flex items-center gap-1 font-medium hover:underline"
                        onClick={() => setIncomeSort((s) => (s === "asc" ? "desc" : "asc"))}
                      >
                        Lease No {incomeSort === "asc" ? "↑" : "↓"}
                      </button>
                    </TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Total Rent</TableHead>
                    <TableHead className="text-right">{prevYear}</TableHead>
                    <TableHead className="text-right">{year}</TableHead>
                    <TableHead className="text-right">Deferred</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.leaseNo || "—"}</TableCell>
                      <TableCell>{tenantName(r.tenantId)}</TableCell>
                      <TableCell>
                        {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
                      </TableCell>
                      <TableCell className="text-right">{currency(r.total)}</TableCell>
                      <TableCell className="text-right">{currency(r.previous)}</TableCell>
                      <TableCell className="text-right text-emerald-600 font-medium">
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
                      <TableCell className="text-right text-emerald-600">
                        {currency(incomeTotals.current)}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        {currency(incomeTotals.deferred)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PDCs */}
        <TabsContent value="pdc">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Upcoming PDCs</CardTitle>
                <CardDescription>
                  {upcoming.length} cheque(s) ·{" "}
                  {currency(upcoming.reduce((s, c) => s + c.amount, 0))}
                </CardDescription>
              </div>
              <ReportActions
                title="Upcoming PDCs"
                period={periodLabel}
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
                        className="flex items-center gap-1 font-medium hover:underline"
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
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Yearly profit */}
        <TabsContent value="profit">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Yearly profit</CardTitle>
                <CardDescription>Contract revenue − Expenses</CardDescription>
              </div>
              <ReportActions
                title="Yearly Profit"
                period={periodLabel}
                onExport={() =>
                  exportCSV(
                    `yearly_profit.csv`,
                    ["Year", "Income", "Expenses", "Profit", "Margin %"],
                    yearly.map(([yr, r]) => {
                      const profit = r.income - r.expense;
                      const margin = r.income ? Math.round((profit / r.income) * 100) : 0;
                      return [yr, r.income, r.expense, profit, margin];
                    }),
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
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearly.map(([yr, r]) => {
                    const profit = r.income - r.expense;
                    return (
                      <TableRow key={yr}>
                        <TableCell className="font-medium">
                          {yr}
                          {yr === year ? " (current)" : ""}
                        </TableCell>
                        <TableCell className="text-right">{currency(r.income)}</TableCell>
                        <TableCell className="text-right">{currency(r.expense)}</TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            profit >= 0 ? "text-emerald-600" : "text-destructive"
                          }`}
                        >
                          {currency(profit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.income ? `${Math.round((profit / r.income) * 100)}%` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Renewals */}
        <TabsContent value="renewal">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Contract renewals (≤ 120 days)</CardTitle>
                <CardDescription>{renewals.length} contract(s)</CardDescription>
              </div>
              <ReportActions
                title="Contract Renewals"
                period={periodLabel}
                onExport={() =>
                  exportCSV(
                    `contract_renewals.csv`,
                    ["Lease No", "Tenant", "Unit", "End Date", "Rent", "Days Left"],
                    renewals.map((c) => [
                      c.leaseNo,
                      tenantName(c.tenantId),
                      unitLabel(c.unitId),
                      c.endDate,
                      c.rent,
                      daysUntil(c.endDate),
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
                    <TableHead>End Date</TableHead>
                    <TableHead>Rent</TableHead>
                    <TableHead className="text-right">Days left</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renewals.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.leaseNo || "—"}</TableCell>
                      <TableCell>{tenantName(c.tenantId)}</TableCell>
                      <TableCell>{unitLabel(c.unitId)}</TableCell>
                      <TableCell>{fmtDate(c.endDate)}</TableCell>
                      <TableCell>{currency(c.rent)}</TableCell>
                      <TableCell className="text-right">{daysUntil(c.endDate)} days</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vacant */}
        <TabsContent value="vacant">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Vacant units</CardTitle>
                <CardDescription>{vacant.length} unit(s) with no active contract</CardDescription>
              </div>
              <ReportActions
                title="Vacant Units"
                period={periodLabel}
                onExport={() =>
                  exportCSV(
                    `vacant_units.csv`,
                    ["Flat", "Building", "Bedroom Type", "Market Rent"],
                    vacant.map((u) => [u.flatNo, u.building, u.bedroomType, u.marketRent]),
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
                    <TableHead>Bedroom Type</TableHead>
                    <TableHead className="text-right">Market Rent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vacant.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.flatNo}</TableCell>
                      <TableCell>{u.building || "—"}</TableCell>
                      <TableCell>{u.bedroomType || "—"}</TableCell>
                      <TableCell className="text-right">{currency(u.marketRent)}</TableCell>
                    </TableRow>
                  ))}
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
          header, nav { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </AppShell>
  );
}

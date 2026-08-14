import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, daysUntil, fmtDate, useStore } from "@/lib/store";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [{ title: "Reports — Estate Manager" }],
  }),
  component: ReportsPage,
});

/** Split a contract rent across calendar years */
function splitByYear(startDate: string, endDate: string, rent: number) {
  if (!startDate || !endDate || !rent) return {} as Record<number, number>;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const daily = rent / 365;
  const result: Record<number, number> = {};

  const startY = start.getFullYear();
  const endY = end.getFullYear();

  for (let y = startY; y <= endY; y++) {
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

function ReportsPage() {
  const { data } = useStore();
  const today = new Date().toISOString().slice(0, 10);
  const year = new Date().getFullYear();
  const prevYear = year - 1;
  const nextYear = year + 1;

  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "—";
  const unitLabel = (id: string) => {
    const u = data.units.find((x) => x.id === id);
    return u ? `${u.flatNo}${u.building ? ` — ${u.building}` : ""}` : "—";
  };

  // Upcoming PDCs
  const upcoming = useMemo(
    () =>
      data.cheques
        .filter((c) => c.status === "PDC")
        .sort((a, b) => a.chequeDate.localeCompare(b.chequeDate)),
    [data.cheques],
  );

  // Income breakdown per contract
  const incomeRows = useMemo(() => {
    return data.contracts.map((c) => {
      const byYear = splitByYear(c.startDate, c.endDate, c.rent);
      const previous = byYear[prevYear] || 0;
      const current = byYear[year] || 0;
      // deferred = everything after current year
      let deferred = 0;
      Object.entries(byYear).forEach(([y, amt]) => {
        if (Number(y) > year) deferred += amt;
      });
      return {
        ...c,
        previous,
        current,
        deferred,
        total: c.rent,
      };
    });
  }, [data.contracts, year, prevYear]);

  const incomeTotals = useMemo(() => {
    return incomeRows.reduce(
      (s, r) => ({
        previous: s.previous + r.previous,
        current: s.current + r.current,
        deferred: s.deferred + r.deferred,
        total: s.total + r.total,
      }),
      { previous: 0, current: 0, deferred: 0, total: 0 },
    );
  }, [incomeRows]);

  // Yearly profit (current-year revenue - expenses)
  const yearly = useMemo(() => {
    const map = new Map<number, { income: number; expense: number }>();

    data.contracts.forEach((c) => {
      const byYear = splitByYear(c.startDate, c.endDate, c.rent);
      Object.entries(byYear).forEach(([y, amt]) => {
        const yr = Number(y);
        const row = map.get(yr) ?? { income: 0, expense: 0 };
        row.income += amt;
        map.set(yr, row);
      });
    });

    data.expenses.forEach((e) => {
      if (!e.date) return;
      const y = new Date(e.date).getFullYear();
      const row = map.get(y) ?? { income: 0, expense: 0 };
      row.expense += e.amount;
      map.set(y, row);
    });

    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [data.contracts, data.expenses]);

  // Renewals within 120 days
  const renewals = useMemo(
    () =>
      data.contracts
        .filter((c) => {
          const d = daysUntil(c.endDate);
          return d >= 0 && d <= 120;
        })
        .sort((a, b) => a.endDate.localeCompare(b.endDate)),
    [data.contracts],
  );

  // Vacant units
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
      <PageHeader
        title="Reports"
        description="PDCs · Income breakdown · Yearly profit · Renewals · Vacant units"
      />

      <Tabs defaultValue="income">
        <TabsList className="flex-wrap">
          <TabsTrigger value="income">Income breakdown</TabsTrigger>
          <TabsTrigger value="pdc">Upcoming PDCs</TabsTrigger>
          <TabsTrigger value="profit">Yearly profit</TabsTrigger>
          <TabsTrigger value="renewal">Contract renewals</TabsTrigger>
          <TabsTrigger value="vacant">Vacant units</TabsTrigger>
        </TabsList>

        {/* NEW: Income breakdown */}
        <TabsContent value="income">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Income breakdown (from Contracts)
              </CardTitle>
              <CardDescription>
                {prevYear} (previous) · {year} (current) · {nextYear}+ (deferred)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lease No</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Total Rent</TableHead>
                    <TableHead className="text-right">{prevYear}</TableHead>
                    <TableHead className="text-right">{year} (Current)</TableHead>
                    <TableHead className="text-right">Deferred</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No contracts yet. Add contracts to see income split.
                      </TableCell>
                    </TableRow>
                  )}
                  {incomeRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.leaseNo || "—"}</TableCell>
                      <TableCell>{tenantName(r.tenantId)}</TableCell>
                      <TableCell>{unitLabel(r.unitId)}</TableCell>
                      <TableCell>
                        {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
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
                      <TableCell colSpan={4}>TOTAL</TableCell>
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

        {/* PDC */}
        <TabsContent value="pdc">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming post-dated cheques</CardTitle>
              <CardDescription>
                {upcoming.length} cheque(s) · {currency(upcoming.reduce((s, c) => s + c.amount, 0))}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Cheque no.</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Due in</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcoming.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No upcoming PDCs.
                      </TableCell>
                    </TableRow>
                  )}
                  {upcoming.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{fmtDate(c.chequeDate)}</TableCell>
                      <TableCell className="font-medium">{tenantName(c.tenantId)}</TableCell>
                      <TableCell>{c.chequeNo || "—"}</TableCell>
                      <TableCell>{c.bank || "—"}</TableCell>
                      <TableCell className="text-right">{currency(c.amount)}</TableCell>
                      <TableCell
                        className={`text-right ${daysUntil(c.chequeDate) < 0 ? "text-destructive" : ""}`}
                      >
                        {daysUntil(c.chequeDate)} days
                      </TableCell>
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
            <CardHeader>
              <CardTitle className="text-base">Yearly profit</CardTitle>
              <CardDescription>
                Income from contract revenue per year − Expenses
              </CardDescription>
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
                  {yearly.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No data yet.
                      </TableCell>
                    </TableRow>
                  )}
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
            <CardHeader>
              <CardTitle className="text-base">Contract renewals (next 120 days)</CardTitle>
              <CardDescription>{renewals.length} contract(s) ending soon</CardDescription>
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
                  {renewals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No renewals in the next 120 days.
                      </TableCell>
                    </TableRow>
                  )}
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
            <CardHeader>
              <CardTitle className="text-base">Vacant units</CardTitle>
              <CardDescription>
                {vacant.length} unit(s) with no active contract today
              </CardDescription>
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
                  {vacant.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        All units are occupied.
                      </TableCell>
                    </TableRow>
                  )}
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
    </AppShell>
  );
}

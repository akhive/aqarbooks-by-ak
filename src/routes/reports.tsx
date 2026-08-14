import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calcRevenue, currency, daysUntil, fmtDate, useStore } from "@/lib/store";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [{ title: "Reports — Estate Manager" }],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data } = useStore();
  const today = new Date().toISOString().slice(0, 10);
  const year = new Date().getFullYear();

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

  // Yearly profit based on Contract Current-Year Revenue + Expenses
  const yearly = useMemo(() => {
    const map = new Map<number, { income: number; expense: number }>();

    // Income = sum of currentYear revenue from each contract
    data.contracts.forEach((c) => {
      const { currentYear } = calcRevenue(c.startDate, c.endDate, c.rent);
      // Attribute currentYear amount to the calendar year of the contract start
      // and also handle multi-year by using the year we're reporting
      const startY = new Date(c.startDate).getFullYear();
      const endY = new Date(c.endDate).getFullYear();
      for (let y = startY; y <= endY; y++) {
        const yStart = `${y}-01-01`;
        const yEnd = `${y}-12-31`;
        // days of this contract inside year y
        const from = c.startDate > yStart ? c.startDate : yStart;
        const to = c.endDate < yEnd ? c.endDate : yEnd;
        if (to < from) continue;
        const days =
          Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
        const amount = Math.round((c.rent / 365) * days);
        const row = map.get(y) ?? { income: 0, expense: 0 };
        row.income += amount;
        map.set(y, row);
      }
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

  // Contract renewals within 120 days
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

  // Vacant units = no active contract covering today
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
        description="PDCs · Yearly profit (from contracts) · Renewals · Vacant units"
      />

      <Tabs defaultValue="pdc">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pdc">Upcoming PDCs</TabsTrigger>
          <TabsTrigger value="profit">Yearly profit</TabsTrigger>
          <TabsTrigger value="renewal">Contract renewals</TabsTrigger>
          <TabsTrigger value="vacant">Vacant units</TabsTrigger>
        </TabsList>

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
                Income = Current-year revenue from contracts (deferred excluded) − Expenses
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead className="text-right">Income (Revenue)</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearly.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No contract or expense data yet.
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
              <CardDescription>
                {renewals.length} contract(s) ending soon
              </CardDescription>
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

        {/* Vacant units */}
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

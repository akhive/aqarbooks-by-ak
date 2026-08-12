import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, daysUntil, fmtDate, useStore } from "@/lib/store";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Estate Manager" },
      {
        name: "description",
        content:
          "Upcoming PDCs, yearly profit, contracts due for renewal, vacant units and bank reconciliation in one report centre.",
      },
      { property: "og:title", content: "Reports — Estate Manager" },
      {
        property: "og:description",
        content: "PDC schedule, yearly profit, renewals, vacancies and bank reconciliation.",
      },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data, toggleReconciled } = useStore();
  const year = new Date().getFullYear();
  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "—";

  const upcoming = useMemo(
    () =>
      data.cheques
        .filter((c) => c.status === "PDC")
        .sort((a, b) => a.chequeDate.localeCompare(b.chequeDate)),
    [data.cheques],
  );

  const yearly = useMemo(() => {
    const years = new Map<number, { income: number; expense: number }>();
    data.cheques.forEach((c) => {
      if (c.status !== "Cleared" && c.status !== "Deposited") return;
      const yr = new Date(c.chequeDate).getFullYear();
      const row = years.get(yr) ?? { income: 0, expense: 0 };
      row.income += c.amount;
      years.set(yr, row);
    });
    data.expenses.forEach((e) => {
      const yr = new Date(e.date).getFullYear();
      const row = years.get(yr) ?? { income: 0, expense: 0 };
      row.expense += e.amount;
      years.set(yr, row);
    });
    return [...years.entries()].sort((a, b) => b[0] - a[0]);
  }, [data]);

  const renewals = useMemo(
    () =>
      data.tenants
        .filter((t) => t.status !== "Expired" && daysUntil(t.contractEnd) <= 120)
        .sort((a, b) => a.contractEnd.localeCompare(b.contractEnd)),
    [data.tenants],
  );

  const occupied = new Set(data.tenants.filter((t) => t.status !== "Expired").map((t) => t.flatNo));
  const vacant = data.units.filter((u) => !occupied.has(u.flatNo));

  const bankRows = useMemo(
    () =>
      data.cheques
        .filter((c) => c.status === "Deposited" || c.status === "Cleared" || c.status === "Bounced")
        .sort((a, b) => b.chequeDate.localeCompare(a.chequeDate)),
    [data.cheques],
  );
  const matched = bankRows.filter((c) => c.reconciled);
  const unmatched = bankRows.filter((c) => !c.reconciled);

  return (
    <AppShell>
      <PageHeader title="Reports" description="Everything you need for the monthly owner review." />

      <Tabs defaultValue="pdc">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pdc">Upcoming PDCs</TabsTrigger>
          <TabsTrigger value="profit">Yearly profit</TabsTrigger>
          <TabsTrigger value="renewal">Contract renewals</TabsTrigger>
          <TabsTrigger value="vacant">Vacant units</TabsTrigger>
          <TabsTrigger value="bank">Bank reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="pdc">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming post-dated cheques</CardTitle>
              <CardDescription>
                {upcoming.length} cheque(s) pending ·{" "}
                {currency(upcoming.reduce((s, c) => s + c.amount, 0))}
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
                  {upcoming.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{fmtDate(c.chequeDate)}</TableCell>
                      <TableCell className="font-medium">{tenantName(c.tenantId)}</TableCell>
                      <TableCell>#{c.chequeNo}</TableCell>
                      <TableCell>{c.bank}</TableCell>
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

        <TabsContent value="profit">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Yearly profit</CardTitle>
              <CardDescription>Collected rent minus recorded expenses.</CardDescription>
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
                  {yearly.map(([yr, r]) => (
                    <TableRow key={yr}>
                      <TableCell className="font-medium">
                        {yr}
                        {yr === year ? " (current)" : ""}
                      </TableCell>
                      <TableCell className="text-right">{currency(r.income)}</TableCell>
                      <TableCell className="text-right">{currency(r.expense)}</TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          r.income - r.expense >= 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {currency(r.income - r.expense)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.income ? `${Math.round(((r.income - r.expense) / r.income) * 100)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="renewal">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contracts due for renewal</CardTitle>
              <CardDescription>Contracts ending within the next 120 days.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Flat</TableHead>
                    <TableHead>Contract end</TableHead>
                    <TableHead className="text-right">Rent</TableHead>
                    <TableHead className="text-right">Days left</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renewals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No renewals in the next 120 days.
                      </TableCell>
                    </TableRow>
                  ) : (
                    renewals.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>{t.flatNo}</TableCell>
                        <TableCell>{fmtDate(t.contractEnd)}</TableCell>
                        <TableCell className="text-right">{currency(t.rentAmount)}</TableCell>
                        <TableCell
                          className={`text-right ${daysUntil(t.contractEnd) < 30 ? "text-destructive" : ""}`}
                        >
                          {daysUntil(t.contractEnd)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vacant">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vacant units</CardTitle>
              <CardDescription>
                {vacant.length} vacant · potential {currency(vacant.reduce((s, u) => s + u.marketRent, 0))}/yr
              </CardDescription>
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
                  {vacant.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        Fully occupied.
                      </TableCell>
                    </TableRow>
                  ) : (
                    vacant.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.flatNo}</TableCell>
                        <TableCell>{u.building}</TableCell>
                        <TableCell>{u.type}</TableCell>
                        <TableCell className="text-right">{currency(u.marketRent)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bank reconciliation</CardTitle>
              <CardDescription>
                Tick each cheque you can see on the bank statement. Matched {currency(
                  matched.reduce((s, c) => s + c.amount, 0),
                )} · unmatched {currency(unmatched.reduce((s, c) => s + c.amount, 0))}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Match</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Cheque no.</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        No deposited or cleared cheques yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    bankRows.map((c) => (
                      <TableRow key={c.id} className={c.reconciled ? "" : "bg-warning/5"}>
                        <TableCell>
                          <Checkbox
                            checked={!!c.reconciled}
                            aria-label="Mark reconciled"
                            onCheckedChange={() => {
                              toggleReconciled(c.id);
                              toast.success(c.reconciled ? "Unmatched" : "Matched to statement");
                            }}
                          />
                        </TableCell>
                        <TableCell>{fmtDate(c.chequeDate)}</TableCell>
                        <TableCell className="font-medium">{tenantName(c.tenantId)}</TableCell>
                        <TableCell>#{c.chequeNo}</TableCell>
                        <TableCell>{c.bank}</TableCell>
                        <TableCell className="text-right">{currency(c.amount)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.status}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

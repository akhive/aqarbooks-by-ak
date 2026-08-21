import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, useStore } from "@/lib/store";

export const Route = createFileRoute("/deposits")({
  component: DepositsPage,
});

function DepositsPage() {
  const { data } = useStore();

  const rows = useMemo(() => {
    return data.contracts.map((c) => {
      const tenant = data.tenants.find((t) => t.id === c.tenantId);
      const unit = data.units.find((u) => u.id === c.unitId);
      const depCheques = data.cheques.filter(
        (ch) => ch.contractId === c.id && ch.kind === "deposit",
      );
      const depPaid = depCheques.reduce((s, ch) => s + ch.amount, 0);
      return {
        ...c,
        tenantName: tenant?.name || "—",
        unitNo: unit?.flatNo || "—",
        depPaid,
        cheques: depCheques.length,
      };
    });
  }, [data]);

  const totalHeld = rows.reduce((s, r) => s + (r.depositAmount || 0), 0);
  const totalCheques = rows.reduce((s, r) => s + r.depPaid, 0);

  return (
    <AppShell>
      <PageHeader title="Deposits" description="Security deposits by lease" />
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total deposit held (contracts)</p>
            <p className="text-xl font-semibold">{currency(totalHeld)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Deposit cheques total</p>
            <p className="text-xl font-semibold">{currency(totalCheques)}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deposit report</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lease</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Deposit</TableHead>
                <TableHead className="text-right">Cheques</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      to="/contract/$contractId"
                      params={{ contractId: r.id }}
                      className="text-primary hover:underline"
                    >
                      {r.leaseNo || "View"}
                    </Link>
                  </TableCell>
                  <TableCell>{r.tenantName}</TableCell>
                  <TableCell>{r.unitNo}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell className="text-right">{currency(r.depositAmount || 0)}</TableCell>
                  <TableCell className="text-right">{currency(r.depPaid)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

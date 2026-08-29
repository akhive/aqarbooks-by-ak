import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, fmtDate, useStore } from "@/lib/store";

export const Route = createFileRoute("/units/$unitId")({
  head: () => ({
    meta: [{ title: "Lease history — Aqar Books" }],
  }),
  component: UnitLeaseHistoryPage,
});

function UnitLeaseHistoryPage() {
  const { unitId } = Route.useParams();
  const { data } = useStore();

  const unit = data.units.find((u) => u.id === unitId);

  const history = useMemo(() => {
    return data.contracts
      .filter((c) => c.unitId === unitId && (c.status || "Active") !== "Draft")
      .sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
  }, [data.contracts, unitId]);

  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "—";

  if (!unit) {
    return (
      <AppShell>
        <PageHeader title="Unit not found" description={`ID: ${unitId}`} />
        <Button asChild variant="outline">
          <Link to="/units">Back to units</Link>
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/units">
            <ArrowLeft className="mr-2 size-4" />
            Units
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Lease history — Flat ${unit.flatNo}`}
        description={
          [unit.building, unit.bedroomType].filter(Boolean).join(" · ") ||
          "All contracts for this unit"
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {history.length} lease(s) · Flat {unit.flatNo}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Previous and current tenants on this unit (newest first). Drafts hidden.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lease No</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead className="text-right">Rent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No leases linked to this unit yet.
                  </TableCell>
                </TableRow>
              )}
              {history.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      to="/contract/$contractId"
                      params={{ contractId: c.id }}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {c.leaseNo || "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{tenantName(c.tenantId)}</TableCell>
                  <TableCell>{c.status || "Active"}</TableCell>
                  <TableCell>{fmtDate(c.startDate)}</TableCell>
                  <TableCell>{fmtDate(c.endedAt || c.endDate)}</TableCell>
                  <TableCell className="text-right">{currency(c.rent)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

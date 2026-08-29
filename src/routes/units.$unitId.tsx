import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, fmtDate, useStore } from "@/lib/store";

export const Route = createFileRoute("/units/$unitId")({
  head: () => ({
    meta: [{ title: "Unit — Aqar Books" }],
  }),
  component: UnitDetailPage,
});

function UnitDetailPage() {
  const { unitId } = Route.useParams();
  const { data } = useStore();

  const unit = data.units.find((u) => u.id === unitId);

  const history = useMemo(() => {
    return data.contracts
      .filter((c) => c.unitId === unitId && (c.status || "Active") !== "Draft")
      .sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
  }, [data.contracts, unitId]);

  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "—";

  const today = new Date().toISOString().slice(0, 10);
  const current = history.find(
    (c) =>
      (c.status || "Active") === "Active" &&
      c.startDate &&
      c.endDate &&
      c.startDate <= today &&
      c.endDate >= today,
  );

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
        title={`Flat ${unit.flatNo}`}
        description={[unit.building, unit.bedroomType].filter(Boolean).join(" · ") || "Unit detail"}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Market rent</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">{currency(unit.marketRent)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Leases (history)</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">{history.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Current tenant</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {current ? tenantName(current.tenantId) : "Vacant"}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Lease history</TabsTrigger>
          <TabsTrigger value="info">Unit info</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                All contracts for Flat {unit.flatNo}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Every tenant who occupied this unit. Newest first.
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
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardContent className="space-y-2 pt-6 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Flat</span>
                <span className="font-medium">{unit.flatNo}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Building</span>
                <span className="font-medium">{unit.building || "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{unit.bedroomType || "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Market rent</span>
                <span className="font-medium">{currency(unit.marketRent)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

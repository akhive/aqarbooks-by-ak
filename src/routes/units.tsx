import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, fmtDate, useStore } from "@/lib/store";

export const Route = createFileRoute("/units")({
  head: () => ({
    meta: [
      { title: "Units — Estate Manager" },
      {
        name: "description",
        content: "See every flat in the portfolio with occupied or vacant status, tenant and rent.",
      },
      { property: "og:title", content: "Units — Estate Manager" },
      { property: "og:description", content: "Occupancy status for every flat in your portfolio." },
    ],
  }),
  component: UnitsPage,
});

function UnitsPage() {
  const { data } = useStore();
  const tenantFor = (flatNo: string) =>
    data.tenants.find((t) => t.flatNo === flatNo && t.status !== "Expired");
  const vacantCount = data.units.filter((u) => !tenantFor(u.flatNo)).length;

  return (
    <AppShell>
      <PageHeader
        title="Units"
        description={`${data.units.length} units · ${data.units.length - vacantCount} occupied · ${vacantCount} vacant`}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flat</TableHead>
                <TableHead>Building</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Contract ends</TableHead>
                <TableHead className="text-right">Rent</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.units.map((u) => {
                const t = tenantFor(u.flatNo);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.flatNo}</TableCell>
                    <TableCell>{u.building}</TableCell>
                    <TableCell>{u.type}</TableCell>
                    <TableCell>{t ? t.name : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t ? fmtDate(t.contractEnd) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{currency(t ? t.rentAmount : u.marketRent)}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          t ? "bg-success/12 text-success" : "bg-warning/15 text-warning"
                        }`}
                      >
                        {t ? "Occupied" : "Vacant"}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

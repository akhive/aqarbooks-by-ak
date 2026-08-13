import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, fmtDate, useStore, type Cheque } from "@/lib/store";

export const Route = createFileRoute("/reconciliation")({
  head: () => ({
    meta: [{ title: "Bank Reconciliation — Estate Manager" }],
  }),
  component: ReconciliationPage,
});

function ReconciliationPage() {
  const { data, updateCheque } = useStore();

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [clearedDate, setClearedDate] = useState(today);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    return data.cheques
      .filter((c) => {
        if (!c.chequeDate) return false;
        return c.chequeDate >= from && c.chequeDate <= to;
      })
      .sort((a, b) => a.chequeDate.localeCompare(b.chequeDate));
  }, [data.cheques, from, to]);

  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "—";

  const toggle = (id: string) => {
    setSelected((p) => ({ ...p, [id]: !p[id] }));
  };

  const toggleAll = () => {
    const allSelected = rows.every((r) => selected[r.id]);
    if (allSelected) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      rows.forEach((r) => {
        if (r.status !== "Cleared") next[r.id] = true;
      });
      setSelected(next);
    }
  };

  const selectedCheques = rows.filter((r) => selected[r.id]);
  const selectedTotal = selectedCheques.reduce((s, c) => s + c.amount, 0);
  const periodTotal = rows.reduce((s, c) => s + c.amount, 0);
  const clearedTotal = rows.filter((c) => c.status === "Cleared").reduce((s, c) => s + c.amount, 0);
  const pendingTotal = periodTotal - clearedTotal;

  const markCleared = async () => {
    if (selectedCheques.length === 0) {
      toast.error("Select at least one cheque");
      return;
    }
    if (!clearedDate) {
      toast.error("Please enter cleared date");
      return;
    }

    setSaving(true);
    try {
      for (const c of selectedCheques) {
        await updateCheque(c.id, {
          ...c,
          status: "Cleared",
          reconciled: true,
          clearedDate,
        });
      }
      toast.success(`${selectedCheques.length} cheque(s) marked as Cleared`);
      setSelected({});
    } catch (err) {
      console.error(err);
      toast.error("Failed to update cheques");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Bank Reconciliation"
        description="Select period, review cheques, and mark them as cleared."
      />

      {/* Period Filter */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label>From Date</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To Date</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Cleared Date</Label>
            <Input type="date" value={clearedDate} onChange={(e) => setClearedDate(e.target.value)} />
          </div>
          <Button onClick={markCleared} disabled={saving || selectedCheques.length === 0}>
            {saving ? "Saving..." : `Mark ${selectedCheques.length || ""} Cleared`}
          </Button>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Period Total</p>
            <p className="text-xl font-semibold">{currency(periodTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Already Cleared</p>
            <p className="text-xl font-semibold text-green-600">{currency(clearedTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-xl font-semibold text-amber-600">{currency(pendingTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cheques Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input type="checkbox" onChange={toggleAll} />
                </TableHead>
                <TableHead>Cheque Date</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Cheque No</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cleared Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No cheques found in this period
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id} className={c.status === "Cleared" ? "opacity-60" : ""}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={!!selected[c.id]}
                        disabled={c.status === "Cleared"}
                        onChange={() => toggle(c.id)}
                      />
                    </TableCell>
                    <TableCell>{fmtDate(c.chequeDate)}</TableCell>
                    <TableCell>{tenantName(c.tenantId)}</TableCell>
                    <TableCell>{c.chequeNo}</TableCell>
                    <TableCell>{c.bank}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          c.status === "Cleared"
                            ? "bg-success/12 text-success"
                            : c.status === "Deposited"
                              ? "bg-primary/10 text-primary"
                              : c.status === "Bounced"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-warning/15 text-warning"
                        }`}
                      >
                        {c.status}
                      </span>
                    </TableCell>
                    <TableCell>{c.clearedDate ? fmtDate(c.clearedDate) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{currency(c.amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Totals footer like Tally */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/30 px-4 py-3 text-sm">
            <div>
              Selected: <strong>{selectedCheques.length}</strong> cheque(s) —{" "}
              <strong>{currency(selectedTotal)}</strong>
            </div>
            <div className="flex gap-6">
              <span>
                Period Total: <strong>{currency(periodTotal)}</strong>
              </span>
              <span className="text-green-700">
                Cleared: <strong>{currency(clearedTotal)}</strong>
              </span>
              <span className="text-amber-700">
                Pending: <strong>{currency(pendingTotal)}</strong>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}

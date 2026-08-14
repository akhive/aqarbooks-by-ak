import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Printer, Save } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, fmtDate, useStore } from "@/lib/store";
import { supabase } from "../supabase";

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
  const [clearedDate, setClearedDate] = useState(today);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loadingBal, setLoadingBal] = useState(false);

  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "—";

  // Load saved opening balance when period changes
  useEffect(() => {
    const load = async () => {
      if (!from || !to) return;
      setLoadingBal(true);
      try {
        const { data: row } = await supabase
          .from("bank_reconciliations")
          .select("*")
          .eq("period_from", from)
          .eq("period_to", to)
          .maybeSingle();

        if (row) {
          setOpeningBalance(Number(row.opening_balance) || 0);
        } else {
          // Try to get previous period closing balance as opening
          const { data: prev } = await supabase
            .from("bank_reconciliations")
            .select("*")
            .lt("period_to", from)
            .order("period_to", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (prev) {
            setOpeningBalance(Number(prev.closing_balance) || 0);
          } else {
            setOpeningBalance(0);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingBal(false);
      }
    };
    load();
  }, [from, to]);

  const rows = useMemo(() => {
    const chequeRows = data.cheques
      .filter((c) => c.chequeDate && c.chequeDate >= from && c.chequeDate <= to)
      .map((c) => ({
        id: c.id,
        date: c.chequeDate,
        particular: tenantName(c.tenantId),
        type: "Cheque" as const,
        chequeNo: c.chequeNo,
        bank: c.bank,
        status: c.status,
        deposit: c.amount,
        withdrawal: 0,
      }));

    const expenseRows = data.expenses
      .filter((e) => e.date && e.date >= from && e.date <= to)
      .map((e) => ({
        id: e.id,
        date: e.date,
        particular: e.description || e.category,
        type: "Expense" as const,
        chequeNo: "",
        bank: "",
        status: "—",
        deposit: 0,
        withdrawal: e.amount,
      }));

    return [...chequeRows, ...expenseRows].sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [data.cheques, data.expenses, from, to]);

  const totalDeposit = rows.reduce((s, r) => s + r.deposit, 0);
  const totalWithdrawal = rows.reduce((s, r) => s + r.withdrawal, 0);
  const closingBalance = openingBalance + totalDeposit - totalWithdrawal;

  const selectedCheques = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([id]) => id);

  const toggle = (id: string) => setSelected((p) => ({ ...p, [id]: !p[id] }));

  const markCleared = async () => {
    if (selectedCheques.length === 0) return;
    setSaving(true);
    try {
      for (const id of selectedCheques) {
        const c = data.cheques.find((x) => x.id === id);
        if (!c) continue;
        await updateCheque(id, {
          ...c,
          status: "Cleared",
          clearedDate,
          reconciled: true,
        });
      }
      toast.success(`${selectedCheques.length} cheque(s) marked cleared`);
      setSelected({});
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  // SAVE reconciliation statement
  const saveReconciliation = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("bank_reconciliations").upsert(
        {
          period_from: from,
          period_to: to,
          opening_balance: openingBalance,
          closing_balance: closingBalance,
          saved_at: new Date().toISOString(),
        },
        { onConflict: "period_from,period_to" }
      );
      if (error) throw error;
      toast.success("Reconciliation saved. Next time this period will load the same balance.");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // PRINT with fixed header format
  const printPDF = () => {
    window.print();
  };

  return (
    <AppShell>
      {/* PRINT HEADER - only visible when printing */}
      <div className="print-only hidden print:block mb-6 border-b pb-4">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
            AK
          </div>
          <div>
            <h1 className="text-xl font-bold">Bank Reconciliation</h1>
            <p className="text-sm text-muted-foreground">
              Period: {fmtDate(from)} → {fmtDate(to)}
            </p>
            <p className="text-xs text-muted-foreground">Aqar Books — Built by AK</p>
          </div>
        </div>
      </div>

      <div className="no-print">
        <PageHeader
          title="Bank Reconciliation"
          description="Save balances month by month · Print statement"
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={printPDF}>
                <Printer className="mr-2 h-4 w-4" />
                Print / PDF
              </Button>
              <Button onClick={saveReconciliation} disabled={saving || loadingBal}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Statement"}
              </Button>
            </div>
          }
        />
      </div>

      {/* Period + Opening Balance */}
      <Card className="mb-4 no-print">
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
            <Label>Opening Balance {loadingBal && "(loading...)"}</Label>
            <Input
              type="number"
              value={openingBalance || ""}
              onChange={(e) => setOpeningBalance(Number(e.target.value) || 0)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Clearance */}
      <Card className="mb-6 no-print">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label>Bank Clearance Date</Label>
            <Input type="date" value={clearedDate} onChange={(e) => setClearedDate(e.target.value)} />
          </div>
          <Button onClick={markCleared} disabled={saving || selectedCheques.length === 0}>
            {saving ? "Saving..." : `Mark ${selectedCheques.length} Cleared`}
          </Button>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Opening Balance</p>
            <p className="text-lg font-semibold">{currency(openingBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Deposit</p>
            <p className="text-lg font-semibold text-green-600">{currency(totalDeposit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Withdrawal</p>
            <p className="text-lg font-semibold text-red-600">{currency(totalWithdrawal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Closing Balance</p>
            <p className="text-lg font-semibold text-primary">{currency(closingBalance)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="no-print w-10"></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Particular</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Cheque No</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead className="text-right">Deposit</TableHead>
                <TableHead className="text-right">Withdrawal</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    No transactions in this period.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="no-print">
                    {r.type === "Cheque" && (
                      <input
                        type="checkbox"
                        checked={!!selected[r.id]}
                        onChange={() => toggle(r.id)}
                      />
                    )}
                  </TableCell>
                  <TableCell>{fmtDate(r.date)}</TableCell>
                  <TableCell className="font-medium">{r.particular}</TableCell>
                  <TableCell>{r.type}</TableCell>
                  <TableCell>{r.chequeNo || "—"}</TableCell>
                  <TableCell>{r.bank || "—"}</TableCell>
                  <TableCell className="text-right text-green-600">
                    {r.deposit ? currency(r.deposit) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {r.withdrawal ? currency(r.withdrawal) : "—"}
                  </TableCell>
                  <TableCell>{r.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Print styles */}
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

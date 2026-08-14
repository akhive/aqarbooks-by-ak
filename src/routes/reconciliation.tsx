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

type Row = {
  id: string;
  date: string;
  particular: string;
  type: "Cheque" | "Expense";
  chequeNo?: string;
  bank?: string;
  status?: string;
  clearedDate?: string;
  deposit: number;
  withdrawal: number;
  ref: any;
};

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

  // Load saved balance for this period (or previous closing)
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
          const { data: prev } = await supabase
            .from("bank_reconciliations")
            .select("*")
            .lt("period_to", from)
            .order("period_to", { ascending: false })
            .limit(1)
            .maybeSingle();
          setOpeningBalance(prev ? Number(prev.closing_balance) || 0 : 0);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingBal(false);
      }
    };
    load();
  }, [from, to]);

  const rows: Row[] = useMemo(() => {
    const chequeRows: Row[] = data.cheques
      .filter((c) => c.chequeDate && c.chequeDate >= from && c.chequeDate <= to)
      .map((c) => ({
        id: c.id,
        date: c.chequeDate,
        particular: tenantName(c.tenantId),
        type: "Cheque" as const,
        chequeNo: c.chequeNo,
        bank: c.bank,
        status: c.status,
        clearedDate: c.clearedDate,
        deposit: c.amount,
        withdrawal: 0,
        ref: c,
      }));

    const expenseRows: Row[] = data.expenses
      .filter((e) => e.date && e.date >= from && e.date <= to)
      .map((e) => ({
        id: e.id,
        date: e.date,
        particular: e.description || e.category,
        type: "Expense" as const,
        status: "—",
        deposit: 0,
        withdrawal: e.amount,
        ref: e,
      }));

    return [...chequeRows, ...expenseRows].sort((a, b) => a.date.localeCompare(b.date));
  }, [data.cheques, data.expenses, data.tenants, from, to]);

  const toggle = (id: string) => setSelected((p) => ({ ...p, [id]: !p[id] }));

  const toggleAllPendingCheques = () => {
    const pending = rows.filter((r) => r.type === "Cheque" && r.status !== "Cleared");
    const allSelected = pending.every((r) => selected[r.id]);
    if (allSelected) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      pending.forEach((r) => (next[r.id] = true));
      setSelected(next);
    }
  };

  const selectedCheques = rows.filter((r) => r.type === "Cheque" && selected[r.id]);
  const selectedTotal = selectedCheques.reduce((s, r) => s + r.deposit, 0);

  const totalDeposit = rows.reduce((s, r) => s + r.deposit, 0);
  const totalWithdrawal = rows.reduce((s, r) => s + r.withdrawal, 0);
  const clearedDeposit = rows
    .filter((r) => r.type === "Cheque" && r.status === "Cleared")
    .reduce((s, r) => s + r.deposit, 0);
  const availableOnlyInBooks = totalDeposit - clearedDeposit;
  const expectedBankBalance = openingBalance + clearedDeposit - totalWithdrawal;
  const balanceAsPerBooks = openingBalance + totalDeposit - totalWithdrawal;

  const markCleared = async () => {
    if (selectedCheques.length === 0) {
      toast.error("Select at least one cheque");
      return;
    }
    if (!clearedDate) {
      toast.error("Enter Bank Clearance Date");
      return;
    }
    setSaving(true);
    try {
      for (const row of selectedCheques) {
        const c = row.ref;
        await updateCheque(c.id, {
          ...c,
          status: "Cleared",
          reconciled: true,
          clearedDate,
        });
      }
      toast.success(`${selectedCheques.length} cheque(s) cleared`);
      setSelected({});
    } catch (err) {
      console.error(err);
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const saveReconciliation = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("bank_reconciliations").upsert(
        {
          period_from: from,
          period_to: to,
          opening_balance: openingBalance,
          closing_balance: expectedBankBalance,
          saved_at: new Date().toISOString(),
        },
        { onConflict: "period_from,period_to" }
      );
      if (error) throw error;
      toast.success("Statement saved. Balance will be remembered for this period.");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const printPDF = () => window.print();

  return (
    <AppShell>
      {/* Print header */}
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
          description="Period search · Deposits (Income) · Withdrawals (Expense) · Bank clearance"
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
              placeholder="0"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clearance Action */}
      <Card className="mb-6 no-print">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label>Bank Clearance Date (as per bank statement)</Label>
            <Input type="date" value={clearedDate} onChange={(e) => setClearedDate(e.target.value)} />
          </div>
          <Button onClick={markCleared} disabled={saving || selectedCheques.length === 0}>
            {saving ? "Saving..." : `Mark ${selectedCheques.length} Cheque(s) Cleared`}
          </Button>
        </CardContent>
      </Card>

      {/* Summary — original cards kept */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Deposit (Income)</p>
            <p className="text-lg font-semibold text-green-600">{currency(totalDeposit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Withdrawal (Expense)</p>
            <p className="text-lg font-semibold text-red-600">{currency(totalWithdrawal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Available Only in Books</p>
            <p className="text-lg font-semibold text-amber-600">{currency(availableOnlyInBooks)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Expected Bank Balance</p>
            <p className="text-lg font-semibold text-primary">{currency(expectedBankBalance)}</p>
            <p className="text-xs text-muted-foreground">as on {fmtDate(to)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 text-sm font-medium">
            Transactions from {fmtDate(from)} to {fmtDate(to)} ({rows.length} entries)
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="no-print w-10">
                  <input type="checkbox" onChange={toggleAllPendingCheques} title="Select all pending" />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Particular</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Cheque No</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cleared Date</TableHead>
                <TableHead className="text-right">Deposit</TableHead>
                <TableHead className="text-right">Withdrawal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    No transactions in this period.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="no-print">
                      {r.type === "Cheque" && r.status !== "Cleared" && (
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
                    <TableCell>
                      {r.type === "Cheque" ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            r.status === "Cleared"
                              ? "bg-success/12 text-success"
                              : "bg-warning/15 text-warning"
                          }`}
                        >
                          {r.status}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{r.clearedDate ? fmtDate(r.clearedDate) : "—"}</TableCell>
                    <TableCell className="text-right text-green-700">
                      {r.deposit ? currency(r.deposit) : ""}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {r.withdrawal ? currency(r.withdrawal) : ""}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Original tally-style footer kept */}
          <div className="space-y-1.5 border-t bg-muted/20 px-4 py-4 text-sm">
            <div className="flex justify-between no-print">
              <span>Selected for clearance</span>
              <strong>
                {selectedCheques.length} cheque(s) — {currency(selectedTotal)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Total Deposit (Income / Cheques)</span>
              <strong className="text-green-700">{currency(totalDeposit)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Total Withdrawal (Expenses)</span>
              <strong className="text-red-600">{currency(totalWithdrawal)}</strong>
            </div>
            <div className="flex justify-between text-amber-700">
              <span>Available Only in Books (Uncleared cheques)</span>
              <strong>{currency(availableOnlyInBooks)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Balance as per Books</span>
              <strong>{currency(balanceAsPerBooks)}</strong>
            </div>
            <div className="mt-2 flex justify-between border-t pt-2 text-base">
              <span>Expected Bank Balance as on {fmtDate(to)}</span>
              <strong className="text-primary">{currency(expectedBankBalance)}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

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

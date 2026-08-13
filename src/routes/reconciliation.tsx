import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, fmtDate, useStore } from "@/lib/store";

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
  ref: any; // original object
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

  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "—";

  // Combine Cheques (Deposit) + Expenses (Withdrawal)
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

  return (
    <AppShell>
      <PageHeader
        title="Bank Reconciliation"
        description="Period search · Deposits (Income) · Withdrawals (Expense) · Bank clearance"
      />

      {/* Period + Opening Balance */}
      <Card className="mb-4">
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
            <Label>Opening Balance</Label>
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
      <Card className="mb-6">
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

      {/* Summary */}
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
                <TableHead className="w-10">
                  <input type="checkbox" onChange={toggleAllPendingCheques} title="Select pending cheques" />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Particulars</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Cheque No</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bank Clearance Date</TableHead>
                <TableHead className="text-right">Deposit</TableHead>
                <TableHead className="text-right">Withdrawal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                    No transactions in this period.
                    <br />
                    <span className="text-xs">Change From / To dates, or add Cheques and Expenses first.</span>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className={r.status === "Cleared" ? "bg-muted/40" : ""}>
                    <TableCell>
                      {r.type === "Cheque" ? (
                        <input
                          type="checkbox"
                          checked={!!selected[r.id]}
                          disabled={r.status === "Cleared"}
                          onChange={() => toggle(r.id)}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell>{fmtDate(r.date)}</TableCell>
                    <TableCell>{r.particular}</TableCell>
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

          {/* Tally-style footer */}
          <div className="space-y-1.5 border-t bg-muted/20 px-4 py-4 text-sm">
            <div className="flex justify-between">
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
            <div className="mt-2 flex justify-between border-t pt-2 text-base">
              <span>Expected Bank Balance as on {fmtDate(to)}</span>
              <strong className="text-primary">{currency(expectedBankBalance)}</strong>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}

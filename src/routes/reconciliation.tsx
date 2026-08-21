import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Printer, Save } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, fmtDate, useStore } from "@/lib/store";

export const Route = createFileRoute("/reconciliation")({
  head: () => ({
    meta: [{ title: "Bank Reconciliation — Aqar Books" }],
  }),
  component: ReconciliationPage,
});

const STORAGE_KEY = "aqar_bank_recon";

type SavedRecon = {
  openingBalance: number;
  statementBalance: number;
  periodFrom: string;
  periodTo: string;
  notes: string;
};

function loadSaved(): SavedRecon {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {
    openingBalance: 0,
    statementBalance: 0,
    periodFrom: "",
    periodTo: "",
    notes: "",
  };
}

function ReconciliationPage() {
  const { data, updateCheque, refresh } = useStore();
  const [openingBalance, setOpeningBalance] = useState(0);
  const [statementBalance, setStatementBalance] = useState(0);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = loadSaved();
    setOpeningBalance(s.openingBalance || 0);
    setStatementBalance(s.statementBalance || 0);
    setPeriodFrom(s.periodFrom || "");
    setPeriodTo(s.periodTo || "");
    setNotes(s.notes || "");
  }, []);

  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "—";

  const rows = useMemo(() => {
    return [...data.cheques]
      .filter((c) => {
        if (periodFrom && c.chequeDate && c.chequeDate < periodFrom) return false;
        if (periodTo && c.chequeDate && c.chequeDate > periodTo) return false;
        return true;
      })
      .sort((a, b) => (a.chequeDate || "").localeCompare(b.chequeDate || ""));
  }, [data.cheques, periodFrom, periodTo]);

  const clearedInPeriod = rows.filter((c) => c.status === "Cleared" || c.status === "Deposited");
  const clearedTotal = clearedInPeriod.reduce((s, c) => s + c.amount, 0);
  const bookBalance = openingBalance + clearedTotal;
  const difference = statementBalance - bookBalance;

  const saveStatement = () => {
    const payload: SavedRecon = {
      openingBalance,
      statementBalance,
      periodFrom,
      periodTo,
      notes,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      toast.success("Reconciliation saved — opening balance kept for next time");
    } catch {
      toast.error("Could not save");
    }
  };

  /** Enter clearance date → status becomes Cleared automatically */
  const setClearanceDate = async (chequeId: string, date: string) => {
    const ch = data.cheques.find((c) => c.id === chequeId);
    if (!ch) return;
    setSaving(true);
    try {
      if (date) {
        await updateCheque(chequeId, {
          ...ch,
          clearedDate: date,
          status: "Cleared",
          reconciled: true,
        });
        toast.success("Cheque cleared");
      } else {
        await updateCheque(chequeId, {
          ...ch,
          clearedDate: "",
          status: "PDC",
          reconciled: false,
        });
        toast.message("Clearance removed — back to PDC");
      }
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const periodLabel =
    periodFrom || periodTo
      ? `${periodFrom ? fmtDate(periodFrom) : "…"} → ${periodTo ? fmtDate(periodTo) : "…"}`
      : "All periods";

  return (
    <AppShell>
      <div className="print-only mb-6 hidden border-b pb-4 print:block">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            AK
          </div>
          <div>
            <h1 className="text-xl font-bold">Bank Reconciliation</h1>
            <p className="text-sm text-muted-foreground">Period: {periodLabel}</p>
            <p className="text-xs text-muted-foreground">Aqar Books — Built by AK</p>
          </div>
        </div>
      </div>

      <div className="no-print">
        <PageHeader
          title="Bank Reconciliation"
          description="Enter clearance date on each cheque — status becomes Cleared automatically"
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={saveStatement}>
                <Save className="mr-2 h-4 w-4" />
                Save statement
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Print / PDF
              </Button>
            </div>
          }
        />
      </div>

      <Card className="mb-4 no-print">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Period from</Label>
            <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
          </div>
          <div>
            <Label>Period to</Label>
            <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
          </div>
          <div>
            <Label>Opening balance (AED)</Label>
            <Input
              type="number"
              value={openingBalance || ""}
              onChange={(e) => setOpeningBalance(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Balance as per bank statement (AED)</Label>
            <Input
              type="number"
              value={statementBalance || ""}
              onChange={(e) => setStatementBalance(Number(e.target.value))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Month-end notes" />
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cleared in period</p>
            <p className="text-lg font-semibold">{currency(clearedTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Balance as per books</p>
            <p className="text-lg font-semibold">{currency(bookBalance)}</p>
            <p className="text-xs text-muted-foreground">Opening + cleared</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Difference (bank − books)</p>
            <p className={`text-lg font-semibold ${difference === 0 ? "text-emerald-600" : "text-amber-600"}`}>
              {currency(difference)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cheques — enter clearance date to mark Cleared</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cheque date</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Cheque no.</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Clearance date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No cheques in this period.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{fmtDate(c.chequeDate)}</TableCell>
                  <TableCell className="font-medium">{tenantName(c.tenantId)}</TableCell>
                  <TableCell>{c.chequeNo || "—"}</TableCell>
                  <TableCell>{c.bank || "—"}</TableCell>
                  <TableCell className="text-right">{currency(c.amount)}</TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      className="no-print w-[150px]"
                      disabled={saving}
                      value={c.clearedDate || ""}
                      onChange={(e) => setClearanceDate(c.id, e.target.value)}
                    />
                    <span className="hidden print:inline">{c.clearedDate ? fmtDate(c.clearedDate) : "—"}</span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === "Cleared"
                          ? "bg-emerald-100 text-emerald-800"
                          : c.status === "Bounced"
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {c.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          header, nav, aside { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </AppShell>
  );
}

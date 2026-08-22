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
};

function loadSaved(): SavedRecon {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        openingBalance: Number(p.openingBalance) || 0,
        statementBalance: Number(p.statementBalance) || 0,
        periodFrom: p.periodFrom || "",
        periodTo: p.periodTo || "",
      };
    }
  } catch {
    /* ignore */
  }
  return { openingBalance: 0, statementBalance: 0, periodFrom: "", periodTo: "" };
}

/** dd/mm/yyyy or yyyy-mm-dd → yyyy-mm-dd ; empty → "" ; invalid → null */
function parseClearanceDate(raw: string): string | null {
  const t = raw.trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    return `${m[3]}-${mm}-${dd}`;
  }
  return null;
}

function displayClearance(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function ReconciliationPage() {
  const { data, updateCheque, refresh } = useStore();
  const [openingBalance, setOpeningBalance] = useState(0);
  const [statementBalance, setStatementBalance] = useState(0);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  /** Draft only — not saved until Save is clicked */
  const [draftClearance, setDraftClearance] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = loadSaved();
    setOpeningBalance(s.openingBalance);
    setStatementBalance(s.statementBalance);
    setPeriodFrom(s.periodFrom);
    setPeriodTo(s.periodTo);
  }, []);

  // Load existing clearance into draft (display only)
  useEffect(() => {
    const next: Record<string, string> = {};
    data.cheques.forEach((c) => {
      next[c.id] = displayClearance(c.clearedDate || "");
    });
    setDraftClearance(next);
  }, [data.cheques]);

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

  const clearedRows = rows.filter((c) => c.status === "Cleared" || c.status === "Deposited");
  const unclearedRows = rows.filter((c) => c.status !== "Cleared" && c.status !== "Deposited");

  const clearedTotal = clearedRows.reduce((s, c) => s + c.amount, 0);
  const unclearedTotal = unclearedRows.reduce((s, c) => s + c.amount, 0);

  const balanceAsPerBooks = openingBalance + clearedTotal;
  const expectedBankBalance = balanceAsPerBooks;
  const balanceAsPerBank = statementBalance;
  const difference = balanceAsPerBank - balanceAsPerBooks;

  const periodLabel =
    periodFrom || periodTo
      ? `${periodFrom ? fmtDate(periodFrom) : "…"} → ${periodTo ? fmtDate(periodTo) : "…"}`
      : "All periods";

  /**
   * Save:
   * 1) Keep opening / bank / period in localStorage
   * 2) Apply all typed clearance dates → status Cleared
   * 3) Empty clearance → back to PDC (only if it had a clearance before)
   */
  const saveStatement = async () => {
    setSaving(true);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ openingBalance, statementBalance, periodFrom, periodTo }),
      );

      let updated = 0;
      let errors = 0;

      for (const c of rows) {
        const typed = draftClearance[c.id] ?? "";
        const parsed = parseClearanceDate(typed);

        if (parsed === null) {
          errors++;
          continue;
        }

        const prev = c.clearedDate || "";
        const next = parsed || "";

        // No change
        if (prev === next) continue;

        if (next) {
          await updateCheque(c.id, {
            ...c,
            clearedDate: next,
            status: "Cleared",
            reconciled: true,
          });
          updated++;
        } else if (prev) {
          // User cleared the date field
          await updateCheque(c.id, {
            ...c,
            clearedDate: "",
            status: "PDC",
            reconciled: false,
          });
          updated++;
        }
      }

      await refresh();

      if (errors > 0) {
        toast.error(`${errors} date(s) invalid — use dd/mm/yyyy`);
      }
      if (updated > 0) {
        toast.success(`Saved · ${updated} cheque(s) updated to Cleared`);
      } else if (errors === 0) {
        toast.success("Statement saved");
      }
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

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
            <p className="text-xs text-muted-foreground">Aqar Books </p>
          </div>
        </div>
      </div>

      <div className="no-print">
        <PageHeader
          title="Bank Reconciliation"
          description="Type all clearance dates, then click Save — status becomes Cleared only on Save"
          action={
            <div className="flex gap-2">
              <Button onClick={saveStatement} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save statement"}
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
            <Label>Opening balance</Label>
            <Input
              type="number"
              value={openingBalance || ""}
              onChange={(e) => setOpeningBalance(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Balance as per bank statement</Label>
            <Input
              type="number"
              value={statementBalance || ""}
              onChange={(e) => setStatementBalance(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Reconciliation summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Opening balance</p>
              <p className="text-lg font-semibold">{currency(openingBalance)}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Balance as per books</p>
              <p className="text-lg font-semibold">{currency(balanceAsPerBooks)}</p>
              <p className="text-xs text-muted-foreground">Opening + cleared</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Expected bank balance</p>
              <p className="text-lg font-semibold">{currency(expectedBankBalance)}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Balance as per bank</p>
              <p className="text-lg font-semibold">{currency(balanceAsPerBank)}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div>
              <p className="text-xs text-muted-foreground">Difference (bank − books)</p>
              <p
                className={`text-xl font-bold ${
                  difference === 0 ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {currency(difference)}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Cleared: {currency(clearedTotal)} · Still PDC: {currency(unclearedTotal)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">
            Cheques — type clearance dates, then Save statement
          </CardTitle>
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
                      type="text"
                      inputMode="numeric"
                      placeholder="dd/mm/yyyy"
                      className="no-print w-[120px]"
                      value={draftClearance[c.id] ?? ""}
                      onChange={(e) =>
                        setDraftClearance((d) => ({ ...d, [c.id]: e.target.value }))
                      }
                    />
                    <span className="hidden print:inline">
                      {c.clearedDate ? displayClearance(c.clearedDate) : "—"}
                    </span>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calculation details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between border-b py-2">
            <span className="text-muted-foreground">Period</span>
            <span>{periodLabel}</span>
          </div>
          <div className="flex justify-between border-b py-2">
            <span className="text-muted-foreground">Opening balance</span>
            <span>{currency(openingBalance)}</span>
          </div>
          <div className="flex justify-between border-b py-2">
            <span className="text-muted-foreground">(+) Cheques cleared</span>
            <span>{currency(clearedTotal)}</span>
          </div>
          <div className="flex justify-between border-b py-2 font-medium">
            <span>Balance as per books</span>
            <span>{currency(balanceAsPerBooks)}</span>
          </div>
          <div className="flex justify-between border-b py-2 font-medium">
            <span>Expected bank balance</span>
            <span>{currency(expectedBankBalance)}</span>
          </div>
          <div className="flex justify-between border-b py-2">
            <span className="text-muted-foreground">Balance as per bank statement</span>
            <span>{currency(balanceAsPerBank)}</span>
          </div>
          <div className="flex justify-between py-2 font-semibold">
            <span>Difference</span>
            <span className={difference === 0 ? "text-emerald-600" : "text-amber-600"}>
              {currency(difference)}
            </span>
          </div>
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

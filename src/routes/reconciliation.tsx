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

/** Accept yyyy-mm-dd or dd/mm/yyyy → store as yyyy-mm-dd */
function parseClearanceDate(raw: string): string | null {
  const t = raw.trim();
  if (!t) return "";
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // dd/mm/yyyy or dd-mm-yyyy
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null; // invalid
}

function displayClearance(iso: string) {
  if (!iso) return "";
  // show as dd/mm/yyyy for typing comfort
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function ReconciliationPage() {
  const { data, updateCheque, refresh } = useStore();
  const [openingBalance, setOpeningBalance] = useState(0);
  const [statementBalance, setStatementBalance] = useState(0);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [draftClearance, setDraftClearance] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = loadSaved();
    setOpeningBalance(s.openingBalance);
    setStatementBalance(s.statementBalance);
    setPeriodFrom(s.periodFrom);
    setPeriodTo(s.periodTo);
  }, []);

  // keep draft text in sync when data loads
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

  const clearedInPeriod = rows.filter((c) => c.status === "Cleared" || c.status === "Deposited");
  const clearedTotal = clearedInPeriod.reduce((s, c) => s + c.amount, 0);
  const bookBalance = openingBalance + clearedTotal;
  const difference = statementBalance - bookBalance;

  const saveStatement = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          openingBalance,
          statementBalance,
          periodFrom,
          periodTo,
        }),
      );
      toast.success("Saved — opening balance kept for next month");
    } catch {
      toast.error("Could not save");
    }
  };

  const commitClearance = async (chequeId: string, typed: string) => {
    const ch = data.cheques.find((c) => c.id === chequeId);
    if (!ch) return;

    const parsed = parseClearanceDate(typed);
    if (parsed === null) {
      toast.error("Use dd/mm/yyyy or yyyy-mm-dd");
      setDraftClearance((d) => ({ ...d, [chequeId]: displayClearance(ch.clearedDate || "") }));
      return;
    }

    setSaving(true);
    try {
      if (parsed) {
        await updateCheque(chequeId, {
          ...ch,
          clearedDate: parsed,
          status: "Cleared",
          reconciled: true,
        });
        toast.success("Cleared");
      } else {
        await updateCheque(chequeId, {
          ...ch,
          clearedDate: "",
          status: "PDC",
          reconciled: false,
        });
        toast.message("Clearance removed");
      }
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed");
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
          description="Type clearance date (dd/mm/yyyy) — status becomes Cleared"
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={saveStatement}>
                <Save className="mr-2 h-4 w-4" />
                Save
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
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Cheques</CardTitle>
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
                      disabled={saving}
                      value={draftClearance[c.id] ?? ""}
                      onChange={(e) =>
                        setDraftClearance((d) => ({ ...d, [c.id]: e.target.value }))
                      }
                      onBlur={() => commitClearance(c.id, draftClearance[c.id] ?? "")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                      }}
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

      {/* Calculation details — bottom */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reconciliation summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between border-b py-2">
            <span className="text-muted-foreground">Period</span>
            <span className="font-medium">{periodLabel}</span>
          </div>
          <div className="flex justify-between border-b py-2">
            <span className="text-muted-foreground">Opening balance</span>
            <span className="font-medium">{currency(openingBalance)}</span>
          </div>
          <div className="flex justify-between border-b py-2">
            <span className="text-muted-foreground">(+) Cheques cleared in period</span>
            <span className="font-medium">{currency(clearedTotal)}</span>
          </div>
          <div className="flex justify-between border-b py-2">
            <span className="font-medium">Balance as per books</span>
            <span className="font-semibold">{currency(bookBalance)}</span>
          </div>
          <div className="flex justify-between border-b py-2">
            <span className="text-muted-foreground">Balance as per bank statement</span>
            <span className="font-medium">{currency(statementBalance)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="font-medium">Difference (bank − books)</span>
            <span
              className={`font-semibold ${
                difference === 0 ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {currency(difference)}
            </span>
          </div>
          {difference === 0 && (
            <p className="text-xs text-emerald-600">Reconciled — balances match.</p>
          )}
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

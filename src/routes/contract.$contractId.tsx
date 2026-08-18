import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  calcRevenue,
  currency,
  fmtDate,
  useStore,
  type Cheque,
  type ContractStatus,
} from "@/lib/store";
import { supabase } from "../supabase";

export const Route = createFileRoute("/contract/$contractId")({
  component: ContractDetailPage,
});

const BANKS_KEY = "aqar_bank_names";

function loadBanks(): string[] {
  try {
    const raw = localStorage.getItem(BANKS_KEY);
    if (!raw) return ["ENBD", "FAB", "ADCB", "Mashreq", "Dubai Islamic Bank"];
    return JSON.parse(raw);
  } catch {
    return ["ENBD", "FAB", "ADCB"];
  }
}

function saveBanks(list: string[]) {
  localStorage.setItem(BANKS_KEY, JSON.stringify(list));
}

function dayCount(start: string, end: string) {
  return Math.max(
    0,
    Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1,
  );
}

/** Split cheque dates evenly across lease period */
function splitDates(startDate: string, endDate: string, count: number): string[] {
  if (!startDate || count < 1) return [];
  const start = new Date(startDate);
  const end = new Date(endDate || startDate);
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  const interval = totalDays / count;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + Math.round(interval * i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function ContractDetailPage() {
  const { contractId } = Route.useParams();
  const { data, loading, refresh, addCheque, updateCheque, deleteCheque, updateContract } =
    useStore();

  const contract = data.contracts.find((c) => c.id === contractId);
  const tenant = data.tenants.find((t) => t.id === contract?.tenantId);
  const unit = data.units.find((u) => u.id === contract?.unitId);

  const cheques = useMemo(() => {
    if (!contract) return [];
    return data.cheques
      .filter(
        (c) =>
          c.contractId === contractId ||
          (!c.contractId && c.tenantId === contract.tenantId),
      )
      .sort((a, b) => (a.chequeDate || "").localeCompare(b.chequeDate || ""));
  }, [data.cheques, contractId, contract]);

  const [banks, setBanks] = useState<string[]>([]);
  const [bankOpen, setBankOpen] = useState(false);
  const [newBank, setNewBank] = useState("");

  const [splitOpen, setSplitOpen] = useState(false);
  const [splitCount, setSplitCount] = useState(4);

  const [editCheque, setEditCheque] = useState<Cheque | null>(null);
  const [chequeNo, setChequeNo] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [bankSearch, setBankSearch] = useState("");

  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<ContractStatus>("Broken");
  const [breakDate, setBreakDate] = useState(new Date().toISOString().slice(0, 10));
  const [calcRent, setCalcRent] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [extra, setExtra] = useState(0);
  const [balance, setBalance] = useState(0);
  const [actionNotes, setActionNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBanks(loadBanks());
  }, []);

  // Auto calc settlement when break dialog opens / date changes
  useEffect(() => {
    if (!contract || !actionOpen) return;
    const days = dayCount(contract.startDate, breakDate);
    const totalDays = dayCount(contract.startDate, contract.endDate) || 365;
    const used = Math.round((contract.rent / totalDays) * days);
    const received = cheques
      .filter((c) => c.status === "Cleared" || c.status === "Deposited")
      .reduce((s, c) => s + c.amount, 0);
    // Positive = tenant owes us; Negative = we refund tenant
    const bal = used + penalty + extra - received;
    setCalcRent(used);
    setBalance(bal);
  }, [contract, actionOpen, breakDate, penalty, extra, cheques]);

  if (loading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading contract...</p>
      </AppShell>
    );
  }

  if (!contract) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Contract not found.</p>
        <Link to="/contracts" className="mt-4 inline-flex rounded-md border px-4 py-2 text-sm">
          Back to Contracts
        </Link>
      </AppShell>
    );
  }

  const rev = calcRevenue(contract.startDate, contract.endDate, contract.rent);
  const chequeTotal = cheques.reduce((s, c) => s + c.amount, 0);

  const previewDates = splitDates(contract.startDate, contract.endDate, splitCount);

  const generateSplit = async () => {
    setSaving(true);
    try {
      const dates = splitDates(contract.startDate, contract.endDate, splitCount);
      const each = Math.round((contract.rent / splitCount) * 100) / 100;
      let remaining = contract.rent;
      for (let i = 0; i < splitCount; i++) {
        const amount = i === splitCount - 1 ? Math.round(remaining * 100) / 100 : each;
        remaining -= amount;
        await addCheque({
          tenantId: contract.tenantId,
          contractId: contract.id,
          chequeDate: dates[i],
          chequeNo: `${contract.leaseNo || "L"}-${i + 1}`,
          bank: "",
          amount,
          status: "PDC",
          reconciled: false,
        });
      }
      toast.success(`${splitCount} cheques created`);
      setSplitOpen(false);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const openBreak = (type: ContractStatus) => {
    setActionType(type);
    setBreakDate(new Date().toISOString().slice(0, 10));
    setPenalty(0);
    setExtra(0);
    setActionNotes("");
    setActionOpen(true);
  };

  const applyAction = async () => {
    setSaving(true);
    try {
      const notes = [
        actionNotes,
        `Settlement: calc rent ${calcRent}, penalty ${penalty}, extra ${extra}, balance ${balance}`,
      ]
        .filter(Boolean)
        .join(" | ");

      await updateContract(contract.id, {
        ...contract,
        status: actionType,
        endedAt: breakDate,
        notes,
      });
      await supabase
        .from("contracts")
        .update({
          status: actionType,
          ended_at: breakDate,
          notes,
        })
        .eq("id", contract.id);

      toast.success(`Contract marked as ${actionType}`);
      setActionOpen(false);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const printSettlement = () => {
    window.print();
  };

  const saveChequeEdit = async () => {
    if (!editCheque) return;
    setSaving(true);
    try {
      await updateCheque(editCheque.id, {
        ...editCheque,
        chequeNo,
        bank: chequeBank,
      });
      toast.success("Cheque updated");
      setEditCheque(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const addBankName = () => {
    const name = newBank.trim();
    if (!name) return;
    if (banks.some((b) => b.toLowerCase() === name.toLowerCase())) {
      toast.message("Bank already exists");
      return;
    }
    const next = [...banks, name].sort();
    setBanks(next);
    saveBanks(next);
    setNewBank("");
    toast.success("Bank saved");
  };

  const filteredBanks = banks.filter((b) =>
    b.toLowerCase().includes(bankSearch.trim().toLowerCase()),
  );

  const statusColor =
    contract.status === "Active"
      ? "bg-emerald-100 text-emerald-800"
      : contract.status === "Ended"
        ? "bg-slate-100 text-slate-800"
        : "bg-red-100 text-red-800";

  return (
    <AppShell>
      <div className="mb-4 no-print">
        <Link
          to="/contracts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Contracts
        </Link>
      </div>

      <div className="no-print">
        <PageHeader
          title={`Lease ${contract.leaseNo || "—"}`}
          description={`${tenant?.name || "—"} · Unit ${unit?.flatNo || "—"}`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setSplitOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Split PDCs
              </Button>
              <Button variant="outline" onClick={() => setBankOpen(true)}>
                Bank names
              </Button>
              <Button variant="outline" onClick={() => openBreak("Ended")}>
                End / Vacate
              </Button>
              <Button variant="outline" onClick={() => openBreak("Cancelled")}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => openBreak("Broken")}>
                Break Contract
              </Button>
            </div>
          }
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4 no-print">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${statusColor}`}>
              {contract.status || "Active"}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Period</p>
            <p className="font-medium">
              {fmtDate(contract.startDate)} → {fmtDate(contract.endDate)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Rent</p>
            <p className="text-lg font-semibold">{currency(contract.rent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Revenue / Deferred</p>
            <p className="font-medium text-emerald-600">{currency(rev.currentYear)}</p>
            <p className="text-sm text-amber-600">{currency(rev.deferred)} deferred</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2 no-print">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lease details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tenant</span>
              <span className="font-medium">{tenant?.name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unit</span>
              <span className="font-medium">{unit?.flatNo || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span>{contract.bedroomType || unit?.bedroomType || "—"}</span>
            </div>
            {contract.endedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ended</span>
                <span>{fmtDate(contract.endedAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lease rent</span>
              <span className="font-medium">{currency(contract.rent)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cheques total</span>
              <span className="font-medium">{currency(chequeTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Difference</span>
              <span>{currency(contract.rent - chequeTotal)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment schedule */}
      <Card className="no-print">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Payment schedule (Cheques)</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setSplitOpen(true)}>
            Generate split PDCs
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Cheque No</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cleared</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cheques.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No cheques yet.
                  </TableCell>
                </TableRow>
              )}
              {cheques.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{fmtDate(c.chequeDate)}</TableCell>
                  <TableCell>{c.chequeNo || "—"}</TableCell>
                  <TableCell>{c.bank || "—"}</TableCell>
                  <TableCell className="text-right">{currency(c.amount)}</TableCell>
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
                  <TableCell>{c.clearedDate ? fmtDate(c.clearedDate) : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Edit cheque no / bank"
                        onClick={() => {
                          setEditCheque(c);
                          setChequeNo(c.chequeNo || "");
                          setChequeBank(c.bank || "");
                          setBankSearch("");
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm("Delete this cheque?")) return;
                          await deleteCheque(c.id);
                          toast.success("Deleted");
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Split PDCs */}
      <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Split rent into PDCs</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Dates are spaced evenly across{" "}
              <strong>
                {fmtDate(contract.startDate)} → {fmtDate(contract.endDate)}
              </strong>
            </p>
            <div>
              <Label>Number of cheques</Label>
              <Select value={String(splitCount)} onValueChange={(v) => setSplitCount(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 6, 12].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} × ~{currency(Math.round(contract.rent / n))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="mb-1 font-medium">Preview dates:</p>
              {previewDates.map((d, i) => (
                <div key={d}>
                  {i + 1}. {fmtDate(d)}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSplitOpen(false)}>
              Cancel
            </Button>
            <Button onClick={generateSplit} disabled={saving}>
              {saving ? "Creating..." : "Create cheques"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit cheque */}
      <Dialog open={!!editCheque} onOpenChange={(o) => !o && setEditCheque(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit cheque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cheque No</Label>
              <Input value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} />
            </div>
            <div>
              <Label>Bank</Label>
              <Input
                placeholder="Type to search or enter bank"
                value={chequeBank}
                onChange={(e) => {
                  setChequeBank(e.target.value);
                  setBankSearch(e.target.value);
                }}
              />
              <div className="mt-2 max-h-32 overflow-auto rounded border">
                {filteredBanks.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => setChequeBank(b)}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCheque(null)}>
              Cancel
            </Button>
            <Button onClick={saveChequeEdit} disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank names manager */}
      <Dialog open={bankOpen} onOpenChange={setBankOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Default bank names</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Type bank name"
                value={newBank}
                onChange={(e) => setNewBank(e.target.value)}
              />
              <Button type="button" onClick={addBankName}>
                Save
              </Button>
            </div>
            <div className="max-h-48 overflow-auto rounded border">
              {banks.map((b) => (
                <div key={b} className="flex items-center justify-between px-3 py-1.5 text-sm">
                  <span>{b}</span>
                  <button
                    type="button"
                    className="text-destructive text-xs"
                    onClick={() => {
                      const next = banks.filter((x) => x !== b);
                      setBanks(next);
                      saveBanks(next);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settlement / Break / Cancel / End */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionType === "Broken"
                ? "Break contract — Settlement"
                : actionType === "Cancelled"
                  ? "Cancel contract — Settlement"
                  : "End / Vacate — Settlement"}
            </DialogTitle>
          </DialogHeader>

          <div className="print-settlement space-y-4">
            <div className="print-only hidden print:block border-b pb-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                  AK
                </div>
                <div>
                  <h2 className="text-lg font-bold">Settlement Statement</h2>
                  <p className="text-sm text-muted-foreground">
                    Lease {contract.leaseNo} · {tenant?.name}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label>Break / End date</Label>
              <Input
                type="date"
                value={breakDate}
                onChange={(e) => setBreakDate(e.target.value)}
                className="no-print"
              />
              <p className="print:block hidden text-sm">{fmtDate(breakDate)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Calculated lease rent (to break date)</Label>
                <Input
                  type="number"
                  value={calcRent}
                  onChange={(e) => setCalcRent(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Penalty</Label>
                <Input
                  type="number"
                  value={penalty}
                  onChange={(e) => setPenalty(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Extra charges</Label>
                <Input
                  type="number"
                  value={extra}
                  onChange={(e) => setExtra(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Balance (payable / receivable)</Label>
                <Input
                  type="number"
                  value={balance}
                  onChange={(e) => setBalance(Number(e.target.value))}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  + tenant pays us · − we refund tenant
                </p>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Input
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Remarks"
              />
            </div>

            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span>Full lease rent</span>
                <span>{currency(contract.rent)}</span>
              </div>
              <div className="flex justify-between">
                <span>Calculated rent</span>
                <span>{currency(calcRent)}</span>
              </div>
              <div className="flex justify-between">
                <span>Penalty + Extra</span>
                <span>{currency(penalty + extra)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Balance</span>
                <span className={balance >= 0 ? "text-amber-700" : "text-emerald-700"}>
                  {currency(balance)} {balance >= 0 ? "(Receivable)" : "(Payable / Refund)"}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="no-print">
            <Button variant="outline" onClick={printSettlement}>
              <Printer className="mr-2 h-4 w-4" />
              Print / PDF
            </Button>
            <Button variant="outline" onClick={() => setActionOpen(false)}>
              Close
            </Button>
            <Button
              variant={actionType === "Broken" ? "destructive" : "default"}
              onClick={applyAction}
              disabled={saving}
            >
              {saving ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body * { visibility: hidden; }
          .print-settlement, .print-settlement * { visibility: visible; }
          .print-settlement {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 24px;
          }
        }
      `}</style>
    </AppShell>
  );
}

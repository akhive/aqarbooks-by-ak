import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
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
  currency,
  fmtDate,
  useStore,
  type Cheque,
  type ChequeStatus,
  type ContractStatus,
} from "@/lib/store";

export const Route = createFileRoute("/contract/$contractId")({
  component: ContractDetailPage,
});

const BANKS_KEY = "aqar_bank_names";

function loadBanks(): string[] {
  if (typeof window === "undefined") return ["ENBD", "FAB", "ADCB"];
  try {
    const raw = localStorage.getItem(BANKS_KEY);
    if (!raw) return ["ENBD", "FAB", "ADCB", "Mashreq", "Dubai Islamic Bank"];
    return JSON.parse(raw);
  } catch {
    return ["ENBD", "FAB", "ADCB"];
  }
}

function dayCount(start: string, end: string) {
  if (!start || !end) return 0;
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function splitDates(startDate: string, endDate: string, count: number): string[] {
  if (!startDate || count < 1) return [];
  const start = new Date(startDate + "T12:00:00");
  const end = new Date((endDate || startDate) + "T12:00:00");
  const dayOfMonth = start.getDate();

  let totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (totalMonths < 1) totalMonths = 1;
  const approxDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (approxDays >= 360 && approxDays <= 366) totalMonths = 12;

  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const monthsToAdd = Math.round((totalMonths * i) / count);
    const d = new Date(start.getFullYear(), start.getMonth() + monthsToAdd, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dayOfMonth, lastDay));
    out.push(toYmd(d));
  }
  return out;
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

function ContractDetailPage() {
  const { contractId } = Route.useParams();
  const navigate = useNavigate();
  const {
    data,
    loading,
    refresh,
    addCheque,
    updateCheque,
    deleteCheque,
    updateContract,
    addContract,
  } = useStore();

  const contract = data.contracts.find((c) => c.id === contractId);
  const tenant = data.tenants.find((t) => t.id === contract?.tenantId);
  const unit = data.units.find((u) => u.id === contract?.unitId);

  const isDraft = contract?.status === "Draft";
  const isActive = (contract?.status || "Active") === "Active";

  const rentCheques = useMemo(() => {
    if (!contract) return [];
    return data.cheques
      .filter(
        (c) =>
          (c.contractId === contractId || (!c.contractId && c.tenantId === contract.tenantId)) &&
          (c.kind || "rent") !== "deposit",
      )
      .sort((a, b) => (a.chequeDate || "").localeCompare(b.chequeDate || ""));
  }, [data.cheques, contractId, contract]);

  const depositCheques = useMemo(() => {
    if (!contract) return [];
    return data.cheques
      .filter(
        (c) =>
          (c.contractId === contractId || (!c.contractId && c.tenantId === contract.tenantId)) &&
          c.kind === "deposit",
      )
      .sort((a, b) => (a.chequeDate || "").localeCompare(b.chequeDate || ""));
  }, [data.cheques, contractId, contract]);

  const clearedRent = useMemo(
    () => rentCheques.filter((c) => c.status === "Cleared" || c.status === "Deposited"),
    [rentCheques],
  );
  const pendingReturnPdcs = useMemo(
    () => rentCheques.filter((c) => c.status === "PDC"),
    [rentCheques],
  );
  const receivedTotal = clearedRent.reduce((s, c) => s + c.amount, 0);
  const pendingReturnTotal = pendingReturnPdcs.reduce((s, c) => s + c.amount, 0);

  const [banks, setBanks] = useState<string[]>([]);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitKind, setSplitKind] = useState<"rent" | "deposit">("rent");
  const [splitCount, setSplitCount] = useState(4);

  const [editCheque, setEditCheque] = useState<Cheque | null>(null);
  const [chequeDate, setChequeDate] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeAmount, setChequeAmount] = useState(0);
  const [chequeStatus, setChequeStatus] = useState<ChequeStatus>("PDC");

  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<ContractStatus>("Broken");
  const [breakDate, setBreakDate] = useState(new Date().toISOString().slice(0, 10));
  const [calcRent, setCalcRent] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [extra, setExtra] = useState(0);
  const [depositRefund, setDepositRefund] = useState(0);
  const [balance, setBalance] = useState(0);
  const [actionNotes, setActionNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  const [renewOpen, setRenewOpen] = useState(false);
  const [renewRent, setRenewRent] = useState(0);
  const [renewDeposit, setRenewDeposit] = useState(0);
  const [renewStart, setRenewStart] = useState("");
  const [renewEnd, setRenewEnd] = useState("");
  const [renewLeaseNo, setRenewLeaseNo] = useState("");

  useEffect(() => {
    setBanks(loadBanks());
  }, []);

  useEffect(() => {
    if (!contract || !actionOpen) return;
    const days = dayCount(contract.startDate, breakDate);
    const used = Math.round((contract.rent / 365) * days);
    const received = rentCheques
      .filter((c) => c.status === "Cleared" || c.status === "Deposited")
      .reduce((s, c) => s + c.amount, 0);
    setCalcRent(used);
    setBalance(used + penalty + extra - received - depositRefund);
  }, [contract, actionOpen, breakDate, penalty, extra, depositRefund, rentCheques]);

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

  const rentTotal = rentCheques.reduce((s, c) => s + c.amount, 0);
  const depTotal = depositCheques.reduce((s, c) => s + c.amount, 0);
  const baseAmount = splitKind === "rent" ? contract.rent : contract.depositAmount || 0;
  const previewDates = splitDates(contract.startDate, contract.endDate, splitCount);

  const openSplit = (kind: "rent" | "deposit") => {
    setSplitKind(kind);
    setSplitCount(kind === "deposit" ? 1 : 4);
    setSplitOpen(true);
  };

  const generateSplit = async () => {
    if (baseAmount <= 0) {
      toast.error(splitKind === "deposit" ? "Set deposit amount first" : "Rent is zero");
      return;
    }
    setSaving(true);
    try {
      const dates = splitDates(contract.startDate, contract.endDate, splitCount);
      const each = Math.round((baseAmount / splitCount) * 100) / 100;
      let remaining = baseAmount;
      for (let i = 0; i < splitCount; i++) {
        const amount = i === splitCount - 1 ? Math.round(remaining * 100) / 100 : each;
        remaining -= amount;
        await addCheque({
          tenantId: contract.tenantId,
          contractId: contract.id,
          chequeDate: dates[i],
          chequeNo: `${contract.leaseNo || "L"}-${splitKind === "deposit" ? "D" : "R"}${i + 1}`,
          bank: "",
          amount,
          status: "PDC",
          reconciled: false,
          kind: splitKind,
        });
      }
      toast.success(`${splitCount} ${splitKind} cheque(s) created`);
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
    setDepositRefund(contract.depositAmount || 0);
    setActionNotes("");
    setActionOpen(true);
  };

  const applyAction = async () => {
    setSaving(true);
    try {
      const notes = [
        actionNotes,
        `Settlement: calc ${calcRent}, cleared ${receivedTotal}, pending PDC ${pendingReturnTotal}, penalty ${penalty}, extra ${extra}, deposit refund ${depositRefund}, balance ${balance}`,
      ]
        .filter(Boolean)
        .join(" | ");

      await updateContract(contract.id, {
        ...contract,
        status: actionType,
        endedAt: breakDate,
        notes,
        penalty: penalty || 0,
        extraCharges: extra || 0,
        actualRent: calcRent || 0,
      });

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
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 250);
  };

  const saveChequeEdit = async () => {
    if (!editCheque) return;
    setSaving(true);
    try {
      await updateCheque(editCheque.id, {
        ...editCheque,
        chequeDate,
        chequeNo,
        bank: chequeBank,
        amount: chequeAmount,
        status: chequeStatus,
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

  const removeCheque = async (id: string) => {
    if (isActive) {
      toast.error("Active contract — mark as Returned instead of deleting");
      return;
    }
    if (!confirm("Delete this cheque?")) return;
    try {
      await deleteCheque(id);
      toast.success("Deleted");
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  const openRenew = () => {
    const duration = Math.max(0, dayCount(contract.startDate, contract.endDate) - 1);
    const newStart = addDays(contract.endDate, 1);
    const newEnd = addDays(newStart, duration);
    const nums = data.contracts
      .map((c) => {
        const m = (c.leaseNo || "").match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const next = String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0");

    setRenewLeaseNo(next);
    setRenewStart(newStart);
    setRenewEnd(newEnd);
    setRenewRent(0);
    setRenewDeposit(contract.depositAmount || 0);
    setRenewOpen(true);
  };

  const confirmRenew = async () => {
    if (!renewRent || renewRent <= 0) {
      toast.error("Enter renewal rent amount");
      return;
    }
    setSaving(true);
    try {
      await addContract({
        leaseNo: renewLeaseNo,
        tenantId: contract.tenantId,
        unitId: contract.unitId,
        bedroomType: contract.bedroomType,
        startDate: renewStart,
        endDate: renewEnd,
        rent: renewRent,
        previousRent: contract.rent,
        status: "Draft",
        notes: `Renewed from ${contract.leaseNo}`,
        endedAt: "",
        depositAmount: renewDeposit || 0,
        penalty: 0,
        extraCharges: 0,
        actualRent: 0,
      });
      toast.success(`Draft lease ${renewLeaseNo} created — add PDCs then Submit`);
      setRenewOpen(false);
      navigate({ to: "/contracts" });
    } catch (e: any) {
      toast.error(e.message || "Renew failed");
    } finally {
      setSaving(false);
    }
  };

  const submitContract = async () => {
    if (!confirm("Submit this contract? It becomes Active and will appear in reports.")) return;
    try {
      await updateContract(contract.id, { ...contract, status: "Active" });
      toast.success("Contract submitted (Active)");
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  const saveDeposit = async (val: number) => {
    try {
      await updateContract(contract.id, { ...contract, depositAmount: val });
      toast.success("Deposit saved");
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  const statusColor =
    contract.status === "Draft"
      ? "bg-amber-100 text-amber-900"
      : contract.status === "Active"
        ? "bg-emerald-100 text-emerald-800"
        : contract.status === "Ended"
          ? "bg-slate-100 text-slate-800"
          : "bg-red-100 text-red-800";

  const ChequeTable = ({ rows, title }: { rows: Cheque[]; title: string }) => (
    <Card className="no-print mb-4">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
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
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No cheques yet. Use Split on this lease card.
                </TableCell>
              </TableRow>
            )}
            {rows.map((c) => (
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
                          : c.status === "Returned"
                            ? "bg-violet-100 text-violet-800"
                            : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {c.status === "Returned" ? "Returned" : c.status}
                  </span>
                </TableCell>
                <TableCell>{c.clearedDate ? fmtDate(c.clearedDate) : "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditCheque(c);
                        setChequeDate(c.chequeDate || "");
                        setChequeNo(c.chequeNo || "");
                        setChequeBank(c.bank || "");
                        setChequeAmount(c.amount || 0);
                        setChequeStatus((c.status as ChequeStatus) || "PDC");
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => removeCheque(c.id)}>
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
  );

  return (
    <AppShell>
      <div
        id="settlement-print"
        style={printMode ? { display: "block", padding: 24 } : { display: "none" }}
      >
        <div className="mb-6 flex items-center gap-3 border-b pb-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-black font-bold text-white">
            AK
          </div>
          <div>
            <h1 className="text-xl font-bold">Settlement Statement</h1>
            <p className="text-sm">Aqar Books — Built by AK</p>
          </div>
        </div>
        <p>
          <strong>Lease:</strong> {contract.leaseNo}
        </p>
        <p>
          <strong>Tenant:</strong> {tenant?.name} · {tenant?.mobile} · {tenant?.email}
        </p>
        <p>
          <strong>Unit:</strong> {unit?.flatNo}
        </p>
        <p>
          <strong>Action:</strong> {actionType} · <strong>Break date:</strong> {fmtDate(breakDate)}
        </p>
        <p>
          <strong>Period:</strong> {fmtDate(contract.startDate)} → {fmtDate(contract.endDate)}
        </p>
        <hr className="my-4" />
        <p className="font-semibold">Collected (Cleared)</p>
        <ul className="mb-3 text-sm">
          {clearedRent.length === 0 && <li>None</li>}
          {clearedRent.map((c) => (
            <li key={c.id}>
              {fmtDate(c.chequeDate)} · {c.chequeNo || "—"} · {currency(c.amount)}
            </li>
          ))}
        </ul>
        <p className="font-semibold">Pending PDCs to return</p>
        <ul className="mb-3 text-sm">
          {pendingReturnPdcs.length === 0 && <li>None</li>}
          {pendingReturnPdcs.map((c) => (
            <li key={c.id}>
              {fmtDate(c.chequeDate)} · {c.chequeNo || "—"} · {currency(c.amount)}
            </li>
          ))}
        </ul>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td>Calculated / Actual rent</td>
              <td className="text-right">{currency(calcRent)}</td>
            </tr>
            <tr>
              <td>Penalty</td>
              <td className="text-right">{currency(penalty)}</td>
            </tr>
            <tr>
              <td>Extra charges</td>
              <td className="text-right">{currency(extra)}</td>
            </tr>
            <tr>
              <td>Collected (cleared)</td>
              <td className="text-right">{currency(receivedTotal)}</td>
            </tr>
            <tr>
              <td>Deposit refund</td>
              <td className="text-right">{currency(depositRefund)}</td>
            </tr>
            <tr>
              <td className="pt-3 font-bold">Balance</td>
              <td className="pt-3 text-right font-bold">
                {currency(balance)} {balance >= 0 ? "(Receivable)" : "(Payable)"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="no-print">
        <div className="mb-4">
          <Link
            to="/contracts"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Contracts
          </Link>
        </div>

        <PageHeader
          title={`Lease ${contract.leaseNo || "—"}`}
          description={`${tenant?.name || "—"} · Unit ${unit?.flatNo || "—"}`}
          action={
            <div className="flex flex-wrap gap-2">
              {isDraft && <Button onClick={submitContract}>Submit contract</Button>}
              <Button variant="outline" onClick={() => openSplit("rent")}>
                <Plus className="mr-2 h-4 w-4" />
                Split rent PDCs
              </Button>
              <Button variant="outline" onClick={() => openSplit("deposit")}>
                <Plus className="mr-2 h-4 w-4" />
                Split deposit
              </Button>
              {!isDraft && (
                <Button variant="outline" onClick={openRenew}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Renew
                </Button>
              )}
              {isActive && (
                <>
                  <Button variant="outline" onClick={() => openBreak("Ended")}>
                    End / Vacate
                  </Button>
                  <Button variant="outline" onClick={() => openBreak("Cancelled")}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={() => openBreak("Broken")}>
                    Break Contract
                  </Button>
                </>
              )}
            </div>
          }
        />

        {isDraft && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Draft</strong> — add / edit PDCs here, then click <strong>Submit contract</strong>.
            Draft leases do not appear in reports until submitted.
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Status</p>
              <span
                className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${statusColor}`}
              >
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
              <p className="text-xs text-muted-foreground">Deposit</p>
              <p className="text-lg font-semibold">{currency(contract.depositAmount || 0)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lease & tenant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tenant</span>
                <span className="font-medium">{tenant?.name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span>{tenant?.mobile || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{tenant?.email || "—"}</span>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unit</span>
                <span className="font-medium">{unit?.flatNo || "—"}</span>
              </div>

              {(() => {
                const rentAmt =
                  contract.actualRent && contract.actualRent > 0
                    ? contract.actualRent
                    : contract.rent;
                const endDt =
                  (contract.status === "Broken" ||
                    contract.status === "Cancelled" ||
                    contract.status === "Ended") &&
                  contract.endedAt
                    ? contract.endedAt
                    : contract.endDate;

                const start = new Date(contract.startDate + "T12:00:00");
                const end = new Date(endDt + "T12:00:00");
                const leasedDays =
                  end >= start
                    ? Math.round((end.getTime() - start.getTime()) / 86400000) + 1
                    : 0;
                const daily = leasedDays > 0 ? rentAmt / leasedDays : 0;

                const thisYear = new Date().getFullYear();
                let revenue = 0;
                let deferred = 0;

                if (leasedDays > 0) {
                  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
                    const yStart = new Date(y, 0, 1, 12, 0, 0);
                    const yEnd = new Date(y, 11, 31, 12, 0, 0);
                    const from = start > yStart ? start : yStart;
                    const to = end < yEnd ? end : yEnd;
                    if (to < from) continue;
                    const days =
                      Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
                    const amt = Math.round(daily * days);
                    if (y === thisYear) revenue += amt;
                    else deferred += amt;
                  }
                }

                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Leased days</span>
                      <span className="font-medium">{leasedDays}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revenue / Deferred</span>
                      <span>
                        {currency(revenue)} / {currency(deferred)}
                      </span>
                    </div>
                  </>
                );
              })()}

              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual rent</span>
                <span>
                  {currency(
                    contract.actualRent && contract.actualRent > 0
                      ? contract.actualRent
                      : contract.rent,
                  )}
                </span>
              </div>

                    <div className="space-y-0.5 border-l-2 border-muted pl-2 text-xs text-muted-foreground">
                      {parts.map((p) => (
                        <div key={p.year} className="flex justify-between">
                          <span>
                            Year {p.year}
                            {p.year < thisYear
                              ? " (prior)"
                              : p.year > thisYear
                                ? " (deferred)"
                                : " (this year)"}
                          </span>
                          <span>{currency(p.amount)}</span>
                        </div>
                      ))}
                      {priorYears > 0 && (
                        <div className="flex justify-between">
                          <span>Prior years total</span>
                          <span>{currency(priorYears)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium text-foreground">
                        <span>Total rent used</span>
                        <span>{currency(rentAmt)}</span>
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual rent</span>
                <span>
                  {currency(
                    contract.actualRent && contract.actualRent > 0
                      ? contract.actualRent
                      : contract.rent,
                  )}
                </span>
              </div>

              {(contract.penalty || 0) > 0 || (contract.extraCharges || 0) > 0 ? (
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Penalty / Extra</span>
                  <span>
                    {currency(contract.penalty || 0)} / {currency(contract.extraCharges || 0)}
                  </span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deposit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <Label>Security deposit (AED)</Label>
                <div className="mt-1 flex gap-2">
                  <Input type="number" defaultValue={contract.depositAmount || 0} id="dep-input" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const el = document.getElementById("dep-input") as HTMLInputElement;
                      saveDeposit(Number(el?.value) || 0);
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deposit cheques total</span>
                <span>{currency(depTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rent cheques total</span>
                <span>{currency(rentTotal)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <ChequeTable rows={rentCheques} title="Payment schedule (Rent cheques)" />
        <ChequeTable rows={depositCheques} title="Deposit cheques" />
      </div>

      <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
        <DialogContent className="no-print">
          <DialogHeader>
            <DialogTitle>
              Split {splitKind === "deposit" ? "deposit" : "rent"} into PDCs
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Amount {currency(baseAmount)} · {fmtDate(contract.startDate)} →{" "}
              {fmtDate(contract.endDate)}
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
                      {n} × ~{currency(Math.round(baseAmount / n) || 0)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md bg-muted p-3 text-sm">
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

      <Dialog open={!!editCheque} onOpenChange={(o) => !o && setEditCheque(null)}>
        <DialogContent className="no-print">
          <DialogHeader>
            <DialogTitle>Edit cheque</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
            </div>
            <div>
              <Label>Cheque No</Label>
              <Input value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} />
            </div>
            <div>
              <Label>Bank</Label>
              <Input
                list="bank-list"
                value={chequeBank}
                onChange={(e) => setChequeBank(e.target.value)}
              />
              <datalist id="bank-list">
                {banks.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                value={chequeAmount || ""}
                onChange={(e) => setChequeAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={chequeStatus}
                onValueChange={(v) => setChequeStatus(v as ChequeStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDC">PDC</SelectItem>
                  <SelectItem value="Deposited">Deposited</SelectItem>
                  <SelectItem value="Cleared">Cleared</SelectItem>
                  <SelectItem value="Bounced">Bounced</SelectItem>
                  <SelectItem value="Returned">Returned to tenant</SelectItem>
                </SelectContent>
              </Select>
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

      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="no-print">
          <DialogHeader>
            <DialogTitle>Confirm renewal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>New lease no</Label>
              <Input value={renewLeaseNo} onChange={(e) => setRenewLeaseNo(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start</Label>
                <Input
                  type="date"
                  value={renewStart}
                  onChange={(e) => setRenewStart(e.target.value)}
                />
              </div>
              <div>
                <Label>End</Label>
                <Input type="date" value={renewEnd} onChange={(e) => setRenewEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Renewal rent (AED) *</Label>
              <Input
                type="number"
                value={renewRent || ""}
                onChange={(e) => setRenewRent(Number(e.target.value))}
                placeholder="Enter new annual rent"
              />
            </div>
            <div>
              <Label>Deposit (AED)</Label>
              <Input
                type="number"
                value={renewDeposit || ""}
                onChange={(e) => setRenewDeposit(Number(e.target.value))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Previous rent: {currency(contract.rent)}. Creates a <strong>Draft</strong> lease —
              add PDCs, then Submit.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRenew} disabled={saving}>
              Create draft lease
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="no-print max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionType === "Broken"
                ? "Break — Settlement"
                : actionType === "Cancelled"
                  ? "Cancel — Settlement"
                  : "End / Vacate — Settlement"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Break / end date</Label>
              <Input type="date" value={breakDate} onChange={(e) => setBreakDate(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">
                Days = {dayCount(contract.startDate, breakDate)} · rent ÷ 365 × days
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Calculated rent → Actual rent</Label>
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
                <Label>Extra charges (other income)</Label>
                <Input
                  type="number"
                  value={extra}
                  onChange={(e) => setExtra(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Deposit refund</Label>
                <Input
                  type="number"
                  value={depositRefund}
                  onChange={(e) => setDepositRefund(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">
                Collected (Cleared) — {currency(receivedTotal)}
              </p>
              {clearedRent.length === 0 ? (
                <p className="text-xs text-muted-foreground">None cleared yet.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {clearedRent.map((c) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <span>
                        {fmtDate(c.chequeDate)} · {c.chequeNo || "—"}
                      </span>
                      <span>{currency(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="mb-2 text-sm font-medium text-amber-900">
                Pending PDCs to return — {currency(pendingReturnTotal)}
              </p>
              {pendingReturnPdcs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No open PDCs.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {pendingReturnPdcs.map((c) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <span>
                        {fmtDate(c.chequeDate)} · {c.chequeNo || "—"}
                      </span>
                      <span>{currency(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-1 rounded-md bg-muted p-3 text-sm">
              <div className="flex justify-between">
                <span>Calculated rent</span>
                <span>{currency(calcRent)}</span>
              </div>
              <div className="flex justify-between">
                <span>+ Penalty + Extra</span>
                <span>{currency(penalty + extra)}</span>
              </div>
              <div className="flex justify-between">
                <span>− Collected</span>
                <span>{currency(receivedTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>− Deposit refund</span>
                <span>{currency(depositRefund)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Balance</span>
                <span>
                  {currency(balance)} {balance >= 0 ? "(Receivable)" : "(Payable)"}
                </span>
              </div>
            </div>
            <div>
              <Label>Balance (editable)</Label>
              <Input
                type="number"
                value={balance}
                onChange={(e) => setBalance(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
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
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #settlement-print, #settlement-print * { visibility: visible !important; }
          #settlement-print {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 24px;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </AppShell>
  );
}

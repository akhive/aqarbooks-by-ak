import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
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
  type ContractStatus,
} from "@/lib/store";
import { supabase } from "../supabase";

export const Route = createFileRoute("/contract/$contractId")({
  component: ContractDetailPage,
});

function addMonths(iso: string, months: number) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function ContractDetailPage() {
  const { contractId } = Route.useParams();
  const { data, loading, refresh, addCheque, deleteCheque, updateContract } = useStore();

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

  const [splitOpen, setSplitOpen] = useState(false);
  const [splitCount, setSplitCount] = useState(4);
  const [firstDate, setFirstDate] = useState("");
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<ContractStatus>("Ended");
  const [actionDate, setActionDate] = useState(new Date().toISOString().slice(0, 10));
  const [actionNotes, setActionNotes] = useState("");
  const [saving, setSaving] = useState(false);

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
        <p className="mt-1 text-xs text-muted-foreground">ID: {contractId}</p>
        <Link
          to="/contracts"
          className="mt-4 inline-flex rounded-md border px-4 py-2 text-sm"
        >
          Back to Contracts
        </Link>
      </AppShell>
    );
  }

  const rev = calcRevenue(contract.startDate, contract.endDate, contract.rent);
  const chequeTotal = cheques.reduce((s, c) => s + c.amount, 0);

  const generateSplit = async () => {
    if (!firstDate) {
      toast.error("Select first cheque date");
      return;
    }
    setSaving(true);
    try {
      const each = Math.round((contract.rent / splitCount) * 100) / 100;
      let remaining = contract.rent;
      for (let i = 0; i < splitCount; i++) {
        const amount = i === splitCount - 1 ? Math.round(remaining * 100) / 100 : each;
        remaining -= amount;
        await addCheque({
          tenantId: contract.tenantId,
          contractId: contract.id,
          chequeDate: addMonths(firstDate, i),
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

  const applyAction = async () => {
    setSaving(true);
    try {
      await updateContract(contract.id, {
        ...contract,
        status: actionType,
        endedAt: actionDate,
        notes: actionNotes || contract.notes,
      });
      await supabase
        .from("contracts")
        .update({
          status: actionType,
          ended_at: actionDate,
          notes: actionNotes || null,
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

  const statusColor =
    contract.status === "Active"
      ? "bg-emerald-100 text-emerald-800"
      : contract.status === "Ended"
        ? "bg-slate-100 text-slate-800"
        : "bg-red-100 text-red-800";

  return (
    <AppShell>
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
            <Button variant="outline" onClick={() => setSplitOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Split PDCs
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setActionType("Ended");
                setActionOpen(true);
              }}
            >
              End / Vacate
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setActionType("Cancelled");
                setActionOpen(true);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setActionType("Broken");
                setActionOpen(true);
              }}
            >
              Break Contract
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <p className="text-xs text-muted-foreground">Prev {currency(contract.previousRent)}</p>
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

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lease details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lease No</span>
              <span className="font-medium">{contract.leaseNo || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tenant</span>
              <span className="font-medium">{tenant?.name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground

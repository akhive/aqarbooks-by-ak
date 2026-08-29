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
        <Button asChild className="mt-4" variant="outline">
          <Link to="/contracts">Back to Contracts</Link>
        </Button>
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
    if (splitCount < 1 || splitCount > 24) {
      toast.error("Split count must be 1–24");
      return;
    }
    setSaving(true);
    try {
      const each = Math.round((contract.rent / splitCount) * 100) / 100;
      let remaining = contract.rent;
      for (let i = 0; i < splitCount; i++) {
        const amount = i === splitCount - 1 ? Math.round(remaining * 100) / 100 : each;
        remaining -= amount;
        const date = addMonths(firstDate, i);
        await addCheque({
          tenantId: contract.tenantId,
          contractId: contract.id,
          chequeDate: date,
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

  const unitLink = contract.unitId ? (
    <Link
      to="/units/$unitId"
      params={{ unitId: contract.unitId }}
      className="font-medium text-primary underline-offset-2 hover:underline"
    >
      {unit?.flatNo || "—"}
    </Link>
  ) : (
    <span className="font-medium">—</span>
  );

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
        description={
          <span>
            {tenant?.name || "—"} · Unit {unitLink}
          </span>
        }
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
              <span className="text-muted-foreground">Mobile</span>
              <span>{tenant?.mobile || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Unit</span>
              {unitLink}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Building</span>
              <span>{unit?.building || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bedroom Type</span>
              <span>{contract.bedroomType || unit?.bedroomType || "—"}</span>
            </div>
            {contract.endedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ended / Vacated</span>
                <span>{fmtDate(contract.endedAt)}</span>
              </div>
            )}
            {contract.notes && (
              <div>
                <p className="text-muted-foreground">Notes</p>
                <p>{contract.notes}</p>
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
              <span className={chequeTotal === contract.rent ? "text-emerald-600" : "text-amber-600"}>
                {currency(contract.rent - chequeTotal)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
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
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cheques.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No cheques yet. Use “Split PDCs” to create them from rent.
                  </TableCell>
                </TableRow>
              )}
              {cheques.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{fmtDate(c.chequeDate)}</TableCell>
                  <TableCell>{c.chequeNo || "—"}</TableCell>
                  <TableCell>{c.bank || "—"}</TableCell>
                  <TableCell className="text-right">{currency(c.amount)}</TableCell>
                  <TableCell>{c.status}</TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm("Delete this cheque?")) return;
                        try {
                          await deleteCheque(c.id);
                          toast.success("Deleted");
                        } catch (e: any) {
                          toast.error(e.message || "Failed");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Split rent into PDCs</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
            <div>
              <Label>First cheque date</Label>
              <Input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} />
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

      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "Ended"
                ? "End contract / Vacate unit"
                : actionType === "Cancelled"
                  ? "Cancel contract"
                  : "Break contract"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Effective date</Label>
              <Input type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)} />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Reason / remarks"
              />
            </div>
          </div>
          <DialogFooter>
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
    </AppShell>
  );
}

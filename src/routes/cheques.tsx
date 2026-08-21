import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { currency, fmtDate, useStore, type Cheque, type ChequeStatus } from "@/lib/store";

export const Route = createFileRoute("/cheques")({
  head: () => ({
    meta: [{ title: "Cheques (PDC) — Aqar Books" }],
  }),
  component: ChequesPage,
});

type Form = Omit<Cheque, "id">;

const empty: Form = {
  tenantId: "",
  contractId: "",
  chequeDate: "",
  chequeNo: "",
  bank: "",
  amount: 0,
  status: "PDC",
  clearedDate: "",
  reconciled: false,
  kind: "rent",
};

function ChequesPage() {
  const { data, addCheque, updateCheque, deleteCheque } = useStore();
  const [tenantSearch, setTenantSearch] = useState("");
  const [flatSearch, setFlatSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState("");

  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "—";

  const flatNoFor = (cheque: { tenantId: string; contractId?: string }) => {
    const contract =
      data.contracts.find((c) => c.id === cheque.contractId) ||
      data.contracts.find(
        (c) => c.tenantId === cheque.tenantId && (c.status || "Active") === "Active",
      );
    if (!contract?.unitId) return "—";
    return data.units.find((u) => u.id === contract.unitId)?.flatNo || "—";
  };

  const filtered = useMemo(() => {
    const tq = tenantSearch.trim().toLowerCase();
    const fq = flatSearch.trim().toLowerCase();
    return data.cheques
      .filter((c) => {
        if (tq && !tenantName(c.tenantId).toLowerCase().includes(tq)) return false;
        if (fq && !flatNoFor(c).toLowerCase().includes(fq)) return false;
        return true;
      })
      .sort((a, b) => (a.chequeDate || "").localeCompare(b.chequeDate || ""));
  }, [data.cheques, data.tenants, data.contracts, data.units, tenantSearch, flatSearch]);

  const startAdd = () => {
    setEditing(null);
    setForm(empty);
    setError("");
    setOpen(true);
  };

  const startEdit = (c: Cheque) => {
    setEditing(c.id);
    const { id: _id, ...rest } = c;
    setForm({ ...empty, ...rest });
    setError("");
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenantId) return setError("Select tenant");
    if (!form.chequeDate) return setError("Cheque date required");
    if (form.amount <= 0) return setError("Amount must be greater than zero");

    // If clearance date filled → force Cleared
    const payload: Form = {
      ...form,
      status: form.clearedDate ? "Cleared" : form.status,
      reconciled: !!form.clearedDate,
    };

    try {
      if (editing) {
        await updateCheque(editing, payload);
        toast.success("Cheque updated");
      } else {
        await addCheque(payload);
        toast.success("Cheque added");
      }
      setOpen(false);
    } catch (err: any) {
      setError(err.message || "Failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this cheque?")) return;
    try {
      await deleteCheque(id);
      toast.success("Deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Cheques (PDC)"
        description={`${filtered.length} cheque(s)`}
        action={
          <Button onClick={startAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add cheque
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-full max-w-[220px]">
            <Label>Search tenant</Label>
            <Input
              placeholder="Tenant name"
              value={tenantSearch}
              onChange={(e) => setTenantSearch(e.target.value)}
            />
          </div>
          <div className="w-full max-w-[160px]">
            <Label>Search flat no</Label>
            <Input
              placeholder="e.g. 101"
              value={flatSearch}
              onChange={(e) => setFlatSearch(e.target.value)}
            />
          </div>
          {(tenantSearch || flatSearch) && (
            <Button
              variant="ghost"
              onClick={() => {
                setTenantSearch("");
                setFlatSearch("");
              }}
            >
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Flat</TableHead>
                <TableHead>Cheque no.</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cleared</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    No cheques found.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{fmtDate(c.chequeDate)}</TableCell>
                  <TableCell className="font-medium">{tenantName(c.tenantId)}</TableCell>
                  <TableCell>{flatNoFor(c)}</TableCell>
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
                  <TableCell>{c.kind || "rent"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit cheque" : "Add cheque"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Tenant *</Label>
              <Select
                value={form.tenantId}
                onValueChange={(v) => setForm({ ...form, tenantId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {data.tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cheque date *</Label>
              <Input
                type="date"
                value={form.chequeDate}
                onChange={(e) => setForm({ ...form, chequeDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Cheque no.</Label>
              <Input
                value={form.chequeNo}
                onChange={(e) => setForm({ ...form, chequeNo: e.target.value })}
              />
            </div>
            <div>
              <Label>Bank</Label>
              <Input
                value={form.bank}
                onChange={(e) => setForm({ ...form, bank: e.target.value })}
              />
            </div>
            <div>
              <Label>Amount *</Label>
              <Input
                type="number"
                value={form.amount || ""}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Kind</Label>
              <Select
                value={form.kind || "rent"}
                onValueChange={(v) => setForm({ ...form, kind: v as "rent" | "deposit" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">Rent</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Clearance date (optional — sets status to Cleared)</Label>
              <Input
                type="date"
                value={form.clearedDate || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    clearedDate: e.target.value,
                    status: e.target.value ? "Cleared" : "PDC",
                  })
                }
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as ChequeStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDC">PDC</SelectItem>
                  <SelectItem value="Deposited">Deposited</SelectItem>
                  <SelectItem value="Cleared">Cleared</SelectItem>
                  <SelectItem value="Bounced">Bounced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save" : "Add"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

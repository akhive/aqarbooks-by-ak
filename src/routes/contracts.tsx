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
import { calcRevenue, currency, fmtDate, useStore, type Contract } from "@/lib/store";

export const Route = createFileRoute("/contracts")({
  head: () => ({
    meta: [{ title: "Contracts — Estate Manager" }],
  }),
  component: ContractsPage,
});

type Form = Omit<Contract, "id">;

const empty: Form = {
  leaseNo: "",
  tenantId: "",
  unitId: "",
  startDate: "",
  endDate: "",
  rent: 0,
  previousRent: 0,
  bedroomType: "",
};

function ContractsPage() {
  const { data, addContract, updateContract, deleteContract } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState("");

  const tenantMap = useMemo(() => {
    const m: Record<string, string> = {};
    data.tenants.forEach((t) => (m[t.id] = t.name));
    return m;
  }, [data.tenants]);

  const unitMap = useMemo(() => {
    const m: Record<string, string> = {};
    data.units.forEach((u) => (m[u.id] = `${u.flatNo} — ${u.building || ""}`));
    return m;
  }, [data.units]);

  const startAdd = () => {
  setEditing(null);

  // Auto next lease number (001, 002, ...) — still editable
  const nums = data.contracts
    .map((c) => {
      const m = (c.leaseNo || "").match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  const autoLeaseNo = String(next).padStart(3, "0"); // 001, 002, 005...

  setForm({ ...empty, leaseNo: autoLeaseNo });
  setError("");
  setOpen(true);
};

  const startEdit = (c: Contract) => {
    setEditing(c.id);
    const { id: _id, ...rest } = c;
    setForm(rest);
    setError("");
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenantId) return setError("Please select a tenant.");
    if (!form.startDate || !form.endDate) return setError("Start and End dates are required.");
    if (form.endDate < form.startDate) return setError("End date must be after start date.");
    if (form.rent <= 0) return setError("Rent must be greater than zero.");

    try {
      if (editing) {
        await updateContract(editing, form);
        toast.success("Contract updated");
      } else {
        await addContract(form);
        toast.success("Contract added");
      }
      setOpen(false);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }
  };

  const remove = async (id: string, leaseNo: string) => {
    if (!confirm(`Delete contract ${leaseNo || id}?`)) return;
    try {
      await deleteContract(id);
      toast.success("Contract deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Contracts"
        description={`${data.contracts.length} contract(s)`}
        action={
          <Button onClick={startAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contract
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lease No</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>Previous Rent</TableHead>
                <TableHead>Revenue (This Year)</TableHead>
                <TableHead>Deferred</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.contracts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    No contracts yet. Click “Add Contract”.
                  </TableCell>
                </TableRow>
              )}
              {data.contracts.map((c) => {
                const { currentYear, deferred } = calcRevenue(c.startDate, c.endDate, c.rent);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.leaseNo || "—"}</TableCell>
                    <TableCell>{tenantMap[c.tenantId] || "—"}</TableCell>
                    <TableCell>{unitMap[c.unitId] || "—"}</TableCell>
                    <TableCell>
                      {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
                    </TableCell>
                    <TableCell>{currency(c.rent)}</TableCell>
                    <TableCell>{currency(c.previousRent)}</TableCell>
                    <TableCell className="text-emerald-600 font-medium">{currency(currentYear)}</TableCell>
                    <TableCell className="text-amber-600">{currency(deferred)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(c.id, c.leaseNo)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Contract" : "Add Contract"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Lease No</Label>
              <Input
                value={form.leaseNo}
                onChange={(e) => setForm({ ...form, leaseNo: e.target.value })}
                placeholder="e.g. L-2026-001"
              />
            </div>

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
              <Label>Unit / Flat</Label>
              <Select
                value={form.unitId}
                onValueChange={(v) => setForm({ ...form, unitId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {data.units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.flatNo} — {u.building} ({u.bedroomType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Rent (AED) *</Label>
                <Input
                  type="number"
                  value={form.rent || ""}
                  onChange={(e) => setForm({ ...form, rent: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Bedroom Type</Label>
                <Input
                  value={form.bedroomType}
                  onChange={(e) => setForm({ ...form, bedroomType: e.target.value })}
                  placeholder="1BHK / 2BHK / Studio"
                />
              </div>
            </div>

            {form.startDate && form.endDate && form.rent > 0 && (
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Revenue (This Year)</span>
                  <strong className="text-emerald-600">
                    {currency(calcRevenue(form.startDate, form.endDate, form.rent).currentYear)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Deferred Revenue</span>
                  <strong className="text-amber-600">
                    {currency(calcRevenue(form.startDate, form.endDate, form.rent).deferred)}
                  </strong>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save Changes" : "Add Contract"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

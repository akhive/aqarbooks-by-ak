import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, fmtDate, useStore, type Tenant, type TenantStatus } from "@/lib/store";

export const Route = createFileRoute("/tenants")({
  head: () => ({
    meta: [
      { title: "Tenants — Estate Manager" },
      {
        name: "description",
        content: "Add, edit and remove tenants with flat number, contract dates, rent amount and status.",
      },
      { property: "og:title", content: "Tenants — Estate Manager" },
      { property: "og:description", content: "Manage tenant contracts, rent amounts and lease status." },
    ],
  }),
  component: TenantsPage,
});

type Form = Omit<Tenant, "id">;

const empty: Form = {
  name: "",
  phone: "",
  flatNo: "",
  contractStart: "",
  contractEnd: "",
  rentAmount: 0,
  status: "Active",
};

const statusVariant = (s: TenantStatus) =>
  s === "Active" ? "bg-success/12 text-success" : s === "Notice" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground";

function TenantsPage() {
  const { data, addTenant, updateTenant, deleteTenant } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState("");

  const startAdd = () => {
    setEditing(null);
    setForm(empty);
    setError("");
    setOpen(true);
  };

  const startEdit = (t: Tenant) => {
    setEditing(t.id);
    const { id: _id, ...rest } = t;
    setForm(rest);
    setError("");
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.flatNo.trim()) return setError("Name and flat number are required.");
    if (!form.contractStart || !form.contractEnd) return setError("Contract start and end dates are required.");
    if (form.contractEnd < form.contractStart) return setError("Contract end must be after the start date.");
    if (form.rentAmount <= 0) return setError("Rent amount must be greater than zero.");
    if (editing) {
      updateTenant(editing, form);
      toast.success("Tenant updated");
    } else {
      addTenant(form);
      toast.success("Tenant added");
    }
    setOpen(false);
  };

  return (
    <AppShell>
      <PageHeader
        title="Tenants"
        description="Contracts, rent and lease status for every occupant."
        action={
          <Button onClick={startAdd}>
            <Plus className="size-4" /> Add tenant
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Flat</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead className="text-right">Rent / year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No tenants yet — add your first one.
                  </TableCell>
                </TableRow>
              ) : (
                data.tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.phone || "No phone"}</p>
                    </TableCell>
                    <TableCell>{t.flatNo}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(t.contractStart)} → {fmtDate(t.contractEnd)}
                    </TableCell>
                    <TableCell className="text-right font-medium">{currency(t.rentAmount)}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusVariant(t.status)}`}>
                        {t.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(t)} aria-label="Edit tenant">
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete tenant"
                        onClick={() => {
                          deleteTenant(t.id);
                          toast.success("Tenant deleted");
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit tenant" : "Add tenant"}</DialogTitle>
            <DialogDescription>Contract details are used for renewal reminders.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="name">Tenant name</Label>
              <Input
                id="name"
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                maxLength={30}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="flat">Flat no.</Label>
              <Select value={form.flatNo} onValueChange={(v) => setForm({ ...form, flatNo: v })}>
                <SelectTrigger id="flat">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {data.units.map((u) => (
                    <SelectItem key={u.id} value={u.flatNo}>
                      {u.flatNo} · {u.building}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="start">Contract start</Label>
              <Input
                id="start"
                type="date"
                value={form.contractStart}
                onChange={(e) => setForm({ ...form, contractStart: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end">Contract end</Label>
              <Input
                id="end"
                type="date"
                value={form.contractEnd}
                onChange={(e) => setForm({ ...form, contractEnd: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rent">Rent amount (per year)</Label>
              <Input
                id="rent"
                type="number"
                min={0}
                value={form.rentAmount || ""}
                onChange={(e) => setForm({ ...form, rentAmount: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as TenantStatus })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["Active", "Notice", "Expired"] as const).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save changes" : "Add tenant"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <p className="mt-4 text-xs text-muted-foreground">
        <Badge variant="secondary" className="mr-2">
          Tip
        </Badge>
        Deleting a tenant also removes their cheques.
      </p>
    </AppShell>
  );
}

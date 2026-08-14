import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, useStore, type Tenant } from "@/lib/store";

export const Route = createFileRoute("/tenants")({
  head: () => ({
    meta: [{ title: "Tenants — Estate Manager" }],
  }),
  component: TenantsPage,
});

type Form = Omit<Tenant, "id">;

const empty: Form = {
  name: "",
  mobile: "",
  email: "",
  nationality: "",
  fromDate: "",
};

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Tenant name is required.");
    try {
      if (editing) {
        await updateTenant(editing, form);
        toast.success("Tenant updated");
      } else {
        await addTenant(form);
        toast.success("Tenant added");
      }
      setOpen(false);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete tenant "${name}"? This will also remove their contracts and cheques.`)) return;
    try {
      await deleteTenant(id);
      toast.success("Tenant deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Tenants"
        description={`${data.tenants.length} tenant(s)`}
        action={
          <Button onClick={startAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Tenant
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Nationality</TableHead>
                <TableHead>With us from</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tenants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No tenants yet. Click “Add Tenant” to start.
                  </TableCell>
                </TableRow>
              )}
              {data.tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.mobile || "—"}</TableCell>
                  <TableCell>{t.email || "—"}</TableCell>
                  <TableCell>{t.nationality || "—"}</TableCell>
                  <TableCell>{fmtDate(t.fromDate)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(t.id, t.name)}>
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
            <DialogTitle>{editing ? "Edit Tenant" : "Add Tenant"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Tenant Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                placeholder="+971 50 000 0000"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label>Nationality</Label>
              <Input
                value={form.nationality}
                onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                placeholder="e.g. Indian, Emirati"
              />
            </div>
            <div>
              <Label>With us from</Label>
              <Input
                type="date"
                value={form.fromDate}
                onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save Changes" : "Add Tenant"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

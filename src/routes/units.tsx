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
import { currency, fmtDate, useStore, type Unit } from "@/lib/store";

export const Route = createFileRoute("/units")({
  head: () => ({
    meta: [
      { title: "Units — Estate Manager" },
      {
        name: "description",
        content: "See every flat in the portfolio with occupied or vacant status, tenant and rent.",
      },
    ],
  }),
  component: UnitsPage,
});

type Form = Omit<Unit, "id">;
const empty: Form = { flatNo: "", building: "", type: "", marketRent: 0 };

function UnitsPage() {
  const { data, addUnit, updateUnit, deleteUnit } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState("");

  const tenantFor = (flatNo: string) =>
    data.tenants.find((t) => t.flatNo === flatNo && t.status !== "Expired");
  const vacantCount = data.units.filter((u) => !tenantFor(u.flatNo)).length;

  const startAdd = () => {
    setEditing(null);
    setForm(empty);
    setError("");
    setOpen(true);
  };

  const startEdit = (u: Unit) => {
    setEditing(u.id);
    setForm({ flatNo: u.flatNo, building: u.building, type: u.type, marketRent: u.marketRent });
    setError("");
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.flatNo.trim()) return setError("Flat number is required.");
    if (!form.building.trim()) return setError("Building is required.");
    try {
      if (editing) {
        await updateUnit(editing, form);
        toast.success("Unit updated");
      } else {
        await addUnit(form);
        toast.success("Unit added");
      }
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save unit");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Units"
        description={`${data.units.length} units · ${data.units.length - vacantCount} occupied · ${vacantCount} vacant`}
        action={
          <Button onClick={startAdd}>
            <Plus className="size-4" /> Add Unit
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flat</TableHead>
                <TableHead>Building</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Contract ends</TableHead>
                <TableHead className="text-right">Rent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.units.map((u) => {
                const t = tenantFor(u.flatNo);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.flatNo}</TableCell>
                    <TableCell>{u.building}</TableCell>
                    <TableCell>{u.type}</TableCell>
                    <TableCell>{t ? t.name : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t ? fmtDate(t.contractEnd) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{currency(t ? t.rentAmount : u.marketRent)}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          t ? "bg-success/12 text-success" : "bg-warning/15 text-warning"
                        }`}
                      >
                        {t ? "Occupied" : "Vacant"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(u)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (confirm("Delete this unit?")) {
                              await deleteUnit(u.id);
                              toast.success("Unit deleted");
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Unit" : "Add Unit"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Flat No</Label>
              <Input
                value={form.flatNo}
                onChange={(e) => setForm({ ...form, flatNo: e.target.value })}
                placeholder="101"
              />
            </div>
            <div className="space-y-2">
              <Label>Building</Label>
              <Input
                value={form.building}
                onChange={(e) => setForm({ ...form, building: e.target.value })}
                placeholder="Al Noor Tower"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Input
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                placeholder="2 BHK"
              />
            </div>
            <div className="space-y-2">
              <Label>Market Rent (AED)</Label>
              <Input
                type="number"
                value={form.marketRent || ""}
                onChange={(e) => setForm({ ...form, marketRent: Number(e.target.value) })}
                placeholder="55000"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Update" : "Add Unit"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

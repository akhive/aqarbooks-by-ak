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
import { currency, useStore, type Unit } from "@/lib/store";
import { supabase } from "../supabase";

export const Route = createFileRoute("/units")({
  head: () => ({
    meta: [{ title: "Units — Estate Manager" }],
  }),
  component: UnitsPage,
});

type Form = Omit<Unit, "id">;
const empty: Form = { flatNo: "", building: "", bedroomType: "", marketRent: 0 };

function UnitsPage() {
  const { data, refresh } = useStore();
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

  const startEdit = (u: Unit) => {
    setEditing(u.id);
    setForm({
      flatNo: u.flatNo,
      building: u.building,
      bedroomType: u.bedroomType,
      marketRent: u.marketRent,
    });
    setError("");
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.flatNo.trim()) return setError("Flat number is required.");

    try {
      if (editing) {
        const { error: err } = await supabase
          .from("units")
          .update({
            flat_no: form.flatNo,
            building: form.building,
            bedroom_type: form.bedroomType,
            market_rent: form.marketRent,
          })
          .eq("id", editing);
        if (err) throw err;
        toast.success("Unit updated");
      } else {
        const { error: err } = await supabase.from("units").insert({
          flat_no: form.flatNo,
          building: form.building,
          bedroom_type: form.bedroomType,
          market_rent: form.marketRent,
        });
        if (err) throw err;
        toast.success("Unit added");
      }
      await refresh();
      setOpen(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save unit");
      toast.error(err.message || "Failed to save unit");
    }
  };

  const remove = async (id: string, flatNo: string) => {
    if (!confirm(`Delete unit ${flatNo}?`)) return;
    try {
      const { error: err } = await supabase.from("units").delete().eq("id", id);
      if (err) throw err;
      toast.success("Unit deleted");
      await refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Units"
        description={`${data.units.length} unit(s)`}
        action={
          <Button onClick={startAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Unit
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
                <TableHead>Bedroom Type</TableHead>
                <TableHead>Market Rent</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.units.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No units yet. Click “Add Unit”.
                  </TableCell>
                </TableRow>
              )}
              {data.units.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.flatNo}</TableCell>
                  <TableCell>{u.building || "—"}</TableCell>
                  <TableCell>{u.bedroomType || "—"}</TableCell>
                  <TableCell>{currency(u.marketRent)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(u.id, u.flatNo)}>
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
            <DialogTitle>{editing ? "Edit Unit" : "Add Unit"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Flat No *</Label>
              <Input
                value={form.flatNo}
                onChange={(e) => setForm({ ...form, flatNo: e.target.value })}
                placeholder="101"
              />
            </div>
            <div>
              <Label>Building</Label>
              <Input
                value={form.building}
                onChange={(e) => setForm({ ...form, building: e.target.value })}
                placeholder="Al Noor Tower"
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
            <div>
              <Label>Market Rent (AED)</Label>
              <Input
                type="number"
                value={form.marketRent || ""}
                onChange={(e) => setForm({ ...form, marketRent: Number(e.target.value) })}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save" : "Add Unit"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

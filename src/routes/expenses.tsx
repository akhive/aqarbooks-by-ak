import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { currency, fmtDate, useStore, type Expense } from "@/lib/store";

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [{ title: "Expenses — Estate Manager" }],
  }),
  component: ExpensesPage,
});

type Form = Omit<Expense, "id">;

const empty: Form = {
  date: new Date().toISOString().slice(0, 10),
  category: "",
  description: "",
  amount: 0,
};

function ExpensesPage() {
  const { data, addExpense, deleteExpense } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState("");

  const startAdd = () => {
    setForm(empty);
    setError("");
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category.trim()) return setError("Category is required.");
    if (form.amount <= 0) return setError("Amount must be greater than zero.");

    try {
      await addExpense(form);
      toast.success("Expense added");
      setOpen(false);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await deleteExpense(id);
      toast.success("Expense deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const total = data.expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <AppShell>
      <PageHeader
        title="Expenses"
        description={`${data.expenses.length} expense(s) · Total ${currency(total)}`}
        action={
          <Button onClick={startAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.expenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No expenses yet. Click “Add Expense”.
                  </TableCell>
                </TableRow>
              )}
              {data.expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{fmtDate(e.date)}</TableCell>
                  <TableCell className="font-medium">{e.category}</TableCell>
                  <TableCell>{e.description || "—"}</TableCell>
                  <TableCell className="text-right text-destructive font-medium">
                    {currency(e.amount)}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => remove(e.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Category *</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Maintenance, Utilities, Salary, etc."
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional details"
              />
            </div>
            <div>
              <Label>Amount (AED) *</Label>
              <Input
                type="number"
                value={form.amount || ""}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Expense</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

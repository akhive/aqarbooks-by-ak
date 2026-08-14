import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Download, Printer } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, fmtDate, useStore, type Cheque, type ChequeStatus } from "@/lib/store";

export const Route = createFileRoute("/cheques")({
  head: () => ({
    meta: [{ title: "Cheques (PDC) — Estate Manager" }],
  }),
  component: ChequesPage,
});

type Form = Omit<Cheque, "id">;
const STATUSES: ChequeStatus[] = ["PDC", "Deposited", "Cleared", "Bounced"];

const empty: Form = {
  tenantId: "",
  chequeDate: "",
  chequeNo: "",
  bank: "",
  amount: 0,
  status: "PDC",
  reconciled: false,
};

function ChequesPage() {
  const { data, addCheque, updateCheque, deleteCheque } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ChequeStatus>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Tenant name
  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "—";

  // Flat No from latest contract of that tenant
  const flatForTenant = (tenantId: string) => {
    const contracts = data.contracts
      .filter((c) => c.tenantId === tenantId)
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
    if (contracts.length === 0) return "—";
    const unit = data.units.find((u) => u.id === contracts[0].unitId);
    return unit?.flatNo || "—";
  };

  const rows = useMemo(() => {
    return data.cheques
      .filter((c) => {
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        if (fromDate && c.chequeDate < fromDate) return false;
        if (toDate && c.chequeDate > toDate) return false;
        return true;
      })
      .sort((a, b) => (a.chequeDate > b.chequeDate ? 1 : -1));
  }, [data.cheques, statusFilter, fromDate, toDate]);

  const totalAmount = rows.reduce((s, c) => s + c.amount, 0);

  const startAdd = () => {
    setEditing(null);
    setForm(empty);
    setError("");
    setOpen(true);
  };

  const startEdit = (c: Cheque) => {
    setEditing(c.id);
    const { id: _id, ...rest } = c;
    setForm(rest);
    setError("");
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenantId) return setError("Please select a tenant.");
    if (!form.chequeDate) return setError("Cheque date is required.");
    if (form.amount <= 0) return setError("Amount must be greater than zero.");

    try {
      if (editing) {
        await updateCheque(editing, form);
        toast.success("Cheque updated");
      } else {
        await addCheque(form);
        toast.success("Cheque added");
      }
      setOpen(false);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this cheque?")) return;
    try {
      await deleteCheque(id);
      toast.success("Cheque deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  // Export to Excel (CSV)
  const exportExcel = () => {
    const headers = ["Cheque Date", "Cheque No", "Tenant", "Flat No", "Bank", "Amount", "Status"];
    const lines = rows.map((c) =>
      [
        c.chequeDate,
        c.chequeNo,
        tenantName(c.tenantId),
        flatForTenant(c.tenantId),
        c.bank,
        c.amount,
        c.status,
      ].join(",")
    );
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cheques_${fromDate || "all"}_${toDate || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print / PDF
  const printPDF = () => {
    window.print();
  };

  // Quick filter: next month
  const setNextMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    setFromDate(start.toISOString().slice(0, 10));
    setToDate(end.toISOString().slice(0, 10));
  };

  return (
    <AppShell>
      <PageHeader
        title="Cheques (PDC)"
        description={`${rows.length} cheque(s) · Total ${currency(totalAmount)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportExcel}>
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            <Button variant="outline" onClick={printPDF}>
              <Printer className="mr-2 h-4 w-4" />
              Print / PDF
            </Button>
            <Button onClick={startAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Cheque
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <Label>From Date</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <Label>To Date</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="secondary" onClick={setNextMonth}>
            Next Month
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setFromDate("");
              setToDate("");
              setStatusFilter("all");
            }}
          >
            Clear
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cheque Date</TableHead>
                <TableHead>Cheque No</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Flat No</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No cheques found for this period.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{fmtDate(c.chequeDate)}</TableCell>
                  <TableCell>{c.chequeNo || "—"}</TableCell>
                  <TableCell className="font-medium">{tenantName(c.tenantId)}</TableCell>
                  <TableCell>{flatForTenant(c.tenantId)}</TableCell>
                  <TableCell>{c.bank || "—"}</TableCell>
                  <TableCell className="text-right font-medium">{currency(c.amount)}</TableCell>
                  <TableCell>{c.status}</TableCell>
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

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Cheque" : "Add Cheque"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
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
              <Label>Cheque Date *</Label>
              <Input
                type="date"
                value={form.chequeDate}
                onChange={(e) => setForm({ ...form, chequeDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Cheque No</Label>
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
              <Label>Amount (AED) *</Label>
              <Input
                type="number"
                value={form.amount || ""}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as ChequeStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}

            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save" : "Add Cheque"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

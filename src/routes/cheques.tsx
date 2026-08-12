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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, fmtDate, useStore, type Cheque, type ChequeStatus } from "@/lib/store";

export const Route = createFileRoute("/cheques")({
  head: () => ({
    meta: [
      { title: "Cheques (PDC) — Estate Manager" },
      {
        name: "description",
        content: "Record post-dated cheques per tenant with date, cheque number, bank, amount and status.",
      },
      { property: "og:title", content: "Cheques (PDC) — Estate Manager" },
      { property: "og:description", content: "Track PDC, deposited, cleared and bounced cheques by tenant." },
    ],
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

const statusClass = (s: ChequeStatus) =>
  s === "Cleared"
    ? "bg-success/12 text-success"
    : s === "Deposited"
      ? "bg-primary/10 text-primary"
      : s === "Bounced"
        ? "bg-destructive/10 text-destructive"
        : "bg-warning/15 text-warning";

function ChequesPage() {
  const { data, addCheque, updateCheque, deleteCheque } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | ChequeStatus>("all");
  const [tenantFilter, setTenantFilter] = useState<string>("all");

  const tenantName = (id: string) => data.tenants.find((t) => t.id === id)?.name ?? "—";

  const rows = useMemo(
    () =>
      data.cheques
        .filter((c) => (filter === "all" ? true : c.status === filter))
        .filter((c) => (tenantFilter === "all" ? true : c.tenantId === tenantFilter))
        .sort((a, b) => a.chequeDate.localeCompare(b.chequeDate)),
    [data.cheques, filter, tenantFilter],
  );

  const startAdd = () => {
    setEditing(null);
    setForm({ ...empty, tenantId: data.tenants[0]?.id ?? "" });
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenantId) return setError("Select a tenant.");
    if (!form.chequeDate) return setError("Cheque date is required.");
    if (!form.chequeNo.trim()) return setError("Cheque number is required.");
    if (!form.bank.trim()) return setError("Bank name is required.");
    if (form.amount <= 0) return setError("Amount must be greater than zero.");
    if (editing) {
      updateCheque(editing, form);
      toast.success("Cheque updated");
    } else {
      addCheque(form);
      toast.success("Cheque added");
    }
    setOpen(false);
  };

  const total = rows.reduce((s, c) => s + c.amount, 0);

  return (
    <AppShell>
      <PageHeader
        title="Cheques (PDC)"
        description="Every cheque collected against a tenancy contract."
        action={
          <Button onClick={startAdd} disabled={data.tenants.length === 0}>
            <Plus className="size-4" /> Add cheque
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={tenantFilter} onValueChange={setTenantFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All tenants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tenants</SelectItem>
            {data.tenants.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto self-center text-sm text-muted-foreground">
          {rows.length} cheque(s) · <span className="font-medium text-foreground">{currency(total)}</span>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cheque date</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Cheque no.</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No cheques match this filter.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{fmtDate(c.chequeDate)}</TableCell>
                    <TableCell className="font-medium">{tenantName(c.tenantId)}</TableCell>
                    <TableCell>#{c.chequeNo}</TableCell>
                    <TableCell>{c.bank}</TableCell>
                    <TableCell className="text-right font-medium">{currency(c.amount)}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(c.status)}`}>
                        {c.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" aria-label="Edit cheque" onClick={() => startEdit(c)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete cheque"
                        onClick={() => {
                          deleteCheque(c.id);
                          toast.success("Cheque deleted");
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
            <DialogTitle>{editing ? "Edit cheque" : "Add cheque"}</DialogTitle>
            <DialogDescription>Post-dated cheques feed the dashboard and reports.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="tenant">Tenant</Label>
              <Select value={form.tenantId} onValueChange={(v) => setForm({ ...form, tenantId: v })}>
                <SelectTrigger id="tenant">
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {data.tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · Flat {t.flatNo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cdate">Cheque date</Label>
              <Input
                id="cdate"
                type="date"
                value={form.chequeDate}
                onChange={(e) => setForm({ ...form, chequeDate: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cno">Cheque no.</Label>
              <Input
                id="cno"
                maxLength={30}
                value={form.chequeNo}
                onChange={(e) => setForm({ ...form, chequeNo: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bank">Bank</Label>
              <Input
                id="bank"
                maxLength={60}
                value={form.bank}
                onChange={(e) => setForm({ ...form, bank: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amt">Amount</Label>
              <Input
                id="amt"
                type="number"
                min={0}
                value={form.amount || ""}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="cstatus">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as ChequeStatus })}
              >
                <SelectTrigger id="cstatus">
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
            {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save changes" : "Add cheque"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

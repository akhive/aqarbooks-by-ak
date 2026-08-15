import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { History, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
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
type SortKey =
  | "leaseNo"
  | "unit"
  | "period"
  | "rent"
  | "previousRent"
  | "revenue"
  | "deferred";

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

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayDiff(start: string, end: string) {
  return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
}

function ContractsPage() {
  const { data, addContract, updateContract, deleteContract } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("leaseNo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [historyTenantId, setHistoryTenantId] = useState<string | null>(null);
  const [unitSearch, setUnitSearch] = useState("");

  const tenantMap = useMemo(() => {
    const m: Record<string, string> = {};
    data.tenants.forEach((t) => (m[t.id] = t.name));
    return m;
  }, [data.tenants]);

  const unitFlat = useMemo(() => {
    const m: Record<string, string> = {};
    data.units.forEach((u) => (m[u.id] = u.flatNo || "—"));
    return m;
  }, [data.units]);

  const bedroomOptions = useMemo(() => {
    const set = new Set<string>();
    data.units.forEach((u) => {
      if (u.bedroomType?.trim()) set.add(u.bedroomType.trim());
    });
    if (set.size === 0) ["Studio", "1 BHK", "2 BHK", "3 BHK"].forEach((t) => set.add(t));
    return [...set].sort();
  }, [data.units]);

  const nextLeaseNo = () => {
    const nums = data.contracts
      .map((c) => {
        const m = (c.leaseNo || "").match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return String(next).padStart(3, "0");
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };
  const sortIcon = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  const rows = useMemo(() => {
    const q = unitSearch.trim().toLowerCase();
    let list = data.contracts.map((c) => {
      const rev = calcRevenue(c.startDate, c.endDate, c.rent);
      return {
        ...c,
        unitLabel: unitFlat[c.unitId] || "—",
        revenue: rev.currentYear,
        deferred: rev.deferred,
      };
    });

    // Search by unit number
    if (q) {
      list = list.filter((c) => c.unitLabel.toLowerCase().includes(q));
    }

    return list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "leaseNo":
          cmp = (a.leaseNo || "").localeCompare(b.leaseNo || "", undefined, { numeric: true });
          break;
        case "unit":
          cmp = (a.unitLabel || "").localeCompare(b.unitLabel || "", undefined, { numeric: true });
          break;
        case "period":
          cmp = (a.startDate || "").localeCompare(b.startDate || "");
          break;
        case "rent":
          cmp = a.rent - b.rent;
          break;
        case "previousRent":
          cmp = a.previousRent - b.previousRent;
          break;
        case "revenue":
          cmp = a.revenue - b.revenue;
          break;
        case "deferred":
          cmp = a.deferred - b.deferred;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data.contracts, unitFlat, sortKey, sortDir, unitSearch]);

  const historyRows = useMemo(() => {
    if (!historyTenantId) return [];
    return data.contracts
      .filter((c) => c.tenantId === historyTenantId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [data.contracts, historyTenantId]);

  const startAdd = () => {
    setEditing(null);
    setForm({ ...empty, leaseNo: nextLeaseNo() });
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

  const startRenew = (c: Contract) => {
    setEditing(null);
    const duration = dayDiff(c.startDate, c.endDate);
    const newStart = addDays(c.endDate, 1);
    const newEnd = addDays(newStart, duration);
    setForm({
      leaseNo: nextLeaseNo(),
      tenantId: c.tenantId,
      unitId: c.unitId,
      bedroomType: c.bedroomType,
      startDate: newStart,
      endDate: newEnd,
      rent: 0,
      previousRent: c.rent,
    });
    setError("");
    setOpen(true);
    toast.message("Renewal form ready — enter new rent and adjust period if needed");
  };

  const onUnitChange = (unitId: string) => {
    const unit = data.units.find((u) => u.id === unitId);
    setForm((f) => ({
      ...f,
      unitId,
      bedroomType: unit?.bedroomType || f.bedroomType,
    }));
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
        toast.success("Contract saved");
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
        description={`${rows.length} contract(s)${unitSearch ? " (filtered)" : ""}`}
        action={
          <Button onClick={startAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contract
          </Button>
        }
      />

      {/* Search by unit number */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="relative w-full max-w-xs">
            <Label className="mb-1.5 block">Search by Unit No</Label>
            <Search className="absolute left-3 top-9 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="e.g. 101"
              value={unitSearch}
              onChange={(e) => setUnitSearch(e.target.value)}
            />
          </div>
          {unitSearch && (
            <Button variant="ghost" onClick={() => setUnitSearch("")}>
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("leaseNo")}>
                    Lease No{sortIcon("leaseNo")}
                  </button>
                </TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>
                  <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("unit")}>
                    Unit{sortIcon("unit")}
                  </button>
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>
                  <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("period")}>
                    Period{sortIcon("period")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("rent")}>
                    Rent{sortIcon("rent")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("previousRent")}>
                    Previous Rent{sortIcon("previousRent")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("revenue")}>
                    Revenue (This Year){sortIcon("revenue")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("deferred")}>
                    Deferred{sortIcon("deferred")}
                  </button>
                </TableHead>
                <TableHead className="w-36"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    {unitSearch ? "No contracts for this unit." : "No contracts yet."}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.leaseNo || "—"}</TableCell>
                  <TableCell>{tenantMap[c.tenantId] || "—"}</TableCell>
                  <TableCell>{c.unitLabel}</TableCell>
                  <TableCell>{c.bedroomType || "—"}</TableCell>
                  <TableCell>
                    {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
                  </TableCell>
                  <TableCell>{currency(c.rent)}</TableCell>
                  <TableCell>{currency(c.previousRent)}</TableCell>
                  <TableCell className="text-emerald-600 font-medium">{currency(c.revenue)}</TableCell>
                  <TableCell className="text-amber-600">{currency(c.deferred)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" title="Renew" onClick={() => startRenew(c)}>
                        <RefreshCw className="h-4 w-4 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" title="History" onClick={() => setHistoryTenantId(c.tenantId)}>
                        <History className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => startEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(c.id, c.leaseNo)}>
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

      {/* Add / Edit / Renew dialog — same as before */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Contract" : form.previousRent > 0 ? "Renew Contract" : "Add Contract"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Lease No</Label>
              <Input value={form.leaseNo} onChange={(e) => setForm({ ...form, leaseNo: e.target.value })} />
            </div>
            <div>
              <Label>Tenant *</Label>
              <Select value={form.tenantId} onValueChange={(v) => setForm({ ...form, tenantId: v })}>
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
              <Select value={form.unitId} onValueChange={onUnitChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {data.units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.flatNo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bedroom Type</Label>
              <Select value={form.bedroomType} onValueChange={(v) => setForm({ ...form, bedroomType: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {bedroomOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date *</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>New Rent (AED) *</Label>
                <Input type="number" value={form.rent || ""} onChange={(e) => setForm({ ...form, rent: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Previous Rent</Label>
                <Input type="number" value={form.previousRent || ""} readOnly className="bg-muted" />
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
              <Button type="submit">
                {editing ? "Save Changes" : form.previousRent > 0 ? "Save Renewal" : "Add Contract"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* History */}
      <Dialog open={!!historyTenantId} onOpenChange={(o) => !o && setHistoryTenantId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Contract history — {historyTenantId ? tenantMap[historyTenantId] : ""}
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lease No</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>Previous</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyRows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.leaseNo || "—"}</TableCell>
                  <TableCell>{unitFlat[c.unitId] || "—"}</TableCell>
                  <TableCell>
                    {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
                  </TableCell>
                  <TableCell>{currency(c.rent)}</TableCell>
                  <TableCell>{currency(c.previousRent)}</TableCell>
                  <TableCell>{c.bedroomType || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryTenantId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
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
import { currency, fmtDate, useStore, type Contract } from "@/lib/store";

export const Route = createFileRoute("/contracts")({
  head: () => ({
    meta: [{ title: "Contracts — Estate Manager" }],
  }),
  component: ContractsPage,
});

type Form = Omit<Contract, "id">;
type SortKey = "leaseNo" | "unit" | "period" | "rent";

const empty: Form = {
  leaseNo: "",
  tenantId: "",
  unitId: "",
  startDate: "",
  endDate: "",
  rent: 0,
  previousRent: 0,
  bedroomType: "",
  status: "Active",
  notes: "",
  endedAt: "",
  depositAmount: 0,
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
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [tenantSearchText, setTenantSearchText] = useState("");
  const [tenantOpen, setTenantOpen] = useState(false);

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

  const filteredTenants = useMemo(() => {
    const q = tenantSearchText.trim().toLowerCase();
    if (!q) return data.tenants;
    return data.tenants.filter((t) => t.name.toLowerCase().includes(q));
  }, [data.tenants, tenantSearchText]);

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

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-medium hover:underline"
      onClick={() => toggleSort(k)}
    >
      {label}
      <span className="text-xs text-muted-foreground">
        {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );

  const rows = useMemo(() => {
    const q = unitSearch.trim().toLowerCase();

    let list = data.contracts.map((c) => ({
      ...c,
      unitLabel: unitFlat[c.unitId] || "—",
      tenantName: tenantMap[c.tenantId] || "—",
    }));

    if (q) list = list.filter((c) => c.unitLabel.toLowerCase().includes(q));
    if (tenantFilter !== "all") list = list.filter((c) => c.tenantId === tenantFilter);

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "leaseNo") {
        cmp = (a.leaseNo || "").localeCompare(b.leaseNo || "", undefined, { numeric: true });
      } else if (sortKey === "unit") {
        cmp = (a.unitLabel || "").localeCompare(b.unitLabel || "", undefined, { numeric: true });
      } else if (sortKey === "period") {
        cmp = (a.startDate || "").localeCompare(b.startDate || "");
      } else if (sortKey === "rent") {
        cmp = (a.rent || 0) - (b.rent || 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data.contracts, unitFlat, tenantMap, sortKey, sortDir, unitSearch, tenantFilter]);

  const historyRows = useMemo(() => {
    if (!historyTenantId) return [];
    return data.contracts
      .filter((c) => c.tenantId === historyTenantId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [data.contracts, historyTenantId]);

  const startAdd = () => {
    setEditing(null);
    setForm({ ...empty, leaseNo: nextLeaseNo(), status: "Active" });
    setError("");
    setOpen(true);
  };

  const startEdit = (c: Contract) => {
    setEditing(c.id);
    const { id: _id, ...rest } = c;
    setForm({ ...empty, ...rest });
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
      status: "Active",
      notes: "",
      endedAt: "",
      depositAmount: c.depositAmount || 0,
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
        description={`${rows.length} contract(s) · Click Lease No to open details`}
        action={
          <Button onClick={startAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contract
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="w-full max-w-[200px]">
            <Label className="mb-1.5 block">Search Unit No</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="e.g. 101"
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="relative w-full max-w-[260px]">
            <Label className="mb-1.5 block">Search Tenant</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Type tenant name..."
                value={tenantSearchText}
                onChange={(e) => {
                  setTenantSearchText(e.target.value);
                  setTenantFilter("all");
                  setTenantOpen(true);
                }}
                onFocus={() => setTenantOpen(true)}
              />
            </div>
            {tenantOpen && (
              <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    setTenantFilter("all");
                    setTenantSearchText("");
                    setTenantOpen(false);
                  }}
                >
                  All tenants
                </button>
                {filteredTenants.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setTenantFilter(t.id);
                      setTenantSearchText(t.name);
                      setTenantOpen(false);
                    }}
                  >
                    {t.name}
                  </button>
                ))}
                {filteredTenants.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No tenant found</div>
                )}
              </div>
            )}
          </div>

          {(unitSearch || tenantFilter !== "all" || tenantSearchText) && (
            <Button
              variant="ghost"
              onClick={() => {
                setUnitSearch("");
                setTenantFilter("all");
                setTenantSearchText("");
                setTenantOpen(false);
              }}
            >
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortBtn k="leaseNo" label="Lease No" />
                </TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>
                  <SortBtn k="unit" label="Unit" />
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <SortBtn k="period" label="Period" />
                </TableHead>
                <TableHead>
                  <SortBtn k="rent" label="Rent" />
                </TableHead>
                <TableHead className="w-36"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No contracts found.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/contract/$contractId"
                      params={{ contractId: c.id }}
                      className="text-primary hover:underline"
                    >
                      {c.leaseNo || "View"}
                    </Link>
                  </TableCell>
                  <TableCell>{c.tenantName}</TableCell>
                  <TableCell>
                    {c.unitId ? (
                      <Link
                        to="/units/$unitId"
                        params={{ unitId: c.unitId }}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {c.unitLabel}
                      </Link>
                    ) : (
                      c.unitLabel
                    )}
                  </TableCell>
                  <TableCell>{c.bedroomType || "—"}</TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === "Active"
                          ? "bg-emerald-100 text-emerald-800"
                          : c.status === "Ended"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {c.status || "Active"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
                  </TableCell>
                  <TableCell>{currency(c.rent)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" title="Renew" onClick={() => startRenew(c)}>
                        <RefreshCw className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="History"
                        onClick={() => setHistoryTenantId(c.tenantId)}
                      >
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Contract" : form.previousRent > 0 ? "Renew Contract" : "Add Contract"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Lease No</Label>
              <Input
                value={form.leaseNo}
                onChange={(e) => setForm({ ...form, leaseNo: e.target.value })}
              />
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
              <Select
                value={form.bedroomType}
                onValueChange={(v) => setForm({ ...form, bedroomType: v })}
              >
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
                <Label>New Rent (AED) *</Label>
                <Input
                  type="number"
                  value={form.rent || ""}
                  onChange={(e) => setForm({ ...form, rent: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Previous Rent</Label>
                <Input type="number" value={form.previousRent || ""} readOnly className="bg-muted" />
              </div>
            </div>
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

      <Dialog open={!!historyTenantId} onOpenChange={(o) => !o && setHistoryTenantId(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
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
                <TableHead>Status</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Rent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyRows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/contract/$contractId"
                      params={{ contractId: c.id }}
                      className="text-primary hover:underline"
                      onClick={() => setHistoryTenantId(null)}
                    >
                      {c.leaseNo || "View"}
                    </Link>
                  </TableCell>
                  <TableCell>{unitFlat[c.unitId] || "—"}</TableCell>
                  <TableCell>{c.status || "Active"}</TableCell>
                  <TableCell>
                    {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
                  </TableCell>
                  <TableCell>{currency(c.rent)}</TableCell>
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

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../supabase";

export type Unit = {
  id: string;
  flatNo: string;
  building: string;
  bedroomType: string;
  marketRent: number;
};

export type Tenant = {
  id: string;
  name: string;
  mobile: string;
  email: string;
  nationality: string;
  fromDate: string;
};

export type ContractStatus = "Active" | "Ended" | "Cancelled" | "Broken";

export type Contract = {
  id: string;
  leaseNo: string;
  tenantId: string;
  unitId: string;
  startDate: string;
  endDate: string;
  rent: number;
  previousRent: number;
  bedroomType: string;
  status: ContractStatus;
  notes?: string;
  endedAt?: string;
  deletedAt?: string;
  depositAmount: number;
  penalty?: number;
  extraCharges?: number;
  actualRent?: number;
};

export type ChequeStatus = "PDC" | "Deposited" | "Cleared" | "Bounced" | "Returned";

export type Cheque = {
  id: string;
  tenantId: string;
  contractId?: string;
  chequeDate: string;
  chequeNo: string;
  bank: string;
  amount: number;
  status: ChequeStatus;
  clearedDate?: string;
  reconciled?: boolean;
  kind?: "rent" | "deposit";
};

export type Expense = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
};

type Data = {
  units: Unit[];
  tenants: Tenant[];
  contracts: Contract[];
  cheques: Cheque[];
  expenses: Expense[];
};

type Ctx = {
  data: Data;
  loading: boolean;
  refresh: () => Promise<void>;
  addTenant: (t: Omit<Tenant, "id">) => Promise<void>;
  updateTenant: (id: string, t: Omit<Tenant, "id">) => Promise<void>;
  deleteTenant: (id: string) => Promise<void>;
  addContract: (c: Omit<Contract, "id">) => Promise<void>;
  updateContract: (id: string, c: Omit<Contract, "id">) => Promise<void>;
  deleteContract: (id: string) => Promise<void>;
  restoreContract: (id: string) => Promise<void>;
  addCheque: (c: Omit<Cheque, "id">) => Promise<void>;
  updateCheque: (id: string, c: Omit<Cheque, "id">) => Promise<void>;
  deleteCheque: (id: string) => Promise<void>;
  addExpense: (e: Omit<Expense, "id">) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
};

const StoreContext = createContext<Ctx | null>(null);

const mapUnit = (r: any): Unit => ({
  id: r.id,
  flatNo: r.flat_no || "",
  building: r.building || "",
  bedroomType: r.bedroom_type || "",
  marketRent: Number(r.market_rent) || 0,
});

const mapTenant = (r: any): Tenant => ({
  id: r.id,
  name: r.name || "",
  mobile: r.mobile || "",
  email: r.email || "",
  nationality: r.nationality || "",
  fromDate: r.from_date || "",
});

const mapContract = (r: any): Contract => ({
  id: r.id,
  leaseNo: r.lease_no || "",
  tenantId: r.tenant_id || "",
  unitId: r.unit_id || "",
  startDate: r.start_date || "",
  endDate: r.end_date || "",
  rent: Number(r.rent) || 0,
  previousRent: Number(r.previous_rent) || 0,
  bedroomType: r.bedroom_type || "",
  status: (r.status as ContractStatus) || "Active",
  notes: r.notes || "",
  endedAt: r.ended_at || "",
  deletedAt: r.deleted_at || "",
  depositAmount: Number(r.deposit_amount) || 0,
  penalty: Number(r.penalty) || 0,
  extraCharges: Number(r.extra_charges) || 0,
  actualRent: Number(r.actual_rent) || 0,
});

const mapCheque = (r: any): Cheque => ({
  id: r.id,
  tenantId: r.tenant_id || "",
  contractId: r.contract_id || "",
  chequeDate: r.cheque_date || "",
  chequeNo: r.cheque_no || "",
  bank: r.bank || "",
  amount: Number(r.amount) || 0,
  status: r.status || "PDC",
  clearedDate: r.cleared_date || "",
  reconciled: r.reconciled || false,
  kind: r.kind === "deposit" ? "deposit" : "rent",
});

const mapExpense = (r: any): Expense => ({
  id: r.id,
  date: r.date || "",
  category: r.category || "",
  description: r.description || "",
  amount: Number(r.amount) || 0,
});

export function calcRevenue(startDate: string, endDate: string, rent: number) {
  if (!startDate || !endDate || !rent) return { currentYear: 0, deferred: 0 };

  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  if (end < start) return { currentYear: 0, deferred: 0 };

  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1, 12, 0, 0);
  const yearEnd = new Date(year, 11, 31, 12, 0, 0);

  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (totalDays <= 0) return { currentYear: 0, deferred: 0 };

  // Use rent ÷ totalDays so full lease sums to rent (not always 365)
  const daily = rent / totalDays;

  const curFrom = start > yearStart ? start : yearStart;
  const curTo = end < yearEnd ? end : yearEnd;

  let currentDays = 0;
  if (curTo >= curFrom) {
    currentDays = Math.round((curTo.getTime() - curFrom.getTime()) / 86400000) + 1;
  }

  // Deferred = portion strictly after this calendar year
  const afterYearStart = new Date(year + 1, 0, 1, 12, 0, 0);
  let deferredDays = 0;
  if (end >= afterYearStart) {
    const defFrom = start > afterYearStart ? start : afterYearStart;
    deferredDays = Math.round((end.getTime() - defFrom.getTime()) / 86400000) + 1;
  }

  return {
    currentYear: Math.round(daily * currentDays),
    deferred: Math.round(daily * deferredDays),
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>({
    units: [],
    tenants: [],
    contracts: [],
    cheques: [],
    expenses: [],
  });
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [unitsRes, tenantsRes, contractsRes, chequesRes, expensesRes] = await Promise.all([
        supabase.from("units").select("*").order("flat_no"),
        supabase.from("tenants").select("*").order("name"),
        supabase.from("contracts").select("*").order("start_date", { ascending: false }),
        supabase.from("cheques").select("*").order("cheque_date"),
        supabase.from("expenses").select("*").order("date"),
      ]);

      setData({
        units: (unitsRes.data || []).map(mapUnit),
        tenants: (tenantsRes.data || []).map(mapTenant),
        contracts: (contractsRes.data || []).map(mapContract).filter((c) => !c.deletedAt),
        cheques: (chequesRes.data || []).map(mapCheque),
        expenses: (expensesRes.data || []).map(mapExpense),
      });
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      data,
      loading,
      refresh,

      addTenant: async (t) => {
        const { data: row, error } = await supabase
          .from("tenants")
          .insert({
            name: t.name,
            mobile: t.mobile,
            email: t.email,
            nationality: t.nationality,
            from_date: t.fromDate || null,
          })
          .select()
          .single();
        if (error) throw error;
        if (row) setData((p) => ({ ...p, tenants: [...p.tenants, mapTenant(row)] }));
      },

      updateTenant: async (id, t) => {
        const { error } = await supabase
          .from("tenants")
          .update({
            name: t.name,
            mobile: t.mobile,
            email: t.email,
            nationality: t.nationality,
            from_date: t.fromDate || null,
          })
          .eq("id", id);
        if (error) throw error;
        setData((p) => ({
          ...p,
          tenants: p.tenants.map((x) => (x.id === id ? { ...t, id } : x)),
        }));
      },

      deleteTenant: async (id) => {
        const { error } = await supabase.from("tenants").delete().eq("id", id);
        if (error) throw error;
        setData((p) => ({
          ...p,
          tenants: p.tenants.filter((x) => x.id !== id),
          contracts: p.contracts.filter((c) => c.tenantId !== id),
          cheques: p.cheques.filter((c) => c.tenantId !== id),
        }));
      },

      addContract: async (c) => {
        const last = data.contracts
          .filter((x) => x.tenantId === c.tenantId)
          .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0];

        const previousRent = c.previousRent > 0 ? c.previousRent : last ? last.rent : 0;

        const { data: row, error } = await supabase
          .from("contracts")
          .insert({
            lease_no: c.leaseNo,
            tenant_id: c.tenantId,
            unit_id: c.unitId || null,
            start_date: c.startDate,
            end_date: c.endDate,
            rent: c.rent,
            previous_rent: previousRent,
            bedroom_type: c.bedroomType,
            status: c.status || "Active",
            notes: c.notes || null,
            ended_at: c.endedAt || null,
            deposit_amount: c.depositAmount || 0,
            penalty: c.penalty || 0,
            extra_charges: c.extraCharges || 0,
            actual_rent: c.actualRent || 0,
          })
          .select()
          .single();
        if (error) throw error;
        if (row) setData((p) => ({ ...p, contracts: [mapContract(row), ...p.contracts] }));
      },

      updateContract: async (id, c) => {
        const { error } = await supabase
          .from("contracts")
          .update({
            lease_no: c.leaseNo,
            tenant_id: c.tenantId,
            unit_id: c.unitId || null,
            start_date: c.startDate,
            end_date: c.endDate,
            rent: c.rent,
            previous_rent: c.previousRent,
            bedroom_type: c.bedroomType,
            status: c.status || "Active",
            notes: c.notes || null,
            ended_at: c.endedAt || null,
            deposit_amount: c.depositAmount || 0,
            penalty: c.penalty || 0,
            extra_charges: c.extraCharges || 0,
            actual_rent: c.actualRent || 0,
          })
          .eq("id", id);
        if (error) throw error;
        setData((p) => ({
          ...p,
          contracts: p.contracts.map((x) => (x.id === id ? { ...c, id } : x)),
        }));
      },

      deleteContract: async (id) => {
  // Soft-delete contract
  const { error } = await supabase
    .from("contracts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  // Hard-delete linked PDCs (same contract)
  const { error: chErr } = await supabase.from("cheques").delete().eq("contract_id", id);
  if (chErr) throw chErr;

  setData((p) => ({
    ...p,
    contracts: p.contracts.filter((x) => x.id !== id),
    cheques: p.cheques.filter((x) => x.contractId !== id),
  }));
},

      addCheque: async (c) => {
        const { data: row, error } = await supabase
          .from("cheques")
          .insert({
            tenant_id: c.tenantId,
            contract_id: c.contractId || null,
            cheque_date: c.chequeDate || null,
            cheque_no: c.chequeNo,
            bank: c.bank,
            amount: c.amount,
            status: c.status,
            cleared_date: c.clearedDate || null,
            reconciled: c.reconciled || false,
            kind: c.kind || "rent",
          })
          .select()
          .single();
        if (error) throw error;
        if (row) setData((p) => ({ ...p, cheques: [...p.cheques, mapCheque(row)] }));
      },

      updateCheque: async (id, c) => {
        const { error } = await supabase
          .from("cheques")
          .update({
            tenant_id: c.tenantId,
            contract_id: c.contractId || null,
            cheque_date: c.chequeDate || null,
            cheque_no: c.chequeNo,
            bank: c.bank,
            amount: c.amount,
            status: c.status,
            cleared_date: c.clearedDate || null,
            reconciled: c.reconciled || false,
            kind: c.kind || "rent",
          })
          .eq("id", id);
        if (error) throw error;
        setData((p) => ({
          ...p,
          cheques: p.cheques.map((x) => (x.id === id ? { ...c, id } : x)),
        }));
      },

      deleteCheque: async (id) => {
  const ch = data.cheques.find((x) => x.id === id);
  if (ch?.contractId) {
    throw new Error(
      "This PDC is linked to a contract. Open the lease card to manage it (or mark as Returned).",
    );
  }
  const { error } = await supabase.from("cheques").delete().eq("id", id);
  if (error) throw error;
  setData((p) => ({ ...p, cheques: p.cheques.filter((x) => x.id !== id) }));
},
      addExpense: async (e) => {
        const { data: row, error } = await supabase
          .from("expenses")
          .insert({
            date: e.date || null,
            category: e.category,
            description: e.description,
            amount: e.amount,
          })
          .select()
          .single();
        if (error) throw error;
        if (row) setData((p) => ({ ...p, expenses: [...p.expenses, mapExpense(row)] }));
      },

      deleteExpense: async (id) => {
        const { error } = await supabase.from("expenses").delete().eq("id", id);
        if (error) throw error;
        setData((p) => ({ ...p, expenses: p.expenses.filter((x) => x.id !== id) }));
      },
    }),
    [data, loading],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export const currency = (n: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(n);

export const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const dt = new Date(iso);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

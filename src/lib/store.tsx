import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../supabase";

export type TenantStatus = "Active" | "Expired" | "Notice";
export type ChequeStatus = "PDC" | "Deposited" | "Cleared" | "Bounced";

export type Unit = {
  id: string;
  flatNo: string;
  building: string;
  type: string;
  marketRent: number;
};

export type Cheque = {
  id: string;
  tenantId: string;
  chequeDate: string;
  chequeNo: string;
  bank: string;
  amount: number;
  status: ChequeStatus;
  reconciled?: boolean;
  clearedDate?: string;
};

export type Cheque = {
  id: string;
  tenantId: string;
  chequeDate: string;
  chequeNo: string;
  bank: string;
  amount: number;
  status: ChequeStatus;
  reconciled?: boolean;
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
  cheques: Cheque[];
  expenses: Expense[];
};

type Ctx = {
  data: Data;
  loading: boolean;
  addTenant: (t: Omit<Tenant, "id">) => Promise<void>;
  updateTenant: (id: string, t: Omit<Tenant, "id">) => Promise<void>;
  deleteTenant: (id: string) => Promise<void>;
  addCheque: (c: Omit<Cheque, "id">) => Promise<void>;
  updateCheque: (id: string, c: Omit<Cheque, "id">) => Promise<void>;
  deleteCheque: (id: string) => Promise<void>;
  toggleReconciled: (id: string) => Promise<void>;
  addExpense: (e: Omit<Expense, "id">) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
};

const StoreContext = createContext<Ctx | null>(null);

const mapUnit = (r: any): Unit => ({
  id: r.id,
  flatNo: r.flat_no,
  building: r.building || "",
  type: r.type || "",
  marketRent: Number(r.market_rent) || 0,
});

const mapTenant = (r: any): Tenant => ({
  id: r.id,
  name: r.name,
  phone: r.phone || "",
  flatNo: r.flat_no || "",
  contractStart: r.contract_start || "",
  contractEnd: r.contract_end || "",
  rentAmount: Number(r.rent_amount) || 0,
  status: r.status || "Active",
});

const mapCheque = (r: any): Cheque => ({
  id: r.id,
  tenantId: r.tenant_id,
  chequeDate: r.cheque_date || "",
  chequeNo: r.cheque_no || "",
  bank: r.bank || "",
  amount: Number(r.amount) || 0,
  status: r.status || "PDC",
  reconciled: r.reconciled || false,
  clearedDate: r.cleared_date || "",
});

const mapExpense = (r: any): Expense => ({
  id: r.id,
  date: r.date || "",
  category: r.category || "",
  description: r.description || "",
  amount: Number(r.amount) || 0,
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>({ units: [], tenants: [], cheques: [], expenses: [] });
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [unitsRes, tenantsRes, chequesRes, expensesRes] = await Promise.all([
        supabase.from("units").select("*").order("flat_no"),
        supabase.from("tenants").select("*").order("name"),
        supabase.from("cheques").select("*").order("cheque_date"),
        supabase.from("expenses").select("*").order("date"),
      ]);

      setData({
        units: (unitsRes.data || []).map(mapUnit),
        tenants: (tenantsRes.data || []).map(mapTenant),
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
            phone: t.phone,
            flat_no: t.flatNo,
            contract_start: t.contractStart || null,
            contract_end: t.contractEnd || null,
            rent_amount: t.rentAmount,
            status: t.status,
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
            phone: t.phone,
            flat_no: t.flatNo,
            contract_start: t.contractStart || null,
            contract_end: t.contractEnd || null,
            rent_amount: t.rentAmount,
            status: t.status,
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
          cheques: p.cheques.filter((c) => c.tenantId !== id),
        }));
      },

      addCheque: async (c) => {
        const { data: row, error } = await supabase
          .from("cheques")
          .insert({
            cleared_date: c.clearedDate || null,
            tenant_id: c.tenantId,
            cheque_date: c.chequeDate || null,
            cheque_no: c.chequeNo,
            bank: c.bank,
            amount: c.amount,
            status: c.status,
            reconciled: c.reconciled || false,
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
            cleared_date: c.clearedDate || null,
            tenant_id: c.tenantId,
            cheque_date: c.chequeDate || null,
            cheque_no: c.chequeNo,
            bank: c.bank,
            amount: c.amount,
            status: c.status,
            reconciled: c.reconciled || false,
          })
          .eq("id", id);
        if (error) throw error;
        setData((p) => ({
          ...p,
          cheques: p.cheques.map((x) => (x.id === id ? { ...c, id } : x)),
        }));
      },

      deleteCheque: async (id) => {
        const { error } = await supabase.from("cheques").delete().eq("id", id);
        if (error) throw error;
        setData((p) => ({ ...p, cheques: p.cheques.filter((x) => x.id !== id) }));
      },

      toggleReconciled: async (id) => {
        const current = data.cheques.find((x) => x.id === id);
        if (!current) return;
        const newVal = !current.reconciled;
        const { error } = await supabase.from("cheques").update({ reconciled: newVal }).eq("id", id);
        if (error) throw error;
        setData((p) => ({
          ...p,
          cheques: p.cheques.map((x) => (x.id === id ? { ...x, reconciled: newVal } : x)),
        }));
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

      reset: () => setData({ units: [], tenants: [], cheques: [], expenses: [] }),
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
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

export const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const dt = new Date(iso);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

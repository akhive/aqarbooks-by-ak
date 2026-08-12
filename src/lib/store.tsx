import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type TenantStatus = "Active" | "Expired" | "Notice";
export type ChequeStatus = "PDC" | "Deposited" | "Cleared" | "Bounced";

export type Unit = {
  id: string;
  flatNo: string;
  building: string;
  type: string;
  marketRent: number;
};

export type Tenant = {
  id: string;
  name: string;
  phone: string;
  flatNo: string;
  contractStart: string;
  contractEnd: string;
  rentAmount: number;
  status: TenantStatus;
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

const uid = () => Math.random().toString(36).slice(2, 10);
const y = new Date().getFullYear();
const d = (m: number, day: number, year = y) =>
  `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const seed = (): Data => {
  const units: Unit[] = [
    { id: uid(), flatNo: "101", building: "Al Noor Tower", type: "2 BHK", marketRent: 55000 },
    { id: uid(), flatNo: "102", building: "Al Noor Tower", type: "1 BHK", marketRent: 42000 },
    { id: uid(), flatNo: "201", building: "Al Noor Tower", type: "2 BHK", marketRent: 58000 },
    { id: uid(), flatNo: "202", building: "Al Noor Tower", type: "Studio", marketRent: 30000 },
    { id: uid(), flatNo: "301", building: "Marina View", type: "3 BHK", marketRent: 90000 },
    { id: uid(), flatNo: "302", building: "Marina View", type: "2 BHK", marketRent: 62000 },
  ];
  const tenants: Tenant[] = [
    {
      id: uid(),
      name: "Ahmed Khalid",
      phone: "+971 50 123 4567",
      flatNo: "101",
      contractStart: d(1, 1),
      contractEnd: d(12, 31),
      rentAmount: 55000,
      status: "Active",
    },
    {
      id: uid(),
      name: "Priya Nair",
      phone: "+971 55 998 1122",
      flatNo: "201",
      contractStart: d(3, 15),
      contractEnd: d(3, 14, y + 1),
      rentAmount: 58000,
      status: "Active",
    },
    {
      id: uid(),
      name: "John Mathew",
      phone: "+971 52 776 4433",
      flatNo: "301",
      contractStart: d(6, 1, y - 1),
      contractEnd: d(5, 31),
      rentAmount: 88000,
      status: "Notice",
    },
    {
      id: uid(),
      name: "Sara Ali",
      phone: "+971 56 220 7788",
      flatNo: "102",
      contractStart: d(2, 1),
      contractEnd: d(1, 31, y + 1),
      rentAmount: 42000,
      status: "Active",
    },
  ];
  const cheques: Cheque[] = [];
  tenants.forEach((t) => {
    for (let i = 0; i < 4; i++) {
      const month = ((i * 3 + 1) % 12) + 1;
      cheques.push({
        id: uid(),
        tenantId: t.id,
        chequeDate: d(month, 5),
        chequeNo: String(100000 + Math.floor(Math.random() * 899999)),
        bank: ["Emirates NBD", "ADCB", "Mashreq", "FAB"][i % 4]!,
        amount: Math.round(t.rentAmount / 4),
        status: month <= new Date().getMonth() + 1 ? "Cleared" : "PDC",
        reconciled: month <= new Date().getMonth() + 1,
      });
    }
  });
  const expenses: Expense[] = [
    { id: uid(), date: d(1, 12), category: "Maintenance", description: "AC servicing", amount: 4200 },
    { id: uid(), date: d(3, 4), category: "Utilities", description: "Common area DEWA", amount: 3100 },
    { id: uid(), date: d(5, 20), category: "Repairs", description: "Plumbing 201", amount: 1800 },
    { id: uid(), date: d(7, 9), category: "Management", description: "Agency fee", amount: 9500 },
    { id: uid(), date: d(9, 2), category: "Maintenance", description: "Lift AMC", amount: 6400 },
  ];
  return { units, tenants, cheques, expenses };
};

const KEY = "rems.data.v1";

type Ctx = {
  data: Data;
  addTenant: (t: Omit<Tenant, "id">) => void;
  updateTenant: (id: string, t: Omit<Tenant, "id">) => void;
  deleteTenant: (id: string) => void;
  addCheque: (c: Omit<Cheque, "id">) => void;
  updateCheque: (id: string, c: Omit<Cheque, "id">) => void;
  deleteCheque: (id: string) => void;
  toggleReconciled: (id: string) => void;
  addExpense: (e: Omit<Expense, "id">) => void;
  deleteExpense: (id: string) => void;
  reset: () => void;
};

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(() => seed());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setData(JSON.parse(raw) as Data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data]);

  const value = useMemo<Ctx>(
    () => ({
      data,
      addTenant: (t) => setData((p) => ({ ...p, tenants: [...p.tenants, { ...t, id: uid() }] })),
      updateTenant: (id, t) =>
        setData((p) => ({ ...p, tenants: p.tenants.map((x) => (x.id === id ? { ...t, id } : x)) })),
      deleteTenant: (id) =>
        setData((p) => ({
          ...p,
          tenants: p.tenants.filter((x) => x.id !== id),
          cheques: p.cheques.filter((c) => c.tenantId !== id),
        })),
      addCheque: (c) => setData((p) => ({ ...p, cheques: [...p.cheques, { ...c, id: uid() }] })),
      updateCheque: (id, c) =>
        setData((p) => ({ ...p, cheques: p.cheques.map((x) => (x.id === id ? { ...c, id } : x)) })),
      deleteCheque: (id) => setData((p) => ({ ...p, cheques: p.cheques.filter((x) => x.id !== id) })),
      toggleReconciled: (id) =>
        setData((p) => ({
          ...p,
          cheques: p.cheques.map((x) => (x.id === id ? { ...x, reconciled: !x.reconciled } : x)),
        })),
      addExpense: (e) => setData((p) => ({ ...p, expenses: [...p.expenses, { ...e, id: uid() }] })),
      deleteExpense: (id) => setData((p) => ({ ...p, expenses: p.expenses.filter((x) => x.id !== id) })),
      reset: () => setData(seed()),
    }),
    [data],
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

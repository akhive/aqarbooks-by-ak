import { useMemo, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currency, daysUntil, fmtDate, useStore } from "@/lib/store";

type Msg = { role: "user" | "bot"; text: string };

function localToday() {
  const n = new Date();
  return [
    n.getFullYear(),
    String(n.getMonth() + 1).padStart(2, "0"),
    String(n.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function effectiveRent(c: { rent: number; actualRent?: number }) {
  return c.actualRent && c.actualRent > 0 ? c.actualRent : c.rent;
}

function effectiveEnd(c: { endDate: string; endedAt?: string; status?: string }) {
  if (
    (c.status === "Broken" || c.status === "Cancelled" || c.status === "Ended") &&
    c.endedAt
  ) {
    return c.endedAt;
  }
  return c.endDate;
}

function rentInYear(startDate: string, endDate: string, rent: number, y: number) {
  if (!startDate || !endDate || !rent) return 0;
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  if (end < start) return 0;
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (totalDays <= 0) return 0;
  const yStart = new Date(y, 0, 1, 12, 0, 0);
  const yEnd = new Date(y, 11, 31, 12, 0, 0);
  const from = start > yStart ? start : yStart;
  const to = end < yEnd ? end : yEnd;
  if (to < from) return 0;
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  return Math.round((rent / totalDays) * days);
}

function answerQuery(
  raw: string,
  data: ReturnType<typeof useStore>["data"],
): string {
  const q = raw.trim().toLowerCase();
  const year = new Date().getFullYear();
  const today = localToday();
  const tomorrow = addDaysIso(today, 1);

  const tenantName = (id: string) =>
    data.tenants.find((t) => t.id === id)?.name ?? "Unknown";
  const flatNo = (unitId?: string) =>
    data.units.find((u) => u.id === unitId)?.flatNo ?? "—";

  // —— Help ——
  if (
    !q ||
    q === "help" ||
    q.includes("what can you") ||
    q.includes("commands")
  ) {
    return [
      "I can answer from your Aqar Books data:",
      "• profit / income / expenses",
      "• occupancy / vacant",
      "• renewals / expire soon",
      "• expired contracts",
      "• PDCs today / tomorrow / next 7 days",
      "• lease 001 (or any lease no)",
      "• tenant <name>",
    ].join("\n");
  }

  // —— Profit / income / expense ——
  if (
    q.includes("profit") ||
    q.includes("income") ||
    q.includes("expense") ||
    q.includes("revenue")
  ) {
    let income = 0;
    let other = 0;
    let expense = 0;

    data.contracts.forEach((c) => {
      if ((c.status || "Active") === "Draft") return;
      income += rentInYear(c.startDate, effectiveEnd(c), effectiveRent(c), year);
      const pen = (c.penalty || 0) + (c.extraCharges || 0);
      if (pen > 0) {
        const endIso = c.endedAt || c.endDate;
        if (endIso && new Date(endIso).getFullYear() === year) other += pen;
      }
    });
    data.expenses.forEach((e) => {
      if (e.date && new Date(e.date).getFullYear() === year) expense += e.amount;
    });
    const profit = income + other - expense;

    return [
      `${year} summary (same logic as Dashboard):`,
      `• Income (accrual): ${currency(income)}`,
      other > 0 ? `• Penalty/extra: ${currency(other)}` : null,
      `• Expenses: ${currency(expense)}`,
      `• Net profit: ${currency(profit)}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // —— Occupancy / vacant ——
  if (q.includes("occup") || q.includes("vacant") || q.includes("empty")) {
    const covering = data.contracts.filter((c) => {
      if ((c.status || "Active") !== "Active") return false;
      if (c.startDate && c.startDate > today) return false;
      if (c.endDate && c.endDate < today) return false;
      return true;
    });
    const occupied = new Set(covering.map((c) => c.unitId).filter(Boolean));
    const vacant = data.units.filter((u) => !occupied.has(u.id));
    const lines = vacant.slice(0, 15).map((u) => `• Flat ${u.flatNo} (${u.bedroomType || "—"})`);
    return [
      `Occupancy: ${occupied.size}/${data.units.length}`,
      `Vacant: ${vacant.length}`,
      lines.length ? lines.join("\n") : "All units occupied.",
      vacant.length > 15 ? `… +${vacant.length - 15} more` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // —— Expired (Active, period ended) ——
  if (q.includes("expired") || q.includes("overdue contract")) {
    const list = data.contracts
      .filter(
        (c) =>
          (c.status || "Active") === "Active" &&
          c.endDate &&
          c.endDate <= today,
      )
      .sort((a, b) => (b.endDate || "").localeCompare(a.endDate || ""));
    if (!list.length) return "No expired Active contracts.";
    return [
      `Expired (Active, period ended): ${list.length}`,
      ...list.slice(0, 12).map((c) => {
        const d = daysUntil(c.endDate);
        return `• ${c.leaseNo || "—"} · ${tenantName(c.tenantId)} · Flat ${flatNo(c.unitId)} · ended ${fmtDate(c.endDate)} (${d === 0 ? "today" : Math.abs(d) + "d overdue"})`;
      }),
    ].join("\n");
  }

  // —— Renewals / expire soon ——
  if (
    q.includes("renew") ||
    q.includes("expir") ||
    q.includes("ending soon") ||
    q.includes("end soon")
  ) {
    const list = data.contracts
      .filter((c) => {
        if ((c.status || "Active") !== "Active") return false;
        if (!c.endDate) return false;
        const d = daysUntil(c.endDate);
        return d >= 0 && d <= 120;
      })
      .sort((a, b) => a.endDate.localeCompare(b.endDate));
    if (!list.length) return "No Active contracts ending within 120 days.";
    return [
      `Upcoming renewals (120 days): ${list.length}`,
      ...list.slice(0, 12).map(
        (c) =>
          `• ${c.leaseNo || "—"} · ${tenantName(c.tenantId)} · Flat ${flatNo(c.unitId)} · ends ${fmtDate(c.endDate)} (in ${daysUntil(c.endDate)}d)`,
      ),
    ].join("\n");
  }

  // —— PDCs ——
  if (
    q.includes("pdc") ||
    q.includes("cheque") ||
    q.includes("check") ||
    q.includes("payment due")
  ) {
    let from = today;
    let to = today;
    let label = "today";

    if (q.includes("tomorrow") || q.includes("tmorrow")) {
      from = to = tomorrow;
      label = "tomorrow";
    } else if (q.includes("week") || q.includes("7 day") || q.includes("seven")) {
      to = addDaysIso(today, 7);
      label = "next 7 days";
    } else if (q.includes("today")) {
      label = "today";
    }

    const list = data.cheques
      .filter((c) => {
        if (c.status !== "PDC") return false;
        if ((c.kind || "rent") === "deposit") return false;
        if (!c.chequeDate) return false;
        if (c.chequeDate < from || c.chequeDate > to) return false;
        return true;
      })
      .sort((a, b) => (a.chequeDate || "").localeCompare(b.chequeDate || ""));

    if (!list.length) return `No PDCs for ${label}.`;
    const total = list.reduce((s, c) => s + (c.amount || 0), 0);
    return [
      `PDCs ${label}: ${list.length} · total ${currency(total)}`,
      ...list.slice(0, 15).map(
        (c) =>
          `• ${fmtDate(c.chequeDate)} · ${tenantName(c.tenantId)} · #${c.chequeNo || "—"} · ${currency(c.amount)}`,
      ),
    ].join("\n");
  }

  // —— Lease by number ——
  const leaseMatch = q.match(/\b(?:lease|contract)\s*#?\s*(\d+)\b/) || q.match(/\b0*(\d{1,4})\b/);
  if (leaseMatch && (q.includes("lease") || q.includes("contract") || /^\d+$/.test(q.trim()))) {
    const num = leaseMatch[1];
    const c = data.contracts.find(
      (x) => (x.leaseNo || "").replace(/^0+/, "") === String(Number(num)),
    );
    if (!c) return `No lease found for ${num}.`;
    return [
      `Lease ${c.leaseNo || num}`,
      `• Tenant: ${tenantName(c.tenantId)}`,
      `• Unit: ${flatNo(c.unitId)}`,
      `• Status: ${c.status || "Active"}`,
      `• Period: ${fmtDate(c.startDate)} → ${fmtDate(c.endDate)}`,
      `• Rent: ${currency(c.rent)}`,
      c.actualRent ? `• Actual rent: ${currency(c.actualRent)}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // —— Tenant search ——
  if (q.includes("tenant") || q.startsWith("who is") || q.startsWith("find ")) {
    const nameQ = q
      .replace(/tenant|who is|find|details|of|for/gi, "")
      .trim();
    if (nameQ.length >= 2) {
      const hits = data.tenants.filter((t) =>
        (t.name || "").toLowerCase().includes(nameQ),
      );
      if (!hits.length) return `No tenant matching “${nameQ}”.`;
      return hits
        .slice(0, 5)
        .map((t) => {
          const leases = data.contracts.filter(
            (c) => c.tenantId === t.id && (c.status || "Active") !== "Draft",
          );
          return [
            `${t.name}`,
            `• Mobile: ${t.mobile || "—"}`,
            `• Leases: ${leases.map((c) => c.leaseNo || "—").join(", ") || "none"}`,
          ].join("\n");
        })
        .join("\n\n");
    }
  }

  return "I didn’t understand that. Type **help** for examples, e.g. “profit”, “PDCs tomorrow”, “renewals”, “vacant”.";
}

export function DataAssistant() {
  const { data } = useStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "bot",
      text: "Hi — ask about profit, PDCs, renewals, vacant units, or a lease number. Type help for more.",
    },
  ]);

  const suggestions = useMemo(
    () => ["Profit", "PDCs tomorrow", "Renewals", "Expired", "Vacant"],
    [],
  );

  const send = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    const reply = answerQuery(q, data);
    setMsgs((m) => [...m, { role: "user", text: q }, { role: "bot", text: reply }]);
    setInput("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90"
        title="Data assistant"
      >
        <MessageCircle className="size-5" />
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-50 flex h-[min(480px,70vh)] w-[min(360px,calc(100vw-2rem))] flex-col rounded-xl border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div>
              <p className="text-sm font-semibold">Aqar Assistant</p>
              <p className="text-xs text-muted-foreground">Answers from your live data</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap rounded-lg px-3 py-2 ${
                  m.role === "user"
                    ? "ml-8 bg-primary text-primary-foreground"
                    : "mr-6 bg-muted"
                }`}
              >
                {m.text}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-1 border-t px-2 py-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                onClick={() => send(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <form
            className="flex gap-2 border-t p-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask e.g. PDCs tomorrow…"
              className="h-9"
            />
            <Button type="submit" size="icon" className="shrink-0">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

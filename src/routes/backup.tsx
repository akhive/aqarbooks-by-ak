import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, RotateCcw, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "../supabase";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/backup")({
  head: () => ({
    meta: [{ title: "Backup & Restore — Estate Manager" }],
  }),
  component: BackupPage,
});

const AUTO_KEY = "aqar_auto_backups"; // last few snapshots in browser
const MAX_AUTO = 7;

type Snapshot = {
  id: string;
  createdAt: string;
  label: string;
  data: {
    units: any[];
    tenants: any[];
    contracts: any[];
    cheques: any[];
    expenses: any[];
  };
};

async function fetchAll() {
  const [units, tenants, contracts, cheques, expenses] = await Promise.all([
    supabase.from("units").select("*"),
    supabase.from("tenants").select("*"),
    supabase.from("contracts").select("*"),
    supabase.from("cheques").select("*"),
    supabase.from("expenses").select("*"),
  ]);
  return {
    units: units.data || [],
    tenants: tenants.data || [],
    contracts: contracts.data || [],
    cheques: cheques.data || [],
    expenses: expenses.data || [],
  };
}

function loadAuto(): Snapshot[] {
  try {
    return JSON.parse(localStorage.getItem(AUTO_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAuto(list: Snapshot[]) {
  localStorage.setItem(AUTO_KEY, JSON.stringify(list.slice(0, MAX_AUTO)));
}

function BackupPage() {
  const { refresh } = useStore();
  const [autoList, setAutoList] = useState<Snapshot[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAutoList(loadAuto());
  }, []);

  const downloadBackup = async () => {
    setBusy(true);
    try {
      const data = await fetchAll();
      const payload = {
        version: 1,
        app: "aqarbooks",
        createdAt: new Date().toISOString(),
        data,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const day = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `aqarbooks-backup-${day}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch (e: any) {
      toast.error(e.message || "Backup failed");
    } finally {
      setBusy(false);
    }
  };

  const createAutoSnapshot = async (label = "Auto") => {
    setBusy(true);
    try {
      const data = await fetchAll();
      const snap: Snapshot = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        label,
        data,
      };
      const next = [snap, ...loadAuto()].slice(0, MAX_AUTO);
      saveAuto(next);
      setAutoList(next);
      toast.success("Snapshot saved in this browser");
    } catch (e: any) {
      toast.error(e.message || "Snapshot failed");
    } finally {
      setBusy(false);
    }
  };

  const restoreFromSnapshot = async (snap: Snapshot) => {
    if (
      !confirm(
        `Restore snapshot from ${new Date(snap.createdAt).toLocaleString()}?\n\nThis will UPSERT rows into Supabase. Deleted rows are not removed automatically.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const d = snap.data;
      // Upsert by id so existing rows update and missing ones return
      if (d.units?.length) {
        const { error } = await supabase.from("units").upsert(d.units);
        if (error) throw error;
      }
      if (d.tenants?.length) {
        const { error } = await supabase.from("tenants").upsert(d.tenants);
        if (error) throw error;
      }
      if (d.contracts?.length) {
        const { error } = await supabase.from("contracts").upsert(d.contracts);
        if (error) throw error;
      }
      if (d.cheques?.length) {
        const { error } = await supabase.from("cheques").upsert(d.cheques);
        if (error) throw error;
      }
      if (d.expenses?.length) {
        const { error } = await supabase.from("expenses").upsert(d.expenses);
        if (error) throw error;
      }
      await refresh();
      toast.success("Restore completed — refresh pages if needed");
    } catch (e: any) {
      toast.error(e.message || "Restore failed");
    } finally {
      setBusy(false);
    }
  };

  const restoreFromFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const data = json.data || json;
      const snap: Snapshot = {
        id: crypto.randomUUID(),
        createdAt: json.createdAt || new Date().toISOString(),
        label: file.name,
        data: {
          units: data.units || [],
          tenants: data.tenants || [],
          contracts: data.contracts || [],
          cheques: data.cheques || [],
          expenses: data.expenses || [],
        },
      };
      await restoreFromSnapshot(snap);
    } catch (e: any) {
      toast.error(e.message || "Invalid backup file");
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Backup & Restore"
        description="Download backups, restore from file, or use browser auto-snapshots"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Download backup</CardTitle>
            <CardDescription>
              Full JSON of units, tenants, contracts, cheques, expenses. Keep this file safe
              (Google Drive / USB).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={downloadBackup} disabled={busy}>
              <Download className="mr-2 h-4 w-4" />
              Download JSON backup
            </Button>
            <Button variant="outline" onClick={() => createAutoSnapshot("Manual")} disabled={busy}>
              <Save className="mr-2 h-4 w-4" />
              Save snapshot in browser
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Restore from file</CardTitle>
            <CardDescription>
              Upload a previous <code>aqarbooks-backup-….json</code> file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
              <Upload className="h-4 w-4" />
              Choose backup file
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) restoreFromFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Browser auto-snapshots (last {MAX_AUTO})</CardTitle>
          <CardDescription>
            Stored only on this computer/browser. Not a replacement for downloading JSON to Drive.
            Open the app at least once a day so a snapshot can be created.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => createAutoSnapshot("Auto")}
          >
            Take snapshot now
          </Button>

          {autoList.length === 0 && (
            <p className="text-sm text-muted-foreground">No snapshots yet.</p>
          )}

          {autoList.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(s.createdAt).toLocaleString()} ·{" "}
                  {s.data.contracts?.length || 0} contracts · {s.data.tenants?.length || 0} tenants
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => restoreFromSnapshot(s)}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Restore
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Recommended routine</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>1. After major data entry → Download JSON backup</p>
          <p>2. Save file to Google Drive / OneDrive</p>
          <p>3. Weekly → Download again</p>
          <p>4. If you delete something by mistake → Restore from file or browser snapshot</p>
        </CardContent>
      </Card>
    </AppShell>
  );
}

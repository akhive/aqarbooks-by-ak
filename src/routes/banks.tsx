import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/banks")({
  component: BanksPage,
});

const KEY = "aqar_bank_names";

function BanksPage() {
  const [list, setList] = useState<string[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setList(JSON.parse(raw));
      else setList(["ENBD", "FAB", "ADCB", "Mashreq", "Dubai Islamic Bank"]);
    } catch {
      setList(["ENBD", "FAB", "ADCB"]);
    }
  }, []);

  const save = (next: string[]) => {
    setList(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  return (
    <AppShell>
      <PageHeader title="Bank names" description="Saved banks appear when editing cheques" />
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Bank name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              onClick={() => {
                const n = name.trim();
                if (!n) return;
                if (list.some((x) => x.toLowerCase() === n.toLowerCase())) {
                  toast.message("Already exists");
                  return;
                }
                save([...list, n].sort());
                setName("");
                toast.success("Saved");
              }}
            >
              Add
            </Button>
          </div>
          {list.map((b) => (
            <div key={b} className="flex justify-between border-b py-2 text-sm">
              <span>{b}</span>
              <button
                type="button"
                className="text-destructive"
                onClick={() => save(list.filter((x) => x !== b))}
              >
                Remove
              </button>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}

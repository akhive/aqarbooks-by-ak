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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setList(Array.isArray(parsed) ? parsed : []);
      } else {
        const defaults = ["ENBD", "FAB", "ADCB", "Mashreq", "Dubai Islamic Bank"];
        localStorage.setItem(KEY, JSON.stringify(defaults));
        setList(defaults);
      }
    } catch {
      setList(["ENBD", "FAB", "ADCB"]);
    }
    setReady(true);
  }, []);

  const persist = (next: string[]) => {
    setList(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      toast.error("Could not save (browser blocked storage)");
    }
  };

  const addBank = () => {
    const n = name.trim();
    if (!n) {
      toast.error("Type a bank name");
      return;
    }
    if (list.some((x) => x.toLowerCase() === n.toLowerCase())) {
      toast.message("Already exists");
      return;
    }
    const next = [...list, n].sort((a, b) => a.localeCompare(b));
    persist(next);
    setName("");
    toast.success(`Saved: ${n}`);
  };

  if (!ready) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Bank names"
        description="These names appear when you edit a cheque (type or pick from list)"
      />
      <Card>
        <CardContent className="space-y-4 p-4">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addBank();
            }}
          >
            <Input
              className="min-w-[200px] flex-1"
              placeholder="e.g. Emirates NBD"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit">Add bank</Button>
          </form>

          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">No banks yet. Add one above.</p>
          )}

          <ul className="divide-y rounded-md border">
            {list.map((b) => (
              <li key={b} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{b}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    persist(list.filter((x) => x !== b));
                    toast.message("Removed");
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </AppShell>
  );
}

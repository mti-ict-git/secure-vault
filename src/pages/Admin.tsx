import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, RefreshCw, Shield } from "lucide-react";
import { get } from "@/lib/api";

type AuditItem = {
  id: string;
  action: string;
  actor_user_id: string | null;
  actor_username?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  details_json?: unknown;
  created_at: string;
};

const Admin = () => {
  const { user } = useAuth();
  const isAdmin = !!user && (user as { role?: "user" | "admin" }).role === "admin";
  const [items, setItems] = useState<AuditItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actorId, setActorId] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");

  const load = async () => {
    setIsLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (actorId) qs.set("actor_id", actorId);
    if (since) qs.set("since", since);
    if (until) qs.set("until", until);
    const res = await get<{ items: AuditItem[] }>(`/admin/audit${qs.toString() ? "?" + qs.toString() : ""}`);
    if (!res.ok) {
      setError("Failed to load audit");
      setItems([]);
    } else {
      setItems(res.body?.items || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAdmin) {
      void load();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Administration requires elevated access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Audit & Compliance</h2>
            <p className="text-sm text-muted-foreground">System-wide audit logs</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-4">
            <div className="space-y-3 p-4 border rounded-xl bg-card/40">
              <div className="space-y-2">
                <label className="text-sm font-medium">Actor ID</label>
                <Input value={actorId} onChange={(e) => setActorId(e.target.value)} placeholder="optional" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Since (ISO)</label>
                <Input value={since} onChange={(e) => setSince(e.target.value)} placeholder="YYYY-MM-DD" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Until (ISO)</label>
                <Input value={until} onChange={(e) => setUntil(e.target.value)} placeholder="YYYY-MM-DD" />
              </div>
              <Button onClick={load} disabled={isLoading}>Apply Filters</Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
          <div className="col-span-12 md:col-span-8">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-3">
                {items.map((it) => (
                  <div key={it.id} className="p-3 border rounded-xl bg-card/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{it.action}</div>
                        <div className="text-xs text-muted-foreground">{it.actor_username || it.actor_user_id}</div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">{new Date(it.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
                {items.length === 0 && !isLoading && (
                  <div className="text-center py-12">
                    <Activity className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No audit data</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;

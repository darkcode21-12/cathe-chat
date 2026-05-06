import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api, User } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, ShieldOff, Loader2 } from "lucide-react";

const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<User[]>([]);
  const isAdmin = !!user?.is_admin;

  useEffect(() => { document.title = "Admin — School Anonymous Chat"; }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth", { replace: true }); return; }
    if (!isAdmin) {
      toast({ title: "Not authorized", variant: "destructive" });
      navigate("/chat", { replace: true });
    }
  }, [user, loading, navigate]);

  const refresh = async () => {
    try { setRows(await api.listUsers()); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  const togglePromote = async (row: User) => {
    try {
      await api.setAdmin(row.id, !row.is_admin);
      toast({ title: row.is_admin ? `Removed admin from ${row.handle}` : `Promoted ${row.handle}` });
      refresh();
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>;
  }
  if (!isAdmin) return null;

  return (
    <main className="min-h-screen p-4 max-w-4xl mx-auto">
      <header className="glass flex items-center justify-between p-4 rounded-2xl shadow-soft mb-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/chat"><ArrowLeft className="size-4" /></Link></Button>
          <div>
            <h1 className="font-semibold flex items-center gap-2"><Shield className="size-4" /> Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">{rows.length} users</p>
          </div>
        </div>
      </header>

      <Card className="glass shadow-soft overflow-hidden">
        <div className="divide-y divide-border">
          <div className="grid grid-cols-12 gap-3 p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
            <div className="col-span-3">Handle</div>
            <div className="col-span-5">Real email</div>
            <div className="col-span-2">Joined</div>
            <div className="col-span-2 text-right">Action</div>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-12 gap-3 p-4 items-center hover:bg-muted/30 transition-colors">
              <div className="col-span-3 flex items-center gap-2">
                <span className="font-medium">{r.handle}</span>
                {r.is_admin && <Badge variant="secondary" className="text-xs">admin</Badge>}
              </div>
              <div className="col-span-5 text-sm text-muted-foreground truncate">{r.email}</div>
              <div className="col-span-2 text-xs text-muted-foreground">—</div>
              <div className="col-span-2 flex justify-end">
                {r.id !== user?.id && (
                  <Button size="sm" variant={r.is_admin ? "outline" : "default"} onClick={() => togglePromote(r)}>
                    {r.is_admin ? <><ShieldOff className="size-3 mr-1" /> Demote</> : <><Shield className="size-3 mr-1" /> Promote</>}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        Real identities are visible only to admins. To make yourself the first admin, set <code className="bg-muted px-1 rounded">is_admin = true</code> for your user in your server's database.
      </p>
    </main>
  );
};

export default Admin;
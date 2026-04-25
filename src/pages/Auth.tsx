import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { MessageCircle, Sparkles } from "lucide-react";

const schema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Sign in — School Anonymous Chat";
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/chat", { replace: true });
    });
  }, [navigate]);

  const handle = async (mode: "signin" | "signup") => {
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast({ title: "Check your input", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}/chat` },
        });
        if (error) throw error;
        toast({ title: "Account created", description: "You got a random anonymous handle. Welcome!" });
        navigate("/chat", { replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        navigate("/chat", { replace: true });
      }
    } catch (err: any) {
      toast({ title: "Authentication error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="glass w-full max-w-md p-8 shadow-soft">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="size-14 rounded-2xl gradient-primary flex items-center justify-center shadow-glow mb-4">
            <MessageCircle className="size-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">School Anonymous Chat</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <Sparkles className="size-3" /> Speak freely. Stay anonymous.
          </p>
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>

          {(["signin", "signup"] as const).map((mode) => (
            <TabsContent key={mode} value={mode} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor={`email-${mode}`}>Email</Label>
                <Input id={`email-${mode}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" maxLength={255} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`pw-${mode}`}>Password</Label>
                <Input id={`pw-${mode}`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" maxLength={72} />
              </div>
              <Button onClick={() => handle(mode)} disabled={loading} className="w-full gradient-primary text-primary-foreground border-0 shadow-glow hover:opacity-90">
                {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create anonymous account"}
              </Button>
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground text-center">
                  You'll get a random handle like <span className="text-foreground">BlueFox42</span>. Your real identity is hidden from other students.
                </p>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </Card>
    </main>
  );
};

export default Auth;
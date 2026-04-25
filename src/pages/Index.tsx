import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      navigate(data.session ? "/chat" : "/auth", { replace: true });
    });
  }, [navigate]);
  return (
    <main className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </main>
  );
};

export default Index;

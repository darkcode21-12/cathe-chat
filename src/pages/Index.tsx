import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "@/lib/api";

const Index = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(getToken() ? "/chat" : "/auth", { replace: true });
  }, [navigate]);
  return (
    <main className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </main>
  );
};

export default Index;

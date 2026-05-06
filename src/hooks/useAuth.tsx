import { useEffect, useState, useCallback } from "react";
import { api, getToken, clearToken, setToken, User } from "@/lib/api";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setLoading(false); return; }
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Pick up ?token=... from Google OAuth redirect
    const url = new URL(window.location.href);
    const tokenFromUrl = url.searchParams.get("token");
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
    }
    refresh();
  }, [refresh]);

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return { user, loading, refresh, signOut };
}
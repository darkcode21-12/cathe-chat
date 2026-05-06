import { API_URL, TOKEN_KEY } from "./config";

export interface User {
  id: string;
  email: string;
  handle: string;
  is_admin?: boolean;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  handle: string;
  content: string | null;
  file_url: string | null;
  file_type: string | null;
  file_name: string | null;
  created_at: string;
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.error || j.message || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  signup: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: User }>("/auth/me"),
  googleLoginUrl: () => `${API_URL}/auth/google`,

  listMessages: () => request<ChatMessage[]>("/messages"),
  sendMessage: (content: string) =>
    request<ChatMessage>("/messages", {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  deleteMessage: (id: string) =>
    request<void>(`/messages/${id}`, { method: "DELETE" }),

  uploadFile: async (file: File): Promise<ChatMessage> => {
    const token = getToken();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_URL}/messages/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  fileUrl: (path: string) => `${API_URL}${path.startsWith("/") ? path : `/files/${path}`}`,

  // Admin
  listUsers: () => request<User[]>("/admin/users"),
  setAdmin: (userId: string, isAdmin: boolean) =>
    request<void>(`/admin/users/${userId}/admin`, {
      method: "POST",
      body: JSON.stringify({ is_admin: isAdmin }),
    }),
};
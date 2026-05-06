// 🔧 Edit these two URLs when you start your server / ngrok tunnel.
// In production (Vercel) set them as env vars: VITE_API_URL and VITE_WS_URL
export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";
export const WS_URL =
  import.meta.env.VITE_WS_URL || "ws://localhost:3001";

export const TOKEN_KEY = "chat_token";
import { useEffect, useRef, useState } from "react";
import { WS_URL } from "@/lib/config";
import { getToken, ChatMessage } from "@/lib/api";

type Event =
  | { type: "message"; data: ChatMessage }
  | { type: "delete"; id: string }
  | { type: "connected" }
  | { type: "error"; message: string };

export function useChatSocket(onEvent: (e: Event) => void, enabled: boolean) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    const token = getToken();
    if (!token) return;

    let stopped = false;
    let retry = 0;

    const connect = () => {
      const ws = new WebSocket(`${WS_URL}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => { setConnected(true); retry = 0; };
      ws.onmessage = (ev) => {
        try { cbRef.current(JSON.parse(ev.data)); } catch {}
      };
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) {
          retry = Math.min(retry + 1, 5);
          setTimeout(connect, 1000 * retry);
        }
      };
      ws.onerror = () => ws.close();
    };
    connect();

    return () => {
      stopped = true;
      wsRef.current?.close();
    };
  }, [enabled]);

  const send = (payload: any) => {
    wsRef.current?.send(JSON.stringify(payload));
  };

  return { connected, send };
}
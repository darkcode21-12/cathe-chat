import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { MessageAttachment } from "@/components/chat/MessageAttachment";
import { LogOut, Paperclip, Send, Shield, Trash2, MessageCircle } from "lucide-react";

interface Message {
  id: string;
  user_id: string;
  content: string | null;
  file_url: string | null;
  file_type: string | null;
  file_name: string | null;
  created_at: string;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm",
  "video/mp4", "video/webm", "video/quicktime",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/zip",
];

const Chat = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [handles, setHandles] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myHandle, setMyHandle] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Group Chat — School Anonymous Chat";
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [user, authLoading, navigate]);

  // Load initial data
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: msgs }, { data: profs }, { data: roles }] = await Promise.all([
        supabase.from("messages").select("*").order("created_at", { ascending: true }).limit(200),
        supabase.from("profiles").select("id, handle"),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      if (msgs) setMessages(msgs as Message[]);
      if (profs) {
        const map: Record<string, string> = {};
        profs.forEach((p: any) => { map[p.id] = p.handle; });
        setHandles(map);
        setMyHandle(map[user.id] || "");
      }
      if (roles?.some((r: any) => r.role === "admin")) setIsAdmin(true);
    })();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("messages-room")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (!handles[m.user_id]) {
          const { data } = await supabase.from("profiles").select("handle").eq("id", m.user_id).maybeSingle();
          if (data) setHandles((h) => ({ ...h, [m.user_id]: data.handle }));
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, handles]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!user || (!text.trim())) return;
    setSending(true);
    const content = text.trim().slice(0, 2000);
    setText("");
    // Optimistic local message; remote users receive via postgres_changes (server-authoritative)
    const optimistic: Message = {
      id: crypto.randomUUID(),
      user_id: user.id,
      content,
      file_url: null,
      file_type: null,
      file_name: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    // Persist so messages survive reloads and admins can moderate
    const { error } = await supabase.from("messages").insert({ id: optimistic.id, user_id: user.id, content });
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    }
    setSending(false);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Max 25MB", variant: "destructive" });
      return;
    }
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({ title: "Unsupported file type", description: "SVG and other unsupported types are not allowed.", variant: "destructive" });
      return;
    }
    setSending(true);
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("chat-files").upload(path, file, { contentType: file.type });
    if (upErr) {
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      setSending(false);
      return;
    }
    const optimistic: Message = {
      id: crypto.randomUUID(),
      user_id: user.id,
      content: null,
      file_url: path,
      file_type: file.type,
      file_name: file.name,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const { error } = await supabase.from("messages").insert({
      id: optimistic.id,
      user_id: user.id,
      file_url: path,
      file_type: file.type,
      file_name: file.name,
    });
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    }
    setSending(false);
  };

  const deleteMsg = async (id: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <main className="min-h-screen flex flex-col max-w-3xl mx-auto">
      <header className="glass sticky top-0 z-10 flex items-center justify-between p-4 m-3 rounded-2xl shadow-soft">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <MessageCircle className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold leading-tight">School Chat</h1>
            <p className="text-xs text-muted-foreground">You are <span className="text-foreground font-medium">{myHandle || "…"}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button asChild variant="secondary" size="sm">
              <Link to="/admin"><Shield className="size-4 mr-1" /> Admin</Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3">
        <div className="space-y-3 py-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <MessageCircle className="size-10 mx-auto mb-3 opacity-50" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
          {messages.map((m) => {
            const mine = m.user_id === user?.id;
            const handle = handles[m.user_id] || "Anonymous";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} group`}>
                <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {!mine && <span className="text-xs text-muted-foreground px-2">{handle}</span>}
                  <div className={`rounded-2xl px-4 py-2 shadow-soft ${mine ? "gradient-bubble-self text-primary-foreground rounded-br-md" : "glass rounded-bl-md"}`}>
                    {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                    {m.file_url && (
                      <div className={m.content ? "mt-2" : ""}>
                        <MessageAttachment fileUrl={m.file_url} fileType={m.file_type} fileName={m.file_name} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 px-2">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {(mine || isAdmin) && (
                      <button onClick={() => deleteMsg(m.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass m-3 p-2 rounded-2xl shadow-soft flex items-center gap-2">
        <input ref={fileRef} type="file" hidden onChange={onFile} accept="image/png,image/jpeg,image/gif,image/webp,audio/*,video/*,application/pdf,.doc,.docx,.txt,.zip" />
        <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} disabled={sending} aria-label="Attach file">
          <Paperclip className="size-5" />
        </Button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Share an idea anonymously…"
          maxLength={2000}
          className="border-0 bg-transparent focus-visible:ring-0"
        />
        <Button onClick={send} disabled={sending || !text.trim()} size="icon" className="gradient-primary text-primary-foreground border-0 shadow-glow">
          <Send className="size-4" />
        </Button>
      </div>
    </main>
  );
};

export default Chat;
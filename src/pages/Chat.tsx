import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import func2url from "../../backend/func2url.json";

const API = (func2url as Record<string, string>)["candidates"];

interface Announcement {
  id: number;
  author_id: number;
  author_name: string;
  message: string;
  created_at: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function seenKey(userId?: number) {
  return `chat_last_seen_${userId ?? "anon"}`;
}

export default function Chat() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchAnnouncements = useCallback(async () => {
    const res = await fetch(`${API}?mode=announcements`, {
      headers: { "X-Session-Id": token || "" },
    });
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 10000);
    return () => clearInterval(interval);
  }, [fetchAnnouncements]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    if (items.length > 0) {
      const maxId = Math.max(...items.map((i) => i.id));
      localStorage.setItem(seenKey(user?.id), String(maxId));
    }
  }, [items]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
      body: JSON.stringify({ action: "announcements_post", message: text.trim() }),
    });
    setText("");
    setSending(false);
    await fetchAnnouncements();
    textareaRef.current?.focus();
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
      body: JSON.stringify({ action: "announcements_delete", ann_id: id }),
    });
    setDeletingId(null);
    await fetchAnnouncements();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(210,20%,97%)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Header */}
      <header className="text-white px-6 py-4 flex items-center justify-between shadow-lg" style={{ background: "hsl(217, 60%, 18%)" }}>
        <div className="flex items-center gap-3">
          <img src="https://cdn.poehali.dev/projects/9349667d-fe54-44ac-a18d-809d42c7c67e/files/ba8ed286-2fa3-48f9-9a22-0eacab2cada0.jpg" alt="logo" className="w-9 h-9 rounded object-cover border border-white/20" />
          <div>
            <div className="font-semibold text-base tracking-wide leading-tight">Объявления</div>
            <div className="text-white/50 text-xs font-light">Сообщения от администратора</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/")} className="flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors" title="Кандидаты">
            <Icon name="Users" size={14} />
            <span className="hidden md:inline">Кандидаты</span>
          </button>
          <button onClick={() => navigate("/leads")} className="flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors" title="Лиды">
            <Icon name="Inbox" size={14} />
            <span className="hidden md:inline">Лиды</span>
          </button>
          {isAdmin && (
            <button onClick={() => navigate("/users")} className="flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors" title="Пользователи">
              <Icon name="UserCog" size={14} />
              <span className="hidden md:inline">Пользователи</span>
            </button>
          )}
          <button onClick={() => navigate("/help")} className="flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors" title="Инструкция">
            <Icon name="BookOpen" size={14} />
            <span className="hidden md:inline">Инструкция</span>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl w-full mx-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <Icon name="Loader2" size={20} className="animate-spin mr-2" />
            <span className="text-sm">Загрузка...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <Icon name="MessageSquare" size={36} />
            <p className="text-sm">Объявлений пока нет</p>
            {isAdmin && <p className="text-xs text-gray-400">Напишите первое объявление ниже</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "hsl(217, 60%, 30%)" }}>
                      {item.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-700">{item.author_name}</span>
                      <span className="text-xs text-gray-400 ml-2">{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                      title="Удалить"
                    >
                      {deletingId === item.id ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Trash2" size={14} />}
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{item.message}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input — only admin */}
      {isAdmin && (
        <div className="border-t border-gray-200 bg-white px-4 py-3">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напишите объявление... (Enter — отправить, Shift+Enter — новая строка)"
              rows={2}
              className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-white text-sm font-medium transition disabled:opacity-40"
              style={{ background: "hsl(217, 60%, 28%)" }}
            >
              {sending ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Send" size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
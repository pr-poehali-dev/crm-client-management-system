import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";
import { useUnread } from "@/hooks/useUnread";
import { useBadge } from "@/hooks/useBadge";

const API = (func2url as Record<string, string>)["candidates"];

interface TrashItem {
  id: number;
  fullName: string;
  phone: string;
  city: string;
  citizenship: string;
  isLead: boolean;
  trashedAt: string | null;
  trashedFrom: string;
  createdAt: string;
  assignedTo: string;
  callResult: string;
}

const SOURCE_LABELS: Record<string, string> = {
  duplicates: "Дубли",
  leads: "Лиды",
  candidates: "Кандидаты",
};

function apiParse(raw: string) {
  const p = JSON.parse(raw);
  return typeof p === "string" ? JSON.parse(p) : p;
}

export default function Trash() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useUnread(token, user?.id);
  useBadge(unreadCount);

  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [purgingId, setPurgingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const headers = { "Content-Type": "application/json", "X-Session-Id": token || "" };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "trash_list" }),
      });
      const data = apiParse(await res.text());
      if (!res.ok) { setError(data.error || "Ошибка загрузки"); return; }
      setItems(data.items || []);
    } catch {
      setError("Сервер не отвечает");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== "admin") { navigate("/"); return; }
    load();
  }, []);

  const handleRestore = async (item: TrashItem) => {
    setRestoringId(item.id);
    setError(null);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "trash_restore", id: item.id }),
      });
      const data = apiParse(await res.text());
      if (!res.ok) { setError(data.error || "Ошибка"); return; }
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      const dest = SOURCE_LABELS[item.trashedFrom] || item.trashedFrom || "раздел";
      setSuccessMsg(`«${item.fullName || item.phone}» восстановлен в ${dest}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch {
      setError("Сервер не отвечает");
    } finally {
      setRestoringId(null);
    }
  };

  const handlePurge = async (item: TrashItem) => {
    if (!confirm(`Удалить «${item.fullName || item.phone}» навсегда? Это действие нельзя отменить.`)) return;
    setPurgingId(item.id);
    setError(null);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "trash_purge", id: item.id }),
      });
      const data = apiParse(await res.text());
      if (!res.ok) { setError(data.error || "Ошибка"); return; }
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch {
      setError("Сервер не отвечает");
    } finally {
      setPurgingId(null);
    }
  };

  const filtered = items.filter((item) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      item.fullName.toLowerCase().includes(s) ||
      item.phone.includes(s) ||
      item.city.toLowerCase().includes(s)
    );
  });

  const navItems = [
    { path: "/", icon: "UserPlus", label: "Кандидаты" },
    { path: "/leads", icon: "Users", label: "Лиды" },
    { path: "/chat", icon: "MessageSquare", label: "Чат", badge: unreadCount > 0 ? unreadCount : undefined },
    { path: "/users", icon: "Settings", label: "Сотрудники" },
    { path: "/duplicates", icon: "Copy", label: "Дубли" },
    { path: "/trash", icon: "Trash2", label: "Корзина" },
    { path: "/help", icon: "HelpCircle", label: "Помощь" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between gap-2 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <span className="font-semibold text-base">Корзина</span>
          {items.length > 0 && (
            <Badge variant="secondary">{items.length}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <button onClick={() => { logout(); navigate("/login"); }} className="text-muted-foreground hover:text-foreground transition-colors ml-1">
            <Icon name="LogOut" size={18} />
          </button>
        </div>
      </header>

      <nav className="border-b bg-card px-2 flex gap-1 overflow-x-auto">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 relative ${
              item.path === "/trash"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name={item.icon as Parameters<typeof Icon>[0]["name"]} size={15} />
            {item.label}
            {item.badge && (
              <span className="absolute -top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm flex items-center gap-2">
            <Icon name="AlertCircle" size={16} />
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg text-sm flex items-center gap-2">
            <Icon name="CheckCircle" size={16} />
            {successMsg}
          </div>
        )}

        {items.length > 0 && (
          <div className="mb-4">
            <Input
              placeholder="Поиск по имени, телефону, городу..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Icon name="Loader2" size={20} className="animate-spin" />
            Загрузка корзины...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Icon name="Trash2" size={40} className="opacity-30" />
            <p className="text-base font-medium">Корзина пуста</p>
            <p className="text-sm">Удалённые записи появятся здесь</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Ничего не найдено</div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              {filtered.length} {filtered.length !== items.length ? `из ${items.length} ` : ""}
              {items.length === 1 ? "запись" : items.length < 5 ? "записи" : "записей"} в корзине
            </p>
            {filtered.map((item) => (
              <div key={item.id} className="border rounded-lg bg-card p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name={item.isLead ? "Users" : "User"} size={16} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">
                      {item.fullName || <span className="text-muted-foreground italic">Без имени</span>}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
                      {item.isLead ? "Лид" : "Кандидат"}
                    </Badge>
                    {item.trashedFrom && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
                        из: {SOURCE_LABELS[item.trashedFrom] || item.trashedFrom}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {item.phone && (
                      <span className="text-xs text-muted-foreground font-mono">{item.phone}</span>
                    )}
                    {item.city && (
                      <span className="text-xs text-muted-foreground">{item.city}</span>
                    )}
                    {item.assignedTo && (
                      <span className="text-xs text-muted-foreground">→ {item.assignedTo}</span>
                    )}
                  </div>
                  {item.trashedAt && (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Удалён: {new Date(item.trashedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1"
                    onClick={() => handleRestore(item)}
                    disabled={restoringId === item.id}
                  >
                    {restoringId === item.id
                      ? <Icon name="Loader2" size={12} className="animate-spin" />
                      : <Icon name="RotateCcw" size={12} />
                    }
                    Восстановить
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handlePurge(item)}
                    disabled={purgingId === item.id}
                    title="Удалить навсегда"
                  >
                    {purgingId === item.id
                      ? <Icon name="Loader2" size={12} className="animate-spin" />
                      : <Icon name="X" size={14} />
                    }
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

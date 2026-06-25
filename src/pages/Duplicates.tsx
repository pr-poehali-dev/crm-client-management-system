import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";
import { useUnread } from "@/hooks/useUnread";
import { useBadge } from "@/hooks/useBadge";

const API = (func2url as Record<string, string>)["candidates"];

interface DupRecord {
  id: number;
  fullName: string;
  createdAt: string;
  isLead: boolean;
}

interface DupGroup {
  phone: string;
  count: number;
  keepId: number;
  records: DupRecord[];
}

function apiParse(raw: string) {
  const p = JSON.parse(raw);
  return typeof p === "string" ? JSON.parse(p) : p;
}

export default function Duplicates() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useUnread(token, user?.id);
  useBadge(unreadCount);

  const [groups, setGroups] = useState<DupGroup[]>([]);
  const [totalDuplicates, setTotalDuplicates] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const headers = { "Content-Type": "application/json", "X-Session-Id": token || "" };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "get_duplicates" }),
      });
      const data = apiParse(await res.text());
      if (!res.ok) { setError(data.error || "Ошибка загрузки"); return; }
      setGroups(data.groups || []);
      setTotalDuplicates(data.totalDuplicates || 0);
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

  const handleDeleteAll = async () => {
    if (!confirm(`Удалить ${totalDuplicates} дублей? По каждому номеру останется самая ранняя запись.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "delete_duplicates" }),
      });
      const data = apiParse(await res.text());
      if (!res.ok) { setError(data.error || "Ошибка"); return; }
      setDone(data.deleted);
      setGroups([]);
      setTotalDuplicates(0);
    } catch {
      setError("Сервер не отвечает");
    } finally {
      setDeleting(false);
    }
  };

  const navItems = [
    { path: "/", icon: "UserPlus", label: "Кандидаты" },
    { path: "/leads", icon: "Users", label: "Лиды" },
    { path: "/chat", icon: "MessageSquare", label: "Чат", badge: unreadCount > 0 ? unreadCount : undefined },
    ...(user?.role === "admin" ? [
      { path: "/users", icon: "Settings", label: "Сотрудники" },
      { path: "/duplicates", icon: "Copy", label: "Дубли" },
      { path: "/trash", icon: "Trash2", label: "Корзина" },
    ] : []),
    { path: "/help", icon: "HelpCircle", label: "Помощь" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between gap-2 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <span className="font-semibold text-base">Дубли по телефону</span>
          {totalDuplicates > 0 && (
            <Badge variant="destructive">{totalDuplicates}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalDuplicates > 0 && (
            <Button size="sm" variant="destructive" onClick={handleDeleteAll} disabled={deleting}>
              {deleting ? <Icon name="Loader2" size={14} className="animate-spin mr-1" /> : <Icon name="Trash2" size={14} className="mr-1" />}
              Удалить все дубли
            </Button>
          )}
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
              item.path === "/duplicates"
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

        {done !== null && (
          <div className="mb-4 p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg text-sm flex items-center gap-2">
            <Icon name="CheckCircle" size={16} />
            Удалено {done} дублей. База очищена.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Icon name="Loader2" size={20} className="animate-spin" />
            Поиск дублей...
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Icon name="CheckCircle2" size={40} className="text-green-500" />
            <p className="text-base font-medium">Дублей не найдено</p>
            <p className="text-sm">Все записи с уникальными номерами телефонов</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Найдено <span className="font-semibold text-foreground">{groups.length}</span> номеров с дублями
              ({totalDuplicates} лишних записей). При удалении останется самая ранняя запись по каждому номеру.
            </p>
            {groups.map((group) => (
              <div key={group.phone} className="border rounded-lg overflow-hidden bg-card">
                <div className="px-4 py-2.5 bg-muted/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="Phone" size={14} className="text-muted-foreground" />
                    <span className="font-mono font-medium text-sm">{group.phone}</span>
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{group.count} записи</Badge>
                  </div>
                </div>
                <div className="divide-y">
                  {group.records.map((rec, idx) => (
                    <div
                      key={rec.id}
                      className={`px-4 py-2.5 flex items-center justify-between text-sm ${
                        rec.id === group.keepId ? "bg-green-500/5" : "bg-destructive/5"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon
                          name={rec.id === group.keepId ? "CheckCircle2" : "XCircle"}
                          size={14}
                          className={rec.id === group.keepId ? "text-green-500 shrink-0" : "text-destructive shrink-0"}
                        />
                        <span className="truncate font-medium">{rec.fullName || <span className="text-muted-foreground italic">Без имени</span>}</span>
                        <Badge variant="outline" className="text-[10px] px-1 shrink-0">
                          {rec.isLead ? "Лид" : "Кандидат"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs text-muted-foreground">{rec.createdAt?.slice(0, 10)}</span>
                        {rec.id === group.keepId ? (
                          <span className="text-[10px] text-green-600 font-medium">оставить</span>
                        ) : (
                          <span className="text-[10px] text-destructive font-medium">удалить</span>
                        )}
                        {idx === 0 && <span className="text-[10px] text-muted-foreground">(#{rec.id})</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
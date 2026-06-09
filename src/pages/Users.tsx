import { useState, useEffect } from "react";
import { useUnread } from "@/hooks/useUnread";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

interface User {
  id: number;
  login: string;
  fullName: string;
  role: "admin" | "employee";
  createdAt: string;
  isActive: boolean;
  mangoVerified: boolean;
}

function apiParse(raw: string) {
  const p = JSON.parse(raw);
  return typeof p === "string" ? JSON.parse(p) : p;
}

export default function Users() {
  const { token, user: me } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const { unreadCount } = useUnread(token, me?.id);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [passwordModal, setPasswordModal] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm] = useState({ login: "", password: "", fullName: "", role: "employee" as "admin" | "employee" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = { "Content-Type": "application/json", "X-Session-Id": token || "" };

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(AUTH_URL, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "list_users" }),
        signal: controller.signal,
      });
      const data = apiParse(await res.text());
      setUsers(data.users || []);
    } catch (_e) { setLoadError(true); } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);



  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ action: "create_user", ...form }),
    });
    const data = apiParse(await res.text());
    if (!res.ok) { setError(data.error || "Ошибка"); setSaving(false); return; }
    setIsModalOpen(false);
    setForm({ login: "", password: "", fullName: "", role: "employee" });
    load();
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!passwordModal || !newPassword.trim()) return;
    setSaving(true);
    await fetch(AUTH_URL, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ action: "change_password", id: passwordModal.id, password: newPassword }),
    });
    setPasswordModal(null);
    setNewPassword("");
    setSaving(false);
  };

  const handleToggle = async (u: User) => {
    await fetch(AUTH_URL, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ action: "toggle_user", id: u.id }),
    });
    load();
  };

  const handleToggleMango = async (u: User) => {
    await fetch(AUTH_URL, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ action: "toggle_mango", id: u.id }),
    });
    load();
  };

  const roleBadge = (u: User) => {
    if (!u.isActive) return <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">Заблокирован</span>;
    if (u.role === "admin") return <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Администратор</span>;
    return <span className="text-xs px-2 py-0.5 rounded bg-gray-50 text-gray-600 border border-gray-200">Сотрудник</span>;
  };

  return (
    <div className="min-h-screen bg-[hsl(210,20%,97%)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <header className="text-white px-6 py-4 flex items-center justify-between shadow-lg" style={{ background: "hsl(217, 60%, 18%)" }}>
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-xs">
            <Icon name="ArrowLeft" size={14} />Назад
          </a>
          <div className="w-px h-5 bg-white/20" />
          <div className="font-semibold text-sm">Пользователи системы</div>
        </div>
        <button
          onClick={() => navigate("/chat")}
          className="relative flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors"
          title="Объявления"
        >
          <Icon name="MessageSquare" size={14} />
          <span className="hidden md:inline">Объявления</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </header>

      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-muted-foreground">Управление доступом сотрудников</div>
          <Button onClick={() => { setError(null); setIsModalOpen(true); }} className="h-8 text-sm text-white" style={{ background: "hsl(217,60%,20%)" }}>
            <Icon name="Plus" size={14} />Добавить
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Icon name="Loader2" size={22} className="animate-spin mr-2" />
            <span className="text-sm">Загрузка...</span>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Icon name="WifiOff" size={32} className="text-red-400" />
            <span className="text-sm">Сервер недоступен. Проверьте соединение.</span>
            <button onClick={load} className="text-xs underline hover:text-foreground transition-colors">Повторить</button>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className={`bg-white border rounded-lg px-4 py-3 flex items-center gap-3 ${!u.isActive ? "opacity-60 border-red-200" : "border-border"}`}>
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon name={u.isActive ? "User" : "UserX"} size={15} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{u.fullName || u.login}</div>
                  <div className="text-xs text-muted-foreground">@{u.login}</div>
                </div>
                {roleBadge(u)}
                {u.id === me?.id ? (
                  <span className="text-xs text-muted-foreground italic">Вы</span>
                ) : (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => handleToggleMango(u)}
                      className={`p-1.5 rounded transition-colors ${u.mangoVerified ? "text-green-500 hover:bg-red-50 hover:text-red-600 drop-shadow-[0_0_4px_rgba(34,197,94,0.8)]" : "text-muted-foreground hover:bg-green-50 hover:text-green-600"}`}
                      title={u.mangoVerified ? "Закрыть доступ к номерам" : "Открыть доступ к номерам"}
                    >
                      <Icon name={u.mangoVerified ? "PhoneCall" : "PhoneOff"} size={14} />
                    </button>
                    <button
                      onClick={() => { setPasswordModal(u); setNewPassword(""); }}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Сменить пароль"
                    >
                      <Icon name="KeyRound" size={14} />
                    </button>
                    <button
                      onClick={() => handleToggle(u)}
                      className={`p-1.5 rounded transition-colors ${u.isActive ? "hover:bg-red-50 text-muted-foreground hover:text-red-600" : "hover:bg-green-50 text-muted-foreground hover:text-green-600"}`}
                      title={u.isActive ? "Заблокировать" : "Разблокировать"}
                    >
                      <Icon name={u.isActive ? "Ban" : "CheckCircle"} size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {users.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">Нет пользователей</div>
            )}
          </div>
        )}
      </div>

      {/* Создание пользователя */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Icon name="UserPlus" size={15} />Новый пользователь
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs font-medium">ФИО</Label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Фамилия Имя Отчество" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Логин *</Label>
              <Input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })}
                placeholder="Уникальный логин" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Пароль *</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Пароль" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Роль</Label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "employee" })}
                className="w-full h-8 text-sm border border-input rounded-md px-2 bg-background">
                <option value="employee">Сотрудник</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
            {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="h-8 text-xs">Отмена</Button>
              <Button type="submit" disabled={saving || !form.login.trim() || !form.password.trim()} className="h-8 text-xs text-white" style={{ background: "hsl(217,60%,20%)" }}>
                {saving ? <Icon name="Loader2" size={13} className="animate-spin" /> : "Создать"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Смена пароля сотруднику (админом) */}
      <Dialog open={!!passwordModal} onOpenChange={() => setPasswordModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Icon name="KeyRound" size={15} />Смена пароля — {passwordModal?.fullName || passwordModal?.login}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Новый пароль</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Введите новый пароль" className="h-8 text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPasswordModal(null)} className="h-8 text-xs">Отмена</Button>
              <Button disabled={saving || !newPassword.trim()} onClick={handleChangePassword} className="h-8 text-xs text-white" style={{ background: "hsl(217,60%,20%)" }}>
                {saving ? <Icon name="Loader2" size={13} className="animate-spin" /> : "Сохранить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
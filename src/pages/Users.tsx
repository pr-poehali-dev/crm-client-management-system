import { useState, useEffect } from "react";
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
}

export default function Users() {
  const { token, user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [passwordModal, setPasswordModal] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm] = useState({ login: "", password: "", fullName: "", role: "employee" as "admin" | "employee" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = { "Content-Type": "application/json", "X-Session-Id": token || "" };

  const load = async () => {
    setLoading(true);
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ action: "list_users" }),
    });
    const raw = await res.text();
    const data = typeof JSON.parse(raw) === "string" ? JSON.parse(JSON.parse(raw)) : JSON.parse(raw);
    setUsers(data.users || []);
    setLoading(false);
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
    const raw = await res.text();
    const data = typeof JSON.parse(raw) === "string" ? JSON.parse(JSON.parse(raw)) : JSON.parse(raw);
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

  const roleLabel = (r: string) => r === "admin" ? "Администратор" : "Сотрудник";
  const roleBadge = (r: string) => r === "admin"
    ? <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Администратор</span>
    : <span className="text-xs px-2 py-0.5 rounded bg-gray-50 text-gray-600 border border-gray-200">Сотрудник</span>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="font-semibold text-base">Пользователи системы</div>
          <div className="text-xs text-muted-foreground mt-0.5">Управление доступом</div>
        </div>
        <Button onClick={() => { setError(null); setIsModalOpen(true); }} className="h-8 text-sm text-white" style={{ background: "hsl(217,60%,20%)" }}>
          <Icon name="Plus" size={14} />Добавить
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Icon name="Loader2" size={22} className="animate-spin mr-2" />
          <span className="text-sm">Загрузка...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="bg-white border border-border rounded-lg px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Icon name="User" size={15} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{u.fullName || u.login}</div>
                <div className="text-xs text-muted-foreground">@{u.login}</div>
              </div>
              {roleBadge(u.role)}
              {u.id !== me?.id && (
                <button
                  onClick={() => { setPasswordModal(u); setNewPassword(""); }}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Сменить пароль"
                >
                  <Icon name="KeyRound" size={14} />
                </button>
              )}
              {u.id === me?.id && (
                <span className="text-xs text-muted-foreground italic">Вы</span>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Нет пользователей</div>
          )}
        </div>
      )}

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

      {/* Смена пароля */}
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

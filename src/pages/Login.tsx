import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Icon from "@/components/ui/icon";

export default function Login() {
  const { login } = useAuth();
  const [loginVal, setLoginVal] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = await login(loginVal, password);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(210,20%,97%)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="https://cdn.poehali.dev/projects/9349667d-fe54-44ac-a18d-809d42c7c67e/files/ba8ed286-2fa3-48f9-9a22-0eacab2cada0.jpg" alt="logo" className="w-16 h-16 rounded-xl object-cover mx-auto mb-4 shadow-md" />
          <div className="font-semibold text-lg text-foreground">CRM — Учёт кандидатов</div>
          <div className="text-sm text-muted-foreground mt-1">Войдите в систему</div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl shadow-sm p-6 space-y-4 mb-4">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Логин</Label>
            <Input
              autoFocus
              value={loginVal}
              onChange={(e) => setLoginVal(e.target.value)}
              placeholder="Введите логин"
              className="h-9 text-sm"
              autoComplete="username"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Пароль</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              className="h-9 text-sm"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !loginVal.trim() || !password.trim()}
            className="w-full h-9 text-sm text-white font-medium"
            style={{ background: "hsl(217,60%,20%)" }}
          >
            {loading ? <><Icon name="Loader2" size={14} className="animate-spin" /> Вход...</> : "Войти"}
          </Button>
        </form>
        <div className="bg-white border border-border rounded-xl shadow-sm p-5 space-y-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Установить приложение</div>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-base">🍎</span>
              <div>
                <div className="text-xs font-medium text-foreground mb-1">iPhone (Safari)</div>
                <ol className="text-xs text-muted-foreground space-y-0.5 list-none">
                  <li>1. Откройте сайт в браузере <span className="font-medium">Safari</span></li>
                  <li>2. Нажмите кнопку <span className="font-medium">«Поделиться»</span> <span className="text-[10px]">(квадрат со стрелкой вверх)</span></li>
                  <li>3. Выберите <span className="font-medium">«На экран «Домой»»</span></li>
                  <li>4. Нажмите <span className="font-medium">«Добавить»</span></li>
                </ol>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-base">🤖</span>
              <div>
                <div className="text-xs font-medium text-foreground mb-1">Android (Chrome)</div>
                <ol className="text-xs text-muted-foreground space-y-0.5 list-none">
                  <li>1. Откройте сайт в браузере <span className="font-medium">Chrome</span></li>
                  <li>2. Нажмите <span className="font-medium">«⋮»</span> (три точки) в правом верхнем углу</li>
                  <li>3. Выберите <span className="font-medium">«Добавить на главный экран»</span></li>
                  <li>4. Нажмите <span className="font-medium">«Добавить»</span></li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
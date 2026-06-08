import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import Icon from "@/components/ui/icon";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function MangoVerifyModal({ open, onClose }: Props) {
  const { verifyMango } = useAuth();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const err = await verifyMango(login, password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setLogin("");
        setPassword("");
      }, 1500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Phone" size={18} />
            Подключить Манго Офис
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6 text-green-600">
            <Icon name="CheckCircle" size={40} />
            <p className="font-medium text-center">Верификация прошла успешно!<br />Теперь вам доступны номера телефонов.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Введите логин и пароль от вашей учётной записи в Манго Офис, чтобы получить доступ к номерам телефонов лидов.
            </p>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Логин Манго Офис</label>
              <Input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Ваш логин"
                autoComplete="username"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Пароль Манго Офис</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ваш пароль"
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 flex items-center gap-2">
                <Icon name="AlertCircle" size={14} />
                {error}
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Проверяем..." : "Подключить"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

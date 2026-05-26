import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import func2url from "../../backend/func2url.json";

const API = (func2url as Record<string, string>)["candidates"];

interface Lead {
  id: number;
  fullName: string;
  phone: string;
  city: string;
  citizenship: string;
  notes: string;
  createdAt: string;
}

interface ApiLead {
  id: string;
  full_name: string;
  phone: string;
  city: string;
  citizenship: string;
  notes: string;
  created_at: string;
}

function fromApi(r: ApiLead): Lead {
  return {
    id: Number(r.id),
    fullName: r.full_name || "",
    phone: r.phone || "",
    city: r.city || "",
    citizenship: r.citizenship || "",
    notes: r.notes || "",
    createdAt: r.created_at || "",
  };
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground font-medium mb-0.5">{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

export default function Leads() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [convertingId, setConvertingId] = useState<number | null>(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}?mode=leads`, {
        headers: token ? { "X-Session-Id": token } : {},
      });
      const raw = await res.text();
      const data: ApiLead[] = JSON.parse(raw);
      setLeads(data.map(fromApi));
    } catch (e) {
      console.error("Load leads error", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const filtered = leads.filter((l) =>
    [l.fullName, l.phone, l.city].some((v) =>
      v.toLowerCase().includes(search.toLowerCase())
    )
  );

  const handleConvert = async (id: number) => {
    setConvertingId(id);
    try {
      await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
        body: JSON.stringify({ action: "convert_lead", id }),
      });
      setLeads((prev) => prev.filter((l) => l.id !== id));
      if (detailId === id) setDetailId(null);
    } finally {
      setConvertingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
      body: JSON.stringify({ action: "delete", id }),
    });
    setLeads((prev) => prev.filter((l) => l.id !== id));
    if (detailId === id) setDetailId(null);
  };

  const detail = detailId !== null ? leads.find((l) => l.id === detailId) : null;

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(210,20%,97%)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Header */}
      <header className="text-white px-6 py-4 flex items-center justify-between shadow-lg" style={{ background: "hsl(217, 60%, 18%)" }}>
        <div className="flex items-center gap-3">
          <img src="https://cdn.poehali.dev/projects/9349667d-fe54-44ac-a18d-809d42c7c67e/files/ba8ed286-2fa3-48f9-9a22-0eacab2cada0.jpg" alt="logo" className="w-9 h-9 rounded object-cover border border-white/20" />
          <div>
            <div className="font-semibold text-base tracking-wide leading-tight">CRM — Лиды с сайта</div>
            <div className="text-white/50 text-xs font-light">Входящие заявки</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs font-mono hidden md:block mr-2">Лидов: {leads.length}</span>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors"
            title="Кандидаты"
          >
            <Icon name="Users" size={14} />
            <span className="hidden md:inline">Кандидаты</span>
          </button>
          {isAdmin && (
            <button onClick={() => navigate("/users")} className="flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors" title="Пользователи">
              <Icon name="UserCog" size={14} />
              <span className="hidden md:inline">Пользователи</span>
            </button>
          )}
          <button onClick={async () => { await logout(); navigate("/login"); }} className="flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors" title="Выйти">
            <Icon name="LogOut" size={14} />
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="bg-white border-b border-border px-6 py-3 flex items-center gap-4">
        <div className="relative flex-1 max-w-xs">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input placeholder="Поиск по ФИО, телефону, городу..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <span className="text-xs text-muted-foreground">
          Показано: <b className="text-foreground">{filtered.length}</b> из {leads.length}
        </span>
        <button onClick={loadLeads} className="ml-auto p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors" title="Обновить">
          <Icon name={loading ? "Loader2" : "RefreshCw"} size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Icon name="Loader2" size={28} className="animate-spin mr-3" />
            <span className="text-sm">Загрузка лидов...</span>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse" style={{ minWidth: "700px" }}>
            <thead>
              <tr style={{ background: "hsl(217, 60%, 22%)" }}>
                {["№", "ФИО", "Телефон", "Город", "Гражданство", "Примечание", "Дата", ""].map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 font-medium text-xs tracking-wide text-white/80 border-b border-white/10 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-20 text-muted-foreground">
                    <Icon name="Inbox" size={36} className="mx-auto mb-3 opacity-25" />
                    <div className="text-sm">Нет лидов. Они появятся здесь после заявок с сайта.</div>
                  </td>
                </tr>
              )}
              {filtered.map((l, idx) => (
                <tr key={l.id} className="border-b border-border hover:bg-amber-50/40 transition-colors group animate-fade-in bg-white">
                  <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                  <td className="px-3 py-2 font-semibold whitespace-nowrap max-w-[160px] truncate">{l.fullName || <span className="text-muted-foreground italic">Без имени</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono">{l.phone || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{l.city || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{l.citizenship || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 max-w-[200px]">
                    <div className="truncate text-muted-foreground">{l.notes || "—"}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">{l.createdAt}</td>
                  <td className="px-3 py-2 sticky right-0 bg-white group-hover:bg-amber-50/40">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setDetailId(l.id)} className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors" title="Подробнее">
                        <Icon name="Eye" size={13} />
                      </button>
                      <button
                        onClick={() => handleConvert(l.id)}
                        disabled={convertingId === l.id}
                        className="p-1 rounded hover:bg-green-100 text-green-700 transition-colors disabled:opacity-50"
                        title="Перевести в кандидаты"
                      >
                        <Icon name={convertingId === l.id ? "Loader2" : "UserCheck"} size={13} className={convertingId === l.id ? "animate-spin" : ""} />
                      </button>
                      {isAdmin && (
                        <button onClick={() => handleDelete(l.id)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" title="Удалить">
                          <Icon name="Trash2" size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={detailId !== null} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="max-w-md">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  <Icon name="UserCircle" size={16} />{detail.fullName || "Лид без имени"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="ФИО" value={detail.fullName} />
                  <InfoRow label="Телефон" value={detail.phone} />
                  <InfoRow label="Город" value={detail.city} />
                  <InfoRow label="Гражданство" value={detail.citizenship} />
                  <InfoRow label="Дата заявки" value={detail.createdAt} />
                </div>
                {detail.notes && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Примечание</div>
                    <div className="bg-muted/50 rounded p-3 text-sm leading-relaxed whitespace-pre-line">{detail.notes}</div>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-border gap-2">
                  <Button
                    onClick={() => handleConvert(detail.id)}
                    disabled={convertingId === detail.id}
                    className="h-8 text-sm text-white flex-1"
                    style={{ background: "hsl(142,60%,35%)" }}
                  >
                    {convertingId === detail.id
                      ? <><Icon name="Loader2" size={13} className="animate-spin" /> Перевод...</>
                      : <><Icon name="UserCheck" size={13} /> Перевести в кандидаты</>}
                  </Button>
                  {isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => handleDelete(detail.id)} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                      <Icon name="Trash2" size={13} />
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import func2url from "../../backend/func2url.json";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const API = (func2url as Record<string, string>)["candidates"];

const CALL_RESULTS = [
  { value: "Недозвон", label: "Недозвон", color: { color: "#fff", background: "#ca8a04", borderColor: "#a16207", fontWeight: "700" } },
  { value: "Занято", label: "Занято", color: { color: "#fff", background: "#2563eb", borderColor: "#1d4ed8", fontWeight: "700" } },
  { value: "Отказ", label: "Отказ", color: { color: "#fff", background: "#dc2626", borderColor: "#b91c1c", fontWeight: "700" } },
  { value: "Заинтересован", label: "Заинтересован", color: { color: "#fff", background: "#16a34a", borderColor: "#15803d", fontWeight: "700" } },
  { value: "Перезвонит", label: "Перезвонит", color: { color: "#fff", background: "#16a34a", borderColor: "#15803d", fontWeight: "700" } },
  { value: "Дубль", label: "Дубль", color: { color: "#fff", background: "#dc2626", borderColor: "#b91c1c", fontWeight: "700" } },
];

interface MyLead {
  id: string;
  fullName: string;
  phone: string;
  city: string;
  citizenship: string;
  notes: string;
  createdAt: string;
  callResult: string;
  callComment: string;
  assignedTo: string;
}

function CallResultBadge({ result }: { result: string }) {
  const r = CALL_RESULTS.find((x) => x.value === result);
  if (!result || !r) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded border" style={r.color}>
      {r.label}
    </span>
  );
}

export default function MyLeads() {
  const { user } = useAuth();
  const [nameInput, setNameInput] = useState("");
  const [activeName, setActiveName] = useState("");
  const [leads, setLeads] = useState<MyLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedLead, setSelectedLead] = useState<MyLead | null>(null);

  const handleLoad = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}?mode=my_leads&name=${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error("Ошибка загрузки");
      const data = await res.json();
      setLeads(data);
      setActiveName(trimmed);
    } catch {
      setError("Не удалось загрузить данные. Проверьте соединение.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(210,20%,97%)] flex flex-col" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Header */}
      <header className="text-white px-6 py-4 flex items-center gap-3 shadow-lg" style={{ background: "hsl(217, 60%, 18%)" }}>
        <Icon name="UserCheck" size={20} className="text-white/70" />
        <span className="font-semibold text-base tracking-wide">Мои лиды</span>
      </header>

      <div className="flex-1 flex flex-col items-center px-4 py-10 gap-6">
        {/* Ввод имени */}
        <div className="bg-white rounded-xl shadow border border-border p-6 w-full max-w-md flex flex-col gap-4">
          <div className="text-sm font-semibold text-foreground">Введите ваше ФИО</div>
          <div className="text-xs text-muted-foreground">Система покажет лиды, закреплённые за вами после звонков.</div>
          <div className="flex gap-2">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLoad(nameInput); }}
              placeholder="Иванов Иван Иванович"
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            <button
              onClick={() => handleLoad(nameInput)}
              disabled={loading || !nameInput.trim()}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              {loading ? "..." : "Найти"}
            </button>
          </div>
          {error && <div className="text-xs text-red-500 flex items-center gap-1"><Icon name="AlertCircle" size={12} />{error}</div>}
        </div>

        {/* Результаты */}
        {activeName && !loading && (
          <div className="w-full max-w-3xl flex flex-col gap-3">
            <div className="text-sm text-muted-foreground px-1">
              Лиды сотрудника: <span className="font-semibold text-foreground">{activeName}</span>
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{leads.length}</span>
            </div>

            {leads.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                <Icon name="PhoneMissed" size={32} className="opacity-30" />
                <span>Нет закреплённых лидов</span>
                <span className="text-xs">Лиды появятся здесь после того, как вы укажете своё ФИО при результате звонка</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {leads.map((lead) => (
                  <div key={lead.id} onClick={() => setSelectedLead(lead)} className="bg-white rounded-xl border border-border p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <div className="font-semibold text-sm text-foreground">{lead.fullName || "Без имени"}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {lead.phone && (
                            (user?.mangoVerified || user?.role === "admin") ? (
                              <span className="flex items-center gap-1 text-blue-600">
                                <Icon name="Phone" size={11} />
                                {lead.phone}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Icon name="Lock" size={11} />
                                Скрыт
                              </span>
                            )
                          )}
                          {lead.city && (
                            <span className="flex items-center gap-1">
                              <Icon name="MapPin" size={11} />
                              {lead.city}
                            </span>
                          )}
                          {lead.citizenship && (
                            <span className="flex items-center gap-1">
                              <Icon name="Globe" size={11} />
                              {lead.citizenship}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <CallResultBadge result={lead.callResult} />
                      </div>
                    </div>
                    {lead.callComment && (
                      <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border border-border">
                        {lead.callComment}
                      </div>
                    )}
                    {lead.notes && (
                      <div className="text-xs text-muted-foreground italic">{lead.notes}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground/60">
                      {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("ru-RU") : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Карточка лида */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {selectedLead && (() => {
            const rawPhone = selectedLead.phone?.replace(/\D/g, "");
            const greeting = encodeURIComponent("Здравствуйте! Вам пишут по поводу трудоустройства.");
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base font-semibold flex items-center gap-2">
                    <Icon name="UserCircle" size={16} />
                    {selectedLead.fullName || "Лид без имени"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-1">
                  {(user?.mangoVerified || user?.role === "admin") && selectedLead.phone && (
                    <div className="bg-muted/40 rounded-lg p-3 space-y-3">
                      <div>
                        <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
                          <Icon name="Phone" size={13} /> Позвонить
                        </div>
                        <a href={`tel:${selectedLead.phone}`}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                          style={{ background: "hsl(220,80%,45%)" }}>
                          <Icon name="Phone" size={15} />
                          {selectedLead.phone}
                        </a>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
                          <Icon name="MessageCircle" size={13} /> Написать в мессенджер
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a href={`https://wa.me/${rawPhone}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                            style={{ background: "#25D366" }}>WhatsApp</a>
                          <a href={`https://wa.me/${rawPhone}?text=${greeting}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
                            style={{ color: "#25D366", borderColor: "#25D366" }}>WA + текст</a>
                          <a href={`https://t.me/+${rawPhone}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                            style={{ background: "#2AABEE" }}>Telegram</a>
                          <a href={`https://max.ru/call/${rawPhone}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                            style={{ background: "#005FF9" }}>MAX</a>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2 text-sm">
                    {selectedLead.city && <div className="flex gap-2"><span className="text-muted-foreground text-xs w-24 shrink-0">Город</span><span className="text-xs">{selectedLead.city}</span></div>}
                    {selectedLead.citizenship && <div className="flex gap-2"><span className="text-muted-foreground text-xs w-24 shrink-0">Гражданство</span><span className="text-xs">{selectedLead.citizenship}</span></div>}
                    {selectedLead.callResult && <div className="flex gap-2 items-center"><span className="text-muted-foreground text-xs w-24 shrink-0">Результат</span><CallResultBadge result={selectedLead.callResult} /></div>}
                    {selectedLead.callComment && <div className="flex gap-2"><span className="text-muted-foreground text-xs w-24 shrink-0">Комментарий</span><span className="text-xs">{selectedLead.callComment}</span></div>}
                    {selectedLead.notes && <div className="flex gap-2"><span className="text-muted-foreground text-xs w-24 shrink-0">Заметки</span><span className="text-xs">{selectedLead.notes}</span></div>}
                    {selectedLead.createdAt && <div className="flex gap-2"><span className="text-muted-foreground text-xs w-24 shrink-0">Дата</span><span className="text-xs">{new Date(selectedLead.createdAt).toLocaleDateString("ru-RU")}</span></div>}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
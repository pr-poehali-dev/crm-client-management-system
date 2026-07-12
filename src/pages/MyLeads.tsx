import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import func2url from "../../backend/func2url.json";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";

const WA_SVG = <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.849L0 24l6.335-1.502A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.807 9.807 0 01-5.032-1.388l-.361-.214-3.741.887.936-3.634-.235-.374A9.786 9.786 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>;
const TG_SVG = <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.16 13.28l-2.963-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.991.279z"/></svg>;

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

const EMPTY_FORM = { fullName: "", phone: "", city: "", citizenship: "", birthDate: "", criminalRecord: "", chronicDiseases: "", notes: "" };

export default function MyLeads() {
  const { user, token } = useAuth();
  const [nameInput, setNameInput] = useState("");
  const [activeName, setActiveName] = useState("");
  const [leads, setLeads] = useState<MyLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedLead, setSelectedLead] = useState<MyLead | null>(null);
  const [leadForm, setLeadForm] = useState(EMPTY_FORM);
  const [leadSaving, setLeadSaving] = useState(false);
  const [converting, setConverting] = useState(false);

  const handleSetCallResult = async (id: string, result: string) => {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, callResult: result, called: result !== "" } : l));
    setSelectedLead((prev) => prev ? { ...prev, callResult: result } : null);
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
      body: JSON.stringify({ action: "set_call_result", id, result, comment: "" }),
    });
  };

  const handleConvert = async (id: string) => {
    setConverting(true);
    try {
      await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
        body: JSON.stringify({ action: "convert_lead", id }),
      });
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setSelectedLead(null);
    } finally {
      setConverting(false);
    }
  };

  useEffect(() => {
    if (selectedLead) {
      setLeadForm({
        fullName: selectedLead.fullName || "",
        phone: selectedLead.phone || "",
        city: selectedLead.city || "",
        citizenship: selectedLead.citizenship || "",
        birthDate: "",
        criminalRecord: "",
        chronicDiseases: "",
        notes: selectedLead.notes || "",
      });
    }
  }, [selectedLead?.id]);

  const handleSaveLead = async () => {
    if (!selectedLead) return;
    setLeadSaving(true);
    try {
      await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
        body: JSON.stringify({
          action: "update",
          id: selectedLead.id,
          ...leadForm,
          docPhotos: [], relationPhotos: [], tickets: [], contractPhotos: [],
          hasInn: false, hasSnils: false,
          employeeName: selectedLead.assignedTo || "",
          company: "",
        }),
      });
      setLeads((prev) => prev.map((l) => l.id === selectedLead.id ? { ...l, ...leadForm } : l));
      setSelectedLead((prev) => prev ? { ...prev, ...leadForm } : null);
    } finally {
      setLeadSaving(false);
    }
  };

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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
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
                <div className="space-y-5 pt-2">
                  {/* Связь */}
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
                        <div className="text-[10px] text-muted-foreground mt-1">Звонок через Mango Office</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
                          <Icon name="MessageCircle" size={13} /> Написать в мессенджер
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a href={`https://wa.me/${rawPhone}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                            style={{ background: "#25D366" }}>{WA_SVG} WhatsApp</a>
                          <a href={`https://wa.me/${rawPhone}?text=${greeting}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
                            style={{ color: "#25D366", borderColor: "#25D366" }}>{WA_SVG} + текст</a>
                          <a href={`https://t.me/+${rawPhone}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                            style={{ background: "#2AABEE" }}>{TG_SVG} Telegram</a>
                          <a href={`https://t.me/+${rawPhone}?text=${greeting}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
                            style={{ color: "#2AABEE", borderColor: "#2AABEE" }}>{TG_SVG} + текст</a>
                          <a href={`https://max.ru/call/${rawPhone}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                            style={{ background: "#005FF9" }}><Icon name="MessageCircle" size={13} /> MAX</a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Форма редактирования */}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Icon name="Pencil" size={13} /> Данные лида
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 space-y-1">
                        <div className="text-xs text-muted-foreground font-medium">ФИО</div>
                        <Input value={leadForm.fullName} onChange={(e) => setLeadForm({ ...leadForm, fullName: e.target.value })} placeholder="Фамилия Имя Отчество" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground font-medium">Телефон</div>
                        <Input value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} placeholder="+7..." className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground font-medium">Дата рождения</div>
                        <DateInput value={leadForm.birthDate} onChange={(v) => setLeadForm({ ...leadForm, birthDate: v })} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground font-medium">Город</div>
                        <Input value={leadForm.city} onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })} placeholder="Город" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground font-medium">Гражданство</div>
                        <Input value={leadForm.citizenship} onChange={(e) => setLeadForm({ ...leadForm, citizenship: e.target.value })} placeholder="РФ / другое" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground font-medium">Судимость</div>
                        <Input value={leadForm.criminalRecord} onChange={(e) => setLeadForm({ ...leadForm, criminalRecord: e.target.value })} placeholder="Нет / есть" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground font-medium">Хр. болезни</div>
                        <Input value={leadForm.chronicDiseases} onChange={(e) => setLeadForm({ ...leadForm, chronicDiseases: e.target.value })} placeholder="Нет / есть" className="h-8 text-sm" />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <div className="text-xs text-muted-foreground font-medium">Заметки</div>
                        <textarea
                          value={leadForm.notes}
                          onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                          placeholder="Заметки..."
                          rows={3}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end mt-3">
                      <Button size="sm" onClick={handleSaveLead} disabled={leadSaving} className="h-8 text-xs">
                        {leadSaving ? <><Icon name="Loader2" size={13} className="animate-spin mr-1" />Сохранение...</> : <><Icon name="Save" size={13} className="mr-1" />Сохранить</>}
                      </Button>
                    </div>
                  </div>

                  {/* Результат звонка */}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Icon name="Phone" size={13} /> Результат звонка
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {CALL_RESULTS.map((r) => (
                        <button
                          key={r.value}
                          onClick={() => handleSetCallResult(selectedLead.id, r.value)}
                          className="text-[11px] font-medium px-2 py-1 rounded border transition-all"
                          style={selectedLead.callResult === r.value
                            ? { ...r.color, outline: "2px solid " + r.color.borderColor, outlineOffset: "1px" }
                            : { color: "#888", borderColor: "#e2e8f0", background: "white" }
                          }
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Перевести в кандидаты */}
                  <div className="flex pt-2 border-t border-border">
                    <Button
                      onClick={() => handleConvert(selectedLead.id)}
                      disabled={converting}
                      className="h-8 text-sm text-white flex-1"
                      style={{ background: "hsl(142,60%,35%)" }}
                    >
                      {converting
                        ? <><Icon name="Loader2" size={13} className="animate-spin mr-1" /> Перевод...</>
                        : <><Icon name="UserCheck" size={13} className="mr-1" /> Перевести в кандидаты</>}
                    </Button>
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
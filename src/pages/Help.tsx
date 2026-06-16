import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import { useBadge } from "@/hooks/useBadge";
import { useUnread } from "@/hooks/useUnread";
import func2url from "../../backend/func2url.json";

const API = (func2url as Record<string, string>)["candidates"];

interface HelpItem {
  label: string;
  desc: string;
}

interface ColorLegendEntry {
  id?: number;
  sortOrder?: number;
  color: string;
  label: string;
  description: string;
}

interface HelpSection {
  id: number;
  sortOrder: number;
  icon: string;
  title: string;
  items: HelpItem[];
  sectionType: "list" | "colors";
  colorLegend: ColorLegendEntry[];
}

export default function Help() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { unreadCount } = useUnread(token, user?.id);
  useBadge(unreadCount);

  const isAdmin = user?.role === "admin";

  const [sections, setSections] = useState<HelpSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, HelpSection>>({});

  const loadHelp = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}?mode=help`);
      const data: HelpSection[] = await res.json();
      setSections(data);
      const d: Record<number, HelpSection> = {};
      data.forEach((s) => { d[s.id] = JSON.parse(JSON.stringify(s)); });
      setDraft(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHelp(); }, [loadHelp]);

  const handleSaveSection = async (id: number) => {
    const s = draft[id];
    if (!s) return;
    setSaving(id);
    try {
      await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
        body: JSON.stringify({ action: "help_save", id, title: s.title, icon: s.icon, items: s.sectionType === "colors" ? [] : s.items }),
      });
      if (s.sectionType === "colors") {
        await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
          body: JSON.stringify({ action: "help_save_legend", sectionId: id, entries: s.colorLegend }),
        });
      }
      setSections((prev) => prev.map((sec) => sec.id === id ? { ...sec, ...s } : sec));
    } finally {
      setSaving(null);
    }
  };

  const handleAddSection = async (sectionType: "list" | "colors") => {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
      body: JSON.stringify({ action: "help_add_section", title: sectionType === "colors" ? "Цветовые пометки" : "Новый раздел", icon: sectionType === "colors" ? "Palette" : "Info", sectionType }),
    });
    const sec: HelpSection = await res.json();
    setSections((prev) => [...prev, sec]);
    setDraft((prev) => ({ ...prev, [sec.id]: JSON.parse(JSON.stringify(sec)) }));
  };

  const handleDeleteSection = async (id: number) => {
    if (!confirm("Удалить этот раздел?")) return;
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
      body: JSON.stringify({ action: "help_delete_section", id }),
    });
    setSections((prev) => prev.filter((s) => s.id !== id));
    setDraft((prev) => { const d = { ...prev }; delete d[id]; return d; });
  };

  const updateDraftSection = (id: number, field: keyof HelpSection, value: string) => {
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const updateDraftItem = (sectionId: number, itemIdx: number, field: keyof HelpItem, value: string) => {
    setDraft((prev) => {
      const sec = { ...prev[sectionId] };
      const items = [...sec.items];
      items[itemIdx] = { ...items[itemIdx], [field]: value };
      return { ...prev, [sectionId]: { ...sec, items } };
    });
  };

  const addItem = (sectionId: number) => {
    setDraft((prev) => {
      const sec = { ...prev[sectionId] };
      return { ...prev, [sectionId]: { ...sec, items: [...sec.items, { label: "", desc: "" }] } };
    });
  };

  const deleteItem = (sectionId: number, itemIdx: number) => {
    setDraft((prev) => {
      const sec = { ...prev[sectionId] };
      const items = sec.items.filter((_, i) => i !== itemIdx);
      return { ...prev, [sectionId]: { ...sec, items } };
    });
  };

  const updateLegendEntry = (sectionId: number, entryIdx: number, field: keyof ColorLegendEntry, value: string) => {
    setDraft((prev) => {
      const sec = { ...prev[sectionId] };
      const colorLegend = [...sec.colorLegend];
      colorLegend[entryIdx] = { ...colorLegend[entryIdx], [field]: value };
      return { ...prev, [sectionId]: { ...sec, colorLegend } };
    });
  };

  const addLegendEntry = (sectionId: number) => {
    setDraft((prev) => {
      const sec = { ...prev[sectionId] };
      return { ...prev, [sectionId]: { ...sec, colorLegend: [...sec.colorLegend, { color: "#3b82f6", label: "", description: "" }] } };
    });
  };

  const deleteLegendEntry = (sectionId: number, entryIdx: number) => {
    setDraft((prev) => {
      const sec = { ...prev[sectionId] };
      const colorLegend = sec.colorLegend.filter((_, i) => i !== entryIdx);
      return { ...prev, [sectionId]: { ...sec, colorLegend } };
    });
  };

  return (
    <div className="min-h-screen bg-[hsl(210,20%,97%)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <header className="text-white px-6 py-4 flex items-center justify-between shadow-lg" style={{ background: "hsl(217, 60%, 18%)" }}>
        <div className="flex items-center gap-3">
          <img src="https://cdn.poehali.dev/projects/9349667d-fe54-44ac-a18d-809d42c7c67e/files/ba8ed286-2fa3-48f9-9a22-0eacab2cada0.jpg" alt="logo" className="w-9 h-9 rounded object-cover border border-white/20" />
          <div>
            <div className="font-semibold text-base tracking-wide leading-tight">Инструкция по работе</div>
            <div className="text-white/50 text-xs font-light">CRM — Учёт кандидатов</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/chat")} className="relative flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors" title="Объявления">
            <Icon name="MessageSquare" size={14} />
            <span className="hidden md:inline">Объявления</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          {isAdmin && (
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded transition-colors ${editMode ? "bg-amber-400 text-black font-semibold" : "text-white/70 hover:text-white hover:bg-white/10"}`}
            >
              <Icon name={editMode ? "X" : "Pencil"} size={14} />
              <span className="hidden md:inline">{editMode ? "Завершить" : "Редактировать"}</span>
            </button>
          )}
          <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm px-3 py-1.5 rounded hover:bg-white/10 transition-colors">
            <Icon name="ArrowLeft" size={15} />
            Назад
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div className="text-center space-y-2 mb-10">
          <h1 className="text-2xl font-bold text-[hsl(217,60%,18%)]">Как пользоваться CRM</h1>
          <p className="text-muted-foreground text-sm">
            {editMode ? "Режим редактирования — изменяйте текст и сохраняйте каждый раздел" : "Здесь собраны ответы на основные вопросы по работе с системой"}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Icon name="Loader2" size={20} className="animate-spin" />
            <span className="text-sm">Загрузка...</span>
          </div>
        ) : (
          <>
            {sections.map((section) => {
              const sec = editMode ? (draft[section.id] || section) : section;
              return (
                <div key={section.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                  {/* Шапка раздела */}
                  <div className="flex items-center gap-3 px-6 py-4 border-b border-border" style={{ background: "hsl(217, 60%, 22%)" }}>
                    {editMode ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          value={sec.icon}
                          onChange={(e) => updateDraftSection(section.id, "icon", e.target.value)}
                          className="w-24 text-xs bg-white/10 border border-white/20 rounded px-2 py-1 text-white placeholder:text-white/40 focus:outline-none"
                          placeholder="Иконка"
                          title="Название иконки из lucide-react"
                        />
                        <input
                          value={sec.title}
                          onChange={(e) => updateDraftSection(section.id, "title", e.target.value)}
                          className="flex-1 text-sm font-semibold bg-white/10 border border-white/20 rounded px-2 py-1 text-white placeholder:text-white/40 focus:outline-none"
                          placeholder="Название раздела"
                        />
                      </div>
                    ) : (
                      <>
                        <Icon name={sec.icon} size={18} className="text-white/80" />
                        <h2 className="text-white font-semibold text-sm">{sec.title}</h2>
                      </>
                    )}
                    {editMode && (
                      <div className="flex items-center gap-1 ml-auto shrink-0">
                        <button
                          onClick={() => handleSaveSection(section.id)}
                          disabled={saving === section.id}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-green-500 hover:bg-green-400 text-white transition-colors disabled:opacity-50"
                        >
                          {saving === section.id ? <Icon name="Loader2" size={11} className="animate-spin" /> : <Icon name="Check" size={11} />}
                          Сохранить
                        </button>
                        <button onClick={() => handleDeleteSection(section.id)} className="p-1 rounded hover:bg-red-500/30 text-white/50 hover:text-white transition-colors" title="Удалить раздел">
                          <Icon name="Trash2" size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Блок цветовой легенды */}
                  {sec.sectionType === "colors" && (
                    <div className="divide-y divide-border">
                      {sec.colorLegend.map((entry, idx) => (
                        <div key={idx} className="px-6 py-4" style={{ borderLeft: `4px solid ${entry.color}`, background: entry.color + "18" }}>
                          {editMode ? (
                            <div className="flex gap-3 items-start">
                              <input
                                type="color"
                                value={entry.color}
                                onChange={(e) => updateLegendEntry(section.id, idx, "color", e.target.value)}
                                className="w-9 h-9 rounded cursor-pointer border border-border p-0.5 shrink-0 mt-0.5"
                                title="Выбрать цвет"
                              />
                              <div className="flex-1 space-y-2">
                                <input
                                  value={entry.label}
                                  onChange={(e) => updateLegendEntry(section.id, idx, "label", e.target.value)}
                                  className="w-full text-sm font-semibold border border-border rounded px-2 py-1 focus:outline-none focus:border-blue-400"
                                  placeholder="Название (напр. Зелёный — контракт загружен)"
                                />
                                <textarea
                                  value={entry.description}
                                  onChange={(e) => updateLegendEntry(section.id, idx, "description", e.target.value)}
                                  rows={2}
                                  className="w-full text-sm text-muted-foreground border border-border rounded px-2 py-1 focus:outline-none focus:border-blue-400 resize-none"
                                  placeholder="Описание — что означает этот цвет"
                                />
                              </div>
                              <button onClick={() => deleteLegendEntry(section.id, idx)} className="mt-1 p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors shrink-0" title="Удалить">
                                <Icon name="X" size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              <div className="w-5 h-5 rounded-full shrink-0 mt-0.5 border-2 border-white shadow-sm" style={{ background: entry.color }} />
                              <div>
                                <div className="font-semibold text-sm text-foreground mb-0.5">{entry.label}</div>
                                {entry.description && <div className="text-sm text-muted-foreground leading-relaxed">{entry.description}</div>}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {editMode && (
                        <div className="px-6 py-3">
                          <button onClick={() => addLegendEntry(section.id)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                            <Icon name="Plus" size={13} />
                            Добавить цвет
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Обычный текстовый раздел */}
                  {sec.sectionType !== "colors" && (
                    <div className="divide-y divide-border">
                      {sec.items.map((item, idx) => (
                        <div key={idx} className="px-6 py-4">
                          {editMode ? (
                            <div className="flex gap-2 items-start">
                              <div className="flex-1 space-y-2">
                                <input
                                  value={item.label}
                                  onChange={(e) => updateDraftItem(section.id, idx, "label", e.target.value)}
                                  className="w-full text-sm font-semibold border border-border rounded px-2 py-1 focus:outline-none focus:border-blue-400"
                                  placeholder="Заголовок пункта"
                                />
                                <textarea
                                  value={item.desc}
                                  onChange={(e) => updateDraftItem(section.id, idx, "desc", e.target.value)}
                                  rows={3}
                                  className="w-full text-sm text-muted-foreground border border-border rounded px-2 py-1 focus:outline-none focus:border-blue-400 resize-y"
                                  placeholder="Описание пункта"
                                />
                              </div>
                              <button onClick={() => deleteItem(section.id, idx)} className="mt-1 p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors shrink-0" title="Удалить пункт">
                                <Icon name="X" size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 w-5 h-5 rounded-full bg-[hsl(217,60%,22%)] flex items-center justify-center shrink-0">
                                <Icon name="ChevronRight" size={11} className="text-white" />
                              </div>
                              <div>
                                <div className="font-semibold text-sm text-foreground mb-1">{item.label}</div>
                                <div className="text-sm text-muted-foreground leading-relaxed">{item.desc}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {editMode && (
                        <div className="px-6 py-3">
                          <button onClick={() => addItem(section.id)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                            <Icon name="Plus" size={13} />
                            Добавить пункт
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {editMode && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleAddSection("list")}
                  className="flex-1 py-3 rounded-xl border-2 border-dashed border-border hover:border-blue-400 text-muted-foreground hover:text-blue-600 text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Icon name="Plus" size={16} />
                  Текстовый раздел
                </button>
                <button
                  onClick={() => handleAddSection("colors")}
                  className="flex-1 py-3 rounded-xl border-2 border-dashed border-border hover:border-purple-400 text-muted-foreground hover:text-purple-600 text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Icon name="Palette" size={16} />
                  Раздел с цветами
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

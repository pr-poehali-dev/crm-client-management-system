import { useState, useEffect, useCallback } from "react";
import { useUnread } from "@/hooks/useUnread";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import func2url from "../../backend/func2url.json";
import * as XLSX from "xlsx";
import { useBadge } from "@/hooks/useBadge";


const API = (func2url as Record<string, string>)["candidates"];

const CALL_RESULTS = [
  { value: "Недозвон", label: "Недозвон", color: { color: "#fff", background: "#ca8a04", borderColor: "#a16207", fontWeight: "700" } },
  { value: "Занято", label: "Занято", color: { color: "#fff", background: "#2563eb", borderColor: "#1d4ed8", fontWeight: "700" } },
  { value: "Отказ", label: "Отказ", color: { color: "#fff", background: "#dc2626", borderColor: "#b91c1c", fontWeight: "700" } },
  { value: "Заинтересован", label: "Заинтересован", color: { color: "#fff", background: "#16a34a", borderColor: "#15803d", fontWeight: "700" } },
  { value: "Перезвонит", label: "Перезвонит", color: { color: "#fff", background: "#16a34a", borderColor: "#15803d", fontWeight: "700" } },
  { value: "Дубль", label: "Дубль", color: { color: "#fff", background: "#dc2626", borderColor: "#b91c1c", fontWeight: "700" } },
];

interface Lead {
  id: number;
  fullName: string;
  phone: string;
  city: string;
  citizenship: string;
  notes: string;
  createdAt: string;
  called: boolean;
  callResult: string;
  callComment: string;
  assignedTo: string;
  colorMark: string;
}

interface CallLogEntry {
  id: number;
  userName: string;
  calledAt: string;
  result: string;
  comment: string;
}

interface ApiLead {
  id: string;
  full_name: string;
  phone: string;
  city: string;
  citizenship: string;
  notes: string;
  created_at: string;
  called: boolean;
  call_result: string;
  call_comment: string;
  assigned_to: string;
  color_mark: string;
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
    called: r.called || false,
    callResult: r.call_result || "",
    callComment: r.call_comment || "",
    assignedTo: r.assigned_to || "",
    colorMark: r.color_mark || "",
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

function CallResultBadge({ result }: { result: string }) {
  const r = CALL_RESULTS.find((x) => x.value === result);
  if (!result || !r) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border" style={r.color}>
      {r.label}
    </span>
  );
}

export default function Leads() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [showUncalled, setShowUncalled] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [convertingId, setConvertingId] = useState<number | null>(null);
  const [commentEditId, setCommentEditId] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [assignPopup, setAssignPopup] = useState<{ id: number; result: string } | null>(null);
  const [assignName, setAssignName] = useState("");
  const [callLog, setCallLog] = useState<CallLogEntry[]>([]);
  const [callLogLoading, setCallLogLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAssignPopup, setBulkAssignPopup] = useState(false);
  const [bulkAssignName, setBulkAssignName] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [colorPickerId, setColorPickerId] = useState<number | null>(null);
  const { unreadCount } = useUnread(token, user?.id);
  useBadge(unreadCount);

  useEffect(() => {
    if (colorPickerId === null) return;
    const close = () => setColorPickerId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [colorPickerId]);

  const loadCallLog = useCallback(async (candidateId: number) => {
    setCallLogLoading(true);
    setCallLog([]);
    try {
      const res = await fetch(`${API}?mode=call_log&candidate_id=${candidateId}`, {
        headers: token ? { "X-Session-Id": token } : {},
      });
      const data = await res.json();
      setCallLog(data.log || []);
    } finally {
      setCallLogLoading(false);
    }
  }, [token]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${API}?mode=leads`, {
        headers: token ? { "X-Session-Id": token } : {},
        signal: controller.signal,
      });
      const raw = await res.text();
      const data: ApiLead[] = JSON.parse(raw);
      setLeads(data.map(fromApi));
    } catch (e) {
      console.error("Load leads error", e);
      setLoadError(true);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const employees = Array.from(new Set(leads.map((l) => l.assignedTo).filter(Boolean))).sort();

  const filtered = leads.filter((l) => {
    if (showUncalled && l.called) return false;
    if (filterEmployee && l.assignedTo !== filterEmployee) return false;
    return [l.fullName, l.phone, l.city].some((v) =>
      v.toLowerCase().includes(search.toLowerCase())
    );
  });

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

  const handleToggleCalled = async (id: number, called: boolean) => {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, called } : l));
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
      body: JSON.stringify({ action: "toggle_called", id, called }),
    });
  };

  const RESULTS_NEED_ASSIGN = ["Недозвон", "Занято", "Заинтересован", "Перезвонит"];

  const handleSetCallResult = async (id: number, result: string, comment?: string, assignedTo?: string) => {
    const lead = leads.find((l) => l.id === id);
    const newComment = comment !== undefined ? comment : (lead?.callComment || "");
    // Если результат требует ФИО — и оно ещё не задано, показываем попап
    if (RESULTS_NEED_ASSIGN.includes(result) && !assignedTo) {
      setAssignPopup({ id, result });
      setAssignName(lead?.assignedTo || "");
      return;
    }
    const finalAssigned = assignedTo ?? (lead?.assignedTo || "");
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, callResult: result, callComment: newComment, called: result !== "", assignedTo: finalAssigned } : l));
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
      body: JSON.stringify({ action: "set_call_result", id, result, comment: newComment, assignedTo: finalAssigned }),
    });
    if (detailId === id) loadCallLog(id);
  };

  const handleAssignConfirm = async () => {
    if (!assignPopup) return;
    const name = assignName.trim();
    if (!name) return;
    await handleSetCallResult(assignPopup.id, assignPopup.result, undefined, name);
    setAssignPopup(null);
    setAssignName("");
  };

  const handleSaveComment = async (id: number, comment: string) => {
    const lead = leads.find((l) => l.id === id);
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, callComment: comment } : l));
    setCommentEditId(null);
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
      body: JSON.stringify({ action: "set_call_result", id, result: lead?.callResult || "", comment }),
    });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const uncalledFiltered = filtered.filter((l) => !l.called && !l.callResult);
    if (uncalledFiltered.every((l) => selectedIds.has(l.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(uncalledFiltered.map((l) => l.id)));
    }
  };

  const handleBulkAssign = async () => {
    const name = bulkAssignName.trim();
    if (!name || selectedIds.size === 0) return;
    setBulkAssigning(true);
    try {
      await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
        body: JSON.stringify({ action: "assign_leads", ids: Array.from(selectedIds), assignedTo: name }),
      });
      setLeads((prev) => prev.map((l) => selectedIds.has(l.id) ? { ...l, assignedTo: name } : l));
      setSelectedIds(new Set());
      setBulkAssignPopup(false);
      setBulkAssignName("");
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleSetColor = async (id: number, color: string) => {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, colorMark: color } : l));
    setColorPickerId(null);
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
      body: JSON.stringify({ action: "set_color", id, color }),
    });
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

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [cleaningEmpty, setCleaningEmpty] = useState(false);

  const handleDeleteEmptyLeads = async () => {
    if (!confirm("Удалить все лиды без телефона и имени (мусорные записи от неудачного импорта)?")) return;
    setCleaningEmpty(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
        body: JSON.stringify({ action: "delete_empty_leads" }),
      });
      const data = await res.json();
      if (data.ok) {
        setImportResult({ imported: 0, skipped: 0 });
        alert(`Удалено пустых записей: ${data.deleted}`);
        loadLeads();
      }
    } finally {
      setCleaningEmpty(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      let wb: XLSX.WorkBook;
      if (isCsv) {
        const text = await file.text();
        // Определяем разделитель: если больше ; чем , — используем ;
        const firstLine = text.split("\n")[0] || "";
        const sep = (firstLine.split(";").length > firstLine.split(",").length) ? ";" : ",";
        wb = XLSX.read(text, { type: "string", FS: sep });
      } else {
        const buf = await file.arrayBuffer();
        wb = XLSX.read(buf, { type: "array", raw: false });
      }
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "", raw: false });

      // Определяем реальное имя колонки с телефоном (может быть "Phone", числовым ключом и т.д.)
      const sampleKeys = raw.length > 0 ? Object.keys(raw[0]) : [];
      const phoneKey = sampleKeys.find((k) => /phone|телефон|tel/i.test(k)) || "Phone";
      const nameKey = sampleKeys.find((k) => /name|фио|fullname/i.test(k) && !/channel/i.test(k)) || "";
      const channelKey = sampleKeys.find((k) => /channel/i.test(k)) || "";

      const rows = raw.map((r) => {
        const phone = String(r[phoneKey] || "").replace(/\D/g, "");
        const source = channelKey ? (r[channelKey] || "") : "";
        const baseNotes = r["Примечание"] || r["notes"] || "";
        const notes = source ? `Источник: DMP.ONE (${source})` + (baseNotes ? `\n${baseNotes}` : "") : (baseNotes || "Источник: DMP.ONE");
        return {
          fullName: nameKey ? (r[nameKey] || "") : "",
          phone,
          city: r["Город"] || r["city"] || "",
          citizenship: r["Гражданство"] || r["citizenship"] || "",
          notes,
        };
      }).filter((r) => r.phone);
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
        body: JSON.stringify({ action: "import_leads", rows }),
      });
      const data = await res.json();
      if (data.ok) {
        setImportResult({ imported: data.imported, skipped: data.skipped });
        loadLeads();
      }
    } finally {
      setImporting(false);
    }
  };

  const handleExportExcel = () => {
    const rows = filtered.map((l, idx) => ({
      "№": idx + 1,
      "ФИО": l.fullName,
      "Телефон": l.phone,
      "Город": l.city,
      "Гражданство": l.citizenship,
      "Примечание": l.notes,
      "Дата заявки": l.createdAt ? new Date(l.createdAt).toLocaleString("ru-RU") : "",
      "Прозвонен": l.called ? "Да" : "Нет",
      "Результат звонка": l.callResult,
      "Комментарий": l.callComment,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Лиды");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `leads_${date}.xlsx`);
  };

  const detail = detailId !== null ? leads.find((l) => l.id === detailId) : null;
  const commentLead = commentEditId !== null ? leads.find((l) => l.id === commentEditId) : null;

  const closeComment = () => {
    setCommentDraft(commentLead?.callComment || "");
    setCommentEditId(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(210,20%,97%)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* Bulk assign popup */}
      {bulkAssignPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setBulkAssignPopup(false)}>
          <div className="bg-white border border-blue-300 rounded-xl shadow-2xl p-6 flex flex-col gap-4 w-[400px] max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-foreground">Назначить лиды сотруднику</div>
              <button onClick={() => setBulkAssignPopup(false)} className="text-muted-foreground hover:text-foreground"><Icon name="X" size={16} /></button>
            </div>
            <div className="text-xs text-muted-foreground">
              Выбрано лидов: <b>{selectedIds.size}</b>. Укажите ФИО сотрудника, которому их назначить.
            </div>
            <input
              autoFocus
              value={bulkAssignName}
              onChange={(e) => setBulkAssignName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleBulkAssign(); if (e.key === "Escape") setBulkAssignPopup(false); }}
              placeholder="Иванов Иван Иванович"
              className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setBulkAssignPopup(false)} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors">Отмена</button>
              <button
                onClick={handleBulkAssign}
                disabled={!bulkAssignName.trim() || bulkAssigning}
                className="text-xs px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors flex items-center gap-1.5"
              >
                {bulkAssigning && <Icon name="Loader2" size={12} className="animate-spin" />}
                Назначить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign employee popup */}
      {assignPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAssignPopup(null)}>
          <div className="bg-white border border-blue-300 rounded-xl shadow-2xl p-6 flex flex-col gap-4 w-[380px] max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-foreground">Укажите ваше ФИО</div>
              <button onClick={() => setAssignPopup(null)} className="text-muted-foreground hover:text-foreground"><Icon name="X" size={16} /></button>
            </div>
            <div className="text-xs text-muted-foreground">
              Лид будет закреплён за вами. Вы сможете найти его в своём личном списке.
            </div>
            <input
              autoFocus
              value={assignName}
              onChange={(e) => setAssignName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAssignConfirm(); if (e.key === "Escape") setAssignPopup(null); }}
              placeholder="Иванов Иван Иванович"
              className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAssignPopup(null)} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors">Отмена</button>
              <button
                onClick={handleAssignConfirm}
                disabled={!assignName.trim()}
                className="text-xs px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors"
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment popup */}
      {commentLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={closeComment}>
          <div
            className="bg-white border border-blue-300 rounded-lg shadow-2xl p-5 flex flex-col gap-3 w-[440px] max-w-[95vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-foreground flex items-center justify-between">
              <span>Комментарий к звонку</span>
              <button onClick={closeComment} className="text-muted-foreground hover:text-foreground">
                <Icon name="X" size={16} />
              </button>
            </div>
            <div className="text-xs text-muted-foreground">{commentLead.fullName || "Без имени"}{user?.mangoVerified && commentLead.phone ? ` · ${commentLead.phone}` : ""}</div>
            <textarea
              autoFocus
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeComment();
                if (e.key === "Enter" && e.ctrlKey) handleSaveComment(commentLead.id, commentDraft);
              }}
              rows={6}
              className="text-sm border border-border rounded px-3 py-2 w-full focus:outline-none focus:border-blue-400 resize-none"
              placeholder="Введите комментарий..."
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">Ctrl+Enter — сохранить</span>
              <div className="flex gap-2">
                <button onClick={closeComment} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors">
                  Отмена
                </button>
                <button onClick={() => handleSaveComment(commentLead.id, commentDraft)} className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          <button onClick={() => navigate("/my-leads")} className="flex items-center gap-1 text-amber-300 hover:text-amber-200 text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors" title="Мои лиды">
            <Icon name="UserCheck" size={14} />
            <span className="hidden md:inline">Мои лиды</span>
          </button>
          <button onClick={() => navigate("/help")} className="flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors" title="Инструкция">
            <Icon name="BookOpen" size={14} />
            <span className="hidden md:inline">Инструкция</span>
          </button>
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
        <button
          onClick={() => setShowUncalled((v) => !v)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors whitespace-nowrap ${showUncalled ? "bg-orange-500 border-orange-500 text-white" : "border-border text-muted-foreground hover:border-orange-400 hover:text-orange-600"}`}
          title="Только непрозвоненные"
        >
          <Icon name="PhoneMissed" size={13} />
          <span>Непрозвоненные</span>
        </button>
        {isAdmin && employees.length > 0 && (
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className={`text-xs h-8 px-2 rounded border transition-colors focus:outline-none ${filterEmployee ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-border text-muted-foreground bg-white"}`}
            title="Фильтр по сотруднику"
          >
            <option value="">Все сотрудники</option>
            {employees.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
        <span className="text-xs text-muted-foreground">
          Показано: <b className="text-foreground">{filtered.length}</b> из {leads.length}
        </span>
        {isAdmin && selectedIds.size > 0 && (
          <button
            onClick={() => setBulkAssignPopup(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            <Icon name="UserPlus" size={13} />
            Назначить выбранные ({selectedIds.size})
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {importResult && (
            <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
              Загружено: <b>{importResult.imported}</b>{importResult.skipped > 0 ? `, пропущено дублей: ${importResult.skipped}` : ""}
            </span>
          )}
          {isAdmin && (
            <>
              <button
                onClick={handleDeleteEmptyLeads}
                disabled={cleaningEmpty}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 transition-colors disabled:opacity-40"
                title="Удалить лиды без телефона (мусор от неудачного импорта)"
              >
                <Icon name={cleaningEmpty ? "Loader2" : "Trash2"} size={13} className={cleaningEmpty ? "animate-spin" : ""} />
                <span>Очистить пустые</span>
              </button>
              <label className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer ${importing ? "opacity-60 pointer-events-none" : ""}`} title="Импорт лидов из Excel (DMP.ONE)">
                <Icon name={importing ? "Loader2" : "Upload"} size={13} className={importing ? "animate-spin" : ""} />
                <span>{importing ? "Импорт..." : "Импорт"}</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportExcel} disabled={importing} />
              </label>
            </>
          )}
          <button
            onClick={handleExportExcel}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Скачать в Excel"
          >
            <Icon name="FileSpreadsheet" size={13} />
            <span>Excel</span>
          </button>
          <button onClick={loadLeads} className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors" title="Обновить">
            <Icon name={loading ? "Loader2" : "RefreshCw"} size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Icon name="Loader2" size={28} className="animate-spin mr-3" />
            <span className="text-sm">Загрузка лидов...</span>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <Icon name="WifiOff" size={32} className="text-red-400" />
            <span className="text-sm">Сервер недоступен. Проверьте соединение.</span>
            <button onClick={loadLeads} className="text-xs underline hover:text-foreground transition-colors">Повторить</button>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse" style={{ minWidth: "880px" }}>
            <thead>
              <tr style={{ background: "hsl(217, 60%, 22%)" }}>
                {isAdmin && (
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      className="cursor-pointer"
                      checked={filtered.filter((l) => !l.called && !l.callResult).length > 0 && filtered.filter((l) => !l.called && !l.callResult).every((l) => selectedIds.has(l.id))}
                      onChange={toggleSelectAll}
                      title="Выбрать все непрозвоненные"
                    />
                  </th>
                )}
                {["№", "ФИО", "Телефон", "Город", "Гражданство", "Примечание", "Дата", "Результат", "Кто звонил", "Комментарий", ""].map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 font-medium text-xs tracking-wide text-white/80 border-b border-white/10 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 12 : 11} className="text-center py-20 text-muted-foreground">
                    <Icon name="Inbox" size={36} className="mx-auto mb-3 opacity-25" />
                    <div className="text-sm">Нет лидов. Они появятся здесь после заявок с сайта.</div>
                  </td>
                </tr>
              )}
              {filtered.map((l, idx) => {
                const isUncalled = !l.called && !l.callResult;
                const rowBg = l.colorMark ? l.colorMark + "22" : undefined;
                const rowBorder = l.colorMark ? `2px solid ${l.colorMark}44` : undefined;
                return (
                <tr key={l.id} className="border-b border-border hover:bg-muted/40 transition-colors group animate-fade-in" style={{ background: rowBg || "white", borderLeft: rowBorder }}>
                  {isAdmin && (
                    <td className="px-3 py-2">
                      {isUncalled && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(l.id)}
                          onChange={() => toggleSelect(l.id)}
                          className="cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                  <td className="px-3 py-2 font-semibold whitespace-nowrap max-w-[160px] truncate">{l.fullName || <span className="text-muted-foreground italic">Без имени</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {(user?.mangoVerified || user?.role === "admin") ? (
                      l.phone ? (
                        <a
                          href={`tel:${l.phone}`}
                          className="font-mono text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                          title="Позвонить"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Icon name="Phone" size={11} />
                          {l.phone}
                        </a>
                      ) : <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Icon name="Lock" size={11} />
                        Скрыт
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{l.city || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{l.citizenship || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 max-w-[200px]">
                    <div className="truncate text-muted-foreground">{l.notes || "—"}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">{l.createdAt ? new Date(l.createdAt).toLocaleDateString("ru-RU") : "—"}</td>
                  <td className="px-3 py-2">
                    <select
                      value={l.callResult || ""}
                      onChange={(e) => handleSetCallResult(l.id, e.target.value)}
                      className="text-[11px] rounded px-1.5 py-0.5 border cursor-pointer focus:outline-none font-medium"
                      style={(() => {
                        const r = CALL_RESULTS.find((r) => r.value === l.callResult);
                        return r ? r.color : { color: "#888", borderColor: "#e2e8f0", background: "white" };
                      })()}
                    >
                      <option value="">Выбрать</option>
                      {CALL_RESULTS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {l.assignedTo
                      ? <span className="flex items-center gap-1 text-[11px] text-slate-600"><Icon name="User" size={10} />{l.assignedTo}</span>
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                  <td className="px-3 py-2 max-w-[180px] relative">
                    <button
                      onClick={() => { setCommentEditId(l.id); setCommentDraft(l.callComment || ""); }}
                      className="text-left w-full text-[11px] text-muted-foreground hover:text-foreground group/comment flex items-center gap-1"
                      title={l.callComment || "Добавить комментарий"}
                    >
                      {l.callComment
                        ? <span className="truncate text-foreground/80">{l.callComment}</span>
                        : <span className="opacity-0 group-hover/comment:opacity-60 italic">+ добавить</span>
                      }
                      <Icon name="Pencil" size={10} className="shrink-0 opacity-0 group-hover/comment:opacity-50" />
                    </button>

                  </td>
                  <td className="px-3 py-2 sticky right-0 bg-white group-hover:bg-amber-50/40">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => { setDetailId(l.id); loadCallLog(l.id); }} className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors" title="Подробнее">
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
                        <>
                          <div className="relative">
                            <button
                              onClick={() => setColorPickerId(colorPickerId === l.id ? null : l.id)}
                              className="p-1 rounded hover:bg-purple-50 transition-colors"
                              title="Цвет пометки"
                              style={{ color: l.colorMark || "#94a3b8" }}
                            >
                              <Icon name="Palette" size={13} />
                            </button>
                            {colorPickerId === l.id && (
                              <div className="absolute right-0 bottom-7 z-50 bg-white border border-border rounded-lg shadow-xl p-2 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <div className="text-[10px] text-muted-foreground mb-1 font-medium px-1">Цвет строки</div>
                                <div className="flex gap-1.5 flex-wrap w-[136px]">
                                  {["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#14b8a6"].map((c) => (
                                    <button key={c} onClick={() => handleSetColor(l.id, c)} className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110" style={{ background: c, borderColor: l.colorMark === c ? "#1e293b" : "transparent" }} title={c} />
                                  ))}
                                  <input type="color" value={l.colorMark || "#3b82f6"} onChange={(e) => handleSetColor(l.id, e.target.value)} className="w-6 h-6 rounded cursor-pointer border border-border p-0" title="Свой цвет" />
                                </div>
                                {l.colorMark && (
                                  <button onClick={() => handleSetColor(l.id, "")} className="text-[10px] text-muted-foreground hover:text-red-500 px-1 text-left transition-colors">Сбросить</button>
                                )}
                              </div>
                            )}
                          </div>
                          <button onClick={() => handleDelete(l.id)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" title="Удалить">
                            <Icon name="Trash2" size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
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
                  <div>
                    <div className="text-xs text-muted-foreground font-medium mb-0.5">Телефон</div>
                    {(user?.mangoVerified || user?.role === "admin") ? (
                      detail.phone ? (
                        <a href={`tel:${detail.phone}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                          <Icon name="Phone" size={13} />
                          {detail.phone}
                        </a>
                      ) : <div className="text-sm">—</div>
                    ) : (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Icon name="Lock" size={13} />
                        Скрыт
                      </div>
                    )}
                  </div>
                  <InfoRow label="Город" value={detail.city} />
                  <InfoRow label="Гражданство" value={detail.citizenship} />
                  <InfoRow label="Дата заявки" value={detail.createdAt ? new Date(detail.createdAt).toLocaleDateString("ru-RU") : ""} />
                  <div>
                    <div className="text-xs text-muted-foreground font-medium mb-1">Результат звонка</div>
                    <CallResultBadge result={detail.callResult} />
                  </div>
                </div>
                {detail.notes && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Примечание</div>
                    <div className="bg-muted/50 rounded p-3 text-sm leading-relaxed whitespace-pre-line">{detail.notes}</div>
                  </div>
                )}

                {/* Выбор результата звонка в модалке */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">Отметить результат звонка</div>
                  <div className="flex flex-wrap gap-1.5">
                    {CALL_RESULTS.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => handleSetCallResult(detail.id, r.value)}
                        className="text-[11px] font-medium px-2 py-1 rounded border transition-all"
                        style={detail.callResult === r.value
                          ? { ...r.color, outline: "2px solid " + r.color.color, outlineOffset: "1px" }
                          : { color: "#888", borderColor: "#e2e8f0", background: "white" }
                        }
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* История звонков */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Icon name="History" size={13} />
                    История звонков
                  </div>
                  {callLogLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Icon name="Loader2" size={13} className="animate-spin" /> Загрузка...
                    </div>
                  ) : callLog.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">Звонков ещё не было</div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {callLog.map((entry) => {
                        const cr = CALL_RESULTS.find((r) => r.value === entry.result);
                        return (
                          <div key={entry.id} className="flex items-start gap-2 text-xs bg-muted/40 rounded px-2 py-1.5">
                            <Icon name="User" size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium">{entry.userName || "Неизвестно"}</span>
                                {entry.result && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={cr ? { color: cr.color.color, background: cr.color.background } : { color: "#888", background: "#f1f5f9" }}>
                                    {entry.result}
                                  </span>
                                )}
                                <span className="text-muted-foreground ml-auto shrink-0">
                                  {new Date(entry.calledAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              {entry.comment && <div className="text-muted-foreground mt-0.5 truncate">{entry.comment}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

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
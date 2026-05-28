import { useState, useRef, useEffect, useCallback } from "react";
import { useUnread } from "@/hooks/useUnread";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import func2url from "../../backend/func2url.json";
import * as XLSX from "xlsx";
import WelcomeTutorial from "@/components/WelcomeTutorial";
import { useBadge } from "@/hooks/useBadge";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const API = (func2url as Record<string, string>)["candidates"];
const AUTH_URL = (func2url as Record<string, string>)["auth"];
const UPLOAD_URL = API;

interface FileItem {
  name: string;
  url: string;
  type: string;
}

interface Candidate {
  id: number;
  fullName: string;
  birthDate: string;
  city: string;
  citizenship: string;
  hasInn: boolean;
  hasSnils: boolean;
  relations: string;
  age: string;
  criminalRecord: string;
  chronicDiseases: string;
  dispensaryRecord: string;
  phone: string;
  arrivalDate: string;
  notes: string;
  docPhotos: FileItem[];
  relationPhotos: FileItem[];
  tickets: FileItem[];
  contractPhotos: FileItem[];
  employeeName: string;
  company: string;
  createdAt: string;
  called: boolean;
}

interface ApiCandidate {
  id: string;
  full_name: string;
  birth_date: string;
  city: string;
  citizenship: string;
  has_inn: boolean;
  has_snils: boolean;
  relations: string;
  age: string;
  criminal_record: string;
  chronic_diseases: string;
  dispensary_record: string;
  phone: string;
  arrival_date: string;
  notes: string;
  doc_photos: FileItem[];
  relation_photos: FileItem[];
  tickets: FileItem[];
  contract_photos: FileItem[];
  employee_name: string;
  company: string;
  created_at: string;
  called: boolean;
}

function fromApi(r: ApiCandidate): Candidate {
  return {
    id: Number(r.id),
    fullName: r.full_name,
    birthDate: r.birth_date || "",
    city: r.city || "",
    citizenship: r.citizenship || "",
    hasInn: !!r.has_inn,
    hasSnils: !!r.has_snils,
    relations: r.relations || "",
    age: r.age,
    criminalRecord: r.criminal_record,
    chronicDiseases: r.chronic_diseases,
    dispensaryRecord: r.dispensary_record,
    phone: r.phone || "",
    arrivalDate: r.arrival_date || "",
    notes: r.notes,
    docPhotos: r.doc_photos || [],
    relationPhotos: r.relation_photos || [],
    tickets: r.tickets || [],
    contractPhotos: r.contract_photos || [],
    employeeName: r.employee_name,
    company: r.company || "",
    createdAt: r.created_at,
    called: r.called || false,
  };
}

function toApi(c: Omit<Candidate, "id" | "createdAt">) {
  return {
    fullName: c.fullName,
    birthDate: c.birthDate,
    city: c.city,
    citizenship: c.citizenship,
    hasInn: c.hasInn,
    hasSnils: c.hasSnils,
    relations: c.relations,
    age: c.age,
    criminalRecord: c.criminalRecord,
    chronicDiseases: c.chronicDiseases,
    dispensaryRecord: c.dispensaryRecord,
    phone: c.phone,
    arrivalDate: c.arrivalDate,
    notes: c.notes,
    docPhotos: c.docPhotos,
    relationPhotos: c.relationPhotos,
    tickets: c.tickets,
    contractPhotos: c.contractPhotos,
    employeeName: c.employeeName,
    company: c.company,
    createdAt: new Date().toISOString().slice(0, 10),
  };
}

const EMPTY: Omit<Candidate, "id" | "createdAt"> = {
  fullName: "", birthDate: "", city: "", citizenship: "",
  hasInn: false, hasSnils: false, relations: "",
  age: "", criminalRecord: "", chronicDiseases: "",
  dispensaryRecord: "", phone: "", arrivalDate: "",
  notes: "", docPhotos: [], relationPhotos: [],
  tickets: [], contractPhotos: [], employeeName: "", company: "",
};

async function uploadFileToS3(file: File): Promise<FileItem> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1];
        const res = await fetch(UPLOAD_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "upload", data: base64, name: file.name, type: file.type }),
        });
        const data = await res.text();
        // Разворачиваем двойную сериализацию если есть
        let parsed = JSON.parse(data);
        if (typeof parsed === "string") parsed = JSON.parse(parsed);
        if (!parsed.url) throw new Error("No URL in response: " + data);
        resolve({ url: parsed.url, name: file.name, type: file.type });
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FilesUploadCell({ files, onAdd, label }: {
  files: FileItem[];
  onAdd: (f: FileItem[]) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    if (inputRef.current) inputRef.current.value = "";
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await Promise.all(picked.map(uploadFileToS3));
      onAdd([...files, ...uploaded]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => (
          <a key={i} href={f.url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded hover:bg-blue-100 transition-colors">
            <Icon name={f.type.startsWith("image/") ? "Image" : "FileText"} size={12} />
            <span className="max-w-[100px] truncate">{f.name}</span>
          </a>
        ))}
      </div>
      <button type="button" onClick={() => !uploading && inputRef.current?.click()}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors border border-dashed border-border rounded px-2 py-1 hover:border-primary disabled:opacity-50">
        {uploading
          ? <><Icon name="Loader2" size={12} className="animate-spin" /> Загрузка...</>
          : <><Icon name="Plus" size={12} />{label}</>}
      </button>
      <input ref={inputRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleFiles} />
      {uploadError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 break-all">
          Ошибка: {uploadError}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const lower = (value || "").toLowerCase().trim();
  if (!lower || lower === "нет")
    return <span className="inline-flex text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">Нет</span>;
  return <span className="inline-flex text-xs px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">{value}</span>;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground font-medium mb-0.5">{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

function Th({ children, tip }: { children: React.ReactNode; tip?: string }) {
  return (
    <th className="text-left px-2 py-2 font-medium text-xs tracking-wide text-white/80 border-b border-white/10 whitespace-nowrap">
      {tip ? (
        <span className="group relative inline-flex items-center gap-1 cursor-help">
          {children}
          <span className="opacity-40 group-hover:opacity-80 transition-opacity">
            <Icon name="Info" size={10} />
          </span>
          <span className="pointer-events-none absolute left-0 top-full mt-1.5 z-50 w-48 rounded-lg bg-gray-900 text-white text-xs px-3 py-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity leading-relaxed font-normal tracking-normal">
            {tip}
          </span>
        </span>
      ) : children}
    </th>
  );
}

export default function Index() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showUncalled, setShowUncalled] = useState(false);
  const [leadsCount, setLeadsCount] = useState<number | null>(null);
  const { unreadCount } = useUnread(token, user?.id);
  useBadge(unreadCount);
  usePushNotifications(token);

  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) CRM — Учёт кандидатов` : "CRM — Учёт кандидатов";
  }, [unreadCount]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<Candidate, "id" | "createdAt">>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [pwdModal, setPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ oldPassword: "", newPassword: "" });
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSaving(true);
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
      body: JSON.stringify({ action: "change_own_password", ...pwdForm }),
    });
    const raw = await res.text();
    const data = JSON.parse(typeof JSON.parse(raw) === "string" ? JSON.parse(raw) : raw);
    if (!res.ok) { setPwdError(data.error || "Ошибка"); }
    else { setPwdModal(false); setPwdForm({ oldPassword: "", newPassword: "" }); }
    setPwdSaving(false);
  };

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API, {
        headers: token ? { "X-Session-Id": token } : {},
      });
      const data: ApiCandidate[] = JSON.parse(await res.text());
      setCandidates(data.map(fromApi));
    } catch (e) {
      console.error("Load error", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}?mode=leads`, { headers: { "X-Session-Id": token } })
      .then((r) => r.text())
      .then((raw) => { const data = JSON.parse(raw); setLeadsCount(Array.isArray(data) ? data.length : 0); })
      .catch(() => {});
  }, [token]);

  const filtered = candidates.filter((c) => {
    if (showUncalled && c.called) return false;
    return [c.fullName, c.employeeName, c.age].some((v) =>
      v.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleToggleCalled = async (id: number, called: boolean) => {
    setCandidates((prev) => prev.map((c) => c.id === id ? { ...c, called } : c));
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": token || "" },
      body: JSON.stringify({ action: "toggle_called", id, called }),
    });
  };

  const handleExportExcel = () => {
    const rows = filtered.map((c, idx) => ({
      "№": idx + 1,
      "ФИО": c.fullName,
      "Телефон": c.phone,
      "Дата рождения": c.birthDate,
      "Город": c.city,
      "Гражданство": c.citizenship,
      "ИНН": c.hasInn ? "Да" : "Нет",
      "СНИЛС": c.hasSnils ? "Да" : "Нет",
      "Отношения": c.relations,
      "Возраст": c.age,
      "Судимости": c.criminalRecord,
      "Хр. болезни": c.chronicDiseases,
      "ПНД/НД": c.dispensaryRecord,
      "Дата прибытия": c.arrivalDate,
      "Заметки": c.notes,
      "Сотрудник": c.employeeName,
      "Компания": c.company,
      "Дата добавления": c.createdAt,
      "Прозвонен": c.called ? "Да" : "Нет",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Кандидаты");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `candidates_${date}.xlsx`);
  };

  const openAdd = () => {
    setForm({ ...EMPTY, employeeName: user?.fullName || "" });
    setEditingId(null);
    setIsModalOpen(true);
  };
  const openEdit = (c: Candidate) => {
    const { id, createdAt, ...rest } = c;
    setForm(rest); setEditingId(id); setIsModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId !== null) {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update", id: editingId, ...toApi(form) }),
        });
        const updated = fromApi(JSON.parse(await res.text()));
        setCandidates((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
      } else {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", ...toApi(form) }),
        });
        const created = fromApi(JSON.parse(await res.text()));
        setCandidates((prev) => [created, ...prev]);


      }
      setIsModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  };

  const detail = detailId !== null ? candidates.find((c) => c.id === detailId) : null;

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(210,20%,97%)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <WelcomeTutorial />
      {/* Header */}
      <header className="text-white px-6 py-4 flex items-center justify-between shadow-lg" style={{ background: "hsl(217, 60%, 18%)" }}>
        <div className="flex items-center gap-3">
          <img src="https://cdn.poehali.dev/projects/9349667d-fe54-44ac-a18d-809d42c7c67e/files/ba8ed286-2fa3-48f9-9a22-0eacab2cada0.jpg" alt="logo" className="w-9 h-9 rounded object-cover border border-white/20" />
          <div>
            <div className="font-semibold text-base tracking-wide leading-tight">CRM — Учёт кандидатов</div>
            <div className="text-white/50 text-xs font-light">Система управления персоналом</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs font-mono hidden md:block mr-2">Записей: {candidates.length}</span>
          <button
            onClick={() => navigate("/leads")}
            className="relative flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors"
            title="Лиды с сайта"
          >
            <Icon name="Zap" size={14} />
            <span className="hidden md:inline">Лиды</span>
            {leadsCount !== null && leadsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-[hsl(217,60%,18%)] text-[10px] font-bold leading-4 text-center">
                {leadsCount > 99 ? "99+" : leadsCount}
              </span>
            )}
          </button>
          {isAdmin && (
            <button onClick={() => navigate("/users")} className="flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors" title="Пользователи">
              <Icon name="UserCog" size={14} />
              <span className="hidden md:inline">Пользователи</span>
            </button>
          )}
          <button onClick={() => { setPwdError(null); setPwdForm({ oldPassword: "", newPassword: "" }); setPwdModal(true); }} className="flex items-center gap-1 text-white/60 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors" title="Сменить пароль">
            <Icon name="User" size={14} />
            <span className="hidden md:inline">{user?.fullName || user?.login}</span>
          </button>
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
          <button onClick={() => navigate("/help")} className="flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors" title="Инструкция">
            <Icon name="BookOpen" size={14} />
            <span className="hidden md:inline">Инструкция</span>
          </button>
          <button onClick={async () => { await logout(); navigate("/login"); }} className="flex items-center gap-1 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors" title="Выйти">
            <Icon name="LogOut" size={14} />
          </button>
          <Button onClick={openAdd} className="bg-white text-[hsl(217,60%,18%)] hover:bg-white/90 text-sm font-semibold h-9 px-4 ml-1">
            <Icon name="Plus" size={15} />Добавить кандидата
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="bg-white border-b border-border px-6 py-3 flex items-center gap-4">
        <div className="relative flex-1 max-w-xs">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input placeholder="Поиск по ФИО, сотруднику..." value={search}
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
        <span className="text-xs text-muted-foreground">
          Показано: <b className="text-foreground">{filtered.length}</b> из {candidates.length}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:border-green-500 hover:text-green-700 transition-colors whitespace-nowrap"
            title="Выгрузить в Excel"
          >
            <Icon name="FileDown" size={13} />
            <span>Excel</span>
          </button>
          <button onClick={loadCandidates} className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors" title="Обновить">
            <Icon name={loading ? "Loader2" : "RefreshCw"} size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto crm-table-wrap">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Icon name="Loader2" size={28} className="animate-spin mr-3" />
            <span className="text-sm">Загрузка данных...</span>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse" style={{ minWidth: "960px" }}>
            <thead>
              <tr style={{ background: "hsl(217, 60%, 22%)" }}>
                <Th>№</Th>
                <Th tip="Полное имя кандидата">ФИО</Th>
                <Th tip="Контактный телефон">Телефон</Th>
                <Th tip="Возраст кандидата">Лет</Th>
                <Th tip="Наличие судимости. «Нет» — отсутствует">Судимость</Th>
                <Th tip="Хронические заболевания. «Нет» — здоров">Хр. болезни</Th>
                <Th tip="Состоит ли на учёте в ПНД или НД. «Нет» — не состоит">ПНД/НД</Th>
                <Th tip="Дополнительные заметки по кандидату">Заметки</Th>
                <Th tip="Количество прикреплённых фото документов">Доки</Th>
                <Th tip="Фото документов об отношениях (семья, дети)">Отнош.</Th>
                <Th tip="Прикреплённые билеты (авиа, ЖД и т.д.)">Билеты</Th>
                <Th tip="Фото подписанного контракта">Контракт</Th>
                <Th tip="Сотрудник, добавивший запись">Сотрудник</Th>
                <Th tip="Компания кандидата">Компания</Th>
                <Th tip="Дата добавления в систему">Дата</Th>
                <Th tip="Отметьте галочкой после звонка кандидату. Кнопка «Непрозвоненные» скрывает отмеченных.">Прозвонен</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={17} className="text-center py-20 text-muted-foreground">
                    <Icon name="Inbox" size={36} className="mx-auto mb-3 opacity-25" />
                    <div className="text-sm">Нет записей. Добавьте первого кандидата.</div>
                  </td>
                </tr>
              )}
              {filtered.map((c, idx) => (
                <tr key={c.id} className="border-b border-border hover:bg-blue-50/50 transition-colors group animate-fade-in bg-white">
                  <td className="px-2 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                  <td className="px-2 py-2 font-semibold whitespace-nowrap max-w-[160px] truncate">{c.fullName}</td>
                  <td className="px-2 py-2 whitespace-nowrap font-mono">{c.phone || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-2 text-center font-mono">{c.age}</td>
                  <td className="px-2 py-2"><StatusBadge value={c.criminalRecord} /></td>
                  <td className="px-2 py-2"><StatusBadge value={c.chronicDiseases} /></td>
                  <td className="px-2 py-2"><StatusBadge value={c.dispensaryRecord} /></td>
                  <td className="px-2 py-2 max-w-[120px]">
                    <div className="truncate text-muted-foreground">{c.notes || "—"}</div>
                  </td>
                  <td className="px-2 py-2 text-center">{c.docPhotos.length > 0 ? <span className="text-blue-700 font-medium">{c.docPhotos.length}</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-2 text-center">{c.relationPhotos.length > 0 ? <span className="text-blue-700 font-medium">{c.relationPhotos.length}</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-2 text-center">{c.tickets.length > 0 ? <span className="text-blue-700 font-medium">{c.tickets.length}</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-2 text-center">{c.contractPhotos.length > 0 ? <span className="text-blue-700 font-medium">{c.contractPhotos.length}</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-2 whitespace-nowrap max-w-[120px] truncate">{c.employeeName || "—"}</td>
                  <td className="px-2 py-2 whitespace-nowrap max-w-[120px] truncate">{c.company || "—"}</td>
                  <td className="px-2 py-2 font-mono text-muted-foreground whitespace-nowrap">{c.createdAt}</td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => handleToggleCalled(c.id, !c.called)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${c.called ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"}`}
                      title={c.called ? "Прозвонен" : "Отметить как прозвоненный"}
                    >
                      {c.called && <Icon name="Check" size={11} />}
                    </button>
                  </td>
                  <td className="px-2 py-2 sticky right-0 bg-white group-hover:bg-blue-50/50">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setDetailId(c.id)} className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors" title="Подробнее">
                        <Icon name="Eye" size={13} />
                      </button>
                      <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Редактировать">
                        <Icon name="Pencil" size={13} />
                      </button>
                      {isAdmin && (
                        <button onClick={() => handleDelete(c.id)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" title="Удалить">
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

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Icon name={editingId !== null ? "Pencil" : "UserPlus"} size={16} />
              {editingId !== null ? "Редактировать кандидата" : "Новый кандидат"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* 1. ФИО */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">1. ФИО кандидата *</Label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Фамилия Имя Отчество" className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* 2. Дата рождения */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">2. Дата рождения</Label>
                <Input value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  placeholder="дд.мм.гггг" className="h-9 text-sm" />
              </div>
              {/* 3. Город */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">3. Город проживания</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Город" className="h-9 text-sm" />
              </div>
              {/* 4. Гражданство */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">4. Гражданство РФ</Label>
                <Input value={form.citizenship} onChange={(e) => setForm({ ...form, citizenship: e.target.value })}
                  placeholder="Гражданство" className="h-9 text-sm" />
              </div>
              {/* 9. Телефон */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">9. Телефон для связи</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+7 (___) ___-__-__" className="h-9 text-sm" />
              </div>
            </div>
            {/* 5. Документы */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">5. Наличие документов</Label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm select-none">
                  <input type="checkbox" checked={form.hasInn} onChange={(e) => setForm({ ...form, hasInn: e.target.checked })} className="w-4 h-4 accent-blue-700 rounded" />
                  ИНН
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm select-none">
                  <input type="checkbox" checked={form.hasSnils} onChange={(e) => setForm({ ...form, hasSnils: e.target.checked })} className="w-4 h-4 accent-blue-700 rounded" />
                  СНИЛС
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* 6. Отношения */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">6. Отношения</Label>
                <Input value={form.relations} onChange={(e) => setForm({ ...form, relations: e.target.value })}
                  placeholder="Семейное положение / дети" className="h-9 text-sm" />
              </div>
              {/* 7. Заболевания */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">7. Заболевания</Label>
                <Input value={form.chronicDiseases} onChange={(e) => setForm({ ...form, chronicDiseases: e.target.value })}
                  placeholder="Нет / укажите" className="h-9 text-sm" />
              </div>
              {/* 8. Судимости */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">8. Судимости</Label>
                <Input value={form.criminalRecord} onChange={(e) => setForm({ ...form, criminalRecord: e.target.value })}
                  placeholder="Нет / укажите статью" className="h-9 text-sm" />
              </div>
              {/* 10. Прибытие */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">10. Прибытие / дата билетов</Label>
                <Input value={form.arrivalDate} onChange={(e) => setForm({ ...form, arrivalDate: e.target.value })}
                  placeholder="Дата или описание" className="h-9 text-sm" />
              </div>
            </div>
            {/* Учёт ПНД/НД + Сотрудник + Компания */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Учёт ПНД / НД</Label>
                <Input value={form.dispensaryRecord} onChange={(e) => setForm({ ...form, dispensaryRecord: e.target.value })}
                  placeholder="Нет / укажите" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">ФИО сотрудника</Label>
                <Input value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })}
                  placeholder="Ответственный" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Компания</Label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Компания" className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Заметки</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Дополнительная информация..." rows={2} className="text-sm resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <Label className="text-xs font-medium flex items-center gap-1"><Icon name="IdCard" size={12} /> Фото документов</Label>
                <FilesUploadCell files={form.docPhotos} onAdd={(f) => setForm({ ...form, docPhotos: f })} label="Добавить фото" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium flex items-center gap-1"><Icon name="Heart" size={12} /> Фото отношений</Label>
                <FilesUploadCell files={form.relationPhotos} onAdd={(f) => setForm({ ...form, relationPhotos: f })} label="Добавить фото/PDF" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium flex items-center gap-1"><Icon name="Ticket" size={12} /> Билеты</Label>
                <FilesUploadCell files={form.tickets} onAdd={(f) => setForm({ ...form, tickets: f })} label="Добавить фото/PDF" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium flex items-center gap-1"><Icon name="FileSignature" size={12} /> Фото контракта</Label>
                <FilesUploadCell files={form.contractPhotos} onAdd={(f) => setForm({ ...form, contractPhotos: f })} label="Добавить фото/PDF" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="h-8 text-sm">Отмена</Button>
              <Button onClick={handleSave} disabled={saving || !form.fullName.trim()} className="h-8 text-sm text-white" style={{ background: "hsl(217,60%,20%)" }}>
                {saving
                  ? <><Icon name="Loader2" size={14} className="animate-spin" /> Сохранение...</>
                  : <><Icon name="Check" size={14} /> {editingId !== null ? "Сохранить" : "Добавить"}</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={detailId !== null} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  <Icon name="User" size={16} />{detail.fullName}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="1. ФИО" value={detail.fullName} />
                  <InfoRow label="2. Дата рождения" value={detail.birthDate} />
                  <InfoRow label="3. Город проживания" value={detail.city} />
                  <InfoRow label="4. Гражданство РФ" value={detail.citizenship} />
                  <InfoRow label="5. ИНН" value={detail.hasInn ? "✅ есть" : "❌ нет"} />
                  <InfoRow label="5. СНИЛС" value={detail.hasSnils ? "✅ есть" : "❌ нет"} />
                  <InfoRow label="6. Отношения" value={detail.relations} />
                  <InfoRow label="7. Заболевания" value={<StatusBadge value={detail.chronicDiseases} />} />
                  <InfoRow label="8. Судимости" value={<StatusBadge value={detail.criminalRecord} />} />
                  <InfoRow label="9. Телефон" value={detail.phone} />
                  <InfoRow label="10. Прибытие / билеты" value={detail.arrivalDate} />
                  <InfoRow label="Возраст" value={detail.age ? `${detail.age} лет` : ""} />
                  <InfoRow label="Учёт ПНД / НД" value={<StatusBadge value={detail.dispensaryRecord} />} />
                  <InfoRow label="Сотрудник" value={detail.employeeName} />
                  <InfoRow label="Компания" value={detail.company} />
                  <InfoRow label="Дата добавления" value={detail.createdAt} />
                </div>
                {detail.notes && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Заметки</div>
                    <div className="bg-muted/50 rounded p-3 text-sm leading-relaxed">{detail.notes}</div>
                  </div>
                )}
                {[
                  { label: "Фото документов", files: detail.docPhotos },
                  { label: "Фото отношений", files: detail.relationPhotos },
                  { label: "Билеты", files: detail.tickets },
                  { label: "Фото контракта", files: detail.contractPhotos },
                ].map(({ label, files }) =>
                  files.length > 0 ? (
                    <div key={label}>
                      <div className="text-xs font-medium text-muted-foreground mb-2">{label}</div>
                      <div className="flex flex-wrap gap-2">
                        {files.map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs px-2 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded hover:bg-blue-100 transition-colors">
                            <Icon name={f.type.startsWith("image/") ? "Image" : "FileText"} size={12} />
                            <span className="max-w-[120px] truncate">{f.name}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null
                )}
                <div className="flex justify-end pt-2 border-t border-border">
                  <Button variant="outline" size="sm" onClick={() => { setDetailId(null); openEdit(detail); }}>
                    <Icon name="Pencil" size={13} />Редактировать
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Смена своего пароля */}
      <Dialog open={pwdModal} onOpenChange={setPwdModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Icon name="KeyRound" size={15} />Смена пароля
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangeOwnPassword} className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Текущий пароль</Label>
              <Input type="password" value={pwdForm.oldPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                placeholder="Введите текущий пароль" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Новый пароль</Label>
              <Input type="password" value={pwdForm.newPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                placeholder="Введите новый пароль" className="h-8 text-sm" />
            </div>
            {pwdError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{pwdError}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setPwdModal(false)} className="h-8 text-xs">Отмена</Button>
              <Button type="submit" disabled={pwdSaving || !pwdForm.oldPassword || !pwdForm.newPassword} className="h-8 text-xs text-white" style={{ background: "hsl(217,60%,20%)" }}>
                {pwdSaving ? <Icon name="Loader2" size={13} className="animate-spin" /> : "Сохранить"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
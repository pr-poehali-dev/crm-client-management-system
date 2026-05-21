import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import Icon from "@/components/ui/icon";

interface FileItem {
  name: string;
  url: string;
  type: string;
}

interface Candidate {
  id: number;
  fullName: string;
  age: string;
  criminalRecord: string;
  chronicDiseases: string;
  dispensaryRecord: string;
  notes: string;
  docPhotos: FileItem[];
  relationPhotos: FileItem[];
  tickets: FileItem[];
  contractPhotos: FileItem[];
  employeeName: string;
  createdAt: string;
}

const EMPTY_CANDIDATE: Omit<Candidate, "id" | "createdAt"> = {
  fullName: "",
  age: "",
  criminalRecord: "",
  chronicDiseases: "",
  dispensaryRecord: "",
  notes: "",
  docPhotos: [],
  relationPhotos: [],
  tickets: [],
  contractPhotos: [],
  employeeName: "",
};

const DEMO_DATA: Candidate[] = [
  {
    id: 1,
    fullName: "Иванов Александр Петрович",
    age: "34",
    criminalRecord: "Нет",
    chronicDiseases: "Нет",
    dispensaryRecord: "Нет",
    notes: "Опыт работы 8 лет",
    docPhotos: [],
    relationPhotos: [],
    tickets: [],
    contractPhotos: [],
    employeeName: "Смирнова Е.В.",
    createdAt: "2026-05-15",
  },
  {
    id: 2,
    fullName: "Петрова Мария Сергеевна",
    age: "28",
    criminalRecord: "Нет",
    chronicDiseases: "Астма (контролируемая)",
    dispensaryRecord: "Нет",
    notes: "Рекомендована от ООО «Альфа»",
    docPhotos: [],
    relationPhotos: [],
    tickets: [],
    contractPhotos: [],
    employeeName: "Козлов Д.А.",
    createdAt: "2026-05-18",
  },
];

function FilesUploadCell({
  files,
  onAdd,
  label,
}: {
  files: FileItem[];
  onAdd: (f: FileItem[]) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    const items: FileItem[] = picked.map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
      type: f.type,
    }));
    onAdd([...files, ...items]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => (
          <a
            key={i}
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded hover:bg-blue-100 transition-colors"
          >
            <Icon name={f.type.startsWith("image/") ? "Image" : "FileText"} size={12} />
            <span className="max-w-[100px] truncate">{f.name}</span>
          </a>
        ))}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors border border-dashed border-border rounded px-2 py-1 hover:border-primary"
      >
        <Icon name="Plus" size={12} />
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFiles}
      />
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const lower = (value || "").toLowerCase().trim();
  if (!lower || lower === "нет") {
    return (
      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 font-normal">
        Нет
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-normal">
      {value}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground font-medium mb-0.5">{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

export default function Index() {
  const [candidates, setCandidates] = useState<Candidate[]>(DEMO_DATA);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<Candidate, "id" | "createdAt">>(EMPTY_CANDIDATE);
  const [saving, setSaving] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const filtered = candidates.filter((c) =>
    [c.fullName, c.employeeName, c.age].some((v) =>
      v.toLowerCase().includes(search.toLowerCase())
    )
  );

  const openAdd = () => {
    setForm(EMPTY_CANDIDATE);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEdit = (c: Candidate) => {
    const { id, createdAt, ...rest } = c;
    setForm(rest);
    setEditingId(id);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId !== null) {
        setCandidates((prev) =>
          prev.map((c) => (c.id === editingId ? { ...c, ...form } : c))
        );
      } else {
        const newCandidate: Candidate = {
          ...form,
          id: Date.now(),
          createdAt: new Date().toISOString().slice(0, 10),
        };
        setCandidates((prev) => [newCandidate, ...prev]);

        try {
          const func2url = await import("../../backend/func2url.json");
          const url = (func2url as Record<string, string>)["notify-telegram"];
          if (url) {
            await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fullName: form.fullName,
                age: form.age,
                employeeName: form.employeeName,
                createdAt: newCandidate.createdAt,
              }),
            });
          }
        } catch (e) { console.warn("Telegram notify", e); }
      }
      setIsModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  };

  const detail = detailId !== null ? candidates.find((c) => c.id === detailId) : null;

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(210,20%,97%)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Header */}
      <header className="text-white px-6 py-4 flex items-center justify-between shadow-lg" style={{ background: "hsl(217, 60%, 18%)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/10 border border-white/20 rounded flex items-center justify-center">
            <Icon name="Users" size={18} className="text-white" />
          </div>
          <div>
            <div className="font-semibold text-base tracking-wide leading-tight">CRM — Учёт кандидатов</div>
            <div className="text-white/50 text-xs font-light">Система управления персоналом</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/40 text-xs font-mono hidden md:block">
            Записей: {candidates.length}
          </span>
          <Button
            onClick={openAdd}
            className="bg-white text-[hsl(217,60%,18%)] hover:bg-white/90 text-sm font-semibold h-9 px-4"
          >
            <Icon name="Plus" size={15} />
            Добавить кандидата
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="bg-white border-b border-border px-6 py-3 flex items-center gap-4">
        <div className="relative flex-1 max-w-xs">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Поиск по ФИО, сотруднику..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          Показано: <b className="text-foreground">{filtered.length}</b> из {candidates.length}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto crm-table-wrap">
        <table className="w-full text-sm border-collapse" style={{ minWidth: "1480px" }}>
          <thead>
            <tr style={{ background: "hsl(217, 60%, 22%)" }}>
              {[
                "№", "ФИО кандидата", "Возраст", "Судимость / статья",
                "Хронические заболевания", "Учёт ПНД / НД", "Заметки",
                "Фото документов", "Фото отношений", "Билеты", "Фото контракта",
                "ФИО сотрудника", "Дата", "",
              ].map((h, i) => (
                <th
                  key={i}
                  className="text-left px-3 py-2.5 font-medium text-xs tracking-wider text-white/80 border-b border-white/10 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={14} className="text-center py-20 text-muted-foreground">
                  <Icon name="Inbox" size={36} className="mx-auto mb-3 opacity-25" />
                  <div className="text-sm">Нет записей. Добавьте первого кандидата.</div>
                </td>
              </tr>
            )}
            {filtered.map((c, idx) => (
              <tr
                key={c.id}
                className="border-b border-border hover:bg-blue-50/50 transition-colors group animate-fade-in bg-white"
              >
                <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs w-8">{idx + 1}</td>
                <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{c.fullName}</td>
                <td className="px-3 py-2.5 text-center font-mono text-sm">{c.age}</td>
                <td className="px-3 py-2.5"><StatusBadge value={c.criminalRecord} /></td>
                <td className="px-3 py-2.5"><StatusBadge value={c.chronicDiseases} /></td>
                <td className="px-3 py-2.5"><StatusBadge value={c.dispensaryRecord} /></td>
                <td className="px-3 py-2.5 max-w-[160px]">
                  <div className="truncate text-muted-foreground text-xs">{c.notes || "—"}</div>
                </td>
                <td className="px-3 py-2.5">
                  {c.docPhotos.length > 0
                    ? <span className="text-xs text-blue-700 font-medium">{c.docPhotos.length} файл(а)</span>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  {c.relationPhotos.length > 0
                    ? <span className="text-xs text-blue-700 font-medium">{c.relationPhotos.length} файл(а)</span>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  {c.tickets.length > 0
                    ? <span className="text-xs text-blue-700 font-medium">{c.tickets.length} файл(а)</span>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  {c.contractPhotos.length > 0
                    ? <span className="text-xs text-blue-700 font-medium">{c.contractPhotos.length} файл(а)</span>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-sm">{c.employeeName || "—"}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{c.createdAt}</td>
                <td className="px-3 py-2.5 w-24">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setDetailId(c.id)}
                      className="p-1.5 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                      title="Подробнее"
                    >
                      <Icon name="Eye" size={14} />
                    </button>
                    <button
                      onClick={() => openEdit(c)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Редактировать"
                    >
                      <Icon name="Pencil" size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                      title="Удалить"
                    >
                      <Icon name="Trash2" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs font-medium">ФИО кандидата *</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Фамилия Имя Отчество"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Полных лет</Label>
                <Input
                  type="number"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  placeholder="Возраст"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">ФИО сотрудника</Label>
                <Input
                  value={form.employeeName}
                  onChange={(e) => setForm({ ...form, employeeName: e.target.value })}
                  placeholder="Ответственный сотрудник"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Судимость / статья</Label>
                <Input
                  value={form.criminalRecord}
                  onChange={(e) => setForm({ ...form, criminalRecord: e.target.value })}
                  placeholder="Нет / укажите статью"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Хронические заболевания</Label>
                <Input
                  value={form.chronicDiseases}
                  onChange={(e) => setForm({ ...form, chronicDiseases: e.target.value })}
                  placeholder="Нет / укажите"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Учёт ПНД / НД</Label>
                <Input
                  value={form.dispensaryRecord}
                  onChange={(e) => setForm({ ...form, dispensaryRecord: e.target.value })}
                  placeholder="Нет / укажите"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Заметки</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Дополнительная информация о кандидате..."
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Icon name="IdCard" size={12} /> Фото документов
                </Label>
                <FilesUploadCell
                  files={form.docPhotos}
                  onAdd={(f) => setForm({ ...form, docPhotos: f })}
                  label="Добавить фото"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Icon name="Heart" size={12} /> Фото отношений
                </Label>
                <FilesUploadCell
                  files={form.relationPhotos}
                  onAdd={(f) => setForm({ ...form, relationPhotos: f })}
                  label="Добавить фото/PDF"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Icon name="Ticket" size={12} /> Билеты
                </Label>
                <FilesUploadCell
                  files={form.tickets}
                  onAdd={(f) => setForm({ ...form, tickets: f })}
                  label="Добавить фото/PDF"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Icon name="FileSignature" size={12} /> Фото контракта
                </Label>
                <FilesUploadCell
                  files={form.contractPhotos}
                  onAdd={(f) => setForm({ ...form, contractPhotos: f })}
                  label="Добавить фото/PDF"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="h-8 text-sm">
                Отмена
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.fullName.trim()}
                className="h-8 text-sm text-white"
                style={{ background: "hsl(217,60%,20%)" }}
              >
                {saving ? (
                  <><Icon name="Loader2" size={14} className="animate-spin" /> Сохранение...</>
                ) : (
                  <><Icon name="Check" size={14} /> {editingId !== null ? "Сохранить" : "Добавить"}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail View */}
      <Dialog open={detailId !== null} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  <Icon name="User" size={16} />
                  {detail.fullName}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="Возраст" value={`${detail.age} лет`} />
                  <InfoRow label="ФИО сотрудника" value={detail.employeeName} />
                  <InfoRow label="Судимость / статья" value={<StatusBadge value={detail.criminalRecord} />} />
                  <InfoRow label="Хронические заболевания" value={<StatusBadge value={detail.chronicDiseases} />} />
                  <InfoRow label="Учёт ПНД / НД" value={<StatusBadge value={detail.dispensaryRecord} />} />
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
                          <a
                            key={i}
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs px-2 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded hover:bg-blue-100 transition-colors"
                          >
                            <Icon name={f.type.startsWith("image/") ? "Image" : "FileText"} size={12} />
                            <span className="max-w-[120px] truncate">{f.name}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null
                )}

                <div className="flex justify-end pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDetailId(null);
                      openEdit(detail);
                    }}
                  >
                    <Icon name="Pencil" size={13} />
                    Редактировать
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
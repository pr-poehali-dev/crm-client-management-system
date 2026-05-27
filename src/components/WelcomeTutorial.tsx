import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";

const STORAGE_KEY = "crm_tutorial_seen";

interface Step {
  icon: string;
  title: string;
  desc: string;
  install?: boolean;
}

const steps: Step[] = [
  {
    icon: "Users",
    title: "Добро пожаловать в CRM!",
    desc: "Это система учёта кандидатов. Здесь вы можете добавлять, просматривать и управлять базой кандидатов вашей компании.",
  },
  {
    icon: "UserPlus",
    title: "Добавление кандидата",
    desc: "Нажмите кнопку «Добавить кандидата» в правом верхнем углу. Заполните форму с данными: ФИО, телефон, город, гражданство, и прикрепите нужные документы.",
  },
  {
    icon: "Phone",
    title: "Отметка прозвона",
    desc: "В таблице есть столбец «Прозвонен» — нажмите на чекбокс, чтобы отметить кандидата. Кнопка «Непрозвоненные» в панели поиска скрывает уже прозвоненных.",
  },
  {
    icon: "FileDown",
    title: "Выгрузка в Excel",
    desc: "Кнопка «Excel» в панели инструментов скачивает таблицу в файл. Выгружаются только те записи, которые видны на экране — с учётом поиска и фильтров.",
  },
  {
    icon: "Smartphone",
    title: "Установите приложение",
    desc: "Добавьте CRM на рабочий стол телефона — и работайте как в обычном приложении без браузера.",
    install: true,
  },
  {
    icon: "BookOpen",
    title: "Полная инструкция",
    desc: "Все возможности системы описаны в разделе «Инструкция» — кнопка в шапке страницы. Там вы найдёте ответы на любые вопросы.",
  },
];

export default function WelcomeTutorial() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const goHelp = () => {
    close();
    navigate("/help");
  };

  if (!visible) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-8 pt-8 pb-6 text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: "hsl(217, 60%, 18%)" }}
          >
            <Icon name={current.icon} size={26} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-[hsl(217,60%,18%)] mb-3">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.desc}</p>
          {current.install && (
            <div className="mt-4 text-left space-y-3">
              <div className="bg-[hsl(210,20%,97%)] rounded-lg px-4 py-3">
                <div className="text-xs font-semibold text-[hsl(217,60%,18%)] mb-1">🍎 iPhone (Safari)</div>
                <div className="text-xs text-muted-foreground">Поделиться → «На экран «Домой»» → Добавить</div>
              </div>
              <div className="bg-[hsl(210,20%,97%)] rounded-lg px-4 py-3">
                <div className="text-xs font-semibold text-[hsl(217,60%,18%)] mb-1">🤖 Android — Chrome</div>
                <div className="text-xs text-muted-foreground">⋮ (три точки) → «Добавить на главный экран» → Добавить</div>
              </div>
              <div className="bg-[hsl(210,20%,97%)] rounded-lg px-4 py-3">
                <div className="text-xs font-semibold text-[hsl(217,60%,18%)] mb-1">🌐 Android — Яндекс Браузер</div>
                <div className="text-xs text-muted-foreground">⋮ (три точки) → «Добавить на рабочий стол» → Добавить</div>
                <div className="text-xs text-amber-600 mt-1">⚠️ Счётчик непрочитанных на иконке не поддерживается — только в Chrome и Safari</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-1.5 pb-4">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="rounded-full transition-all"
              style={{
                width: i === step ? 20 : 8,
                height: 8,
                background: i === step ? "hsl(217, 60%, 18%)" : "hsl(217, 20%, 80%)",
              }}
            />
          ))}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={close}
            className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Пропустить
          </button>
          {isLast ? (
            <button
              onClick={goHelp}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors flex items-center justify-center gap-1.5"
              style={{ background: "hsl(217, 60%, 18%)" }}
            >
              <Icon name="BookOpen" size={14} />
              Открыть инструкцию
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors flex items-center justify-center gap-1.5"
              style={{ background: "hsl(217, 60%, 18%)" }}
            >
              Далее
              <Icon name="ArrowRight" size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
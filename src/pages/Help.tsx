import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import { useBadge } from "@/hooks/useBadge";
import { useUnread } from "@/hooks/useUnread";

interface Section {
  icon: string;
  title: string;
  items: { label: string; desc: string }[];
}

const sections: Section[] = [
  {
    icon: "Users",
    title: "Кандидаты",
    items: [
      { label: "Добавить кандидата", desc: "Нажмите кнопку «Добавить кандидата» в правом верхнем углу. Заполните форму: ФИО, телефон, город, гражданство, дату рождения и прочие данные. Прикрепите фото документов, билетов или контракта — файлы загружаются прямо из формы." },
      { label: "Редактировать запись", desc: "Нажмите иконку карандаша (✏️) в строке кандидата. Откроется та же форма с уже заполненными данными — измените нужное и сохраните." },
      { label: "Просмотр подробностей", desc: "Нажмите иконку глаза (👁) — откроется карточка кандидата со всей информацией и прикреплёнными файлами." },
      { label: "Удалить кандидата", desc: "Кнопка удаления (🗑) доступна только администраторам. После нажатия запись удаляется без возможности восстановления." },
      { label: "Отметить прозвон", desc: "В столбце «Прозвонен» есть чекбокс — нажмите его, чтобы отметить кандидата как прозвоненного (станет зелёным). Нажмите снова, чтобы снять отметку." },
    ],
  },
  {
    icon: "Search",
    title: "Поиск и фильтры",
    items: [
      { label: "Поиск по ФИО или сотруднику", desc: "Введите имя в строку поиска вверху страницы — таблица мгновенно фильтруется. Поиск работает по ФИО кандидата, имени сотрудника и возрасту." },
      { label: "Фильтр «Непрозвоненные»", desc: "Кнопка «Непрозвоненные» в панели инструментов скрывает всех, кому уже позвонили. Удобно при ежедневном обзвоне — только те, кто ещё ждёт звонка." },
      { label: "Обновить список", desc: "Кнопка с иконкой обновления (🔄) справа перезагружает данные из базы — полезно если коллеги одновременно работают в системе." },
    ],
  },
  {
    icon: "FileDown",
    title: "Выгрузка в Excel",
    items: [
      { label: "Скачать таблицу", desc: "Нажмите кнопку «Excel» в панели инструментов. В файл попадут только те записи, которые видны на экране — с учётом поиска и фильтров. Файл скачивается автоматически." },
    ],
  },
  {
    icon: "Zap",
    title: "Лиды с сайта",
    items: [
      { label: "Что такое лиды?", desc: "Лиды — это заявки от кандидатов, оставленные на внешнем сайте. Число новых лидов отображается оранжевым значком рядом с кнопкой «Лиды» в шапке." },
      { label: "Обработка лидов", desc: "Перейдите в раздел «Лиды». Вы можете просмотреть заявку, отметить её как прозвоненную или удалить. Лиды также выгружаются в Excel." },
    ],
  },
  {
    icon: "UserCog",
    title: "Пользователи (только для администратора)",
    items: [
      { label: "Создать пользователя", desc: "В разделе «Пользователи» нажмите «Добавить пользователя». Укажите ФИО, логин, пароль и роль (Сотрудник или Администратор)." },
      { label: "Сменить пароль пользователя", desc: "Администратор может сбросить пароль любого пользователя. Сотрудник может сменить только свой пароль — через своё имя в шапке страницы." },
      { label: "Удалить пользователя", desc: "Нажмите иконку корзины рядом с пользователем. Удалённый пользователь потеряет доступ к системе немедленно." },
    ],
  },
  {
    icon: "Smartphone",
    title: "Установка приложения на телефон",
    items: [
      { label: "iPhone (Safari)", desc: "1. Откройте сайт в браузере Safari. 2. Нажмите кнопку «Поделиться» (квадрат со стрелкой вверх) внизу экрана. 3. Выберите «На экран «Домой»». 4. Нажмите «Добавить». Приложение появится на рабочем столе как обычное." },
      { label: "Android — Chrome", desc: "1. Откройте сайт в браузере Chrome. 2. Нажмите «⋮» (три точки) в правом верхнем углу. 3. Выберите «Добавить на главный экран». 4. Нажмите «Добавить»." },
      { label: "Android — Яндекс Браузер", desc: "1. Откройте сайт в Яндекс Браузере. 2. Нажмите «⋮» (три точки) внизу экрана. 3. Выберите «Добавить на рабочий стол». 4. Нажмите «Добавить»." },
    ],
  },
  {
    icon: "User",
    title: "Личный кабинет",
    items: [
      { label: "Сменить пароль", desc: "Нажмите на своё имя в правом верхнем углу — откроется форма смены пароля. Введите текущий и новый пароль." },
      { label: "Выйти из системы", desc: "Нажмите иконку выхода (стрелка вправо) рядом со своим именем. Сессия будет завершена." },
    ],
  },
];

export default function Help() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { unreadCount } = useUnread(token, user?.id);
  useBadge(unreadCount);

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
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm px-3 py-1.5 rounded hover:bg-white/10 transition-colors"
          >
            <Icon name="ArrowLeft" size={15} />
            Назад
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div className="text-center space-y-2 mb-10">
          <h1 className="text-2xl font-bold text-[hsl(217,60%,18%)]">Как пользоваться CRM</h1>
          <p className="text-muted-foreground text-sm">Здесь собраны ответы на основные вопросы по работе с системой</p>
        </div>

        {sections.map((section) => (
          <div key={section.title} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border" style={{ background: "hsl(217, 60%, 22%)" }}>
              <Icon name={section.icon} size={18} className="text-white/80" />
              <h2 className="font-semibold text-white text-base">{section.title}</h2>
            </div>
            <div className="divide-y divide-border">
              {section.items.map((item) => (
                <div key={item.label} className="px-6 py-4">
                  <div className="font-medium text-sm text-[hsl(217,60%,18%)] mb-1">{item.label}</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="text-center text-xs text-muted-foreground pt-4">
          Если что-то непонятно — обратитесь к администратору системы
        </div>
      </div>
    </div>
  );
}
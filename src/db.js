import { JSONFilePreset } from "lowdb/node";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, "data", "db.json");

const defaultData = {
  users: [],
  events: [],
  notes: [],
  messages: [],
  aiChats: {},     // userId -> [{role, text, chips?}]
  aiProfiles: {},   // userId -> diagnostic state machine
  roadmaps: {},     // userId -> generated roadmap object
};

export const db = await JSONFilePreset(DB_FILE, defaultData);

export const COMPETENCIES = [
  { id: "subject", icon: "📚", label: "Предметные", short: "Предмет", color: "green", desc: "Знание предмета, научная база" },
  { id: "pedagogy", icon: "🧠", label: "Психолого-педагогическое", short: "Психология", color: "purple", desc: "Управление классом, работа с учениками" },
  { id: "method", icon: "📋", label: "Методическое", short: "Методика", color: "magenta", desc: "Планирование, разработка рабочих программ" },
  { id: "digital", icon: "💻", label: "Цифровое / ИКТ", short: "Цифра", color: "yellow", desc: "МЭШ, ЭОР, медиаграмотность" },
  { id: "communication", icon: "🗣️", label: "Коммуникативное", short: "Общение", color: "purple", desc: "Родители, коллеги, администрация" },
  { id: "personal", icon: "⭐", label: "Личностное", short: "Бренд", color: "magenta", desc: "Бренд педагога, конкурсы, лидерство" },
];

export const ALGO_STAGES = [
  "Диагностика дефицитов",
  "Создание пары наставник—наставляемый",
  "Корректировка карты",
  "Обучение и мероприятия",
  "Рефлексивный анализ",
  "Цифровое портфолио",
];

export const NOTE_CATS = ["Личное", "Урок", "Наставничество", "Мероприятие", "Рефлексия", "Администрирование"];

export function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

export async function seedIfEmpty() {
  if (db.data.users.length) return;

  const pass = await bcrypt.hash("123456", 10);
  const now = Date.now();

  db.data.users.push(
    {
      id: "a1", fullName: "Администратор Системы", email: "admin@np.ru", passwordHash: pass,
      role: "admin", subject: "Администрация", school: "ГБОУ Школа №1248", region: "Москва",
      yearsExperience: 8, currentStage: 6, mentorId: null,
      scores: { subject: 0, pedagogy: 0, method: 0, digital: 0, communication: 0, personal: 0 },
      avatarColor: "purple", createdAt: now - 90 * 86400000,
    },
    {
      id: "m1", fullName: "Анна Сергеевна Козлова", email: "mentor@np.ru", passwordHash: pass,
      role: "mentor", subject: "Математика", school: "ГБОУ Школа №1248", region: "Москва",
      yearsExperience: 12, currentStage: 6, mentorId: null,
      scores: { subject: 5, pedagogy: 4, method: 5, digital: 4, communication: 5, personal: 4 },
      avatarColor: "green", createdAt: now - 400 * 86400000,
    },
    {
      id: "u1", fullName: "Михаил Александрович Петров", email: "user@np.ru", passwordHash: pass,
      role: "user", subject: "История", school: "ГБОУ Школа №1248", region: "Москва",
      yearsExperience: 1, currentStage: 3, mentorId: "m1",
      scores: { subject: 3, pedagogy: 2, method: 3, digital: 2, communication: 3, personal: 4 },
      avatarColor: "magenta", createdAt: now - 60 * 86400000,
    }
  );

  db.data.events.push(
    { id: "e1", title: "Вебинар: Управление классом в современной школе", description: "Практические инструменты управления поведением учеников.", date: "15 сентября", time: "18:00", type: "online", area: "pedagogy", region: "Все регионы", url: "", source: "Каталог платформы", createdBy: "a1", completions: {} },
    { id: "e2", title: "Мастер-класс: Цифровые инструменты учителя", description: "Обзор МЭШ, ЦОС и EdTech-инструментов.", date: "20 сентября", time: "16:00", type: "online", area: "digital", region: "Все регионы", url: "", source: "Каталог платформы", createdBy: "a1", completions: {} },
    { id: "e3", title: "Открытый урок: Лучшие методики преподавания", description: "Мастер-класс от победителей конкурса «Учитель года».", date: "28 сентября", time: "10:00", type: "offline", area: "method", region: "Москва", url: "", source: "Каталог платформы", createdBy: "a1", completions: {} },
    { id: "e4", title: "Тренинг: Коммуникация с родителями", description: "Разбор конфликтных ситуаций.", date: "3 октября", time: "17:00", type: "online", area: "communication", region: "Все регионы", url: "", source: "Каталог платформы", createdBy: "a1", completions: {} },
    { id: "e5", title: "Конкурс молодых педагогов Москвы", description: "Городской конкурс для молодых специалистов.", date: "10 октября", time: "09:00", type: "offline", area: "personal", region: "Москва", url: "", source: "Каталог платформы", createdBy: "a1", completions: {} },
    { id: "e6", title: "Курсы ПК: Обновление предметных знаний", description: "Актуальные научные подходы в преподавании предмета.", date: "18 октября", time: "14:00", type: "online", area: "subject", region: "Все регионы", url: "", source: "Каталог платформы", createdBy: "a1", completions: {} },
  );

  const notes = [
    { id: "n1", userId: "u1", title: "Первый урок в 8Б", content: "Провёл первый урок. Дисциплина слабеет к концу — попробую «выходной билет».", category: "Рефлексия" },
    { id: "n2", userId: "u1", title: "Совет наставника по ИКТ", content: "Анна Сергеевна рекомендовала библиотеку МЭШ.", category: "Наставничество" },
  ];
  notes.forEach((n, i) => { n.updatedAt = now - (i + 1) * 86400000; });
  db.data.notes.push(...notes);

  await db.write();
}

export function newId(prefix) { return (prefix || "id") + "_" + uuid().slice(0, 8); }
export { COMPETENCIES as default };

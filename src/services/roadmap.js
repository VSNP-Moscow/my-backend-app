import { COMPETENCIES, db } from "../db.js";
import { callDeepSeek, extractJsonBlock, hasApiKey } from "./deepseek.js";
import { searchMany } from "./websearch.js";

function weakestFirst(scores) {
  return COMPETENCIES.map((c) => ({ comp: c, score: scores[c.id] || 3 })).sort((a, b) => a.score - b.score);
}

function buildQueries(region) {
  return [
    `${region} профсоюз образования мероприятия для молодых педагогов`,
    `${region} школа молодого педагога`,
    `${region} конкурс молодой учитель 2026`,
    `${region} институт развития образования курсы повышения квалификации`,
    `${region} педагогический дебют`,
  ];
}

function offlineRoadmap(user, note) {
  const ranked = weakestFirst(user.scores || {});
  const catalog = db.data.events;
  const priorities = ranked.slice(0, 6).map(({ comp, score }) => ({
    competency: comp.id,
    score,
    events: catalog
      .filter((e) => e.area === comp.id && (e.region === "Все регионы" || e.region === user.region))
      .slice(0, 2)
      .map((e) => ({ title: e.title, date: e.date, url: e.url || "", source: e.source || "Каталог платформы", description: e.description })),
  }));
  return {
    region: user.region || "не указан",
    summary: note || "Офлайн-режим: показаны мероприятия из общего каталога платформы. Чтобы включить поиск реальных мероприятий по региону, администратору нужно указать ключ DeepSeek API на сервере.",
    priorities,
    mode: "offline",
    generatedAt: Date.now(),
  };
}

const ORGANIZE_SYSTEM = `Ты — ИИ-наставник образовательной платформы «НавигаторПедагога» (методология Поляковой Г.Д., МГУ 2022–2023) для молодых педагогов России.

Тебе передан профиль педагога с баллами по 6 компетенциям (1-5, где ≤2 — выраженный дефицит) и список результатов веб-поиска (заголовок, ссылка, короткий сниппет) по запросам про мероприятия для молодых педагогов в конкретном регионе — приоритет отдавался сайтам профсоюза образования, региональных министерств/департаментов образования и институтов развития образования.

ВАЖНО: используй ТОЛЬКО ссылки и факты из переданных результатов поиска. Не придумывай названия, даты или URL, которых нет в списке. Если результаты поиска не релевантны какой-то компетенции или мероприятие непонятно из сниппета — не включай его, оставь пустой список "events" для этой компетенции. Лучше честно показать меньше мероприятий, чем выдумать.

Распредели наиболее релевантные найденные мероприятия по компетенциям (приоритет — дефицитным, с баллом ≤2), максимум 3 мероприятия на компетенцию.

В конце ответа выведи ИСКЛЮЧИТЕЛЬНО валидный JSON в блоке \`\`\`json ... \`\`\` по схеме:
{
  "region": "название региона",
  "summary": "2-3 предложения на русском о том, что удалось найти",
  "priorities": [
    {
      "competency": "id компетенции (subject|pedagogy|method|digital|communication|personal)",
      "score": число,
      "events": [
        { "title": "...", "date": "если известна из сниппета, иначе пусто", "url": "точная ссылка из списка результатов", "source": "домен сайта", "description": "1 предложение своими словами" }
      ]
    }
  ]
}
Перед JSON можешь кратко написать 2-3 предложения по-русски о ходе поиска, но JSON-блок обязателен и должен идти последним.`;

export async function generateRoadmap(user) {
  if (!user.scores || !Object.values(user.scores).some((v) => v > 0)) {
    const err = new Error("NO_SCORES");
    err.code = "NO_SCORES";
    throw err;
  }

  if (!hasApiKey()) {
    const rm = offlineRoadmap(user);
    db.data.roadmaps[user.id] = rm;
    await db.write();
    return rm;
  }

  const region = user.region || "";
  if (!region) {
    const rm = offlineRoadmap(user, "Регион не указан — укажите его в профиле, чтобы включить поиск реальных мероприятий.");
    db.data.roadmaps[user.id] = rm;
    await db.write();
    return rm;
  }

  try {
    const queries = buildQueries(region);
    const searchResults = await searchMany(queries, 5);

    if (!searchResults.length) {
      const rm = offlineRoadmap(user, `Поиск в интернете не дал результатов для региона «${region}» (возможно, поисковик временно ограничивает запросы). Показаны мероприятия из общего каталога.`);
      db.data.roadmaps[user.id] = rm;
      await db.write();
      return rm;
    }

    const ranked = weakestFirst(user.scores);
    const resultsBlock = searchResults
      .slice(0, 30)
      .map((r, i) => `${i + 1}. [${r.title}](${r.url})\n   ${r.snippet}`)
      .join("\n");

    const profileLine =
      `Педагог: ${user.fullName}. Предмет: ${user.subject}. Стаж: ${user.yearsExperience} лет. Регион: ${region}.\n` +
      `Баллы по компетенциям (1-5): ` +
      ranked.map((r) => `${r.comp.label} (${r.comp.id}) = ${r.score}`).join(", ") +
      `.\n\nРезультаты веб-поиска по региону "${region}":\n${resultsBlock}\n\nРаспредели релевантные мероприятия из списка выше по компетенциям согласно инструкции.`;

    const { text } = await callDeepSeek({
      system: ORGANIZE_SYSTEM,
      messages: [{ role: "user", content: profileLine }],
      maxTokens: 2200,
    });

    let parsed = extractJsonBlock(text);

    if (!parsed) {
      const rm = offlineRoadmap(user, "Не удалось получить структурированный ответ от ИИ — показаны мероприятия из общего каталога. Попробуйте обновить карту ещё раз.");
      rm.rawText = text.slice(0, 4000);
      db.data.roadmaps[user.id] = rm;
      await db.write();
      return rm;
    }

    parsed.mode = "live";
    parsed.generatedAt = Date.now();
    parsed.sources = [...new Set(searchResults.map((r) => r.url))].slice(0, 15);
    parsed.rawText = text.slice(0, 4000);
    db.data.roadmaps[user.id] = parsed;
    await db.write();
    return parsed;
  } catch (e) {
    const rm = offlineRoadmap(user, `Не удалось связаться с DeepSeek API (${e.code || e.message}). Показаны мероприятия из общего каталога.`);
    db.data.roadmaps[user.id] = rm;
    await db.write();
    return rm;
  }
}

export function getStoredRoadmap(userId) {
  return db.data.roadmaps[userId] || null;
}

/**
 * Тонкая обёртка над DeepSeek API (OpenAI-совместимый формат chat/completions).
 * Ключ DEEPSEEK_API_KEY читается только из переменных окружения сервера —
 * никогда не передаётся и не хранится на клиенте.
 *
 * В отличие от Claude, у DeepSeek нет встроенного инструмента веб-поиска —
 * поэтому поиск мероприятий реализован отдельно в services/websearch.js,
 * а сюда передаются уже готовые результаты поиска как контекст (RAG-подход).
 */
const MODEL = "deepseek-v4-flash";
const API_URL = "https://api.deepseek.com/chat/completions";

export function hasApiKey() {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

/**
 * @param {object} opts
 * @param {string} opts.system
 * @param {Array<{role:'user'|'assistant', content:string}>} opts.messages
 * @param {number} [opts.maxTokens]
 * @returns {Promise<{text:string}>}
 */
export async function callDeepSeek({ system, messages, maxTokens = 1800, temperature = 0.4 }) {
  if (!hasApiKey()) {
    const err = new Error("NO_API_KEY");
    err.code = "NO_API_KEY";
    throw err;
  }

  const body = {
    model: MODEL,
    messages: [{ role: "system", content: system }, ...messages],
    max_tokens: maxTokens,
    temperature,
    stream: false,
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + process.env.DEEPSEEK_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const err = new Error(`DeepSeek API HTTP ${res.status}: ${errText.slice(0, 300)}`);
    err.code = "API_ERROR";
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  return { text, raw: data };
}

/** Extracts the last ```json ... ``` fenced block from a text response. */
export function extractJsonBlock(text) {
  if (!text) return null;
  const matches = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)];
  if (!matches.length) return null;
  const last = matches[matches.length - 1][1];
  try {
    return JSON.parse(last);
  } catch (e) {
    return null;
  }
}

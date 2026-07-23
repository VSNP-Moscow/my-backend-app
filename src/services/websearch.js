/**
 * Простой веб-поиск без отдельного платного API — использует HTML-версию
 * DuckDuckGo (https://html.duckduckgo.com/html/), которая не требует ключа.
 *
 * Это best-effort решение: DuckDuckGo может ограничивать частоту запросов
 * или менять разметку страницы. Если у вас есть ключ от специализированного
 * поискового API (Tavily, Serper, Bing Search) — замените функцию search()
 * ниже на вызов этого API для более надёжного результата.
 */
import * as cheerio from "cheerio";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function decodeDdgUrl(href) {
  if (!href) return "";
  try {
    if (href.startsWith("//duckduckgo.com/l/")) {
      const u = new URL("https:" + href);
      return u.searchParams.get("uddg") || href;
    }
    if (href.startsWith("/l/?")) {
      const u = new URL("https://duckduckgo.com" + href);
      return u.searchParams.get("uddg") || href;
    }
    return href;
  } catch (e) {
    return href;
  }
}

/**
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array<{title:string, url:string, snippet:string}>>}
 */
export async function search(query, limit = 6) {
  const url = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
  let res;
  try {
    res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ru-RU,ru;q=0.9,en;q=0.8",
      },
    });
  } catch (e) {
    return [];
  }
  if (!res.ok) return [];
  const html = await res.text();
  const $ = cheerio.load(html);
  const results = [];
  $(".result").each((i, el) => {
    if (results.length >= limit) return;
    const a = $(el).find("a.result__a").first();
    const title = a.text().trim();
    const href = decodeDdgUrl(a.attr("href"));
    const snippet = $(el).find(".result__snippet").text().trim();
    if (title && href && href.startsWith("http")) {
      results.push({ title, url: href, snippet });
    }
  });
  return results;
}

/**
 * Runs several queries in sequence (polite delay to avoid rate-limiting),
 * dedupes by URL, and returns a flat combined list.
 * @param {string[]} queries
 * @param {number} perQueryLimit
 */
export async function searchMany(queries, perQueryLimit = 5) {
  const seen = new Set();
  const all = [];
  for (const q of queries) {
    const results = await search(q, perQueryLimit);
    for (const r of results) {
      if (!seen.has(r.url)) {
        seen.add(r.url);
        all.push({ ...r, query: q });
      }
    }
    // small delay between requests to be a polite, less-likely-to-be-blocked client
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return all;
}

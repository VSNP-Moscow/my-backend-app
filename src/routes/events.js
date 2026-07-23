import { Router } from "express";
import { db, newId } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

function withMyCompletion(e, userId) {
  const c = e.completions?.[userId];
  return { ...e, completed: Boolean(c?.completed), reflection: c?.reflection || "" };
}

router.get("/", requireAuth, (req, res) => {
  const { area } = req.query;
  let list = db.data.events;
  if (area && area !== "all") list = list.filter((e) => e.area === area);
  res.json({ events: list.map((e) => withMyCompletion(e, req.user.id)) });
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const { title, description, date, time, type, area, region, url, source } = req.body || {};
  if (!title || !date) return res.status(400).json({ error: "Заполните название и дату" });
  const e = { id: newId("e"), title, description: description || "", date, time: time || "", type: type || "online", area: area || "subject", region: region || "Все регионы", url: url || "", source: source || "Каталог платформы", createdBy: req.user.id, completions: {} };
  db.data.events.push(e);
  await db.write();
  res.json({ event: withMyCompletion(e, req.user.id) });
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const e = db.data.events.find((x) => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: "Не найдено" });
  Object.assign(e, req.body || {}, { id: e.id, completions: e.completions });
  await db.write();
  res.json({ event: withMyCompletion(e, req.user.id) });
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  db.data.events = db.data.events.filter((x) => x.id !== req.params.id);
  await db.write();
  res.json({ ok: true });
});

router.post("/:id/complete", requireAuth, async (req, res) => {
  const e = db.data.events.find((x) => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: "Не найдено" });
  e.completions = e.completions || {};
  e.completions[req.user.id] = { completed: Boolean(req.body?.completed), reflection: req.body?.reflection || "" };
  await db.write();
  res.json({ event: withMyCompletion(e, req.user.id) });
});

export default router;

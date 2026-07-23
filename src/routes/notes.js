import { Router } from "express";
import { db, newId, NOTE_CATS } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, (req, res) => {
  const list = db.data.notes.filter((n) => n.userId === req.user.id).sort((a, b) => b.updatedAt - a.updatedAt);
  res.json({ notes: list, categories: NOTE_CATS });
});

router.post("/", requireAuth, async (req, res) => {
  const { title, content, category } = req.body || {};
  if (!title) return res.status(400).json({ error: "Введите заголовок" });
  const n = { id: newId("n"), userId: req.user.id, title, content: content || "", category: category || "Личное", updatedAt: Date.now() };
  db.data.notes.push(n);
  await db.write();
  res.json({ note: n });
});

router.put("/:id", requireAuth, async (req, res) => {
  const n = db.data.notes.find((x) => x.id === req.params.id && x.userId === req.user.id);
  if (!n) return res.status(404).json({ error: "Не найдено" });
  Object.assign(n, req.body || {}, { id: n.id, userId: n.userId, updatedAt: Date.now() });
  await db.write();
  res.json({ note: n });
});

router.delete("/:id", requireAuth, async (req, res) => {
  db.data.notes = db.data.notes.filter((x) => !(x.id === req.params.id && x.userId === req.user.id));
  await db.write();
  res.json({ ok: true });
});

export default router;

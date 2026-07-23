import { Router } from "express";
import { db, newId } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const threadId = (a, b) => [a, b].sort().join("__");

router.get("/:otherId", requireAuth, (req, res) => {
  const t = threadId(req.user.id, req.params.otherId);
  const list = db.data.messages.filter((m) => m.thread === t).sort((a, b) => a.ts - b.ts);
  res.json({ messages: list });
});

router.post("/:otherId", requireAuth, async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Пустое сообщение" });
  const m = { id: newId("msg"), thread: threadId(req.user.id, req.params.otherId), from: req.user.id, to: req.params.otherId, text, ts: Date.now() };
  db.data.messages.push(m);
  await db.write();
  res.json({ message: m });
});

export default router;

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { startDiagnostic, handleDiagnosticReply, isDiagnosticActive, assistantReply, QUICK_ACTIONS, quickActionText } from "../services/mentor.js";
import { generateRoadmap, getStoredRoadmap } from "../services/roadmap.js";
import { hasApiKey } from "../services/deepseek.js";

const router = Router();

// A diagnostic conversation alone makes a dozen+ small requests, so keep this generous.
// Only the web-search-backed roadmap generation gets a tight limit below.
const aiLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
router.use(aiLimiter);

const roadmapLimiter = rateLimit({ windowMs: 60_000, max: 6, standardHeaders: true, legacyHeaders: false, message: { error: "Слишком много запросов на построение карты — подождите минуту." } });

router.get("/status", requireAuth, (req, res) => {
  res.json({ liveMode: hasApiKey(), quickActions: QUICK_ACTIONS });
});

router.get("/chat", requireAuth, (req, res) => {
  res.json({ messages: db.data.aiChats[req.user.id] || [], diagnosticActive: isDiagnosticActive(req.user.id) });
});

router.post("/diagnostic/start", requireAuth, async (req, res) => {
  const msgs = startDiagnostic(req.user);
  await db.write();
  res.json({ messages: msgs });
});

router.post("/diagnostic/reply", requireAuth, async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Пустой ответ" });
  const history = db.data.aiChats[req.user.id] || [];
  history.push({ role: "user", text });
  const newMsgs = handleDiagnosticReply(req.user, text);
  db.data.aiChats[req.user.id] = history.concat(newMsgs);
  await db.write();
  res.json({ messages: newMsgs, diagnosticActive: isDiagnosticActive(req.user.id) });
});

router.post("/chat", requireAuth, async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Пустое сообщение" });
  const history = db.data.aiChats[req.user.id] || [];
  history.push({ role: "user", text });
  const replyText = await assistantReply(req.user, text, history);
  const newMsgs = [{ role: "ai", text: replyText }];
  db.data.aiChats[req.user.id] = history.concat(newMsgs);
  await db.write();
  res.json({ messages: newMsgs });
});

router.get("/quick-actions", requireAuth, (req, res) => {
  res.json({ actions: QUICK_ACTIONS.map((a) => ({ ...a, prompt: quickActionText(a.id, req.user) })) });
});

// The star feature: web-search-powered, region-aware roadmap.
router.post("/roadmap/generate", requireAuth, roadmapLimiter, async (req, res) => {
  const region = (req.body?.region || req.user.region || "").trim();
  if (!region) return res.status(400).json({ error: "Укажите регион в профиле или в запросе" });
  if (region !== req.user.region) { req.user.region = region; await db.write(); }
  try {
    const rm = await generateRoadmap(req.user);
    res.json({ roadmap: rm });
  } catch (e) {
    if (e.code === "NO_SCORES") return res.status(400).json({ error: "Сначала пройдите диагностику с ИИ-наставником" });
    res.status(500).json({ error: "Не удалось построить карту: " + e.message });
  }
});

router.get("/roadmap", requireAuth, (req, res) => {
  res.json({ roadmap: getStoredRoadmap(req.user.id) });
});

export default router;

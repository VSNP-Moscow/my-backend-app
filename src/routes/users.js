import { Router } from "express";
import { db, publicUser } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.put("/me", requireAuth, async (req, res) => {
  const { fullName, subject, school, region, yearsExperience } = req.body || {};
  const u = req.user;
  if (fullName) u.fullName = fullName;
  if (subject !== undefined) u.subject = subject;
  if (school !== undefined) u.school = school;
  if (region !== undefined) u.region = region;
  if (yearsExperience !== undefined) u.yearsExperience = parseInt(yearsExperience, 10) || 0;
  await db.write();
  res.json({ user: publicUser(u) });
});

// list users by role — admins see everyone; mentors see their own mentees
router.get("/", requireAuth, (req, res) => {
  const { role } = req.query;
  let list = db.data.users;
  if (req.user.role === "mentor") {
    list = list.filter((u) => u.mentorId === req.user.id);
  } else if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Недостаточно прав" });
  }
  if (role) list = list.filter((u) => u.role === role);
  res.json({ users: list.map(publicUser) });
});

router.get("/:id", requireAuth, (req, res) => {
  const u = db.data.users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: "Не найден" });
  const canView = req.user.role === "admin" || req.user.id === u.id || u.mentorId === req.user.id || req.user.mentorId === u.id;
  if (!canView) return res.status(403).json({ error: "Недостаточно прав" });
  res.json({ user: publicUser(u) });
});

router.put("/:id/mentor", requireAuth, requireRole("admin"), async (req, res) => {
  const u = db.data.users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: "Не найден" });
  u.mentorId = req.body?.mentorId || null;
  await db.write();
  res.json({ user: publicUser(u) });
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  db.data.users = db.data.users.filter((x) => x.id !== req.params.id);
  await db.write();
  res.json({ ok: true });
});

export default router;

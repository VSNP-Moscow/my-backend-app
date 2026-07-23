import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, newId, publicUser } from "../db.js";
import { signToken, requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/register", async (req, res) => {
  const { fullName, email, password, subject, region, school, yearsExperience, role } = req.body || {};
  if (!fullName || !email || !password || password.length < 4) {
    return res.status(400).json({ error: "Заполните имя, email и пароль (мин. 4 символа)" });
  }
  const exists = db.data.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (exists) return res.status(409).json({ error: "Пользователь с такой почтой уже существует" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: newId("u"), fullName, email, passwordHash,
    role: role === "mentor" ? "mentor" : "user",
    subject: subject || "", school: school || "", region: region || "",
    yearsExperience: parseInt(yearsExperience, 10) || 0,
    currentStage: 1, mentorId: null,
    scores: { subject: 0, pedagogy: 0, method: 0, digital: 0, communication: 0, personal: 0 },
    avatarColor: ["purple", "magenta", "yellow", "green"][db.data.users.length % 4],
    createdAt: Date.now(),
  };
  db.data.users.push(user);
  await db.write();
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = db.data.users.find((u) => u.email.toLowerCase() === String(email || "").toLowerCase());
  if (!user) return res.status(401).json({ error: "Неверная почта или пароль" });
  const ok = await bcrypt.compare(password || "", user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Неверная почта или пароль" });
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;

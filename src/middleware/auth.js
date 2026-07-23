import jwt from "jsonwebtoken";
import { db } from "../db.js";

const SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";

export function signToken(userId) {
  return jwt.sign({ uid: userId }, SECRET, { expiresIn: "30d" });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Нет токена авторизации" });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.data.users.find((u) => u.id === payload.uid);
    if (!user) return res.status(401).json({ error: "Пользователь не найден" });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Недействительный токен" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Недостаточно прав" });
    next();
  };
}

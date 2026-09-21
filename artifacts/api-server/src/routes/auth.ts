import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router: IRouter = Router();

// For local dev, a hardcoded secret is fine. In production, use env var.
const JWT_SECRET = process.env.JWT_SECRET || "flux-super-secret-key-123";

router.post("/auth/session", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  
  if (!user) {
    const userId = `user-${Date.now()}`;
    await db.insert(usersTable).values({
      id: userId,
      email: email,
      createdAt: new Date(),
    });
    [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

  res.cookie("flux_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ success: true, user: { id: user.id, email: user.email } });
});

router.post("/auth/logout", (req, res) => {
  res.clearCookie("flux_session");
  res.json({ success: true });
});

router.post("/auth/whop-bridge", async (req, res) => {
  // This endpoint would be hit by the frontend to link a Whop token to their account
  // In a real Whop OAuth flow, this would exchange an authorization code.
  // For now, it simply saves the token they have to the database.
  const { whopToken } = req.body;
  const token = req.cookies?.flux_session;
  
  if (!token) return res.status(401).json({ error: "Not logged in" });
  if (!whopToken) return res.status(400).json({ error: "No Whop token provided" });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    await db.update(usersTable).set({ whopToken }).where(eq(usersTable.id, decoded.userId));
    res.json({ success: true });
    return;
  } catch (error) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }
});

export default router;

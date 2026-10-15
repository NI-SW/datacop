import { Router, Request, Response } from "express"
import bcrypt from "bcryptjs"
import { getPool } from "../db/connection.ts"
import { signToken, requireAuth } from "../middleware/auth.ts"

const router = Router()

// Validate current token and return fresh user info (role may have changed)
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const [rows] = await getPool().query(
      "SELECT id, username, role FROM users WHERE id = ?",
      [req.user!.id]
    ) as [any[], any]
    if (rows.length === 0) {
      res.status(401).json({ error: "账号不存在" })
      return
    }
    res.json({ user: rows[0] })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body
  if (!username || !password) {
    res.status(400).json({ error: "用户名和密码不能为空" })
    return
  }
  try {
    const [rows] = await getPool().query("SELECT id, username, password_hash, role FROM users WHERE username = ?", [username]) as [any[], any]
    if (rows.length === 0) {
      res.status(401).json({ error: "用户名或密码错误" })
      return
    }
    const user = rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      res.status(401).json({ error: "用户名或密码错误" })
      return
    }
    const token = signToken({ id: user.id, username: user.username, role: user.role })
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } })
  } catch (e) {
    res.status(500).json({ error: "服务器错误" })
  }
})

router.post("/register", async (req: Request, res: Response) => {
  const { username, password } = req.body
  if (!username || !password) {
    res.status(400).json({ error: "用户名和密码不能为空" })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ error: "密码至少6位" })
    return
  }
  try {
    const [existing] = await getPool().query("SELECT id FROM users WHERE username = ?", [username]) as [any[], any]
    if (existing.length > 0) {
      res.status(409).json({ error: "用户名已存在" })
      return
    }
    const hash = await bcrypt.hash(password, 10)
    await getPool().query("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'user')", [username, hash])
    res.status(201).json({ message: "注册成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

export default router

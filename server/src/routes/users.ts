import { Router, Request, Response } from "express"
import bcrypt from "bcryptjs"
import { getPool } from "../db/connection.ts"
import { requireAuth } from "../middleware/auth.ts"
import { requireRole } from "../middleware/rbac.ts"

const router = Router()

// List all users
router.get("/", requireAuth, requireRole("root", "admin"), async (_req: Request, res: Response) => {
  try {
    const [rows] = await getPool().query("SELECT id, username, role, created_at FROM users ORDER BY created_at DESC") as [any[], any]
    res.json(rows)
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Create user
router.post("/", requireAuth, requireRole("root"), async (req: Request, res: Response) => {
  const { username, password, role } = req.body
  if (!username || !password) {
    res.status(400).json({ error: "用户名和密码不能为空" })
    return
  }
  try {
    const hash = await bcrypt.hash(password, 10)
    const [result] = await getPool().query(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
      [username, hash, role || "user"]
    ) as [any, any]
    res.status(201).json({ id: result.insertId, message: "创建成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Update user
router.put("/:id", requireAuth, requireRole("root"), async (req: Request, res: Response) => {
  const { username, password, role } = req.body
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 10)
      await getPool().query(
        "UPDATE users SET username = COALESCE(?, username), password_hash = ?, role = COALESCE(?, role) WHERE id = ?",
        [username, hash, role, req.params.id]
      )
    } else {
      await getPool().query(
        "UPDATE users SET username = COALESCE(?, username), role = COALESCE(?, role) WHERE id = ?",
        [username, role, req.params.id]
      )
    }
    res.json({ message: "更新成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Delete user
router.delete("/:id", requireAuth, requireRole("root"), async (req: Request, res: Response) => {
  try {
    await getPool().query("DELETE FROM users WHERE id = ?", [req.params.id])
    res.json({ message: "删除成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

export default router

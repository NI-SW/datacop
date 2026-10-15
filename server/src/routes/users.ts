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
  if (password.length < 6) {
    res.status(400).json({ error: "密码至少6位" })
    return
  }
  try {
    const [existing] = await getPool().query(
      "SELECT id FROM users WHERE username = ?",
      [username]
    ) as [any[], any]
    if (existing.length > 0) {
      res.status(409).json({ error: "用户名已存在" })
      return
    }
    const hash = await bcrypt.hash(password, 10)
    const [result] = await getPool().query(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
      [username, hash, role || "user"]
    ) as [any, any]
    res.status(201).json({ id: result.insertId, message: "创建成功" })
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "用户名已存在" })
      return
    }
    res.status(500).json({ error: "服务器错误" })
  }
})

// Update user
router.put("/:id", requireAuth, requireRole("root"), async (req: Request, res: Response) => {
  const { username, password, role } = req.body
  if (password && password.length < 6) {
    res.status(400).json({ error: "密码至少6位" })
    return
  }
  const allowedRoles = ["root", "admin", "operator", "user"]
  if (role && !allowedRoles.includes(role)) {
    res.status(400).json({ error: "无效的角色" })
    return
  }
  const targetId = Number(req.params.id)
  try {
    const [target] = await getPool().query(
      "SELECT id, role FROM users WHERE id = ?",
      [targetId]
    ) as [any[], any]
    if (target.length === 0) {
      res.status(404).json({ error: "用户不存在" })
      return
    }
    // 取消 root 角色前确认还有其他 root，避免把所有人锁在管理功能之外
    if (role && role !== "root" && target[0].role === "root") {
      const [roots] = await getPool().query(
        "SELECT COUNT(*) AS cnt FROM users WHERE role = 'root'"
      ) as [any[], any]
      if (roots[0].cnt <= 1) {
        res.status(400).json({ error: "不能取消最后一个 root 账号的管理员角色" })
        return
      }
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10)
      await getPool().query(
        "UPDATE users SET username = COALESCE(?, username), password_hash = ?, role = COALESCE(?, role) WHERE id = ?",
        [username, hash, role, targetId]
      )
    } else {
      await getPool().query(
        "UPDATE users SET username = COALESCE(?, username), role = COALESCE(?, role) WHERE id = ?",
        [username, role, targetId]
      )
    }
    res.json({ message: "更新成功" })
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "用户名已存在" })
      return
    }
    res.status(500).json({ error: "服务器错误" })
  }
})

// Delete user
router.delete("/:id", requireAuth, requireRole("root"), async (req: Request, res: Response) => {
  const targetId = Number(req.params.id)
  if (targetId === req.user!.id) {
    res.status(400).json({ error: "不能删除当前登录的账号" })
    return
  }
  try {
    const [target] = await getPool().query(
      "SELECT id, role FROM users WHERE id = ?",
      [targetId]
    ) as [any[], any]
    if (target.length === 0) {
      res.status(404).json({ error: "用户不存在" })
      return
    }
    if (target[0].role === "root") {
      const [roots] = await getPool().query(
        "SELECT COUNT(*) AS cnt FROM users WHERE role = 'root'"
      ) as [any[], any]
      if (roots[0].cnt <= 1) {
        res.status(400).json({ error: "不能删除最后一个 root 账号" })
        return
      }
    }
    await getPool().query("DELETE FROM users WHERE id = ?", [targetId])
    res.json({ message: "删除成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

export default router

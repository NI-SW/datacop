import { Router, Request, Response } from "express"
import crypto from "crypto"
import { getPool } from "../db/connection.ts"
import { requireAuth } from "../middleware/auth.ts"
import { requireRole } from "../middleware/rbac.ts"

const router = Router()

function generateApiKey(): string {
  return "dck_" + crypto.randomBytes(24).toString("hex")
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex")
}

// List all MCP API keys (without exposing the actual key)
router.get("/", requireAuth, requireRole("root", "admin"), async (_req: Request, res: Response) => {
  try {
    const [rows] = await getPool().query(
      `SELECT k.id, k.name, k.key_prefix, k.user_id, k.enabled, k.created_at, k.last_used_at, k.updated_at,
              u.username AS bound_username, u.role AS bound_role
       FROM mcp_api_keys k
       LEFT JOIN users u ON k.user_id = u.id
       ORDER BY k.created_at DESC`
    ) as [any[], any]
    res.json(rows)
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Create a new MCP API key — returns the plaintext key ONCE
router.post("/", requireAuth, requireRole("root"), async (req: Request, res: Response) => {
  const { name, userId } = req.body
  if (!name || !userId) {
    res.status(400).json({ error: "名称和绑定用户不能为空" })
    return
  }
  try {
    // Verify user exists
    const [userRows] = await getPool().query("SELECT id FROM users WHERE id = ?", [userId]) as [any[], any]
    if (userRows.length === 0) {
      res.status(400).json({ error: "绑定的用户不存在" })
      return
    }
    const rawKey = generateApiKey()
    const hash = sha256(rawKey)
    const prefix = rawKey.slice(0, 12)
    const [result] = await getPool().query(
      "INSERT INTO mcp_api_keys (name, key_hash, key_prefix, user_id) VALUES (?, ?, ?, ?)",
      [name, hash, prefix, userId]
    ) as [any, any]
    res.status(201).json({ id: result.insertId, key: rawKey, keyPrefix: prefix, message: "创建成功，请妥善保管密钥（仅显示一次）" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Update a key (rename / enable-disable / rebind user)
router.put("/:id", requireAuth, requireRole("root"), async (req: Request, res: Response) => {
  const { name, userId, enabled } = req.body
  try {
    if (userId !== undefined) {
      const [userRows] = await getPool().query("SELECT id FROM users WHERE id = ?", [userId]) as [any[], any]
      if (userRows.length === 0) {
        res.status(400).json({ error: "绑定的用户不存在" })
        return
      }
    }
    await getPool().query(
      "UPDATE mcp_api_keys SET name = COALESCE(?, name), user_id = COALESCE(?, user_id), enabled = COALESCE(?, enabled) WHERE id = ?",
      [name, userId, enabled, req.params.id]
    )
    res.json({ message: "更新成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Delete a key
router.delete("/:id", requireAuth, requireRole("root"), async (req: Request, res: Response) => {
  try {
    await getPool().query("DELETE FROM mcp_api_keys WHERE id = ?", [req.params.id])
    res.json({ message: "删除成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

export default router

import { Router, Request, Response } from "express"
import { getPool } from "../db/connection.ts"
import { requireAuth } from "../middleware/auth.ts"
import { requireRole } from "../middleware/rbac.ts"

const router = Router()

router.get("/", requireAuth, requireRole("root"), async (_req: Request, res: Response) => {
  try {
    const [rows] = await getPool().query("SELECT * FROM system_settings") as [any[], any]
    res.json(rows)
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

router.put("/", requireAuth, requireRole("root"), async (req: Request, res: Response) => {
  const { key, value } = req.body
  if (!key) {
    res.status(400).json({ error: "缺少key" })
    return
  }
  try {
    await getPool().query(
      "INSERT INTO system_settings (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
      [key, value]
    )
    res.json({ message: "设置已更新" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

export default router

import { Router, Request, Response } from "express"
import { getPool } from "../db/connection.ts"
import { requireAuth } from "../middleware/auth.ts"
import { requireRole, requireProjectRead } from "../middleware/rbac.ts"

const router = Router()

// List projects visible to current user
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role === "root" || req.user!.role === "admin") {
      const [rows] = await getPool().query("SELECT * FROM projects ORDER BY created_at DESC") as [any[], any]
      res.json(rows)
      return
    }
    const [rows] = await getPool().query(
      `SELECT DISTINCT p.* FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ?
       WHERE pm.user_id IS NOT NULL OR p.operator_id = ?`,
      [req.user!.id, req.user!.id]
    ) as [any[], any]
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Create project
router.post("/", requireAuth, requireRole("root", "admin"), async (req: Request, res: Response) => {
  const { name, description, operator_id } = req.body
  if (!name) {
    res.status(400).json({ error: "项目名称不能为空" })
    return
  }
  try {
    const [result] = await getPool().query(
      "INSERT INTO projects (name, description, operator_id) VALUES (?, ?, ?)",
      [name, description || null, operator_id || null]
    ) as [any, any]
    res.status(201).json({ id: result.insertId, message: "创建成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Get single project
router.get("/:id", requireAuth, requireProjectRead, async (req: Request, res: Response) => {
  try {
    const [rows] = await getPool().query("SELECT * FROM projects WHERE id = ?", [req.params.id]) as [any[], any]
    if (rows.length === 0) {
      res.status(404).json({ error: "项目不存在" })
      return
    }
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Update project
router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const { name, description, operator_id } = req.body
  try {
    if (req.user!.role !== "root" && req.user!.role !== "admin") {
      const [pm] = await getPool().query(
        "SELECT role FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'operator'",
        [req.params.id, req.user!.id]
      ) as [any[], any]
      if (pm.length === 0) {
        res.status(403).json({ error: "无权修改该项目" })
        return
      }
    }
    await getPool().query(
      "UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description), operator_id = COALESCE(?, operator_id) WHERE id = ?",
      [name, description, operator_id, req.params.id]
    )
    res.json({ message: "更新成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Delete project
router.delete("/:id", requireAuth, requireRole("root"), async (req: Request, res: Response) => {
  try {
    await getPool().query("DELETE FROM projects WHERE id = ?", [req.params.id])
    res.json({ message: "删除成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Add project member
router.post("/:projectId/members", requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params
  const { user_id, role } = req.body
  if (!user_id) {
    res.status(400).json({ error: "缺少用户ID" })
    return
  }
  try {
    // check auth: root/admin or project operator
    if (req.user!.role !== "root" && req.user!.role !== "admin") {
      const [pm] = await getPool().query(
        "SELECT role FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'operator'",
        [projectId, req.user!.id]
      ) as [any[], any]
      if (pm.length === 0) {
        res.status(403).json({ error: "无权管理项目成员" })
        return
      }
    }
    await getPool().query(
      "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)",
      [projectId, user_id, role || "user"]
    )
    res.json({ message: "成员添加成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Remove project member
router.delete("/:projectId/members/:userId", requireAuth, async (req: Request, res: Response) => {
  const { projectId, userId } = req.params
  try {
    if (req.user!.role !== "root" && req.user!.role !== "admin") {
      const [pm] = await getPool().query(
        "SELECT role FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'operator'",
        [projectId, req.user!.id]
      ) as [any[], any]
      if (pm.length === 0) {
        res.status(403).json({ error: "无权管理项目成员" })
        return
      }
    }
    await getPool().query(
      "DELETE FROM project_members WHERE project_id = ? AND user_id = ?",
      [projectId, userId]
    )
    res.json({ message: "成员移除成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Get project members
router.get("/:projectId/members", requireAuth, requireProjectRead, async (req: Request, res: Response) => {
  try {
    const [rows] = await getPool().query(
      `SELECT u.id, u.username, u.role, pm.role as project_role, pm.created_at
       FROM project_members pm JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = ?`,
      [req.params.projectId]
    ) as [any[], any]
    res.json(rows)
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

export default router

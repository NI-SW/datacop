import { Router, Request, Response } from "express"
import { getPool } from "../db/connection.ts"
import { requireAuth } from "../middleware/auth.ts"
import { requireProjectRead, requireProjectWrite } from "../middleware/rbac.ts"

const router = Router()

// List problems with optional search and status filter
router.get("/:projectId/problems", requireAuth, requireProjectRead, async (req: Request, res: Response) => {
  try {
    const { q, field, status } = req.query
    let sql = "SELECT * FROM problems WHERE project_id = ?"
    const params: any[] = [req.params.projectId]

    // status filter
    if (status && typeof status === "string" && ["pending", "valid"].includes(status)) {
      sql += " AND status = ?"
      params.push(status)
    }

    if (q && typeof q === "string" && q.trim()) {
      const keyword = `%${q.trim()}%`
      if (field && typeof field === "string" && ["name", "description", "scenario", "trigger_method", "symptoms", "cause", "solution", "verification", "notes"].includes(field)) {
        sql += ` AND ${field} LIKE ?`
        params.push(keyword)
      } else {
        sql += ` AND (name LIKE ? OR description LIKE ? OR scenario LIKE ? OR trigger_method LIKE ? OR symptoms LIKE ? OR cause LIKE ? OR solution LIKE ? OR verification LIKE ? OR notes LIKE ?)`
        params.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword, keyword, keyword)
      }
    }

    sql += " ORDER BY created_at DESC"
    const [rows] = await getPool().query(sql, params) as [any[], any]
    res.json(rows)
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Create problem
router.post("/:projectId/problems", requireAuth, requireProjectWrite, async (req: Request, res: Response) => {
  const { name, description, scenario, trigger_method, symptoms, cause, solution, verification, notes } = req.body
  if (!name) {
    res.status(400).json({ error: "问题名称不能为空" })
    return
  }
  try {
    const [result] = await getPool().query(
      `INSERT INTO problems (project_id, name, description, scenario, trigger_method, symptoms, cause, solution, verification, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.projectId, name, description, scenario, trigger_method, symptoms, cause, solution, verification, notes, req.user!.id]
    ) as [any, any]
    res.status(201).json({ id: result.insertId, message: "问题上传成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Get single problem
router.get("/:projectId/problems/:id", requireAuth, requireProjectRead, async (req: Request, res: Response) => {
  try {
    const [rows] = await getPool().query(
      "SELECT * FROM problems WHERE id = ? AND project_id = ?",
      [req.params.id, req.params.projectId]
    ) as [any[], any]
    if (rows.length === 0) {
      res.status(404).json({ error: "问题不存在" })
      return
    }
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Update problem
router.put("/:projectId/problems/:id", requireAuth, requireProjectWrite, async (req: Request, res: Response) => {
  const { name, description, scenario, trigger_method, symptoms, cause, solution, verification, notes } = req.body
  try {
    await getPool().query(
      `UPDATE problems SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        scenario = COALESCE(?, scenario),
        trigger_method = COALESCE(?, trigger_method),
        symptoms = COALESCE(?, symptoms),
        cause = COALESCE(?, cause),
        solution = COALESCE(?, solution),
        verification = COALESCE(?, verification),
        notes = COALESCE(?, notes)
       WHERE id = ? AND project_id = ?`,
      [name, description, scenario, trigger_method, symptoms, cause, solution, verification, notes, req.params.id, req.params.projectId]
    )
    res.json({ message: "问题更新成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Update problem status
router.patch("/:projectId/problems/:id/status", requireAuth, requireProjectWrite, async (req: Request, res: Response) => {
  const { status } = req.body
  if (!status || !["pending", "valid"].includes(status)) {
    res.status(400).json({ error: "无效的状态" })
    return
  }
  try {
    const [result] = await getPool().query(
      "UPDATE problems SET status = ? WHERE id = ? AND project_id = ?",
      [status, req.params.id, req.params.projectId]
    ) as [any, any]
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "问题不存在" })
      return
    }
    res.json({ message: status === "valid" ? "已保留" : "已设为待定" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Delete single problem
router.delete("/:projectId/problems/:id", requireAuth, requireProjectWrite, async (req: Request, res: Response) => {
  try {
    await getPool().query(
      "DELETE FROM problems WHERE id = ? AND project_id = ?",
      [req.params.id, req.params.projectId]
    )
    res.json({ message: "删除成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Batch import problems
router.post("/:projectId/problems/import", requireAuth, requireProjectWrite, async (req: Request, res: Response) => {
  const { problems } = req.body
  if (!problems || !Array.isArray(problems) || problems.length === 0) {
    res.status(400).json({ error: "请选择要导入的问题" })
    return
  }
  try {
    let imported = 0
    for (const p of problems) {
      if (!p.name) continue
      await getPool().query(
        `INSERT INTO problems (project_id, name, description, scenario, trigger_method, symptoms, cause, solution, verification, notes, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.params.projectId,
          p.name,
          p.description || null,
          p.scenario || null,
          p.trigger_method || null,
          p.symptoms || null,
          p.cause || null,
          p.solution || null,
          p.verification || null,
          p.notes || null,
          p.status || "pending",
          req.user!.id,
        ]
      )
      imported++
    }
    res.status(201).json({ message: `成功导入 ${imported} 个问题` })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Batch delete problems
router.delete("/:projectId/problems", requireAuth, requireProjectWrite, async (req: Request, res: Response) => {
  const { ids } = req.body
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "请选择要删除的问题" })
    return
  }
  try {
    const placeholders = ids.map(() => "?").join(",")
    await getPool().query(
      `DELETE FROM problems WHERE id IN (${placeholders}) AND project_id = ?`,
      [...ids, req.params.projectId]
    )
    res.json({ message: `已删除 ${ids.length} 个问题` })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

export default router

import { Router, Request, Response } from "express"
import { getPool } from "../db/connection.ts"
import { requireAuth } from "../middleware/auth.ts"
import { requireRole, requireProjectRead, requireProjectWrite } from "../middleware/rbac.ts"

const router = Router()

const SEARCHABLE_FIELDS = ["name", "description", "scenario", "trigger_method", "symptoms", "cause", "solution", "verification", "notes"]

// List problems with optional search, status filter, sorting and pagination
// Pagination is opt-in: pass page/pageSize to get { items, total, page, pageSize },
// otherwise the full array is returned (used by export).
router.get("/:projectId/problems", requireAuth, requireProjectRead, async (req: Request, res: Response) => {
  try {
    const { q, field, status, page, pageSize, sort, order } = req.query
    // 关联 users 以便前端展示创建者；problems/users 都有 id/created_at，故列名必须带 p. 前缀
    let sql = `SELECT p.*, u.username AS created_by_username
       FROM problems p LEFT JOIN users u ON u.id = p.created_by
       WHERE p.project_id = ?`
    let countSql = "SELECT COUNT(*) AS total FROM problems WHERE project_id = ?"
    const params: any[] = [req.params.projectId]

    // status filter
    if (status && typeof status === "string" && ["pending", "valid"].includes(status)) {
      sql += " AND status = ?"
      countSql += " AND status = ?"
      params.push(status)
    }

    if (q && typeof q === "string" && q.trim()) {
      // 按空白拆词，每个词都要命中（AND），词内再按字段匹配（OR）
      const terms = q.trim().split(/\s+/)
      const useField = field && typeof field === "string" && SEARCHABLE_FIELDS.includes(field)
      for (const term of terms) {
        // 转义 LIKE 通配符，避免 % 和 _ 被当作通配符匹配全部记录
        const keyword = `%${term.replace(/[\\%_]/g, (m) => "\\" + m)}%`
        if (useField) {
          sql += ` AND ${field} LIKE ?`
          countSql += ` AND ${field} LIKE ?`
          params.push(keyword)
        } else {
          const clause = ` AND (${SEARCHABLE_FIELDS.map((f) => `${f} LIKE ?`).join(" OR ")})`
          sql += clause
          countSql += clause
          params.push(...SEARCHABLE_FIELDS.map(() => keyword))
        }
      }
    }

    const sortWhitelist = ["created_at", "updated_at", "name"]
    const sortCol = sort && typeof sort === "string" && sortWhitelist.includes(sort) ? sort : "created_at"
    const sortOrder = order === "asc" ? "ASC" : "DESC"
    sql += ` ORDER BY p.${sortCol} ${sortOrder}, p.id DESC`

    const paginated = page !== undefined || pageSize !== undefined
    if (paginated) {
      const size = Math.min(Math.max(Number(pageSize) || 20, 1), 100)
      const offset = (Math.max(Number(page) || 1, 1) - 1) * size
      sql += " LIMIT ? OFFSET ?"
      const [rows] = await getPool().query(sql, [...params, size, offset]) as [any[], any]
      const [countRows] = await getPool().query(countSql, params) as [any[], any]
      res.json({ items: rows, total: countRows[0].total, page: Math.floor(offset / size) + 1, pageSize: size })
      return
    }

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
      `SELECT p.*, u.username AS created_by_username
       FROM problems p LEFT JOIN users u ON u.id = p.created_by
       WHERE p.id = ? AND p.project_id = ?`,
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

// Move problem to different project (root only)
router.patch("/:projectId/problems/:id/project", requireAuth, requireRole("root"), async (req: Request, res: Response) => {
  const { project_id } = req.body
  if (!project_id) {
    res.status(400).json({ error: "缺少目标项目ID" })
    return
  }
  try {
    const [proj] = await getPool().query("SELECT id FROM projects WHERE id = ?", [project_id]) as [any[], any]
    if (proj.length === 0) {
      res.status(404).json({ error: "目标项目不存在" })
      return
    }
    const [result] = await getPool().query(
      "UPDATE problems SET project_id = ? WHERE id = ? AND project_id = ?",
      [project_id, req.params.id, req.params.projectId]
    ) as [any, any]
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "问题不存在" })
      return
    }
    res.json({ message: "已移动到目标项目" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Batch move problems to different project (root only)
router.patch("/:projectId/problems/project", requireAuth, requireRole("root"), async (req: Request, res: Response) => {
  const { ids, project_id } = req.body
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "请选择要移动的问题" })
    return
  }
  if (!project_id) {
    res.status(400).json({ error: "缺少目标项目ID" })
    return
  }
  try {
    const [proj] = await getPool().query("SELECT id FROM projects WHERE id = ?", [project_id]) as [any[], any]
    if (proj.length === 0) {
      res.status(404).json({ error: "目标项目不存在" })
      return
    }
    const placeholders = ids.map(() => "?").join(",")
    const [result] = await getPool().query(
      `UPDATE problems SET project_id = ? WHERE id IN (${placeholders}) AND project_id = ?`,
      [project_id, ...ids, req.params.projectId]
    ) as [any, any]
    res.json({ message: `已移动 ${result.affectedRows} 个问题到目标项目` })
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

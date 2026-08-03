import { Router, Request, Response } from "express"
import bcrypt from "bcryptjs"
import { getPool } from "../db/connection.ts"
import { requireAuth } from "../middleware/auth.ts"
import { requireRole, requireProjectRead } from "../middleware/rbac.ts"

const router = Router()

const DEFAULT_IMPORT_PASSWORD = "Info@1234"

// List projects visible to current user
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const countSubs = `,
      (SELECT COUNT(*) FROM problems WHERE project_id = p.id AND status = 'pending') AS pending_count,
      (SELECT COUNT(*) FROM problems WHERE project_id = p.id AND status = 'valid') AS valid_count`
    if (req.user!.role === "root" || req.user!.role === "admin") {
      const [rows] = await getPool().query(`SELECT p.*${countSubs} FROM projects p ORDER BY p.created_at DESC`) as [any[], any]
      res.json(rows)
      return
    }
    const [rows] = await getPool().query(
      `SELECT DISTINCT p.*${countSubs} FROM projects p
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

// Batch export problems of selected projects (root/admin)
router.get("/export/problems", requireAuth, requireRole("root", "admin"), async (req: Request, res: Response) => {
  try {
    const idsParam = typeof req.query.ids === "string" ? req.query.ids : ""
    const ids = idsParam.split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0)
    if (ids.length === 0) {
      res.status(400).json({ error: "请选择要导出的项目" })
      return
    }
    const placeholders = ids.map(() => "?").join(",")
    const [projects] = await getPool().query(
      `SELECT p.id, p.name, p.description, p.operator_id, u.username AS operator_username, u.role AS operator_role
       FROM projects p LEFT JOIN users u ON u.id = p.operator_id
       WHERE p.id IN (${placeholders}) ORDER BY p.id`,
      ids
    ) as [any[], any]
    const data: any[] = []
    for (const p of projects) {
      const [problems] = await getPool().query(
        `SELECT id, name, description, scenario, trigger_method, symptoms, cause, solution, verification, notes, status, created_at
         FROM problems WHERE project_id = ? ORDER BY created_at DESC`,
        [p.id]
      ) as [any[], any]
      data.push({
        id: p.id,
        name: p.name,
        description: p.description,
        operator_id: p.operator_id,
        operator_username: p.operator_username,
        operator_role: p.operator_role,
        problems,
      })
    }
    res.json({ projects: data })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Batch import projects (root only): auto-creates users with default password when missing
router.post("/import", requireAuth, requireRole("root"), async (req: Request, res: Response) => {
  const { projects } = req.body
  if (!Array.isArray(projects) || projects.length === 0) {
    res.status(400).json({ error: "导入文件中没有项目数据" })
    return
  }
  try {
    const results: any[] = []
    const createdUsers: string[] = []
    const reusedUsers: string[] = []
    let importedProjects = 0
    let importedProblems = 0

    for (const item of projects) {
      const name = String(item?.name || "").trim()
      if (!name) continue
      try {
        const opUsername = String(
          item.operator_username ||
          (typeof item.operator === "string" ? item.operator : item.operator?.username) || ""
        ).trim()
        const opPassword = String(
          typeof item.operator === "object" && item.operator ? item.operator.password || "" : ""
        ).trim() || DEFAULT_IMPORT_PASSWORD

        // Role to apply when creating a new user: from export (operator_role / operator.role), default 'operator'
        const opRole = String(
          item.operator_role ||
          (typeof item.operator === "object" && item.operator ? item.operator.role || "" : "") ||
          ""
        ).trim() || "operator"
        const allowedRoles = ["root", "admin", "operator", "user"]
        const role = allowedRoles.includes(opRole) ? opRole : "operator"

        let operatorId: number | null = null
        let userCreated = false
        if (opUsername) {
          const [existing] = await getPool().query("SELECT id FROM users WHERE username = ?", [opUsername]) as [any[], any]
          if (existing.length > 0) {
            operatorId = existing[0].id
            reusedUsers.push(opUsername)
          } else {
            const hash = await bcrypt.hash(opPassword, 10)
            const [userResult] = await getPool().query(
              "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
              [opUsername, hash, role]
            ) as [any, any]
            operatorId = userResult.insertId
            createdUsers.push(opUsername)
            userCreated = true
          }
        }

        const [projResult] = await getPool().query(
          "INSERT INTO projects (name, description, operator_id) VALUES (?, ?, ?)",
          [name, item.description || null, operatorId]
        ) as [any, any]
        const projectId = projResult.insertId
        importedProjects++

        if (operatorId) {
          await getPool().query(
            "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'operator') ON DUPLICATE KEY UPDATE role = 'operator'",
            [projectId, operatorId]
          )
        }

        if (Array.isArray(item.problems)) {
          for (const p of item.problems) {
            if (!p?.name) continue
            const status = p.status === "valid" ? "valid" : "pending"
            await getPool().query(
              `INSERT INTO problems (project_id, name, description, scenario, trigger_method, symptoms, cause, solution, verification, notes, status, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [projectId, p.name, p.description || null, p.scenario || null, p.trigger_method || null, p.symptoms || null, p.cause || null, p.solution || null, p.verification || null, p.notes || null, status, operatorId || req.user!.id]
            )
            importedProblems++
          }
        }

        results.push({ name, project_id: projectId, operator_username: opUsername || null, user_created: userCreated })
      } catch {
        results.push({ name, error: "导入失败" })
      }
    }

    res.status(201).json({
      message: `成功导入 ${importedProjects} 个项目、${importedProblems} 个问题`,
      created_users: createdUsers,
      reused_users: reusedUsers,
      imported_projects: importedProjects,
      imported_problems: importedProblems,
      results,
    })
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

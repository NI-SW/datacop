import { Request, Response, NextFunction } from "express"
import { getPool } from "../db/connection.ts"

type Role = "root" | "admin" | "operator" | "user"

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "未登录" })
      return
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "权限不足" })
      return
    }
    next()
  }
}

// root, admin pass through; operator/user must be project member with read access
export function requireProjectRead(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "未登录" })
    return
  }
  if (req.user.role === "root" || req.user.role === "admin") {
    next()
    return
  }
  checkProjectMember(req, res, next, false)
}

// root, admin pass through; operator could write; user cannot write
export function requireProjectWrite(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "未登录" })
    return
  }
  if (req.user.role === "root" || req.user.role === "admin") {
    next()
    return
  }
  checkProjectMember(req, res, next, true)
}

async function checkProjectMember(req: Request, res: Response, next: NextFunction, requireWrite: boolean) {
  const projectId = req.params.projectId || req.params.id
  if (!projectId) {
    res.status(400).json({ error: "缺少项目ID" })
    return
  }
  try {
    // check if user is the project operator
    const [projRows] = await getPool().query(
      "SELECT operator_id FROM projects WHERE id = ?",
      [projectId]
    ) as [any[], any]

    if (projRows.length > 0 && projRows[0].operator_id === req.user!.id) {
      next()
      return
    }

    // fallback to project_members table
    const [memberRows] = await getPool().query(
      "SELECT role FROM project_members WHERE project_id = ? AND user_id = ?",
      [projectId, req.user!.id]
    ) as [any[], any]

    if (memberRows.length === 0) {
      res.status(403).json({ error: "无权访问该项目" })
      return
    }
    if (requireWrite && memberRows[0].role !== "operator") {
      res.status(403).json({ error: "无权修改该项目内容" })
      return
    }
    next()
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
}

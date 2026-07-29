import jwt from "jsonwebtoken"
import { Request, Response, NextFunction } from "express"

const JWT_SECRET = "datacop-secret-key-2024"

export interface AuthUser {
  id: number
  username: string
  role: "root" | "admin" | "operator" | "user"
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "未登录" })
    return
  }
  try {
    const token = header.slice(7)
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: "登录已过期" })
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "24h" })
}

export { JWT_SECRET }

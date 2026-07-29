import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import api from "../api/client"

interface User {
  id: number
  username: string
  role: "root" | "admin" | "operator" | "user"
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem("user")
    if (token && saved) {
      setUser(JSON.parse(saved))
    }
    setLoading(false)
  }, [])

  const login = async (username: string, password: string) => {
    const { data } = await api.post("/auth/login", { username, password })
    localStorage.setItem("token", data.token)
    localStorage.setItem("user", JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
  }

  const register = async (username: string, password: string) => {
    await api.post("/auth/register", { username, password })
  }

  const logout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

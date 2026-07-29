import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function Register() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const nav = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    if (password.length < 6) { setError("密码至少6位"); return }
    if (password !== confirm) { setError("两次密码不一致"); return }
    setLoading(true)
    try {
      await register(username, password)
      setSuccess(true)
      setTimeout(() => nav("/login"), 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || "注册失败")
    }
    setLoading(false)
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)" }}>
      <div style={{ width: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(37,99,235,.3)",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-.02em" }}>DataCop</h1>
          <p style={{ fontSize: 14, color: "var(--gray-500)", marginTop: 4 }}>知识库管理系统</p>
        </div>

        <form onSubmit={handleSubmit} className="card" style={{ padding: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, textAlign: "center", color: "var(--gray-800)" }}>注册账号</h2>
          {success && (
            <div style={{ color: "#15803d", background: "#f0fdf4", padding: "10px 14px", borderRadius: 8, marginBottom: 20, fontSize: 13, border: "1px solid #bbf7d0" }}>
              注册成功，即将跳转登录页...
            </div>
          )}
          {error && (
            <div style={{ color: "#dc2626", background: "#fef2f2", padding: "10px 14px", borderRadius: 8, marginBottom: 20, fontSize: 13, border: "1px solid #fecaca" }}>
              {error}
            </div>
          )}
          <div className="form-group">
            <label>用户名</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="请输入用户名" autoFocus />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少6位" />
          </div>
          <div className="form-group">
            <label>确认密码</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再次输入密码" />
          </div>
          <button type="submit" disabled={loading || success} className="btn btn-primary" style={{ width: "100%", height: 44, fontSize: 15, fontWeight: 600, marginTop: 8 }}>
            {loading ? "注册中..." : "注 册"}
          </button>
          <p style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "var(--gray-500)" }}>
            已有账号？<Link to="/login">立即登录</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

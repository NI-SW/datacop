import { useNavigate, Outlet, Link, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    nav("/login")
  }

  const isAdmin = user?.role === "root" || user?.role === "admin"
  const isRoot = user?.role === "root"

  return (
    <div style={{ minHeight: "100vh", background: "var(--gray-100)" }}>
      <header style={{
        background: "#fff",
        borderBottom: "1px solid var(--gray-200)",
        padding: "0 32px", height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 1px 3px rgba(37,99,235,.3)",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-.01em" }}>DataCop</span>
          </Link>

          <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <NavItem to="/" active={location.pathname === "/"}>项目列表</NavItem>
            {isAdmin && <NavItem to="/admin/projects" active={location.pathname.startsWith("/admin/projects")}>项目管理</NavItem>}
            {isAdmin && <NavItem to="/admin/users" active={location.pathname === "/admin/users"}>用户管理</NavItem>}
            {isAdmin && <NavItem to="/admin/mcp-keys" active={location.pathname === "/admin/mcp-keys"}>密钥管理</NavItem>}
            {isRoot && <NavItem to="/admin/settings" active={location.pathname === "/admin/settings"}>系统设置</NavItem>}
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "5px 12px", borderRadius: 8,
            background: "var(--gray-50)", border: "1px solid var(--gray-200)",
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,.4)",
            }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--gray-700)" }}>{user?.username}</span>
            <span style={{
              padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700,
              background: user?.role === "root" ? "#fef2f2" : user?.role === "admin" ? "#fef3c7" : "#eff6ff",
              color: user?.role === "root" ? "#dc2626" : user?.role === "admin" ? "#d97706" : "#2563eb",
              textTransform: "uppercase", letterSpacing: ".03em",
            }}>{user?.role}</span>
          </div>
          <button onClick={handleLogout} style={{
            background: "transparent", color: "var(--gray-500)", border: "1px solid var(--gray-200)",
            padding: "5px 14px", borderRadius: 6, fontSize: 13, fontWeight: 500,
            transition: "all .15s", cursor: "pointer",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--gray-50)"; e.currentTarget.style.borderColor = "var(--gray-300)"; e.currentTarget.style.color = "var(--gray-700)" }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--gray-200)"; e.currentTarget.style.color = "var(--gray-500)" }}>
            退出登录
          </button>
        </div>
      </header>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 32px" }}>
        <Outlet />
      </main>
    </div>
  )
}

function NavItem({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link to={to} style={{
      color: active ? "var(--primary)" : "var(--gray-500)",
      fontSize: 14, fontWeight: active ? 600 : 400,
      padding: "6px 14px", borderRadius: 6,
      background: active ? "var(--primary-light)" : "transparent",
      textDecoration: "none",
      transition: "all .15s",
    }}
    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "var(--gray-50)"; e.currentTarget.style.color = "var(--gray-700)" } }}
    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--gray-500)" } }}>
      {children}
    </Link>
  )
}

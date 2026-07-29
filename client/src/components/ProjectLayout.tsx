import { useEffect, useState } from "react"
import { useParams, useLocation, Outlet, Link } from "react-router-dom"
import api from "../api/client"

interface Project {
  id: number
  name: string
  description: string
}

export default function ProjectLayout() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/projects/${id}`).then(({ data }) => setProject(data)).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="loading">加载中...</div>

  const isDocs = location.pathname === `/projects/${id}`
  const isProblems = location.pathname.startsWith(`/projects/${id}/problems`)

  return (
    <div>
      <div className="flex-between mb">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Link to="/" style={{ fontSize: 13, color: "var(--gray-400)", textDecoration: "none" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--primary)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--gray-400)"}>
              项目列表
            </Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            <span style={{ fontSize: 13, color: "var(--gray-700)", fontWeight: 500 }}>{project?.name}</span>
          </div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>{project?.name}</h1>
          {project?.description && <p className="text-sm text-muted" style={{ marginTop: 4 }}>{project.description}</p>}
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 24,
        borderBottom: "1px solid var(--gray-200)",
        background: "var(--gray-50)", borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
        padding: "0 8px",
      }}>
        <Tab to={`/projects/${id}`} active={isDocs}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          文件列表
        </Tab>
        <Tab to={`/projects/${id}/problems`} active={isProblems}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          问题列表
        </Tab>
      </div>

      <Outlet />
    </div>
  )
}

function Tab({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link to={to} style={{
      display: "flex", alignItems: "center", gap: 7,
      padding: "12px 20px", fontSize: 14, fontWeight: active ? 600 : 400,
      color: active ? "var(--primary)" : "var(--gray-500)",
      textDecoration: "none", position: "relative",
      borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
      marginBottom: -1,
      transition: "all .15s",
      borderRadius: "var(--radius) var(--radius) 0 0",
    }}
    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = "var(--gray-700)"; e.currentTarget.style.background = "rgba(0,0,0,.03)" } }}
    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = "var(--gray-500)"; e.currentTarget.style.background = "transparent" } }}>
      {children}
    </Link>
  )
}

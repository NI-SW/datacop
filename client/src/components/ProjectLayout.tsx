import { useEffect, useState } from "react"
import { useParams, Outlet, Link } from "react-router-dom"
import api from "../api/client"
import { apiError } from "../api/error"

interface Project {
  id: number
  name: string
  description: string
}

export default function ProjectLayout() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [loadKey, setLoadKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    setLoadError("")
    api.get(`/projects/${id}`)
      .then(({ data }) => setProject(data))
      .catch((err) => setLoadError(apiError(err, "加载项目信息失败")))
      .finally(() => setLoading(false))
  }, [id, loadKey])

  if (loading) return <div className="loading">加载中...</div>

  if (loadError) {
    return (
      <div className="empty">
        <p style={{ marginBottom: 16 }}>{loadError}</p>
        <div className="flex gap-sm" style={{ justifyContent: "center" }}>
          <button onClick={() => setLoadKey((k) => k + 1)} className="btn btn-primary">重试</button>
          <Link to="/" className="btn btn-outline">返回项目列表</Link>
        </div>
      </div>
    )
  }

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

      <Outlet />
    </div>
  )
}

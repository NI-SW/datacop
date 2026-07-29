import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import api from "../api/client"

interface Project {
  id: number
  name: string
  description: string
  operator_id: number | null
  created_at: string
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    api.get("/projects").then(({ data }) => setProjects(data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div>
      <h1 className="page-title">我的项目</h1>
      {projects.length === 0 ? (
        <div className="empty">暂无项目，请联系管理员创建</div>
      ) : (
        <div className="grid-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="card card-hover"
              style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 12 }}
              onClick={() => nav(`/projects/${p.id}`)}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 700, color: "#2563eb", flexShrink: 0,
                }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</h3>
                  <p style={{ fontSize: 13, color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.description || "暂无描述"}
                  </p>
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--gray-100)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--gray-400)" }}>
                <span>{new Date(p.created_at).toLocaleDateString()}</span>
                <span style={{ color: "var(--primary)", fontWeight: 500 }}>进入 →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

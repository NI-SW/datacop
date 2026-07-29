import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import api from "../../api/client"

interface Project {
  id: number
  name: string
  description: string
  operator_id: number | null
  created_at: string
}

interface Member {
  id: number
  username: string
  role: string
  project_role: string
}

interface User {
  id: number
  username: string
  role: string
}

export default function ProjectSettings() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [operatorId, setOperatorId] = useState("")
  const [addUserId, setAddUserId] = useState("")
  const [addRole, setAddRole] = useState("user")
  const [message, setMessage] = useState("")
  const [generating, setGenerating] = useState(false)
  const [indexResult, setIndexResult] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get(`/projects/${id}`),
      api.get(`/projects/${id}/members`),
      api.get("/users"),
    ]).then(([p, m, u]) => {
      setProject(p.data)
      setName(p.data.name)
      setDescription(p.data.description || "")
      setOperatorId(p.data.operator_id?.toString() || "")
      setMembers(m.data)
      setAllUsers(u.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  const handleSaveProject = async () => {
    setSaving(true)
    setMessage("")
    try {
      await api.put(`/projects/${id}`, {
        name,
        description,
        operator_id: operatorId ? Number(operatorId) : null,
      })
      setMessage("项目信息已更新")
    } catch {}
    setSaving(false)
  }

  const handleAddMember = async () => {
    if (!addUserId) return
    try {
      await api.post(`/projects/${id}/members`, { user_id: Number(addUserId), role: addRole })
      setAddUserId("")
      setAddRole("user")
      const { data } = await api.get(`/projects/${id}/members`)
      setMembers(data)
    } catch {}
  }

  const handleRemoveMember = async (userId: number) => {
    if (!confirm("确定移除该成员？")) return
    try {
      await api.delete(`/projects/${id}/members/${userId}`)
      const { data } = await api.get(`/projects/${id}/members`)
      setMembers(data)
    } catch {}
  }

  const handleGenerateIndex = async () => {
    setGenerating(true)
    setIndexResult(null)
    try {
      const { data } = await api.get(`/projects/${id}/generate-index`)
      setIndexResult(`已生成索引，共 ${data.problems} 个问题。路径：${data.path}`)
    } catch (err: any) {
      setIndexResult(`生成失败：${err?.response?.data?.error || "未知错误"}`)
    }
    setGenerating(false)
  }

  // users not yet in the project
  const memberIds = new Set(members.map((m) => m.id))
  const availableUsers = allUsers.filter((u) => !memberIds.has(u.id))

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div>
      <div className="flex-between mb-lg">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>项目设置</h1>
          <p className="text-sm text-muted">{project?.name}</p>
        </div>
        <Link to="/admin/projects" className="btn btn-outline">返回项目管理</Link>
      </div>

      {message && (
        <div style={{ color: "#166534", background: "#f0fdf4", padding: "10px 14px", borderRadius: 8, marginBottom: 20, fontSize: 13, border: "1px solid #bbf7d0" }}>
          {message}
        </div>
      )}

      {/* Basic Info */}
      <div className="card mb" style={{ borderLeft: "3px solid var(--primary)" }}>
        <h3 style={{ marginBottom: 18, fontWeight: 600 }}>基本信息</h3>
        <div className="form-group">
          <label>项目名称</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label>项目描述</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="form-group" style={{ width: 300 }}>
          <label>项目管理员</label>
          <select value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
            <option value="">未设置</option>
            {allUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.username} (ID: {u.id}, {u.role})</option>
            ))}
          </select>
        </div>
        <button onClick={handleSaveProject} disabled={saving} className="btn btn-primary btn-sm">
          {saving ? "保存中..." : "保存修改"}
        </button>
      </div>

      {/* Members */}
      <div className="card mb">
        <h3 style={{ marginBottom: 18, fontWeight: 600 }}>项目成员</h3>

        {members.length === 0 ? (
          <p className="text-sm text-muted" style={{ marginBottom: 16 }}>暂无项目成员（管理员通过 operator_id 关联）</p>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>用户名</th>
                  <th style={{ width: 120 }}>系统角色</th>
                  <th style={{ width: 120 }}>项目角色</th>
                  <th style={{ textAlign: "right" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="text-sm text-muted">{m.id}</td>
                    <td style={{ fontWeight: 500 }}>{m.username}</td>
                    <td>
                      <span style={{
                        padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: m.role === "root" ? "#fef2f2" : m.role === "admin" ? "#fef3c7" : m.role === "operator" ? "#eff6ff" : "#f3f4f6",
                        color: m.role === "root" ? "#991b1b" : m.role === "admin" ? "#92400e" : m.role === "operator" ? "#1e40af" : "#374151",
                      }}>
                        {m.role}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: m.project_role === "operator" ? "#dcfce7" : "#f3f4f6",
                        color: m.project_role === "operator" ? "#166534" : "#374151",
                      }}>
                        {m.project_role}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button onClick={() => handleRemoveMember(m.id)} className="btn btn-danger btn-sm">移除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {availableUsers.length > 0 && (
          <div style={{ borderTop: "1px solid var(--gray-100)", paddingTop: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-600)", marginBottom: 10 }}>添加成员</h4>
            <div className="flex gap" style={{ alignItems: "flex-end" }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>选择用户</label>
                <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
                  <option value="">请选择用户</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.username} (ID: {u.id})</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ width: 130, marginBottom: 0 }}>
                <label>项目角色</label>
                <select value={addRole} onChange={(e) => setAddRole(e.target.value)}>
                  <option value="user">user（只读）</option>
                  <option value="operator">operator（读写）</option>
                </select>
              </div>
              <button onClick={handleAddMember} disabled={!addUserId} className="btn btn-primary btn-sm" style={{ height: 38 }}>添加</button>
            </div>
          </div>
        )}
      </div>

      {/* Index Generation */}
      <div className="card" style={{ borderLeft: "3px solid var(--gray-300)" }}>
        <h3 style={{ marginBottom: 10, fontWeight: 600 }}>Agent 检索索引</h3>
        <p className="text-sm text-muted" style={{ marginBottom: 14 }}>
          为此项目生成 L1（项目索引）和 L2（问题索引）文件，供 Agent 快速检索。
        </p>
        <div className="flex gap" style={{ alignItems: "center" }}>
          <button onClick={handleGenerateIndex} disabled={generating} className="btn btn-outline btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            {generating ? "生成中..." : "生成索引"}
          </button>
          {indexResult && (
            <span style={{ fontSize: 13, color: indexResult.startsWith("已生成") ? "#166534" : "#dc2626" }}>{indexResult}</span>
          )}
        </div>
      </div>
    </div>
  )
}

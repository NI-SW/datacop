import { useEffect, useState, type FormEvent } from "react"
import { useParams, Link } from "react-router-dom"
import api from "../../api/client"
import { apiError } from "../../api/error"
import { useToast } from "../../components/Toast"
import { useConfirm } from "../../components/ConfirmDialog"

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
  const toast = useToast()
  const confirm = useConfirm()
  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [operatorId, setOperatorId] = useState("")
  const [addUserId, setAddUserId] = useState("")
  const [addRole, setAddRole] = useState("user")
  const [loadKey, setLoadKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    setLoadError("")
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
    }).catch((err) => setLoadError(apiError(err, "加载项目设置失败"))).finally(() => setLoading(false))
  }, [id, loadKey])

  const handleSaveProject = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("项目名称不能为空")
      return
    }
    setSaving(true)
    try {
      await api.put(`/projects/${id}`, {
        name,
        description,
        operator_id: operatorId ? Number(operatorId) : null,
      })
      toast.success("项目信息已更新")
    } catch (err) {
      toast.error(apiError(err, "保存失败"))
    }
    setSaving(false)
  }

  const handleAddMember = async () => {
    if (!addUserId) return
    try {
      await api.post(`/projects/${id}/members`, { user_id: Number(addUserId), role: addRole })
      toast.success("成员添加成功")
      setAddUserId("")
      setAddRole("user")
      const { data } = await api.get(`/projects/${id}/members`)
      setMembers(data)
    } catch (err) {
      toast.error(apiError(err, "添加成员失败"))
    }
  }

  const handleRemoveMember = async (member: Member) => {
    const ok = await confirm(`确定把用户"${member.username}"移出该项目？移除后其将无法访问该项目。`, "移除成员")
    if (!ok) return
    try {
      await api.delete(`/projects/${id}/members/${member.id}`)
      toast.success("成员已移除")
      const { data } = await api.get(`/projects/${id}/members`)
      setMembers(data)
    } catch (err) {
      toast.error(apiError(err, "移除成员失败"))
    }
  }

  // users not yet in the project
  const memberIds = new Set(members.map((m) => m.id))
  const availableUsers = allUsers.filter((u) => !memberIds.has(u.id))

  if (loading) return <div className="loading">加载中...</div>

  if (loadError) {
    return (
      <div>
        <div className="flex-between mb-lg">
          <h1 className="page-title">项目设置</h1>
          <Link to="/admin/projects" className="btn btn-outline">返回项目管理</Link>
        </div>
        <div className="empty">
          <p style={{ marginBottom: 16 }}>{loadError}</p>
          <button onClick={() => setLoadKey((k) => k + 1)} className="btn btn-primary">重试</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex-between mb-lg">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>项目设置</h1>
          <p className="text-sm text-muted">{project?.name}</p>
        </div>
        <Link to="/admin/projects" className="btn btn-outline">返回项目管理</Link>
      </div>

      {/* Basic Info */}
      <form onSubmit={handleSaveProject} className="card mb" style={{ borderLeft: "3px solid var(--primary)" }}>
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
        <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
          {saving ? "保存中..." : "保存修改"}
        </button>
      </form>

      {/* Members */}
      <div className="card mb">
        <h3 style={{ marginBottom: 18, fontWeight: 600 }}>项目成员</h3>

        {members.length === 0 ? (
          <p className="text-sm text-muted" style={{ marginBottom: 16 }}>暂无项目成员（管理员通过 operator_id 关联）</p>
        ) : (
          <div className="table-wrap" style={{ marginBottom: 20 }}>
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
                      <button onClick={() => handleRemoveMember(m)} className="btn btn-danger btn-sm">移除</button>
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
    </div>
  )
}

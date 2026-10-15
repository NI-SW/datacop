import { useEffect, useState, type FormEvent } from "react"
import api from "../../api/client"
import { apiError } from "../../api/error"
import { useToast } from "../../components/Toast"
import { useConfirm } from "../../components/ConfirmDialog"
import { useAuth } from "../../context/AuthContext"

interface User {
  id: number
  username: string
  role: string
  created_at: string
}

const ROLES: Record<string, { label: string; color: string }> = {
  root: { label: "ROOT", color: "#dc2626" },
  admin: { label: "ADMIN", color: "#f59e0b" },
  operator: { label: "OPERATOR", color: "#2563eb" },
  user: { label: "USER", color: "#6b7280" },
}

export default function UserManagement() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" })
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ username: "", password: "", role: "" })

  const load = () => {
    api.get("/users")
      .then(({ data }) => setUsers(data))
      .catch((err) => setLoadError(apiError(err, "加载用户列表失败")))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!newUser.username || !newUser.password) {
      toast.error("请填写用户名和密码")
      return
    }
    setCreating(true)
    try {
      await api.post("/users", newUser)
      toast.success("用户创建成功")
      setShowCreate(false)
      setNewUser({ username: "", password: "", role: "user" })
      load()
    } catch (err) {
      toast.error(apiError(err, "创建失败"))
    }
    setCreating(false)
  }

  const handleUpdate = async (id: number) => {
    try {
      await api.put(`/users/${id}`, editForm)
      toast.success("更新成功")
      setEditId(null)
      load()
    } catch (err) {
      toast.error(apiError(err, "更新失败"))
    }
  }

  const handleDelete = async (u: User) => {
    if (u.id === currentUser?.id) {
      toast.error("不能删除当前登录的账号")
      return
    }
    const ok = await confirm(
      `确定删除用户"${u.username}"？该用户创建的问题会保留，绑定的 API 密钥会失效。`,
      "删除用户"
    )
    if (!ok) return
    try {
      await api.delete(`/users/${u.id}`)
      toast.success("删除成功")
      load()
    } catch (err) {
      toast.error(apiError(err, "删除失败"))
    }
  }

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div>
      <div className="flex-between mb-lg">
        <h1 className="page-title">用户管理</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          创建用户
        </button>
      </div>

      {loadError && (
        <div className="card mb" style={{ borderLeft: "3px solid var(--danger)" }}>
          <span style={{ color: "var(--danger)", fontSize: 13 }}>{loadError}</span>
          <button onClick={load} className="btn btn-outline btn-sm" style={{ marginLeft: 12 }}>重试</button>
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="card mb" style={{ borderLeft: "3px solid var(--primary)" }}>
          <h3 style={{ marginBottom: 18, fontWeight: 600 }}>创建新用户</h3>
          <div className="flex gap" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
              <label>用户名</label>
              <input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="输入用户名" autoFocus />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
              <label>密码</label>
              <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="至少6位" />
            </div>
            <div className="form-group" style={{ width: 130 }}>
              <label>角色</label>
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                {Object.keys(ROLES).map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
              </select>
            </div>
            <div className="flex gap-sm" style={{ paddingBottom: 2 }}>
              <button type="submit" disabled={creating} className="btn btn-primary btn-sm">{creating ? "创建中..." : "创建"}</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn btn-outline btn-sm">取消</button>
            </div>
          </div>
        </form>
      )}

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th>用户名</th>
              <th style={{ width: 110 }}>角色</th>
              <th>创建时间</th>
              <th style={{ textAlign: "right" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const roleInfo = ROLES[u.role] || ROLES.user
              const isSelf = u.id === currentUser?.id
              return (
                <tr key={u.id}>
                  <td className="text-sm text-muted">{u.id}</td>
                  <td>
                    {editId === u.id ? (
                      <input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} style={{ width: 130 }} />
                    ) : (
                      <span style={{ fontWeight: 500 }}>
                        {u.username}
                        {isSelf && <span style={{ fontSize: 11, color: "var(--gray-400)", marginLeft: 6 }}>(当前账号)</span>}
                      </span>
                    )}
                  </td>
                  <td>
                    {editId === u.id ? (
                      <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} style={{ width: 110 }}>
                        {Object.keys(ROLES).map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
                      </select>
                    ) : (
                      <span style={{ background: roleInfo.color + "15", color: roleInfo.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: ".03em" }}>
                        {roleInfo.label}
                      </span>
                    )}
                  </td>
                  <td className="text-sm text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ textAlign: "right" }}>
                    {editId === u.id ? (
                      <div className="flex gap-sm" style={{ justifyContent: "flex-end", alignItems: "center" }}>
                        <input type="password" placeholder="新密码（留空不改）" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} style={{ width: 150 }} />
                        <button onClick={() => handleUpdate(u.id)} className="btn btn-primary btn-sm">保存</button>
                        <button onClick={() => setEditId(null)} className="btn btn-outline btn-sm">取消</button>
                      </div>
                    ) : (
                      <div className="flex gap-sm" style={{ justifyContent: "flex-end" }}>
                        <button onClick={() => { setEditId(u.id); setEditForm({ username: u.username, password: "", role: u.role }) }} className="btn btn-outline btn-sm">编辑</button>
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={isSelf}
                          title={isSelf ? "不能删除当前登录的账号" : undefined}
                          className="btn btn-danger btn-sm"
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

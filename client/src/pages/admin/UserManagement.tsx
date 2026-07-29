import { useEffect, useState } from "react"
import api from "../../api/client"

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
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" })
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ username: "", password: "", role: "" })

  const load = () => {
    api.get("/users").then(({ data }) => setUsers(data)).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async () => {
    try {
      await api.post("/users", newUser)
      setShowCreate(false)
      setNewUser({ username: "", password: "", role: "user" })
      load()
    } catch {}
  }

  const handleUpdate = async (id: number) => {
    try {
      await api.put(`/users/${id}`, editForm)
      setEditId(null)
      load()
    } catch {}
  }

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除该用户？")) return
    try { await api.delete(`/users/${id}`); load() } catch {}
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

      {showCreate && (
        <div className="card mb" style={{ borderLeft: "3px solid var(--primary)" }}>
          <h3 style={{ marginBottom: 18, fontWeight: 600 }}>创建新用户</h3>
          <div className="flex gap" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
              <label>用户名</label>
              <input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="输入用户名" />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
              <label>密码</label>
              <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="输入密码" />
            </div>
            <div className="form-group" style={{ width: 130 }}>
              <label>角色</label>
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                {Object.keys(ROLES).map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
              </select>
            </div>
            <div className="flex gap-sm" style={{ paddingBottom: 2 }}>
              <button onClick={handleCreate} className="btn btn-primary btn-sm">创建</button>
              <button onClick={() => setShowCreate(false)} className="btn btn-outline btn-sm">取消</button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
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
              return (
                <tr key={u.id}>
                  <td className="text-sm text-muted">{u.id}</td>
                  <td>
                    {editId === u.id ? (
                      <input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} style={{ width: 130 }} />
                    ) : <span style={{ fontWeight: 500 }}>{u.username}</span>}
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
                        <input type="password" placeholder="新密码" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} style={{ width: 120 }} />
                        <button onClick={() => handleUpdate(u.id)} className="btn btn-primary btn-sm">保存</button>
                        <button onClick={() => setEditId(null)} className="btn btn-outline btn-sm">取消</button>
                      </div>
                    ) : (
                      <div className="flex gap-sm" style={{ justifyContent: "flex-end" }}>
                        <button onClick={() => { setEditId(u.id); setEditForm({ username: u.username, password: "", role: u.role }) }} className="btn btn-outline btn-sm">编辑</button>
                        <button onClick={() => handleDelete(u.id)} className="btn btn-danger btn-sm">删除</button>
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

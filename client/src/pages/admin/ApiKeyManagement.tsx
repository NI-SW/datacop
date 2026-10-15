import { useEffect, useState, type FormEvent } from "react"
import api from "../../api/client"
import { apiError } from "../../api/error"
import { useToast } from "../../components/Toast"
import { useConfirm } from "../../components/ConfirmDialog"
import { copyText } from "../../utils/clipboard"

interface ApiKey {
  id: number
  name: string
  key_prefix: string
  user_id: number
  bound_username: string
  bound_role: string
  enabled: number
  created_at: string
  last_used_at: string | null
}

interface User {
  id: number
  username: string
  role: string
}

export default function ApiKeyManagement() {
  const toast = useToast()
  const confirm = useConfirm()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState({ name: "", userId: "" })
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: "", userId: "", enabled: 1 })

  const load = () => {
    Promise.all([
      api.get("/mcp-keys").then(({ data }) => setKeys(data)).catch((err) => setLoadError(apiError(err, "加载密钥列表失败"))),
      api.get("/users")
        .then(({ data }) => setUsers(data))
        .catch((err) => toast.error(apiError(err, "加载用户列表失败，无法为密钥选择绑定用户"))),
    ]).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!newKey.name.trim() || !newKey.userId) {
      toast.error("请填写密钥名称并选择绑定用户")
      return
    }
    setCreating(true)
    try {
      const { data } = await api.post("/mcp-keys", { name: newKey.name, userId: Number(newKey.userId) })
      setCreatedKey(data.key)
      setCopied(false)
      setShowCreate(false)
      setNewKey({ name: "", userId: "" })
      toast.success("密钥创建成功")
      load()
    } catch (err) {
      toast.error(apiError(err, "创建失败"))
    }
    setCreating(false)
  }

  const handleUpdate = async (id: number) => {
    try {
      await api.put(`/mcp-keys/${id}`, {
        name: editForm.name || undefined,
        userId: editForm.userId ? Number(editForm.userId) : undefined,
        enabled: editForm.enabled,
      })
      toast.success("更新成功")
      setEditId(null)
      load()
    } catch (err) {
      toast.error(apiError(err, "更新失败"))
    }
  }

  const handleDelete = async (k: ApiKey) => {
    const ok = await confirm(`确定删除密钥"${k.name}"？删除后该密钥立即失效且不可恢复。`, "删除密钥")
    if (!ok) return
    try {
      await api.delete(`/mcp-keys/${k.id}`)
      toast.success("密钥已删除")
      load()
    } catch (err) {
      toast.error(apiError(err, "删除失败"))
    }
  }

  const handleToggle = async (k: ApiKey) => {
    const next = k.enabled ? 0 : 1
    try {
      await api.put(`/mcp-keys/${k.id}`, { enabled: next })
      toast.success(next ? "密钥已启用" : "密钥已禁用")
      setKeys((prev) => prev.map((x) => (x.id === k.id ? { ...x, enabled: next } : x)))
    } catch (err) {
      toast.error(apiError(err, "操作失败"))
    }
  }

  const copyToClipboard = async (text: string) => {
    const ok = await copyText(text)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error("复制失败，请手动选择复制")
    }
  }

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div>
      <div className="flex-between mb-lg toolbar-wrap">
        <div>
          <h1 className="page-title">MCP 密钥管理</h1>
          <p className="text-sm text-muted" style={{ marginTop: 4 }}>
            生成 API 密钥用于连接 MCP 服务器。密钥绑定用户身份，可直接作为工具 token 传入，无需 login。
          </p>
        </div>
        <button onClick={() => { setShowCreate(!showCreate); setCreatedKey(null) }} className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          生成密钥
        </button>
      </div>

      {loadError && (
        <div className="card mb" style={{ borderLeft: "3px solid var(--danger)" }}>
          <span style={{ color: "var(--danger)", fontSize: 13 }}>{loadError}</span>
          <button onClick={load} className="btn btn-outline btn-sm" style={{ marginLeft: 12 }}>重试</button>
        </div>
      )}

      {/* 新创建的密钥一次性展示 */}
      {createdKey && (
        <div className="card mb" style={{ borderLeft: "3px solid #22c55e" }}>
          <div className="flex-between">
            <div>
              <h3 style={{ fontWeight: 600, color: "#22c55e" }}>密钥创建成功</h3>
              <p className="text-sm text-muted" style={{ marginTop: 4 }}>请立即复制并妥善保管，此密钥仅显示一次：</p>
            </div>
            <button onClick={() => copyToClipboard(createdKey)} className="btn btn-primary btn-sm">
              {copied ? "已复制" : "复制密钥"}
            </button>
          </div>
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 8,
            background: "var(--gray-50)", border: "1px solid var(--gray-200)",
            fontFamily: "monospace", fontSize: 13, wordBreak: "break-all",
          }}>
            {createdKey}
          </div>
          <div className="text-sm text-muted" style={{ marginTop: 8 }}>
            MCP 客户端配置示例： <code style={{ background: "var(--gray-100)", padding: "2px 6px", borderRadius: 4 }}>headers: {`{ "Authorization": "Bearer ${createdKey.slice(0, 16)}..." }`}</code>
          </div>
        </div>
      )}

      {/* 创建表单 */}
      {showCreate && (
        <form onSubmit={handleCreate} className="card mb" style={{ borderLeft: "3px solid var(--primary)" }}>
          <h3 style={{ marginBottom: 18, fontWeight: 600 }}>生成新密钥</h3>
          <div className="flex gap" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label>密钥名称</label>
              <input value={newKey.name} onChange={(e) => setNewKey({ ...newKey, name: e.target.value })} placeholder="如：我的Claude Code密钥" autoFocus />
            </div>
            <div className="form-group" style={{ width: 180 }}>
              <label>绑定用户</label>
              <select value={newKey.userId} onChange={(e) => setNewKey({ ...newKey, userId: e.target.value })}>
                <option value="">选择用户</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)}
              </select>
            </div>
            <div className="flex gap-sm" style={{ paddingBottom: 2 }}>
              <button type="submit" disabled={creating} className="btn btn-primary btn-sm">{creating ? "生成中..." : "生成"}</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn btn-outline btn-sm">取消</button>
            </div>
          </div>
        </form>
      )}

      {/* 密钥列表 */}
      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th>名称</th>
              <th>密钥前缀</th>
              <th>绑定用户</th>
              <th style={{ width: 80 }}>状态</th>
              <th>创建时间</th>
              <th>最近使用</th>
              <th style={{ textAlign: "right" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-sm text-muted" style={{ textAlign: "center", padding: "32px 0" }}>
                  暂无密钥。当前 MCP 服务器无认证保护，点击「生成密钥」创建第一个密钥后将自动启用认证。
                </td>
              </tr>
            ) : (
              keys.map((k) => (
                <tr key={k.id}>
                  <td className="text-sm text-muted">{k.id}</td>
                  <td>
                    {editId === k.id ? (
                      <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ width: 140 }} />
                    ) : (
                      <span style={{ fontWeight: 500 }}>{k.name}</span>
                    )}
                  </td>
                  <td>
                    <code style={{ fontSize: 12, color: "var(--gray-600)" }}>{k.key_prefix}···</code>
                  </td>
                  <td>
                    {editId === k.id ? (
                      <select value={editForm.userId} onChange={(e) => setEditForm({ ...editForm, userId: e.target.value })} style={{ width: 130 }}>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
                      </select>
                    ) : (
                      <span>
                        {k.bound_username || "-"}
                        {k.bound_role && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: "var(--gray-500)" }}>({k.bound_role})</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td>
                    {editId === k.id ? (
                      <select value={editForm.enabled} onChange={(e) => setEditForm({ ...editForm, enabled: Number(e.target.value) })} style={{ width: 80 }}>
                        <option value={1}>启用</option>
                        <option value={0}>禁用</option>
                      </select>
                    ) : (
                      <button onClick={() => handleToggle(k)} style={{
                        background: k.enabled ? "#22c55e15" : "var(--gray-100)",
                        color: k.enabled ? "#16a34a" : "var(--gray-500)",
                        border: "none", padding: "3px 10px", borderRadius: 20,
                        fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: ".03em",
                      }}>
                        {k.enabled ? "启用" : "禁用"}
                      </button>
                    )}
                  </td>
                  <td className="text-sm text-muted">{new Date(k.created_at).toLocaleDateString()}</td>
                  <td className="text-sm text-muted">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "从未使用"}</td>
                  <td style={{ textAlign: "right" }}>
                    {editId === k.id ? (
                      <div className="flex gap-sm" style={{ justifyContent: "flex-end" }}>
                        <button onClick={() => handleUpdate(k.id)} className="btn btn-primary btn-sm">保存</button>
                        <button onClick={() => setEditId(null)} className="btn btn-outline btn-sm">取消</button>
                      </div>
                    ) : (
                      <div className="flex gap-sm" style={{ justifyContent: "flex-end" }}>
                        <button onClick={() => { setEditId(k.id); setEditForm({ name: k.name, userId: String(k.user_id), enabled: k.enabled }) }} className="btn btn-outline btn-sm">编辑</button>
                        <button onClick={() => handleDelete(k)} className="btn btn-danger btn-sm">删除</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 使用说明 */}
      <div className="card" style={{ background: "var(--gray-50)", marginTop: 16 }}>
        <h3 style={{ fontWeight: 600, marginBottom: 12 }}>使用方式</h3>
        <div className="text-sm" style={{ color: "var(--gray-600)", lineHeight: 1.8 }}>
          <p><strong>1. 连接 MCP 服务器</strong>：在客户端配置中添加 <code style={{ background: "var(--gray-100)", padding: "2px 6px", borderRadius: 4 }}>Authorization: Bearer &lt;你的密钥&gt;</code> 请求头</p>
          <p><strong>2. 免传 token</strong>：密钥已绑定用户身份，服务器自动从请求头获取身份，工具无需传 token 参数</p>
          <p><strong>3. 禁用/删除</strong>：禁用后密钥立即失效（MCP 服务器 30 秒内刷新缓存）；删除后不可恢复</p>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState, type FormEvent } from "react"
import api from "../../api/client"
import { apiError } from "../../api/error"
import { useToast } from "../../components/Toast"
import { useConfirm } from "../../components/ConfirmDialog"

interface Setting {
  id: number
  key_name: string
  value: string
  updated_at: string
}

export default function SystemSettings() {
  const toast = useToast()
  const confirm = useConfirm()
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [newKey, setNewKey] = useState("")
  const [newVal, setNewVal] = useState("")
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editVal, setEditVal] = useState("")

  const load = () => {
    api.get("/settings")
      .then(({ data }) => setSettings(data))
      .catch((err) => setLoadError(apiError(err, "加载设置失败")))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!newKey.trim()) return
    const exists = settings.some((s) => s.key_name === newKey.trim())
    try {
      await api.put("/settings", { key: newKey.trim(), value: newVal })
      toast.success(exists ? "设置已更新" : "设置已添加")
      setNewKey("")
      setNewVal("")
      load()
    } catch (err) {
      toast.error(apiError(err, "保存失败"))
    }
  }

  const handleEditSave = async (key: string) => {
    try {
      await api.put("/settings", { key, value: editVal })
      toast.success("设置已更新")
      setEditKey(null)
      load()
    } catch (err) {
      toast.error(apiError(err, "保存失败"))
    }
  }

  const handleDelete = async (key: string) => {
    const ok = await confirm(`确定删除设置项"${key}"？`, "删除设置")
    if (!ok) return
    try {
      await api.delete(`/settings/${encodeURIComponent(key)}`)
      toast.success("设置已删除")
      load()
    } catch (err) {
      toast.error(apiError(err, "删除失败"))
    }
  }

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div>
      <h1 className="page-title">系统设置</h1>

      {loadError && (
        <div className="card mb" style={{ borderLeft: "3px solid var(--danger)" }}>
          <span style={{ color: "var(--danger)", fontSize: 13 }}>{loadError}</span>
          <button onClick={load} className="btn btn-outline btn-sm" style={{ marginLeft: 12 }}>重试</button>
        </div>
      )}

      <form onSubmit={handleSave} className="card mb" style={{ borderLeft: "3px solid var(--gray-300)" }}>
        <h3 style={{ marginBottom: 18, fontWeight: 600 }}>添加 / 更新设置</h3>
        <div className="flex gap" style={{ alignItems: "flex-end" }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Key</label>
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="设置项名称（已存在则覆盖）" />
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <label>Value</label>
            <input value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder="设置值" />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: 40 }}>保存</button>
        </div>
      </form>

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: "25%" }}>Key</th>
              <th>Value</th>
              <th style={{ width: 140 }}>更新时间</th>
              <th style={{ width: 130, textAlign: "right" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {settings.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-sm text-muted" style={{ textAlign: "center", padding: "32px 0" }}>
                  暂无设置项
                </td>
              </tr>
            ) : settings.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 13 }}>{s.key_name}</td>
                <td>
                  {editKey === s.key_name ? (
                    <input
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(s.key_name); if (e.key === "Escape") setEditKey(null) }}
                      style={{ fontFamily: "monospace", fontSize: 13 }}
                    />
                  ) : (
                    <span style={{ fontFamily: "monospace", fontSize: 13 }}>{s.value}</span>
                  )}
                </td>
                <td className="text-sm text-muted">{s.updated_at ? new Date(s.updated_at).toLocaleString() : "-"}</td>
                <td style={{ textAlign: "right" }}>
                  {editKey === s.key_name ? (
                    <div className="flex gap-sm" style={{ justifyContent: "flex-end" }}>
                      <button onClick={() => handleEditSave(s.key_name)} className="btn btn-primary btn-sm">保存</button>
                      <button onClick={() => setEditKey(null)} className="btn btn-outline btn-sm">取消</button>
                    </div>
                  ) : (
                    <div className="flex gap-sm" style={{ justifyContent: "flex-end" }}>
                      <button onClick={() => { setEditKey(s.key_name); setEditVal(s.value) }} className="btn btn-outline btn-sm">编辑</button>
                      <button onClick={() => handleDelete(s.key_name)} className="btn btn-danger btn-sm">删除</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

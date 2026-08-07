import { useEffect, useState } from "react"
import api from "../../api/client"

interface Setting {
  id: number
  key_name: string
  value: string
}

export default function SystemSettings() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [newKey, setNewKey] = useState("")
  const [newVal, setNewVal] = useState("")

  const load = () => {
    api.get("/settings").then(({ data }) => setSettings(data)).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleSave = async () => {
    if (!newKey) return
    try {
      await api.put("/settings", { key: newKey, value: newVal })
      setNewKey("")
      setNewVal("")
      load()
    } catch {}
  }

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div>
      <h1 className="page-title">系统设置</h1>

      <div className="card mb" style={{ borderLeft: "3px solid var(--gray-300)" }}>
        <h3 style={{ marginBottom: 18, fontWeight: 600 }}>添加设置</h3>
        <div className="flex gap" style={{ alignItems: "flex-end" }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Key</label>
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="设置项名称" />
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <label>Value</label>
            <input value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder="设置值" />
          </div>
          <button onClick={handleSave} className="btn btn-primary" style={{ height: 40 }}>保存</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: "30%" }}>Key</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 13 }}>{s.key_name}</td>
                <td style={{ fontFamily: "monospace", fontSize: 13 }}>{s.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

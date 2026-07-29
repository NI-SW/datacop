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
  const [generating, setGenerating] = useState(false)
  const [indexResult, setIndexResult] = useState<string | null>(null)

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

  const handleGenerateIndex = async () => {
    setGenerating(true)
    setIndexResult(null)
    try {
      const { data } = await api.get("/projects/generate-index")
      setIndexResult(`已生成 ${data.projects} 个项目索引，共 ${data.problems} 个问题。路径：${data.path}`)
    } catch (err: any) {
      setIndexResult(`生成失败：${err?.response?.data?.error || "未知错误"}`)
    }
    setGenerating(false)
  }

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div>
      <h1 className="page-title">系统设置</h1>

      <div className="card mb" style={{ borderLeft: "3px solid var(--primary)" }}>
        <h3 style={{ marginBottom: 10, fontWeight: 600 }}>Agent 检索索引</h3>
        <p className="text-sm text-muted" style={{ marginBottom: 14 }}>
          生成分层索引文件（L1 项目列表 → L2 问题索引），供 Agent 快速检索问题和解决方案。
        </p>
        <div className="flex gap" style={{ alignItems: "center" }}>
          <button onClick={handleGenerateIndex} disabled={generating} className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            {generating ? "生成中..." : "生成全部索引"}
          </button>
          {indexResult && (
            <span style={{ fontSize: 13, color: indexResult.startsWith("已生成") ? "#166534" : "#dc2626" }}>{indexResult}</span>
          )}
        </div>
      </div>

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

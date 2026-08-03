import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import api from "../../api/client"
import { useAuth } from "../../context/AuthContext"

interface Project {
  id: number
  name: string
  description: string
  operator_id: number | null
  created_at: string
}

interface User {
  id: number
  username: string
  role: string
}

export default function ProjectManagement() {
  const nav = useNavigate()
  const { user } = useAuth()
  const isRoot = user?.role === "root"
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: "", description: "", operator_id: "" })
  const [operators, setOperators] = useState<User[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [exporting, setExporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const load = () => {
    Promise.all([
      api.get("/projects"),
      api.get("/users"),
    ]).then(([p, u]) => {
      setProjects(p.data)
      setOperators(u.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    try {
      await api.post("/projects", { ...form, operator_id: form.operator_id ? Number(form.operator_id) : null })
      setShowCreate(false)
      setForm({ name: "", description: "", operator_id: "" })
      load()
    } catch {}
  }

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除该项目？")) return
    try { await api.delete(`/projects/${id}`); load() } catch {}
  }

  const toggleSelect = (pid: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(pid) ? next.delete(pid) : next.add(pid)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === projects.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(projects.map((p) => p.id)))
    }
  }

  // 批量导出所选项目的问题集
  const handleExport = async () => {
    if (selected.size === 0) return
    setExporting(true)
    try {
      const { data } = await api.get("/projects/export/problems", { params: { ids: [...selected].join(",") } })
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `projects_problems_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err?.response?.data?.error || "导出失败")
    }
    setExporting(false)
  }

  // 批量导入项目（自动创建对应用户，默认密码 Info@1234）
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const projects = Array.isArray(data) ? data : data.projects
      if (!Array.isArray(projects) || projects.length === 0) {
        alert("文件中没有项目数据")
        return
      }
      const { data: result } = await api.post("/projects/import", { projects })
      const detail = [
        result.message,
        result.created_users?.length ? `新创建用户: ${result.created_users.join("、")}` : "",
        result.reused_users?.length ? `复用已有用户: ${result.reused_users.join("、")}` : "",
        result.results?.filter((r: any) => r.error)?.length ? `失败 ${result.results.filter((r: any) => r.error).length} 个` : "",
      ].filter(Boolean).join("\n")
      alert(detail)
      load()
    } catch (err: any) {
      alert(err?.response?.data?.error || "导入失败，请检查JSON文件格式")
    }
    setImporting(false)
    if (importRef.current) importRef.current.value = ""
  }

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div>
      <div className="flex-between mb-lg">
        <h1 className="page-title">项目管理</h1>
        <div className="flex gap-sm">
          <button onClick={handleExport} disabled={selected.size === 0 || exporting} className="btn btn-outline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {exporting ? "导出中..." : selected.size > 0 ? `导出问题集 (${selected.size})` : "导出问题集"}
          </button>
          {isRoot && (
            <>
              <input ref={importRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
              <button onClick={() => importRef.current?.click()} disabled={importing} className="btn btn-outline">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {importing ? "导入中..." : "导入项目"}
              </button>
            </>
          )}
          <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            创建项目
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="card mb" style={{ padding: "8px 16px", fontSize: 13, color: "var(--gray-600)" }}>
          已选 {selected.size} 个项目
        </div>
      )}

      {showCreate && (
        <div className="card mb" style={{ borderLeft: "3px solid var(--primary)" }}>
          <h3 style={{ marginBottom: 18, fontWeight: 600 }}>创建新项目</h3>
          <div className="form-group">
            <label>项目名称 *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="输入项目名称" />
          </div>
          <div className="form-group">
            <label>项目描述</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="描述项目用途" />
          </div>
          <div className="form-group" style={{ width: 280 }}>
            <label>项目管理员（可选）</label>
            <select value={form.operator_id} onChange={(e) => setForm({ ...form, operator_id: e.target.value })}>
              <option value="">未设置</option>
              {operators.map((u) => (
                <option key={u.id} value={u.id}>{u.username}（ID: {u.id}）</option>
              ))}
            </select>
          </div>
          <div className="flex gap-sm">
            <button onClick={handleCreate} className="btn btn-primary btn-sm">创建</button>
            <button onClick={() => setShowCreate(false)} className="btn btn-outline btn-sm">取消</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={selected.size === projects.length && projects.length > 0}
                  onChange={toggleAll}
                  style={{ width: 15, height: 15, cursor: "pointer" }}
                />
              </th>
              <th style={{ width: 60 }}>ID</th>
              <th style={{ width: "25%" }}>项目名称</th>
              <th>描述</th>
              <th style={{ width: 100 }}>管理员</th>
              <th>创建时间</th>
              <th style={{ textAlign: "right" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    style={{ width: 15, height: 15, cursor: "pointer" }}
                  />
                </td>
                <td className="text-sm text-muted">{p.id}</td>
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td className="text-sm text-muted" style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description || "-"}</td>
                <td className="text-sm text-muted">{operators.find((u) => u.id === p.operator_id)?.username || "-"}</td>
                <td className="text-sm text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                <td style={{ textAlign: "right" }}>
                  <div className="flex gap-sm" style={{ justifyContent: "flex-end" }}>
                    <button onClick={() => nav(`/admin/projects/${p.id}/settings`)} className="btn btn-outline btn-sm">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                      设置
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="btn btn-danger btn-sm">删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

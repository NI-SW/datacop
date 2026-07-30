import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import api from "../api/client"
import { useAuth } from "../context/AuthContext"

interface Problem {
  id: number
  name: string
  description: string
  scenario: string
  trigger_method: string
  symptoms: string
  cause: string
  solution: string
  verification: string
  notes: string
  status: string
  project_id: number
  created_by: number
  created_at: string
}

interface ProjectOption {
  id: number
  name: string
}

const SEARCH_FIELDS = [
  { value: "", label: "全部字段" },
  { value: "name", label: "问题名称" },
  { value: "description", label: "问题简介" },
  { value: "scenario", label: "问题场景" },
  { value: "trigger_method", label: "触发方式" },
  { value: "symptoms", label: "问题症状" },
  { value: "cause", label: "问题原因" },
  { value: "solution", label: "解决方案" },
  { value: "verification", label: "验证方式" },
  { value: "notes", label: "备注" },
]

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "pending", label: "待定问题" },
  { value: "valid", label: "已保留问题" },
]

export default function ProblemList() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { user } = useAuth()
  const isRoot = user?.role === "root"
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [debouncedKeyword, setDebouncedKeyword] = useState("")
  const [searchField, setSearchField] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [totalCount, setTotalCount] = useState(0)
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>()
  const [allProjects, setAllProjects] = useState<ProjectOption[]>([])
  const [movingId, setMovingId] = useState<number | null>(null)
  const [targetProject, setTargetProject] = useState<string>("")

  // debounce keyword input
  useEffect(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedKeyword(keyword), 300)
    return () => clearTimeout(debounceTimer.current)
  }, [keyword])

  // load all projects for root users
  useEffect(() => {
    if (!isRoot) return
    api.get("/projects").then(({ data }) => setAllProjects(data.map((p: any) => ({ id: p.id, name: p.name })))).catch(() => {})
  }, [isRoot])

  const loadProblems = useCallback((q?: string, field?: string, status?: string) => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (q) params.q = q
    if (field) params.field = field
    if (status) params.status = status
    api.get(`/projects/${id}/problems`, { params })
      .then(({ data }) => {
        setProblems(data)
        setTotalCount(data.length)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  // auto-search when any filter changes
  useEffect(() => {
    loadProblems(debouncedKeyword || undefined, searchField || undefined, statusFilter || undefined)
  }, [debouncedKeyword, searchField, statusFilter, loadProblems])

  const handleClear = () => {
    setKeyword("")
    setDebouncedKeyword("")
    setSearchField("")
    setStatusFilter("")
  }

  const handleStatusChange = async (problemId: number, newStatus: string) => {
    try {
      await api.patch(`/projects/${id}/problems/${problemId}/status`, { status: newStatus })
      loadProblems(keyword, searchField, statusFilter)
    } catch {}
  }

  const handleDelete = async (problemId: number) => {
    if (!confirm("确定删除该问题？")) return
    try {
      await api.delete(`/projects/${id}/problems/${problemId}`)
      loadProblems(keyword, searchField, statusFilter)
    } catch {}
  }

  const toggleSelect = (pid: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(pid) ? next.delete(pid) : next.add(pid)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === problems.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(problems.map((p) => p.id)))
    }
  }

  const handleBatchDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`确定删除选中的 ${selected.size} 个问题？`)) return
    setDeleting(true)
    try {
      await api.delete(`/projects/${id}/problems`, { data: { ids: [...selected] } })
      setSelected(new Set())
      loadProblems(keyword, searchField, statusFilter)
    } catch {}
    setDeleting(false)
  }

  const handleExport = async (status?: string) => {
    const params: Record<string, string> = {}
    if (status) params.status = status
    const { data } = await api.get(`/projects/${id}/problems`, { params })
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `problems${status ? `_${status}` : "_all"}_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const importRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const handleMove = async (problemId: number) => {
    if (!targetProject) return
    try {
      await api.patch(`/projects/${id}/problems/${problemId}/project`, { project_id: Number(targetProject) })
      setMovingId(null)
      setTargetProject("")
      loadProblems(debouncedKeyword || undefined, searchField || undefined, statusFilter || undefined)
    } catch (err: any) {
      alert(err?.response?.data?.error || "移动失败")
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const problems = Array.isArray(data) ? data : data.problems || []
      await api.post(`/projects/${id}/problems/import`, { problems })
      loadProblems(debouncedKeyword || undefined, searchField || undefined, statusFilter || undefined)
    } catch (err: any) {
      alert(err?.response?.data?.error || "导入失败，请检查JSON格式")
    }
    setImporting(false)
    if (importRef.current) importRef.current.value = ""
  }

  return (
    <div>
      <div className="flex-between mb-lg">
        <div className="flex gap">
          {selected.size > 0 && (
            <button onClick={handleBatchDelete} disabled={deleting} className="btn btn-danger">
              {deleting ? "删除中..." : `删除选中 (${selected.size})`}
            </button>
          )}
          <button onClick={() => handleExport()} className="btn btn-outline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            导出全部
          </button>
          <button onClick={() => handleExport("valid")} className="btn btn-outline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            导出有效问题
          </button>
          <input ref={importRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
          <button onClick={() => importRef.current?.click()} disabled={importing} className="btn btn-outline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {importing ? "导入中..." : "导入问题"}
          </button>
          <Link to={`/projects/${id}/problems/new`} className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            上传问题
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card mb" style={{ padding: 16 }}>
        <div className="flex" style={{ gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="输入关键词自动搜索..."
              style={{ paddingLeft: 38, height: 40 }}
            />
          </div>
          <select value={searchField} onChange={(e) => setSearchField(e.target.value)} style={{ width: 140, height: 40 }}>
            {SEARCH_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 130, height: 40 }}>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {(keyword || searchField || statusFilter) && (
            <button onClick={handleClear} className="btn btn-outline" style={{ height: 40 }}>清空</button>
          )}
        </div>
        {(debouncedKeyword || statusFilter) && (
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--gray-500)" }}>
            {debouncedKeyword && <>搜索 "<strong style={{ color: "var(--primary)" }}>{debouncedKeyword}</strong>" </>}
            {statusFilter && <>状态: <strong style={{ color: "var(--primary)" }}>{STATUS_OPTIONS.find(s => s.value === statusFilter)?.label}</strong> </>}
            找到 <strong>{totalCount}</strong> 条结果
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : problems.length === 0 ? (
        <div className="empty">
          {debouncedKeyword || statusFilter ? "未找到匹配的问题" : "暂无问题"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {problems.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
              <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--gray-600)", userSelect: "none" }}>
                <input type="checkbox" checked={selected.size === problems.length && problems.length > 0} onChange={toggleAll} style={{ width: 16, height: 16 }} />
                全选
              </label>
              {selected.size > 0 && <span className="text-sm text-muted">已选 {selected.size} 项</span>}
            </div>
          )}
          {problems.map((p) => (
            <div key={p.id} className="card card-hover">
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={(e) => { e.stopPropagation(); toggleSelect(p.id) }}
                  style={{ width: 16, height: 16, marginTop: 3, flexShrink: 0, cursor: "pointer" }}
                />
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                  <div className="flex-between">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600 }}>
                        {keyword ? highlight(p.name, keyword) : p.name}
                      </h3>
                      <span style={{
                        padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: p.status === "valid" ? "#dcfce7" : "#fef3c7",
                        color: p.status === "valid" ? "#166534" : "#92400e",
                      }}>
                        {p.status === "valid" ? "已保留" : "待定"}
                      </span>
                    </div>
                    <span className="text-sm text-muted">{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                  {p.description && (
                    <p className="text-sm text-muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
                      {keyword ? highlight(p.description, keyword) : p.description}
                    </p>
                  )}
                  {expanded === p.id && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--gray-100)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
                      {p.scenario && <Field label="问题场景" value={p.scenario} kw={keyword} />}
                      {p.trigger_method && <Field label="触发方式" value={p.trigger_method} kw={keyword} />}
                      {p.symptoms && <Field label="问题症状" value={p.symptoms} kw={keyword} />}
                      {p.cause && <Field label="问题原因" value={p.cause} kw={keyword} />}
                      {p.solution && <Field label="解决方案" value={p.solution} kw={keyword} />}
                      {p.verification && <Field label="验证方式" value={p.verification} kw={keyword} />}
                      {p.notes && <Field label="备注" value={p.notes} kw={keyword} full />}
                    </div>
                  )}
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--gray-400)" }}>
                      {expanded === p.id ? "▲ 收起" : "▼ 展开详情"}
                    </span>
                    <div className="flex gap-sm" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => nav(`/projects/${id}/problems/${p.id}/edit`)}
                        className="btn btn-outline btn-sm"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="btn btn-danger btn-sm"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        删除
                      </button>
                      {p.status !== "valid" && (
                        <button
                          onClick={() => handleStatusChange(p.id, "valid")}
                          className="btn btn-sm"
                          style={{ background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          保留
                        </button>
                      )}
                      {p.status === "valid" && (
                        <button
                          onClick={() => handleStatusChange(p.id, "pending")}
                          className="btn btn-outline btn-sm"
                        >
                          撤回保留
                        </button>
                      )}
                      {isRoot && (
                        movingId === p.id ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                            <select
                              value={targetProject}
                              onChange={(e) => setTargetProject(e.target.value)}
                              style={{ height: 28, fontSize: 12, padding: "0 6px", borderRadius: 4, border: "1px solid var(--gray-300)" }}
                            >
                              <option value="">选择项目</option>
                              {allProjects.filter((proj) => proj.id !== Number(id)).map((proj) => (
                                <option key={proj.id} value={proj.id}>{proj.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleMove(p.id)}
                              disabled={!targetProject}
                              className="btn btn-sm btn-primary"
                              style={{ height: 28, fontSize: 12 }}
                            >
                              确认
                            </button>
                            <button
                              onClick={() => { setMovingId(null); setTargetProject("") }}
                              className="btn btn-sm btn-outline"
                              style={{ height: 28, fontSize: 12 }}
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setMovingId(p.id); setTargetProject("") }}
                            className="btn btn-outline btn-sm"
                          >
                            更改项目
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function highlight(text: string, kw: string) {
  if (!kw) return text
  const parts = text.split(new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"))
  return parts.map((part, i) =>
    part.toLowerCase() === kw.toLowerCase()
      ? <mark key={i} style={{ background: "#fef08a", padding: "1px 3px", borderRadius: 2 }}>{part}</mark>
      : part
  )
}

function Field({ label, value, kw, full }: { label: string; value: string; kw?: string; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <strong style={{ fontSize: 12, color: "var(--gray-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</strong>
      <p style={{ fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap", color: "var(--gray-700)", lineHeight: 1.6 }}>
        {kw ? highlight(value, kw) : value}
      </p>
    </div>
  )
}

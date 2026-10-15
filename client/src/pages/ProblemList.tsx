import { useEffect, useState, useRef } from "react"
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom"
import api from "../api/client"
import { apiError } from "../api/error"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/Toast"
import { useConfirm } from "../components/ConfirmDialog"

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
  created_by_username: string | null
  created_at: string
  updated_at: string
}

interface ProjectOption {
  id: number
  name: string
}

const PAGE_SIZE = 20

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
  { value: "pending", label: "待定" },
  { value: "valid", label: "已保留" },
]

const SORT_OPTIONS = [
  { value: "", label: "最新创建" },
  { value: "updated_at", label: "最近更新" },
  { value: "name", label: "按名称" },
]

export default function ProblemList() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const isRoot = user?.role === "root"

  // 筛选条件全部同步到 URL：刷新不丢、编辑往返不丢、可分享
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get("q") || ""
  const searchField = searchParams.get("field") || ""
  const statusFilter = searchParams.get("status") || ""
  const sort = searchParams.get("sort") || ""
  const page = Math.max(Number(searchParams.get("page")) || 1, 1)

  const [keyword, setKeyword] = useState(q)
  const [problems, setProblems] = useState<Problem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [expanded, setExpanded] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [myRole, setMyRole] = useState<string>("user")
  const [refreshKey, setRefreshKey] = useState(0)
  const [allProjects, setAllProjects] = useState<ProjectOption[]>([])
  const [movingId, setMovingId] = useState<number | null>(null)
  const [targetProject, setTargetProject] = useState("")
  const [batchMoving, setBatchMoving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const seqRef = useRef(0)
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>()

  const canWrite = myRole === "root" || myRole === "admin" || myRole === "operator"

  // URL -> 输入框（浏览器前进后退时同步）
  useEffect(() => { setKeyword(q) }, [q])

  // 输入防抖后写入 URL（replace 避免每敲一个字都产生历史记录）
  useEffect(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      if (keyword === q) return
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (keyword) next.set("q", keyword)
        else next.delete("q")
        next.delete("page")
        return next
      }, { replace: true })
    }, 300)
    return () => clearTimeout(debounceTimer.current)
  }, [keyword, q, setSearchParams])

  // 筛选条件变化时清空勾选，防止残留选中项被误删/误移
  useEffect(() => {
    setSelected(new Set())
  }, [q, searchField, statusFilter, sort, page])

  // 项目内角色（决定是否渲染写操作入口）
  useEffect(() => {
    api.get(`/projects/${id}`)
      .then(({ data }) => setMyRole(data.my_role || "user"))
      .catch((err) => {
        setMyRole("user")
        toast.error(apiError(err, "无法确认你在该项目中的权限，已按只读显示"))
      })
  }, [id])

  // root 加载全部项目用于移动操作
  useEffect(() => {
    if (!isRoot) return
    api.get("/projects")
      .then(({ data }) => setAllProjects(data.map((p: ProjectOption) => ({ id: p.id, name: p.name }))))
      .catch((err) => toast.error(apiError(err, "加载项目列表失败，暂时无法更改问题所属项目")))
  }, [isRoot])

  // 拉取列表：保留旧数据避免整页闪烁，请求序号防止慢响应覆盖新结果
  useEffect(() => {
    const seq = ++seqRef.current
    if (problems.length === 0 && !loadError) setLoading(true)
    else setRefreshing(true)
    const params: Record<string, string | number> = { page, pageSize: PAGE_SIZE }
    if (q) params.q = q
    if (searchField) params.field = searchField
    if (statusFilter) params.status = statusFilter
    if (sort) params.sort = sort
    api.get(`/projects/${id}/problems`, { params })
      .then(({ data }) => {
        if (seq !== seqRef.current) return
        setProblems(data.items)
        setTotal(data.total)
        setLoadError("")
      })
      .catch((err) => {
        if (seq !== seqRef.current) return
        setLoadError(apiError(err, "加载问题列表失败"))
      })
      .finally(() => {
        if (seq !== seqRef.current) return
        setLoading(false)
        setRefreshing(false)
      })
    // problems 不作为依赖：仅由筛选条件和 refreshKey 驱动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, q, searchField, statusFilter, sort, page, refreshKey])

  const reload = () => setRefreshKey((k) => k + 1)

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== "page") next.delete("page")
      return next
    })
  }

  const handleClear = () => {
    setKeyword("")
    setSearchParams(new URLSearchParams())
  }

  const handleStatusChange = async (problem: Problem, newStatus: string) => {
    const prevStatus = problem.status
    // 乐观更新，失败回滚
    setProblems((prev) => prev.map((p) => (p.id === problem.id ? { ...p, status: newStatus } : p)))
    try {
      await api.patch(`/projects/${id}/problems/${problem.id}/status`, { status: newStatus })
      toast.success(newStatus === "valid" ? "已保留" : "已设为待定")
    } catch (err) {
      setProblems((prev) => prev.map((p) => (p.id === problem.id ? { ...p, status: prevStatus } : p)))
      toast.error(apiError(err, "状态更新失败"))
    }
  }

  const handleDelete = async (problem: Problem) => {
    const ok = await confirm(`确定删除问题"${problem.name}"？删除后不可恢复。`, "删除问题")
    if (!ok) return
    try {
      await api.delete(`/projects/${id}/problems/${problem.id}`)
      setProblems((prev) => prev.filter((p) => p.id !== problem.id))
      setTotal((t) => Math.max(t - 1, 0))
      setSelected((prev) => { const next = new Set(prev); next.delete(problem.id); return next })
      toast.success("删除成功")
    } catch (err) {
      toast.error(apiError(err, "删除失败"))
    }
  }

  const toggleSelect = (pid: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(pid) ? next.delete(pid) : next.add(pid)
      return next
    })
  }

  const toggleAll = () => {
    if (problems.length > 0 && problems.every((p) => selected.has(p.id))) {
      setSelected(new Set())
    } else {
      setSelected(new Set(problems.map((p) => p.id)))
    }
  }

  const handleBatchDelete = async () => {
    if (selected.size === 0) return
    const ok = await confirm(`确定删除选中的 ${selected.size} 个问题？删除后不可恢复。`, "批量删除")
    if (!ok) return
    try {
      const { data } = await api.delete(`/projects/${id}/problems`, { data: { ids: [...selected] } })
      toast.success(data.message || `已删除 ${selected.size} 个问题`)
      setSelected(new Set())
      reload()
    } catch (err) {
      toast.error(apiError(err, "批量删除失败"))
    }
  }

  const handleBatchMove = async () => {
    if (selected.size === 0 || !targetProject) return
    const targetName = allProjects.find((p) => p.id === Number(targetProject))?.name || "目标项目"
    const ok = await confirm(`确定把选中的 ${selected.size} 个问题移动到"${targetName}"？`, "批量移动")
    if (!ok) return
    try {
      const { data } = await api.patch(`/projects/${id}/problems/project`, { ids: [...selected], project_id: Number(targetProject) })
      toast.success(data.message || "移动成功")
      setBatchMoving(false)
      setTargetProject("")
      setSelected(new Set())
      reload()
    } catch (err) {
      toast.error(apiError(err, "移动失败"))
    }
  }

  const handleMove = async (problemId: number) => {
    if (!targetProject) return
    try {
      await api.patch(`/projects/${id}/problems/${problemId}/project`, { project_id: Number(targetProject) })
      toast.success("已移动到目标项目")
      setMovingId(null)
      setTargetProject("")
      setProblems((prev) => prev.filter((p) => p.id !== problemId))
      setTotal((t) => Math.max(t - 1, 0))
    } catch (err) {
      toast.error(apiError(err, "移动失败"))
    }
  }

  const handleExport = async (status?: string) => {
    setExporting(true)
    try {
      const { data } = await api.get(`/projects/${id}/problems`, { params: status ? { status } : undefined })
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
      toast.success(`已导出 ${data.length} 个问题`)
    } catch (err) {
      toast.error(apiError(err, "导出失败"))
    }
    setExporting(false)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const list = Array.isArray(data) ? data : data.problems || []
      if (!Array.isArray(list) || list.length === 0) {
        toast.error("文件中没有问题数据")
        return
      }
      const ok = await confirm(`即将向当前项目导入 ${list.length} 个问题，同名数据不会自动去重，确定继续？`, "导入问题")
      if (!ok) return
      const { data: result } = await api.post(`/projects/${id}/problems/import`, { problems: list })
      toast.success(result.message || `成功导入 ${list.length} 个问题`)
      reload()
    } catch (err) {
      if (err instanceof SyntaxError) toast.error("导入失败，请检查 JSON 格式")
      else toast.error(apiError(err, "导入失败"))
    }
    setImporting(false)
    if (importRef.current) importRef.current.value = ""
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1)
  const allSelected = problems.length > 0 && problems.every((p) => selected.has(p.id))
  const listSearch = searchParams.toString()
  const backSearch = listSearch ? `?${listSearch}` : ""

  return (
    <div>
      <div className="flex-between mb-lg toolbar-wrap">
        <div className="flex gap toolbar-wrap">
          {canWrite && selected.size > 0 && (
            <button onClick={handleBatchDelete} className="btn btn-danger">
              删除选中 ({selected.size})
            </button>
          )}
          {canWrite && selected.size > 0 && isRoot && (
            batchMoving ? (
              <div className="flex gap" style={{ alignItems: "center" }}>
                <select value={targetProject} onChange={(e) => setTargetProject(e.target.value)} style={{ height: 40, width: 180 }}>
                  <option value="">选择目标项目</option>
                  {allProjects.filter((proj) => proj.id !== Number(id)).map((proj) => (
                    <option key={proj.id} value={proj.id}>{proj.name}</option>
                  ))}
                </select>
                <button onClick={handleBatchMove} disabled={!targetProject} className="btn btn-primary">确认移动</button>
                <button onClick={() => { setBatchMoving(false); setTargetProject("") }} className="btn btn-outline">取消</button>
              </div>
            ) : (
              <button onClick={() => { setBatchMoving(true); setMovingId(null); setTargetProject("") }} className="btn btn-outline">
                批量更改项目
              </button>
            )
          )}
          <button onClick={() => handleExport()} disabled={exporting} className="btn btn-outline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {exporting ? "导出中..." : "导出全部"}
          </button>
          <button onClick={() => handleExport("valid")} disabled={exporting} className="btn btn-outline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {exporting ? "导出中..." : "导出有效问题"}
          </button>
          {canWrite && (
            <>
              <input ref={importRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
              <button onClick={() => importRef.current?.click()} disabled={importing} className="btn btn-outline">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {importing ? "导入中..." : "导入问题"}
              </button>
              <Link to={`/projects/${id}/problems/new${backSearch}`} className="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                新增问题
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="card mb" style={{ padding: 16 }}>
        <div className="flex toolbar-wrap" style={{ gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="输入关键词自动搜索，多个词用空格分隔..."
              aria-label="搜索问题"
              style={{ paddingLeft: 38, height: 40 }}
            />
          </div>
          <select value={searchField} onChange={(e) => setParam("field", e.target.value)} aria-label="搜索字段" style={{ width: 140, height: 40 }}>
            {SEARCH_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setParam("status", e.target.value)} aria-label="状态筛选" style={{ width: 130, height: 40 }}>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={sort} onChange={(e) => setParam("sort", e.target.value)} aria-label="排序方式" style={{ width: 130, height: 40 }}>
            {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {(keyword || searchField || statusFilter || sort) && (
            <button onClick={handleClear} className="btn btn-outline" style={{ height: 40 }}>清空</button>
          )}
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: "var(--gray-500)", display: "flex", alignItems: "center", gap: 8 }}>
          {refreshing && <span style={{ color: "var(--primary)" }}>搜索中...</span>}
          {(q || statusFilter) && (
            <span>
              {q && <>搜索 "<strong style={{ color: "var(--primary)" }}>{q}</strong>" </>}
              {statusFilter && <>状态: <strong style={{ color: "var(--primary)" }}>{STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label}</strong> </>}
            </span>
          )}
          {!loading && !loadError && <span>共 <strong>{total}</strong> 条结果</span>}
        </div>
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : loadError ? (
        <div className="empty">
          <p style={{ marginBottom: 16 }}>{loadError}</p>
          <button onClick={reload} className="btn btn-primary">重试</button>
        </div>
      ) : problems.length === 0 ? (
        <div className="empty">
          <p style={{ marginBottom: 12 }}>{q || statusFilter || searchField ? "未找到匹配的问题" : "暂无问题"}</p>
          {(q || statusFilter || searchField) && (
            <button onClick={handleClear} className="btn btn-outline">清空筛选条件</button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, opacity: refreshing ? 0.6 : 1, transition: "opacity .15s" }}>
          {canWrite && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
              <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--gray-600)", userSelect: "none" }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ width: 16, height: 16 }} />
                全选
              </label>
              {selected.size > 0 && <span className="text-sm text-muted">已选 {selected.size} 项</span>}
            </div>
          )}
          {problems.map((p) => (
            <div key={p.id} className="card card-hover">
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                {canWrite && (
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={(e) => { e.stopPropagation(); toggleSelect(p.id) }}
                    aria-label={`选择问题 ${p.name}`}
                    style={{ width: 16, height: 16, marginTop: 3, flexShrink: 0, cursor: "pointer" }}
                  />
                )}
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                  <div className="flex-between" style={{ gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600 }}>
                        <Link
                          to={`/projects/${id}/problems/${p.id}${backSearch}`}
                          style={{ color: "inherit" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {q ? highlight(p.name, q) : p.name}
                        </Link>
                      </h3>
                      <span style={{
                        padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, flexShrink: 0,
                        background: p.status === "valid" ? "#dcfce7" : "#fef3c7",
                        color: p.status === "valid" ? "#166534" : "#92400e",
                      }}>
                        {p.status === "valid" ? "已保留" : "待定"}
                      </span>
                    </div>
                    <span className="text-sm text-muted" style={{ flexShrink: 0 }}>
                      {p.created_by_username ? `${p.created_by_username} · ` : ""}{formatTime(p.updated_at || p.created_at)}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-sm text-muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
                      {q ? highlight(p.description, q) : p.description}
                    </p>
                  )}
                  {expanded === p.id && (
                    <div id={`problem-detail-${p.id}`} className="detail-grid" style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--gray-100)", display: "grid", gap: "12px 24px" }}>
                      {p.scenario && <Field label="问题场景" value={p.scenario} kw={q} />}
                      {p.trigger_method && <Field label="触发方式" value={p.trigger_method} kw={q} />}
                      {p.symptoms && <Field label="问题症状" value={p.symptoms} kw={q} />}
                      {p.cause && <Field label="问题原因" value={p.cause} kw={q} />}
                      {p.solution && <Field label="解决方案" value={p.solution} kw={q} />}
                      {p.verification && <Field label="验证方式" value={p.verification} kw={q} />}
                      {p.notes && <Field label="备注" value={p.notes} kw={q} full />}
                      <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--gray-400)" }}>
                        创建者 {p.created_by_username || "未知"} · 创建于 {new Date(p.created_at).toLocaleString()}
                        {p.updated_at && p.updated_at !== p.created_at && <> · 更新于 {new Date(p.updated_at).toLocaleString()}</>}
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn-link"
                      aria-expanded={expanded === p.id}
                      aria-controls={`problem-detail-${p.id}`}
                      onClick={(e) => { e.stopPropagation(); setExpanded(expanded === p.id ? null : p.id) }}
                      style={{ fontSize: 12, color: "var(--gray-500)" }}
                    >
                      {expanded === p.id ? "▲ 收起" : "▼ 展开详情"}
                    </button>
                    {canWrite && (
                      <div className="flex gap-sm" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => nav(`/projects/${id}/problems/${p.id}/edit${backSearch}`)}
                          className="btn btn-outline btn-sm"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="btn btn-danger btn-sm"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          删除
                        </button>
                        {p.status !== "valid" ? (
                          <button
                            onClick={() => handleStatusChange(p, "valid")}
                            className="btn btn-sm"
                            style={{ background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            保留
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(p, "pending")}
                            className="btn btn-outline btn-sm"
                          >
                            取消保留
                          </button>
                        )}
                        {isRoot && (
                          movingId === p.id ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
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
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {totalPages > 1 && (
            <div className="flex" style={{ justifyContent: "center", alignItems: "center", gap: 12, padding: "8px 0" }}>
              <button
                className="btn btn-outline btn-sm"
                disabled={page <= 1}
                onClick={() => setParam("page", String(page - 1))}
              >
                上一页
              </button>
              <span className="text-sm text-muted">第 {page} / {totalPages} 页 · 共 {total} 条</span>
              <button
                className="btn btn-outline btn-sm"
                disabled={page >= totalPages}
                onClick={() => setParam("page", String(page + 1))}
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatTime(iso: string) {
  if (!iso) return ""
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? `今天 ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
    : d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

function highlight(text: string, kw: string) {
  if (!kw) return text
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = text.split(new RegExp(`(${escaped})`, "gi"))
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

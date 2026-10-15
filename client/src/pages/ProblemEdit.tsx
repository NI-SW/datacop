import { useEffect, useState, useRef, type FormEvent } from "react"
import { useParams, useNavigate, Link, useLocation } from "react-router-dom"
import api from "../api/client"
import { apiError } from "../api/error"
import { useToast } from "../components/Toast"
import { useUnsavedChanges } from "../hooks/useUnsavedChanges"

export default function ProblemEdit() {
  const { id, problemId } = useParams<{ id: string; problemId: string }>()
  const nav = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [form, setForm] = useState({ name: "", description: "", scenario: "", trigger_method: "", symptoms: "", cause: "", solution: "", verification: "", notes: "" })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [loadKey, setLoadKey] = useState(0)
  const initialRef = useRef("")

  const dirty = !!initialRef.current && JSON.stringify(form) !== initialRef.current
  const markSaved = useUnsavedChanges(dirty)

  useEffect(() => {
    setLoading(true)
    setLoadError("")
    api.get(`/projects/${id}/problems/${problemId}`).then(({ data }) => {
      const next = {
        name: data.name || "",
        description: data.description || "",
        scenario: data.scenario || "",
        trigger_method: data.trigger_method || "",
        symptoms: data.symptoms || "",
        cause: data.cause || "",
        solution: data.solution || "",
        verification: data.verification || "",
        notes: data.notes || "",
      }
      setForm(next)
      initialRef.current = JSON.stringify(next)
    }).catch((err) => {
      // 加载失败绝不渲染空表单，避免用户误以为内容为空并保存覆盖
      setLoadError(apiError(err, "加载问题失败"))
    }).finally(() => setLoading(false))
  }, [id, problemId, loadKey])

  const backUrl = `/projects/${id}/problems${location.search}`

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.name.trim()) {
      setError("请填写问题名称")
      return
    }
    setSubmitting(true)
    try {
      await api.put(`/projects/${id}/problems/${problemId}`, form)
      toast.success("保存成功")
      markSaved()
      nav(backUrl)
    } catch (err: unknown) {
      setError(apiError(err, "保存失败"))
      setSubmitting(false)
    }
  }

  const set = (key: string) => (e: any) => setForm({ ...form, [key]: e.target.value })

  if (loading) return <div className="loading">加载中...</div>

  if (loadError) {
    return (
      <div>
        <div className="flex-between mb-lg">
          <h1 className="page-title">编辑问题</h1>
          <Link to={backUrl} className="btn btn-outline">返回列表</Link>
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
        <h1 className="page-title">编辑问题</h1>
        <Link to={backUrl} className="btn btn-outline">返回列表</Link>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 900 }}>
        {error && (
          <div style={{ color: "#dc2626", background: "#fef2f2", padding: "10px 14px", borderRadius: 8, marginBottom: 20, fontSize: 13, border: "1px solid #fecaca" }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label>问题名称 *</label>
          <input value={form.name} onChange={set("name")} />
        </div>

        <div className="form-group">
          <label>问题简介</label>
          <textarea value={form.description} onChange={set("description")} rows={3} />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label>问题场景</label>
            <textarea value={form.scenario} onChange={set("scenario")} />
          </div>
          <div className="form-group">
            <label>触发方式</label>
            <textarea value={form.trigger_method} onChange={set("trigger_method")} />
          </div>
          <div className="form-group">
            <label>问题症状</label>
            <textarea value={form.symptoms} onChange={set("symptoms")} />
          </div>
          <div className="form-group">
            <label>问题原因</label>
            <textarea value={form.cause} onChange={set("cause")} />
          </div>
          <div className="form-group">
            <label>解决方案</label>
            <textarea value={form.solution} onChange={set("solution")} />
          </div>
          <div className="form-group">
            <label>验证方式</label>
            <textarea value={form.verification} onChange={set("verification")} />
          </div>
        </div>

        <div className="form-group">
          <label>备注</label>
          <textarea value={form.notes} onChange={set("notes")} />
        </div>

        <div style={{ borderTop: "1px solid var(--gray-100)", paddingTop: 20, marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
          <button type="submit" disabled={submitting} className="btn btn-primary" style={{ height: 42, paddingInline: 24, fontSize: 14 }}>
            {submitting ? "保存中..." : "保存修改"}
          </button>
          {dirty && <span style={{ fontSize: 12, color: "var(--gray-400)" }}>有未保存的修改</span>}
        </div>
      </form>
    </div>
  )
}

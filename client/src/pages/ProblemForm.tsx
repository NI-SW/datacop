import { useState, useRef, type FormEvent } from "react"
import { useParams, useNavigate, Link, useLocation } from "react-router-dom"
import api from "../api/client"
import { apiError } from "../api/error"
import { useToast } from "../components/Toast"
import { useUnsavedChanges } from "../hooks/useUnsavedChanges"

export default function ProblemForm() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [form, setForm] = useState({ name: "", description: "", scenario: "", trigger_method: "", symptoms: "", cause: "", solution: "", verification: "", notes: "" })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const initialRef = useRef(JSON.stringify(form))

  const dirty = JSON.stringify(form) !== initialRef.current
  const markSaved = useUnsavedChanges(dirty)

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
      await api.post(`/projects/${id}/problems`, form)
      toast.success("问题创建成功")
      markSaved()
      nav(backUrl)
    } catch (err: unknown) {
      setError(apiError(err, "创建失败，请重试"))
      setSubmitting(false)
    }
  }

  const set = (key: string) => (e: any) => setForm({ ...form, [key]: e.target.value })

  return (
    <div>
      <div className="flex-between mb-lg">
        <h1 className="page-title">新增问题</h1>
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
          <input value={form.name} onChange={set("name")} placeholder="请输入问题名称" autoFocus />
        </div>

        <div className="form-group">
          <label>问题简介</label>
          <textarea value={form.description} onChange={set("description")} placeholder="简要描述该问题" rows={3} />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label>问题场景</label>
            <textarea value={form.scenario} onChange={set("scenario")} placeholder="该问题发生在什么场景下" />
          </div>
          <div className="form-group">
            <label>触发方式</label>
            <textarea value={form.trigger_method} onChange={set("trigger_method")} placeholder="如何触发该问题" />
          </div>
          <div className="form-group">
            <label>问题症状</label>
            <textarea value={form.symptoms} onChange={set("symptoms")} placeholder="问题表现形式" />
          </div>
          <div className="form-group">
            <label>问题原因</label>
            <textarea value={form.cause} onChange={set("cause")} placeholder="导致问题的根本原因" />
          </div>
          <div className="form-group">
            <label>解决方案</label>
            <textarea value={form.solution} onChange={set("solution")} placeholder="如何解决该问题" />
          </div>
          <div className="form-group">
            <label>验证方式</label>
            <textarea value={form.verification} onChange={set("verification")} placeholder="如何验证问题已解决" />
          </div>
        </div>

        <div className="form-group">
          <label>备注</label>
          <textarea value={form.notes} onChange={set("notes")} placeholder="其他相关信息" />
        </div>

        <div style={{ borderTop: "1px solid var(--gray-100)", paddingTop: 20, marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
          <button type="submit" disabled={submitting} className="btn btn-primary" style={{ height: 42, paddingInline: 24, fontSize: 14 }}>
            {submitting ? "保存中..." : "创建问题"}
          </button>
          {dirty && <span style={{ fontSize: 12, color: "var(--gray-400)" }}>有未保存的修改</span>}
        </div>
      </form>
    </div>
  )
}

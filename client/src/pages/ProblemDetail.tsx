import { useEffect, useState } from "react"
import { useParams, Link, useLocation } from "react-router-dom"
import api from "../api/client"
import { apiError } from "../api/error"
import { useToast } from "../components/Toast"
import { copyText } from "../utils/clipboard"

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
  created_at: string
  updated_at: string
  created_by_username: string | null
}

export default function ProblemDetail() {
  const { id, problemId } = useParams<{ id: string; problemId: string }>()
  const location = useLocation()
  const toast = useToast()
  const [problem, setProblem] = useState<Problem | null>(null)
  const [canWrite, setCanWrite] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [loadKey, setLoadKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    setLoadError("")
    api.get(`/projects/${id}/problems/${problemId}`)
      .then(({ data }) => setProblem(data))
      .catch((err) => setLoadError(apiError(err, "加载问题失败")))
      .finally(() => setLoading(false))
  }, [id, problemId, loadKey])

  useEffect(() => {
    api.get(`/projects/${id}`)
      .then(({ data }) => {
        const role = data.my_role || "user"
        setCanWrite(role === "root" || role === "admin" || role === "operator")
      })
      .catch(() => setCanWrite(false))
  }, [id])

  const backUrl = `/projects/${id}/problems${location.search}`
  const detailUrl = `${window.location.origin}/projects/${id}/problems/${problemId}`

  const handleCopyLink = async () => {
    const ok = await copyText(detailUrl)
    ok ? toast.success("问题链接已复制") : toast.error("复制失败，请手动复制地址栏链接")
  }

  if (loading) return <div className="loading">加载中...</div>

  if (loadError || !problem) {
    return (
      <div className="empty">
        <p style={{ marginBottom: 16 }}>{loadError || "问题不存在"}</p>
        <div className="flex gap-sm" style={{ justifyContent: "center" }}>
          <button onClick={() => setLoadKey((k) => k + 1)} className="btn btn-primary">重试</button>
          <Link to={backUrl} className="btn btn-outline">返回列表</Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex-between mb" style={{ alignItems: "flex-start", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title" style={{ marginBottom: 8 }}>{problem.name}</h1>
          <div className="text-sm text-muted" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <span style={{
              padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: problem.status === "valid" ? "#dcfce7" : "#fef3c7",
              color: problem.status === "valid" ? "#166534" : "#92400e",
            }}>
              {problem.status === "valid" ? "已保留" : "待定"}
            </span>
            <span>创建者：{problem.created_by_username || "未知"}</span>
            <span>创建于 {new Date(problem.created_at).toLocaleString()}</span>
            {problem.updated_at && problem.updated_at !== problem.created_at && (
              <span>更新于 {new Date(problem.updated_at).toLocaleString()}</span>
            )}
          </div>
        </div>
        <div className="flex gap-sm" style={{ flexShrink: 0 }}>
          <button onClick={handleCopyLink} className="btn btn-outline">复制链接</button>
          {canWrite && <Link to={`/projects/${id}/problems/${problemId}/edit${location.search}`} className="btn btn-primary">编辑</Link>}
          <Link to={backUrl} className="btn btn-outline">返回列表</Link>
        </div>
      </div>

      <div className="card">
        <div className="detail-grid" style={{ display: "grid", gap: "20px 28px" }}>
          {problem.description && <Field label="问题简介" value={problem.description} full />}
          {problem.scenario && <Field label="问题场景" value={problem.scenario} />}
          {problem.trigger_method && <Field label="触发方式" value={problem.trigger_method} />}
          {problem.symptoms && <Field label="问题症状" value={problem.symptoms} />}
          {problem.cause && <Field label="问题原因" value={problem.cause} />}
          {problem.solution && <Field label="解决方案" value={problem.solution} />}
          {problem.verification && <Field label="验证方式" value={problem.verification} />}
          {problem.notes && <Field label="备注" value={problem.notes} full />}
        </div>
        {!problem.description && !problem.scenario && !problem.trigger_method && !problem.symptoms
          && !problem.cause && !problem.solution && !problem.verification && !problem.notes && (
          <p className="text-sm text-muted">该问题除名称外暂无其他内容</p>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <strong style={{ fontSize: 12, color: "var(--gray-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</strong>
      <p style={{ fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap", color: "var(--gray-700)", lineHeight: 1.6 }}>{value}</p>
    </div>
  )
}

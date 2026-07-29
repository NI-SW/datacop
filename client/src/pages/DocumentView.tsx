import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import api from "../api/client"

interface Doc {
  id: number
  project_id: number
  original_name: string
  filename: string
  size: number
  mime_type: string
  status: string
  content_text: string | null
  cleaned_content: string | null
}

export default function DocumentView() {
  const { id, docId } = useParams<{ id: string; docId: string }>()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    api.get(`/projects/${id}/documents/${docId}`).then(({ data }) => setDoc(data))
  }, [id, docId])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await api.get(`/projects/${id}/documents/${docId}/download`, { responseType: "blob" })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement("a")
      a.href = url
      a.download = doc?.original_name || "download"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {}
    setDownloading(false)
  }

  if (!doc) return <div className="loading">加载中...</div>

  const displayContent = doc.cleaned_content || doc.content_text

  return (
    <div>
      <div className="flex-between mb-lg">
        <h1 className="page-title">{doc.original_name}</h1>
        <div className="flex gap">
          <button onClick={handleDownload} disabled={downloading} className="btn btn-outline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {downloading ? "下载中..." : "下载原文件"}
          </button>
          <Link to={`/projects/${id}`} className="btn btn-outline">返回文档列表</Link>
        </div>
      </div>

      <div className="card mb" style={{ padding: 16 }}>
        <div className="flex" style={{ gap: 24, fontSize: 13, color: "var(--gray-500)" }}>
          <span>大小: {(doc.size / 1024).toFixed(1)} KB</span>
          <span>类型: {doc.mime_type || "未知"}</span>
        </div>
      </div>

      {displayContent ? (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--gray-100)", background: "var(--gray-50)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-600)" }}>文档内容</h3>
          </div>
          <pre style={{
            whiteSpace: "pre-wrap",
            fontSize: 13,
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            maxHeight: 600,
            overflow: "auto",
            padding: 24,
            margin: 0,
            lineHeight: 1.7,
            color: "var(--gray-700)",
          }}>{displayContent}</pre>
        </div>
      ) : (
        <div className="empty">该文档暂无文本内容</div>
      )}
    </div>
  )
}

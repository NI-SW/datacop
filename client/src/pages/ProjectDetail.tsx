import { useEffect, useState, useRef } from "react"
import { useParams } from "react-router-dom"
import api from "../api/client"

interface Document {
  id: number
  original_name: string
  filename: string
  size: number
  mime_type: string
  status: string
  content_text: string | null
  cleaned_content: string | null
  created_at: string
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadDocs = () => {
    setLoading(true)
    api.get(`/projects/${id}/documents`)
      .then(({ data }) => setDocs(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadDocs() }, [id])

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append("file", file)
    try {
      await api.post(`/projects/${id}/documents/upload`, form)
      fileRef.current!.value = ""
      loadDocs()
    } catch {}
    setUploading(false)
  }

  const handleEliminate = async (docId: number) => {
    if (!confirm("确定要删除该文档？")) return
    try {
      await api.delete(`/projects/${id}/documents/${docId}`)
      loadDocs()
    } catch {}
  }

  const handleDownload = async (docId: number, filename: string) => {
    try {
      const res = await api.get(`/projects/${id}/documents/${docId}/download`, { responseType: "blob" })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {}
  }

  const handleView = async (docId: number) => {
    try {
      const res = await api.get(`/projects/${id}/documents/${docId}/download`, { responseType: "blob" })
      const url = URL.createObjectURL(res.data)
      window.open(url, "_blank")
    } catch {}
  }

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div>
      <div className="card mb" style={{ padding: 20 }}>
        <div className="flex" style={{ gap: 12, alignItems: "center" }}>
          <input ref={fileRef} type="file" style={{ flex: 1 }} />
          <button onClick={handleUpload} disabled={uploading} className="btn btn-primary">
            {uploading ? (
              <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> 上传中...</>
            ) : (
              <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> 上传文档</>
            )}
          </button>
        </div>
      </div>

      {docs.length === 0 ? (
        <div className="empty">暂无文档，请上传</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "40%" }}>文件名</th>
                <th>大小</th>
                <th>上传时间</th>
                <th style={{ textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <a onClick={() => handleView(doc.id)} style={{ cursor: "pointer", color: "var(--primary)", fontWeight: 500 }}>
                      {doc.original_name}
                    </a>
                  </td>
                  <td className="text-sm text-muted">{(doc.size / 1024).toFixed(1)} KB</td>
                  <td className="text-sm text-muted">{new Date(doc.created_at).toLocaleString()}</td>
                  <td style={{ textAlign: "right" }}>
                    <div className="flex gap-sm" style={{ justifyContent: "flex-end" }}>
                      <button onClick={() => handleDownload(doc.id, doc.original_name)} className="btn btn-outline btn-sm">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        下载
                      </button>
                      {doc.status !== "eliminated" && (
                        <button onClick={() => handleEliminate(doc.id)} className="btn btn-danger btn-sm">
                          淘汰
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

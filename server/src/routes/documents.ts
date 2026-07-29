import { Router, Request, Response } from "express"
import multer from "multer"
import path from "path"
import fs from "fs"
import jschardet from "jschardet"
import iconv from "iconv-lite"
import { getPool } from "../db/connection.ts"
import { requireAuth } from "../middleware/auth.ts"
import { requireRole, requireProjectRead, requireProjectWrite } from "../middleware/rbac.ts"

const router = Router()

function readTextFile(filePath: string): string {
  const buf = fs.readFileSync(filePath)
  // detect encoding
  const detected = jschardet.detect(buf)
  if (detected.encoding && detected.confidence > 0.7 && iconv.encodingExists(detected.encoding)) {
    return iconv.decode(buf, detected.encoding)
  }
  // fallback: try utf-8
  const utf8 = iconv.decode(buf, "utf-8")
  // if the result contains many replacement chars or is still garbled, try gbk
  if (utf8.includes("\ufffd") || buf.includes(0xd6) || buf.includes(0xce)) {
    return iconv.decode(buf, "gbk")
  }
  return utf8
}

// Fix mangled CJK filenames from multer's incorrect latin1 decoding
function fixFilename(name: string): string {
  const buf = Buffer.from(name, "latin1")
  const fixed = buf.toString("utf8")
  // If the fixed version is valid UTF-8 and different, use it
  if (fixed.includes("\ufffd")) return name
  if (/[\u4e00-\u9fff]/.test(fixed)) return fixed
  return name
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve("uploads")
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, Date.now() + "-" + Math.random().toString(36).slice(2) + ext)
  },
})

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

// List documents
router.get("/:projectId/documents", requireAuth, requireProjectRead, async (req: Request, res: Response) => {
  try {
    const [rows] = await getPool().query(
      "SELECT id, project_id, filename, original_name, size, mime_type, status, content_text, cleaned_content, created_at, updated_at FROM documents WHERE project_id = ? ORDER BY created_at DESC",
      [req.params.projectId]
    ) as [any[], any]
    res.json(rows)
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Upload document
router.post("/:projectId/documents/upload", requireAuth, requireProjectWrite, upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "请选择文件" })
    return
  }
  try {
    const originalName = fixFilename(req.file.originalname)
    const [result] = await getPool().query(
      "INSERT INTO documents (project_id, filename, original_name, file_path, size, mime_type) VALUES (?, ?, ?, ?, ?, ?)",
      [req.params.projectId, req.file.filename, originalName, req.file.path, req.file.size, req.file.mimetype]
    ) as [any, any]
    res.status(201).json({ id: result.insertId, message: "上传成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Get document detail
router.get("/:projectId/documents/:id", requireAuth, requireProjectRead, async (req: Request, res: Response) => {
  try {
    const [rows] = await getPool().query(
      "SELECT id, project_id, filename, original_name, size, mime_type, status, content_text, cleaned_content, created_at, updated_at FROM documents WHERE id = ? AND project_id = ?",
      [req.params.id, req.params.projectId]
    ) as [any[], any]
    if (rows.length === 0) {
      res.status(404).json({ error: "文档不存在" })
      return
    }
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Download document
router.get("/:projectId/documents/:id/download", requireAuth, requireProjectRead, async (req: Request, res: Response) => {
  try {
    const [rows] = await getPool().query(
      "SELECT file_path, original_name, mime_type FROM documents WHERE id = ? AND project_id = ?",
      [req.params.id, req.params.projectId]
    ) as [any[], any]
    if (rows.length === 0) {
      res.status(404).json({ error: "文档不存在" })
      return
    }
    const doc = rows[0]
    if (!fs.existsSync(doc.file_path)) {
      res.status(404).json({ error: "文件不存在" })
      return
    }
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`)
    res.setHeader("Content-Type", doc.mime_type || "application/octet-stream")
    fs.createReadStream(doc.file_path).pipe(res)
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Update document content (correction)
router.put("/:projectId/documents/:id", requireAuth, requireProjectWrite, async (req: Request, res: Response) => {
  const { cleaned_content, original_name } = req.body
  try {
    const sets: string[] = []
    const vals: any[] = []

    if (cleaned_content !== undefined) {
      sets.push("cleaned_content = ?")
      vals.push(cleaned_content)
      sets.push("status = 'cleaned'")
    }
    if (original_name !== undefined) {
      sets.push("original_name = ?")
      vals.push(original_name)
    }

    if (sets.length === 0) {
      res.status(400).json({ error: "无修改内容" })
      return
    }

    vals.push(req.params.id, req.params.projectId)
    await getPool().query(
      `UPDATE documents SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`,
      vals
    )
    res.json({ message: "更新成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Clean document (auto text extraction + mark cleaned)
router.post("/:projectId/documents/:id/clean", requireAuth, requireProjectWrite, async (req: Request, res: Response) => {
  try {
    const [rows] = await getPool().query(
      "SELECT file_path, mime_type FROM documents WHERE id = ? AND project_id = ?",
      [req.params.id, req.params.projectId]
    ) as [any[], any]
    if (rows.length === 0) {
      res.status(404).json({ error: "文档不存在" })
      return
    }

    const doc = rows[0]
    let contentText = ""

    try {
      const mime = doc.mime_type || ""
      const ext = path.extname(doc.original_name || "").toLowerCase()
      const isTextLike = mime.startsWith("text/") || [".txt", ".csv", ".log", ".md", ".json", ".xml", ".html", ".htm", ".js", ".ts", ".py", ".java", ".c", ".cpp", ".h", ".sql", ".yaml", ".yml", ".ini", ".cfg", ".sh"].includes(ext)

      if (isTextLike) {
        contentText = readTextFile(doc.file_path)
      } else if (mime === "application/pdf" || mime.startsWith("application/pdf")) {
        const pdfParse = (await import("pdf-parse")).default
        const data = await pdfParse(fs.readFileSync(doc.file_path))
        contentText = data.text
      } else if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const mammoth = (await import("mammoth")).default
        const result = await mammoth.extractRawText({ path: doc.file_path })
        contentText = result.value
      }
    } catch (e) {
      // text extraction failed, still mark as cleaned
    }

    await getPool().query(
      "UPDATE documents SET content_text = ?, status = 'cleaned' WHERE id = ?",
      [contentText, req.params.id]
    )
    res.json({ message: "清洗完成", content_text: contentText })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Flag document status
router.post("/:projectId/documents/:id/flag", requireAuth, requireProjectWrite, async (req: Request, res: Response) => {
  const { status } = req.body
  if (!["problematic", "eliminated"].includes(status)) {
    res.status(400).json({ error: "无效的状态" })
    return
  }
  try {
    await getPool().query(
      "UPDATE documents SET status = ? WHERE id = ? AND project_id = ?",
      [status, req.params.id, req.params.projectId]
    )
    res.json({ message: "状态更新成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

// Delete document
router.delete("/:projectId/documents/:id", requireAuth, requireProjectWrite, async (req: Request, res: Response) => {
  try {
    const [rows] = await getPool().query(
      "SELECT file_path FROM documents WHERE id = ? AND project_id = ?",
      [req.params.id, req.params.projectId]
    ) as [any[], any]
    if (rows.length === 0) {
      res.status(404).json({ error: "文档不存在" })
      return
    }
    if (rows[0].file_path && fs.existsSync(rows[0].file_path)) {
      fs.unlinkSync(rows[0].file_path)
    }
    await getPool().query("DELETE FROM documents WHERE id = ?", [req.params.id])
    res.json({ message: "删除成功" })
  } catch {
    res.status(500).json({ error: "服务器错误" })
  }
})

export default router

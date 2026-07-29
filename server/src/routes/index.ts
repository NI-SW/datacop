import { Router, Request, Response } from "express"
import fs from "fs"
import path from "path"
import { getPool } from "../db/connection.ts"
import { requireAuth } from "../middleware/auth.ts"
import { requireRole } from "../middleware/rbac.ts"

const router = Router()

const INDEX_DIR = path.resolve("docs/index")

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function escapeMarkdown(text: string): string {
  if (!text) return ""
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ").replace(/\r/g, "")
}

function truncate(text: string, max: number): string {
  if (!text) return ""
  return text.length > max ? text.slice(0, max) + "..." : text
}

// Generate Level 1 index: all projects with descriptions
async function generateL1Index(): Promise<string> {
  const [projects] = await getPool().query(
    "SELECT id, name, description, operator_id, created_at FROM projects ORDER BY id"
  ) as [any[], any]

  const [users] = await getPool().query(
    "SELECT id, username FROM users"
  ) as [any[], any]
  const userMap = new Map(users.map((u: any) => [u.id, u.username]))

  const lines: string[] = []
  lines.push("# DataCop 问题索引 - Level 1: 项目列表")
  lines.push("")
  lines.push("> 本文档为 Agent 检索索引。阅读本文档定位问题所属项目，然后读取对应的 Level 2 索引。")
  lines.push("")
  lines.push(`生成时间: ${new Date().toISOString()}`)
  lines.push("")
  lines.push("---")
  lines.push("")

  if (projects.length === 0) {
    lines.push("暂无项目。")
    return lines.join("\n")
  }

  lines.push("## 项目列表")
  lines.push("")
  lines.push("| 项目ID | 项目名称 | 项目描述 | 管理员 | Level 2 索引路径 |")
  lines.push("|--------|----------|----------|--------|-----------------|")

  for (const p of projects) {
    const operator = userMap.get(p.operator_id) || "-"
    const desc = truncate(escapeMarkdown(p.description || "-"), 60)
    const l2Path = `docs/index/L2-project-${p.id}.md`
    lines.push(`| ${p.id} | ${escapeMarkdown(p.name)} | ${desc} | ${operator} | ${l2Path} |`)
  }

  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("## 检索指引")
  lines.push("")
  lines.push("1. 阅读上表，根据项目名称和描述判断问题属于哪个项目")
  lines.push("2. 读取对应项目的 Level 2 索引文件")
  lines.push("3. 在 Level 2 中通过问题名称和描述定位具体问题")
  lines.push("4. 根据 Level 2 中的位置信息获取问题完整详情（解决方案、原因等）")
  lines.push("")

  return lines.join("\n")
}

// Generate Level 2 index: problems for a specific project
async function generateL2Index(projectId: number): Promise<string> {
  const [projects] = await getPool().query(
    "SELECT id, name, description FROM projects WHERE id = ?",
    [projectId]
  ) as [any[], any]

  if (projects.length === 0) return ""

  const project = projects[0]

  const [problems] = await getPool().query(
    "SELECT id, name, description, status, scenario, cause, solution FROM problems WHERE project_id = ? ORDER BY status DESC, id",
    [projectId]
  ) as [any[], any]

  const lines: string[] = []
  lines.push(`# DataCop 问题索引 - Level 2: ${project.name}`)
  lines.push("")
  lines.push(`> 本文档为项目「${project.name}」的问题索引。根据问题名称和描述定位问题，通过位置信息获取完整详情。`)
  lines.push("")
  lines.push(`项目描述: ${project.description || "-"}`)
  lines.push(`问题总数: ${problems.length}`)
  lines.push(`生成时间: ${new Date().toISOString()}`)
  lines.push("")
  lines.push("---")
  lines.push("")

  if (problems.length === 0) {
    lines.push("该项目暂无问题记录。")
    return lines.join("\n")
  }

  // Group by status
  const validProblems = problems.filter((p: any) => p.status === "valid")
  const pendingProblems = problems.filter((p: any) => p.status === "pending")

  if (validProblems.length > 0) {
    lines.push("## 有效问题 (status: valid)")
    lines.push("")
    lines.push("| ID | 问题名称 | 问题描述 | 场景概要 | 解决方案概要 | 详情位置 |")
    lines.push("|----|----------|----------|----------|-------------|----------|")

    for (const p of validProblems) {
      const desc = truncate(escapeMarkdown(p.description || "-"), 40)
      const scenario = truncate(escapeMarkdown(p.scenario || "-"), 30)
      const solution = truncate(escapeMarkdown(p.solution || "-"), 40)
      const location = `GET /api/projects/${projectId}/problems/${p.id}`
      lines.push(`| ${p.id} | ${escapeMarkdown(p.name)} | ${desc} | ${scenario} | ${solution} | ${location} |`)
    }
    lines.push("")
  }

  if (pendingProblems.length > 0) {
    lines.push("## 待定问题 (status: pending)")
    lines.push("")
    lines.push("| ID | 问题名称 | 问题描述 | 场景概要 | 解决方案概要 | 详情位置 |")
    lines.push("|----|----------|----------|----------|-------------|----------|")

    for (const p of pendingProblems) {
      const desc = truncate(escapeMarkdown(p.description || "-"), 40)
      const scenario = truncate(escapeMarkdown(p.scenario || "-"), 30)
      const solution = truncate(escapeMarkdown(p.solution || "-"), 40)
      const location = `GET /api/projects/${projectId}/problems/${p.id}`
      lines.push(`| ${p.id} | ${escapeMarkdown(p.name)} | ${desc} | ${scenario} | ${solution} | ${location} |`)
    }
    lines.push("")
  }

  lines.push("---")
  lines.push("")
  lines.push("## 检索指引")
  lines.push("")
  lines.push("1. 浏览上表，根据「问题名称」和「问题描述」判断哪个问题与当前问题相关")
  lines.push("2. 记录对应行的「详情位置」URL")
  lines.push("3. 调用该 URL 获取问题完整信息（含触发方式、症状、原因、解决方案、验证方式等）")
  lines.push("")
  lines.push("## 详情 API 返回格式")
  lines.push("")
  lines.push("```json")
  lines.push(`{`)
  lines.push(`  "id": 1,`)
  lines.push(`  "project_id": ${projectId},`)
  lines.push(`  "name": "问题名称",`)
  lines.push(`  "description": "问题简介",`)
  lines.push(`  "scenario": "问题场景",`)
  lines.push(`  "trigger_method": "触发方式",`)
  lines.push(`  "symptoms": "问题症状",`)
  lines.push(`  "cause": "问题原因",`)
  lines.push(`  "solution": "解决方案",`)
  lines.push(`  "verification": "验证方式",`)
  lines.push(`  "notes": "备注",`)
  lines.push(`  "status": "pending|valid",`)
  lines.push(`  "created_at": "2026-01-01T00:00:00.000Z"`)
  lines.push(`}`)
  lines.push("```")
  lines.push("")

  return lines.join("\n")
}

// Generate all indexes
router.get("/generate-index", requireAuth, requireRole("root", "admin"), async (_req: Request, res: Response) => {
  try {
    ensureDir(INDEX_DIR)

    // Generate L1
    const l1Content = await generateL1Index()
    fs.writeFileSync(path.join(INDEX_DIR, "L1-projects.md"), l1Content, "utf-8")

    // Generate L2 for each project
    const [projects] = await getPool().query("SELECT id FROM projects") as [any[], any]
    let projectCount = 0
    let problemCount = 0

    for (const p of projects) {
      const l2Content = await generateL2Index(p.id)
      if (l2Content) {
        fs.writeFileSync(path.join(INDEX_DIR, `L2-project-${p.id}.md`), l2Content, "utf-8")

        // Count problems
        const [count] = await getPool().query(
          "SELECT COUNT(*) as cnt FROM problems WHERE project_id = ?",
          [p.id]
        ) as [any[], any]
        problemCount += count[0].cnt
        projectCount++
      }
    }

    res.json({
      message: "索引生成成功",
      path: INDEX_DIR,
      projects: projectCount,
      problems: problemCount,
      files: [
        "L1-projects.md",
        ...projects.map((p: any) => `L2-project-${p.id}.md`),
      ],
    })
  } catch (e: any) {
    res.status(500).json({ error: "索引生成失败: " + e.message })
  }
})

// Generate index for a single project
router.get("/:projectId/generate-index", requireAuth, requireRole("root", "admin"), async (req: Request, res: Response) => {
  try {
    ensureDir(INDEX_DIR)
    const projectId = Number(req.params.projectId)

    // Regenerate L1
    const l1Content = await generateL1Index()
    fs.writeFileSync(path.join(INDEX_DIR, "L1-projects.md"), l1Content, "utf-8")

    // Generate L2 for this project
    const l2Content = await generateL2Index(projectId)
    if (!l2Content) {
      res.status(404).json({ error: "项目不存在" })
      return
    }
    fs.writeFileSync(path.join(INDEX_DIR, `L2-project-${projectId}.md`), l2Content, "utf-8")

    const [count] = await getPool().query(
      "SELECT COUNT(*) as cnt FROM problems WHERE project_id = ?",
      [projectId]
    ) as [any[], any]

    res.json({
      message: "索引生成成功",
      path: INDEX_DIR,
      problems: count[0].cnt,
      files: [`L1-projects.md`, `L2-project-${projectId}.md`],
    })
  } catch (e: any) {
    res.status(500).json({ error: "索引生成失败: " + e.message })
  }
})

export default router

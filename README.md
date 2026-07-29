# DataCop

知识库管理系统，支持文档上传/清洗和项目级问题跟踪。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + React Router v6 |
| 后端 | Express 4 + TypeScript (ESM, tsx) |
| 数据库 | MySQL |
| 认证 | JWT (Bearer Token) |
| 文件上传 | Multer (最大 50MB) |
| 文本提取 | pdf-parse (PDF) / mammoth (DOCX) / jschardet + iconv-lite (编码检测) |

## 项目结构

```
datacop/
├── client/          # 前端 SPA (端口 5173)
│   └── src/
│       ├── pages/       # 页面组件
│       ├── components/  # 共享组件
│       └── context/     # React Context (认证状态)
├── server/          # 后端 API (端口 3001)
│   └── src/
│       ├── routes/      # API 路由
│       ├── db/          # 数据库连接与 Schema
│       ├── middleware/   # RBAC 权限中间件
│       └── uploads/     # 文件上传存储
├── docs/            # API 文档
└── mcp/             # MCP 集成
```

## 快速开始

### 环境要求

- Node.js 18+
- MySQL 5.7+ / 8.0

### 启动后端

```bash
cd server
npm install
npm run dev          # 开发模式 (watch 热重启)
```

后端启动时自动执行数据库 Schema 迁移，首次启动会创建所有表并写入默认 root 账户。

### 启动前端

```bash
cd client
npm install
npm run dev          # http://localhost:5173
```

前端 Vite 开发服务器将 `/api` 请求代理到 `localhost:3001`。

### 默认账户

| 用户名 | 密码 | 角色 |
|--------|------|------|
| root | admin123 | root (超级管理员) |

## 常用命令

```bash
# 后端
cd server && npm run dev       # 开发 (watch)
cd server && npm run start     # 单次运行
cd server && npm run db:init   # 仅执行 Schema 迁移

# 前端
cd client && npm run dev       # 开发服务器
cd client && npm run build     # 类型检查 + 生产构建
cd client && npx tsc --noEmit  # 仅类型检查
```

## 权限模型

| 角色 | 说明 |
|------|------|
| root | 全部权限，可访问所有项目，管理用户和系统设置 |
| admin | 所有项目的读写权限 |
| operator | 指定项目的读写权限 (通过 `projects.operator_id` 或 `project_members` 表) |
| user | 指定项目的只读权限 (通过 `project_members` 表) |

RBAC 中间件位于 `server/src/middleware/rbac.ts`，通过 `requireRole()` 检查全局角色，`requireProjectRead/Write()` 检查项目级权限。

## 主要功能

- **项目管理** — 创建和管理多个知识库项目
- **文档上传与清洗** — 支持 PDF、DOCX、TXT 等格式，自动编码检测与文本提取
- **问题跟踪** — 每个项目独立的问题列表，支持创建、编辑、状态管理
- **用户与权限** — 多角色 RBAC，项目级别的成员管理
- **系统设置** — 可配置的全局参数

## API 文档

完整的 API 接口文档见 [docs/API.md](docs/API.md)，包含所有端点、请求/响应格式和数据库 Schema。

## 注意事项

- 后端使用 ESM (`"type": "module"`)，本地导入需包含 `.ts` 扩展名
- 数据库连接池采用懒加载模式，必须先调用 `initPool()` 再调用 `initDB()`
- Schema 迁移使用幂等方式 (`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` guard)，可安全重复执行
- `problems` 表无外键约束，`project_id` 仅有索引
- 上传的中文文件名通过 `fixFilename()` 从 latin1 转换为 utf8

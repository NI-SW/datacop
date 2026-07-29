# DataCop API 文档

**Base URL:** `http://localhost:3001/api`

**认证方式:** JWT Bearer Token，所有需要认证的接口在请求头中携带：
```
Authorization: Bearer <token>
```

**权限模型：**
| 角色 | 说明 |
|------|------|
| root | 全部权限，访问全部项目，管理用户和系统设置 |
| admin | 全部项目的读写权限 |
| operator | 指定项目的读写权限（通过 `projects.operator_id` 或 `project_members` 表） |
| user | 指定项目的只读权限（通过 `project_members` 表） |

---

## 1. 认证模块 (`/api/auth`)

### POST `/api/auth/login` — 登录
**无需认证**

请求体：
```json
{
  "username": "root",
  "password": "admin123"
}
```

成功响应 (200)：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 1, "username": "root", "role": "root" }
}
```

错误响应：
- 400: `{ "error": "用户名和密码不能为空" }`
- 401: `{ "error": "用户名或密码错误" }`

---

### POST `/api/auth/register` — 注册新用户
**无需认证**

请求体：
```json
{
  "username": "newuser",
  "password": "pass123"
}
```

成功响应 (201)：`{ "message": "注册成功" }`

错误响应：
- 400: `{ "error": "用户名和密码不能为空" }`
- 400: `{ "error": "密码至少6位" }`
- 409: `{ "error": "用户名已存在" }`

---

## 2. 用户管理 (`/api/users`)

### GET `/api/users` — 用户列表
**权限:** root, admin

响应 (200)：
```json
[
  { "id": 1, "username": "root", "role": "root", "created_at": "2026-07-26T..." },
  { "id": 2, "username": "stream", "role": "operator", "created_at": "2026-07-26T..." }
]
```

---

### POST `/api/users` — 创建用户
**权限:** root

请求体：
```json
{
  "username": "operator1",
  "password": "op123",
  "role": "operator"
}
```

成功响应 (201)：`{ "id": 3, "message": "创建成功" }`

角色可选值：`root` | `admin` | `operator` | `user`（默认 `user`）

---

### PUT `/api/users/:id` — 更新用户
**权限:** root

请求体（修改密码）：
```json
{
  "username": "newname",
  "password": "newpass",
  "role": "admin"
}
```

请求体（不改密码）：
```json
{
  "username": "newname",
  "role": "admin"
}
```

成功响应 (200)：`{ "message": "更新成功" }`

---

### DELETE `/api/users/:id` — 删除用户
**权限:** root

成功响应 (200)：`{ "message": "删除成功" }`

---

## 3. 项目管理 (`/api/projects`)

### GET `/api/projects` — 项目列表
**权限:** 登录用户

- root/admin：返回全部项目
- operator/user：返回该项目的成员项目 + 自己是 operator 的项目

响应 (200)：
```json
[
  {
    "id": 2,
    "name": "stream-knowleged",
    "description": "stream-questions",
    "operator_id": 2,
    "created_at": "2026-07-26T..."
  }
]
```

---

### POST `/api/projects` — 创建项目
**权限:** root, admin

请求体：
```json
{
  "name": "新项目",
  "description": "项目描述",
  "operator_id": 2
}
```

成功响应 (201)：`{ "id": 4, "message": "创建成功" }`

---

### GET `/api/projects/:id` — 项目详情
**权限:** 项目成员 / root / admin

响应 (200)：
```json
{
  "id": 2,
  "name": "stream-knowleged",
  "description": "stream-questions",
  "operator_id": 2,
  "created_at": "2026-07-26T...",
  "updated_at": "2026-07-26T..."
}
```

---

### PUT `/api/projects/:id` — 更新项目
**权限:** root, admin, 项目 operator

请求体：
```json
{
  "name": "新名称",
  "description": "新描述",
  "operator_id": 3
}
```

成功响应 (200)：`{ "message": "更新成功" }`

---

### DELETE `/api/projects/:id` — 删除项目
**权限:** root

成功响应 (200)：`{ "message": "删除成功" }`

---

## 4. 项目成员 (`/api/projects/:projectId/members`)

### GET `/api/projects/:projectId/members` — 成员列表
**权限:** 项目成员 / root / admin

响应 (200)：
```json
[
  {
    "id": 2,
    "username": "stream",
    "role": "operator",
    "project_role": "operator",
    "created_at": "2026-07-26T..."
  }
]
```

---

### POST `/api/projects/:projectId/members` — 添加成员
**权限:** root, admin, 项目 operator

请求体：
```json
{
  "user_id": 3,
  "role": "operator"
}
```

成员角色：`operator` | `user`（默认 `user`）

成功响应 (200)：`{ "message": "成员添加成功" }`

---

### DELETE `/api/projects/:projectId/members/:userId` — 移除成员
**权限:** root, admin, 项目 operator

成功响应 (200)：`{ "message": "成员移除成功" }`

---

## 5. 文档管理 (`/api/projects/:projectId/documents`)

### GET `/api/projects/:projectId/documents` — 文档列表
**权限:** 项目成员 / root / admin

响应 (200)：
```json
[
  {
    "id": 1,
    "project_id": 2,
    "filename": "1785116962664-abc123.pdf",
    "original_name": "i2StreamDM同步手册.pdf",
    "size": 524288,
    "mime_type": "application/pdf",
    "status": "pending",
    "content_text": null,
    "cleaned_content": null,
    "created_at": "2026-07-27T...",
    "updated_at": "2026-07-27T..."
  }
]
```

---

### POST `/api/projects/:projectId/documents/upload` — 上传文档
**权限:** 项目 operator / root / admin
**Content-Type:** `multipart/form-data`

参数：
| 字段 | 类型 | 说明 |
|------|------|------|
| file | File | 文件（最大 50MB） |

成功响应 (201)：`{ "id": 1, "message": "上传成功" }`

支持的文本清洗格式：txt, csv, log, md, json, xml, html, pdf, docx

---

### GET `/api/projects/:projectId/documents/:id` — 文档详情
**权限:** 项目成员 / root / admin

响应 (200)：同列表项结构

---

### GET `/api/projects/:projectId/documents/:id/download` — 下载文档
**权限:** 项目成员 / root / admin

响应：文件流（`Content-Disposition: attachment; filename*=UTF-8''...`）

---

### PUT `/api/projects/:projectId/documents/:id` — 更新文档内容
**权限:** 项目 operator / root / admin

请求体：
```json
{
  "cleaned_content": "清洗后的文本内容",
  "original_name": "新文件名.pdf"
}
```

`cleaned_content` 不传则只改名，`original_name` 不传则只改内容。

成功响应 (200)：`{ "message": "更新成功" }`

---

### POST `/api/projects/:projectId/documents/:id/clean` — 清洗文档
**权限:** 项目 operator / root / admin

自动提取文本（txt/pdf/docx），支持 GBK/UTF-8 编码自动检测。

成功响应 (200)：
```json
{
  "message": "清洗完成",
  "content_text": "提取出的文本内容..."
}
```

---

### POST `/api/projects/:projectId/documents/:id/flag` — 标记文档状态
**权限:** 项目 operator / root / admin

请求体：
```json
{
  "status": "problematic"
}
```

状态值：`problematic` | `eliminated`

成功响应 (200)：`{ "message": "状态更新成功" }`

---

### DELETE `/api/projects/:projectId/documents/:id` — 删除文档
**权限:** 项目 operator / root / admin

删除文件 + 数据库记录。

成功响应 (200)：`{ "message": "删除成功" }`

---

## 6. 问题管理 (`/api/projects/:projectId/problems`)

### GET `/api/projects/:projectId/problems` — 问题列表（支持搜索和筛选）
**权限:** 项目成员 / root / admin

查询参数：
| 参数 | 类型 | 说明 |
|------|------|------|
| q | string | 搜索关键词（模糊匹配所有字段） |
| field | string | 指定搜索字段（精确匹配该字段） |
| status | string | 状态筛选：`pending`（待定）/ `valid`（已保留） |

`field` 可选值：`name`, `description`, `scenario`, `trigger_method`, `symptoms`, `cause`, `solution`, `verification`, `notes`

示例：
```
GET /api/projects/2/problems?q=部署&field=name
GET /api/projects/2/problems?status=valid
GET /api/projects/2/problems?q=部署&status=pending
```

响应 (200)：
```json
[
  {
    "id": 1,
    "project_id": 2,
    "name": "部署问题1",
    "description": "部署时遇到1号错误",
    "scenario": "生产环境部署",
    "trigger_method": "手动触发",
    "symptoms": "服务启动失败",
    "cause": "配置文件缺失",
    "solution": "重新部署",
    "verification": "服务正常启动",
    "notes": "",
    "status": "pending",
    "created_by": 1,
    "created_at": "2026-07-27T...",
    "updated_at": "2026-07-27T..."
  }
]
```

---

### POST `/api/projects/:projectId/problems` — 创建问题
**权限:** 项目 operator / root / admin

请求体：
```json
{
  "name": "问题名称",
  "description": "问题简介",
  "scenario": "问题场景",
  "trigger_method": "触发方式",
  "symptoms": "问题症状",
  "cause": "问题原因",
  "solution": "解决方案",
  "verification": "验证方式",
  "notes": "备注"
}
```

必填字段：`name`。新问题默认 `status: "pending"`。

成功响应 (201)：`{ "id": 1, "message": "问题上传成功" }`

---

### GET `/api/projects/:projectId/problems/:id` — 问题详情
**权限:** 项目成员 / root / admin

响应 (200)：同列表项结构

---

### PUT `/api/projects/:projectId/problems/:id` — 更新问题
**权限:** 项目 operator / root / admin

请求体：同创建，只传需要修改的字段（未传的字段不更新）。

成功响应 (200)：`{ "message": "问题更新成功" }`

---

### PATCH `/api/projects/:projectId/problems/:id/status` — 更新问题状态
**权限:** 项目 operator / root / admin

请求体：
```json
{
  "status": "valid"
}
```

状态值：`pending`（待定）| `valid`（已保留）

成功响应 (200)：
- 状态 `valid`：`{ "message": "已保留" }`
- 状态 `pending`：`{ "message": "已设为待定" }`

---

### DELETE `/api/projects/:projectId/problems/:id` — 删除单个问题
**权限:** 项目 operator / root / admin

成功响应 (200)：`{ "message": "删除成功" }`

---

### DELETE `/api/projects/:projectId/problems` — 批量删除问题
**权限:** 项目 operator / root / admin

请求体：
```json
{
  "ids": [1, 2, 3]
}
```

成功响应 (200)：`{ "message": "已删除 3 个问题" }`

---

## 7. 系统设置 (`/api/settings`)

### GET `/api/settings` — 获取所有设置
**权限:** root

响应 (200)：
```json
[
  { "id": 1, "key_name": "site_name", "value": "DataCop", "updated_at": "..." }
]
```

---

### PUT `/api/settings` — 更新设置
**权限:** root

请求体：
```json
{
  "key": "site_name",
  "value": "DataCop-Production"
}
```

成功响应 (200)：`{ "message": "设置已更新" }`

---

## 数据库表结构

### users
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 用户ID |
| username | VARCHAR(50) | 用户名（唯一） |
| password_hash | VARCHAR(255) | 密码哈希（bcrypt） |
| role | ENUM | root / admin / operator / user |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### projects
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 项目ID |
| name | VARCHAR(100) | 项目名称 |
| description | TEXT | 项目描述 |
| operator_id | INT FK | 项目管理员（关联 users.id） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### project_members
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 记录ID |
| project_id | INT FK | 项目ID |
| user_id | INT FK | 用户ID |
| role | ENUM | operator / user |
| created_at | TIMESTAMP | 添加时间 |

唯一约束：`(project_id, user_id)`

### documents
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 文档ID |
| project_id | INT FK | 所属项目 |
| filename | VARCHAR(255) | 存储文件名（时间戳+随机） |
| original_name | VARCHAR(255) | 原始文件名 |
| file_path | VARCHAR(500) | 文件存储路径 |
| size | BIGINT | 文件大小（字节） |
| mime_type | VARCHAR(100) | MIME 类型 |
| status | ENUM | pending / cleaned / problematic / eliminated |
| content_text | LONGTEXT | 自动提取的文本 |
| cleaned_content | LONGTEXT | 人工修正的文本 |
| created_at | TIMESTAMP | 上传时间 |
| updated_at | TIMESTAMP | 更新时间 |

### problems
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 问题ID |
| project_id | INT FK | 所属项目 |
| name | VARCHAR(255) | 问题名称 |
| description | TEXT | 问题简介 |
| scenario | TEXT | 问题场景 |
| trigger_method | TEXT | 触发方式 |
| symptoms | TEXT | 问题症状 |
| cause | TEXT | 问题原因 |
| solution | TEXT | 解决方案 |
| verification | TEXT | 验证方式 |
| notes | TEXT | 备注 |
| status | VARCHAR(20) | pending（待定）/ valid（已保留） |
| created_by | INT FK | 创建者（关联 users.id） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

索引：`FULLTEXT INDEX ft_problems_name (name)`, `FULLTEXT INDEX ft_problems_text (description, scenario, trigger_method, symptoms, cause, solution, verification, notes)`

### system_settings
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 记录ID |
| key_name | VARCHAR(100) | 设置键（唯一） |
| value | TEXT | 设置值 |
| updated_at | TIMESTAMP | 更新时间 |

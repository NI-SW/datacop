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

### GET `/api/auth/me` — 校验当前 token
**权限:** 登录用户（`Authorization: Bearer <token>`）

用于前端启动时校验 token 是否有效，并获取最新用户信息（角色可能已被管理员调整）。

成功响应 (200)：
```json
{ "user": { "id": 1, "username": "root", "role": "root" } }
```

错误响应：
- 401: `{ "error": "未登录" }` / `{ "error": "登录已过期" }` / `{ "error": "账号不存在" }`

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

错误响应：
- 400: `{ "error": "用户名和密码不能为空" }`
- 400: `{ "error": "密码至少6位" }`
- 409: `{ "error": "用户名已存在" }`

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

错误响应：
- 400: `{ "error": "密码至少6位" }`（提供密码时）
- 400: `{ "error": "无效的角色" }`（role 不在 root/admin/operator/user 内）
- 400: `{ "error": "不能取消最后一个 root 账号的管理员角色" }`（把最后一个 root 改成其他角色）
- 404: `{ "error": "用户不存在" }`
- 409: `{ "error": "用户名已存在" }`

---

### DELETE `/api/users/:id` — 删除用户
**权限:** root

防呆限制：
- 不能删除当前登录的账号
- 不能删除最后一个 root 账号

成功响应 (200)：`{ "message": "删除成功" }`

错误响应：
- 400: `{ "error": "不能删除当前登录的账号" }`
- 400: `{ "error": "不能删除最后一个 root 账号" }`
- 404: `{ "error": "用户不存在" }`

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

响应 (200)（`my_role` 为当前用户在该项目内的有效角色，前端据此隐藏写操作入口）：
```json
{
  "id": 2,
  "name": "stream-knowleged",
  "description": "stream-questions",
  "operator_id": 2,
  "created_at": "2026-07-26T...",
  "updated_at": "2026-07-26T...",
  "my_role": "operator"
}
```

`my_role` 取值：`root` / `admin`（全局角色）/ `operator`（项目 operator 或 members 中 role=operator）/ `user`（只读成员）

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

### GET `/api/projects/export/problems` — 批量导出项目问题集
**权限:** root, admin

查询参数：
- `ids`: 逗号分隔的项目 ID，如 `?ids=1,2,3`

响应 (200)：与批量导入格式兼容，可直接用于 `/api/projects/import`
```json
{
  "projects": [
    {
      "id": 2,
      "name": "stream-knowleged",
      "description": "stream-questions",
      "operator_id": 2,
      "operator_username": "stream",
      "operator_role": "operator",
      "problems": [
        {
          "id": 538,
          "name": "问题名称",
          "description": "问题简介",
          "scenario": "问题场景",
          "trigger_method": "触发方式",
          "symptoms": "问题症状",
          "cause": "问题原因",
          "solution": "解决方案",
          "verification": "验证方式",
          "notes": "备注",
          "status": "pending|valid",
          "created_at": "2026-07-28T10:16:21.000Z"
        }
      ]
    }
  ]
}
```

错误响应：
- 400: `{ "error": "请选择要导出的项目" }`

---

### POST `/api/projects/import` — 批量导入项目
**权限:** root

请求体（支持 `projects` 数组或直接数组；`operator` 可为字符串用户名或 `{ username, password }` 对象；未提供密码时使用默认密码 `Info@1234`）：
```json
{
  "projects": [
    {
      "name": "新项目",
      "description": "项目描述",
      "operator_username": "zhangsan",
      "operator_role": "operator",
      "problems": [
        {
          "name": "问题名称",
          "description": "问题简介",
          "status": "pending"
        }
      ]
    }
  ]
}
```

导入规则：
- 每个项目必须有 `name`，否则跳过
- `operator_username` 对应的用户不存在时自动创建（全局角色取 `operator_role` 或 `operator.role`，缺省 `operator`；密码为默认密码 `Info@1234`，文件可指定 `operator.password` 覆盖）；已存在则复用且不修改密码、不修改角色
- 自动将操作员加入 `project_members`（角色 `operator`）
- `problems` 数组可选，`status` 仅 `valid`/`pending` 有效，其余默认 `pending`

成功响应 (201)：
```json
{
  "message": "成功导入 2 个项目、3 个问题",
  "created_users": ["zhangsan"],
  "reused_users": [],
  "imported_projects": 2,
  "imported_problems": 3,
  "results": [
    { "name": "新项目", "project_id": 16, "operator_username": "zhangsan", "user_created": true }
  ]
}
```

错误响应：
- 400: `{ "error": "导入文件中没有项目数据" }`

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

## 5. 问题管理 (`/api/projects/:projectId/problems`)

### GET `/api/projects/:projectId/problems` — 问题列表（支持搜索、筛选、排序、分页）
**权限:** 项目成员 / root / admin

查询参数：
| 参数 | 类型 | 说明 |
|------|------|------|
| q | string | 搜索关键词（按空格拆词，每个词都要命中；未指定 field 时模糊匹配所有字段） |
| field | string | 指定搜索字段（匹配该字段） |
| status | string | 状态筛选：`pending`（待定）/ `valid`（已保留） |
| sort | string | 排序字段：`created_at`（默认）/ `updated_at` / `name` |
| order | string | `asc` / `desc`（默认 `desc`；sort=name 时前端传 asc） |
| page | number | 页码（从 1 开始）。**传 page 或 pageSize 即启用分页** |
| pageSize | number | 每页条数（默认 20，最大 100） |

`field` 可选值：`name`, `description`, `scenario`, `trigger_method`, `symptoms`, `cause`, `solution`, `verification`, `notes`

示例：
```
GET /api/projects/2/problems?q=部署&field=name
GET /api/projects/2/problems?status=valid&page=1&pageSize=20
GET /api/projects/2/problems?q=连接 超时&sort=updated_at
GET /api/projects/2/problems            # 不传分页参数返回完整数组（导出用）
```

分页响应 (200)（传了 page/pageSize 时）：
```json
{
  "items": [ { "id": 1, "project_id": 2, "name": "部署问题1", "...": "...", "status": "pending", "created_by_username": "root", "created_at": "...", "updated_at": "..." } ],
  "total": 53,
  "page": 1,
  "pageSize": 20
}
```

每条问题额外返回 `created_by_username`（LEFT JOIN users；`created_by` 仍为用户 ID），单条查询接口同。

未传分页参数时响应为数组（与旧版兼容，供导出使用）。`status` 仅可能取 `pending` / `valid`，历史遗留的其他取值会在服务启动迁移时归一化为 `pending`。

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

### PATCH `/api/projects/:projectId/problems/project` — 批量更改问题所属项目
**权限:** root

请求体：
```json
{
  "ids": [1, 2, 3],
  "project_id": 5
}
```

成功响应 (200)：`{ "message": "已移动 3 个问题到目标项目" }`

错误响应：
- 400: `{ "error": "请选择要移动的问题" }`
- 400: `{ "error": "缺少目标项目ID" }`
- 404: `{ "error": "目标项目不存在" }`

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

## 6. 系统设置 (`/api/settings`)

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

成功响应 (200)：`{ "message": "设置已更新" }`（key 已存在时覆盖，即 upsert）

---

### DELETE `/api/settings/:key` — 删除设置项
**权限:** root

成功响应 (200)：`{ "message": "设置已删除" }`

错误响应：
- 404: `{ "error": "设置项不存在" }`

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

# DataCop MCP Server (Python / HTTP)

DataCop 问题检索 MCP 服务器，支持 StreamableHTTP 远程访问。

## 环境要求

- Python 3.10+

## 安装

```bash
cd mcp/python
uv venv --python 3.11 .venv
source .venv/bin/activate
uv pip install "mcp>=1.8.0" pymysql
```

## 配置

编辑 `config.json`：

```json
{
  "port": 8301,
  "apiKeys": [],
  "db": {
    "host": "192.168.34.65",
    "port": 3306,
    "user": "root",
    "password": "***",
    "database": "datacop"
  }
}
```

### API 密钥认证（HTTP 层）

支持两种管理方式，**数据库管理（推荐）** 和配置文件管理：

**① 数据库管理（通过前端管理页面）**

在前端「密钥管理」页面（`/admin/mcp-keys`）生成、禁用、删除密钥。密钥存入 `mcp_api_keys` 表，自动绑定用户身份，可直接作为工具 token 免登录。MCP 服务器每 30 秒刷新缓存。

- 创建密钥后明文仅显示一次，请立即复制保存
- 禁用后 30 秒内生效
- 删除后不可恢复
- 表为空时 MCP 服务器放行所有请求（向后兼容）；一旦创建过密钥，即使全部禁用也会拒绝未认证请求

**② 配置文件管理（config.json，向后兼容）**

```json
"apiKeys": [
  { "key": "root-key", "username": "root" },
  { "key": "plain-key" }
]
```

配置文件密钥支持两种格式：
- 对象 `{"key":"...","username":"..."}` → 绑定身份，免登录
- 纯字符串 `"key"` → 仅 HTTP 认证

两种方式可共存，DB 密钥和 config 密钥都会被校验。

环境变量覆盖：`MCP_PORT`、`DB_HOST`、`DB_PORT`、`DB_PASSWORD`、`MCP_API_KEYS`（逗号分隔，仅纯字符串密钥）

## 启动

```bash
cd mcp/python
./run.sh
# 或
source .venv/bin/activate
python server.py
```

端点：`http://0.0.0.0:8301/mcp`

## MCP 客户端配置

> 启用 `apiKeys` 后，客户端必须在连接时携带密钥请求头（二选一）：
> `Authorization: Bearer <your-api-key>` 或 `X-API-Key: <your-api-key>`

### Hermes Agent

```yaml
# ~/.hermes/config.yaml
mcp_servers:
  datacop:
    url: "http://localhost:8301/mcp"
    headers:
      Accept: "application/json, text/event-stream"
      Authorization: "Bearer your-secret-api-key"   # apiKeys 为空时无需
```

### Claude Code / Cursor

```json
{
  "mcpServers": {
    "datacop": {
      "url": "http://localhost:8301/mcp",
      "headers": { "Authorization": "Bearer your-secret-api-key" }
    }
  }
}
```

## 工具列表

> 认证方式：在 MCP 客户端配置 API 密钥请求头（`Authorization: Bearer <密钥>`），工具无需传 token 参数，服务器自动从请求上下文获取已认证用户身份。

| 工具 | 说明 | 参数 |
|------|------|------|
| `list_projects` | 获取项目列表 | 无 |
| `list_problems` | 获取问题列表 | `project_id`, `status?` |
| `search_problems` | 搜索问题（`exact_match=true` 时按整词精确匹配错误码，如 `-108` 不命中 `-5108`） | `project_id`, `keyword`, `field?`, `status?`, `exact_match?` |
| `get_problem` | 获取单个问题完整详情（含触发方式/症状/原因/方案/验证方式/备注） | `project_id`, `problem_id` |
| `get_index` | 分层检索索引 | `level(1/2)`, `project_id?` |
| `create_problem` | 创建（上传）单个问题，`name` 必填（需项目写权限） | `project_id`, `name`, 各可选字段... |
| `import_problems` | 批量导入问题，`problems` 为对象数组，每项需含 `name`（需项目写权限） | `project_id`, `problems` |

## 使用流程

1. 在前端「密钥管理」页面创建 API 密钥（绑定用户身份）
2. 在 MCP 客户端配置请求头 `Authorization: Bearer <你的密钥>`
3. 调用 `get_index(level=1)` 定位项目
4. 调用 `get_index(level=2, project_id=N)` 定位问题
5. 调用 `search_problems` 精确搜索，`get_problem` 获取完整详情
6. 需要入库时调用 `create_problem`（单个）或 `import_problems`（批量，兼容群聊问题总结 JSON 格式）——需 root/admin/项目 operator 权限

# DataCop MCP Server (Python / HTTP)

DataCop 问题检索 MCP 服务器，支持 StreamableHTTP 远程访问。

## 环境要求

- Python 3.10+

## 安装

```bash
cd mcp/python
uv venv --python 3.11 .venv
source .venv/bin/activate
uv pip install "mcp>=1.8.0" pymysql bcrypt PyJWT
```

## 配置

编辑 `config.json`：

```json
{
  "port": 8301,
  "jwt_secret": "your-secret-key",
  "jwt_ttl_hours": 24,
  "db": {
    "host": "192.168.34.65",
    "port": 3306,
    "user": "root",
    "password": "***",
    "database": "datacop"
  }
}
```

环境变量覆盖：`MCP_PORT`、`DB_HOST`、`DB_PORT`、`DB_PASSWORD`、`MCP_JWT_SECRET`

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

### Hermes Agent

```yaml
# ~/.hermes/config.yaml
mcp_servers:
  datacop:
    url: "http://localhost:8301/mcp"
    headers:
      Accept: "application/json, text/event-stream"
```

### Claude Code / Cursor

```json
{
  "mcpServers": {
    "datacop": {
      "url": "http://localhost:8301/mcp"
    }
  }
}
```

## 工具列表

| 工具 | 说明 | 参数 |
|------|------|------|
| `login` | 验证用户身份并登录，返回 token | `username`, `password` |
| `list_projects` | 获取项目列表 | `token` |
| `list_problems` | 获取问题列表 | `token`, `project_id`, `status?` |
| `search_problems` | 搜索问题 | `token`, `project_id`, `keyword`, `field?`, `status?` |
| `get_index` | 分层检索索引 | `token`, `level(1/2)`, `project_id?` |

## 使用流程

1. 调用 `login` 获取 token
2. 后续调用传入 token 作为参数
3. 调用 `get_index(level=1)` 定位项目
4. 调用 `get_index(level=2, project_id=N)` 定位问题
5. 调用 `search_problems` 精确搜索

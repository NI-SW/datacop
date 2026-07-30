import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import pymysql
from mcp.server.fastmcp import FastMCP

# ── 配置 ─────────────────────────────────────────────────

def load_config(config_path=None):
    defaults = {
        "port": 8301,
        "apiKeys": [],
        "db": {
            "host": "192.168.34.65",
            "port": 3306,
            "user": "root",
            "password": "Info@1234",
            "database": "datacop",
        },
        "jwt_secret": "datacop-mcp-secret-2024",
        "jwt_ttl_hours": 24,
    }
    path = config_path or os.environ.get(
        "MCP_CONFIG",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json"),
    )
    if os.path.exists(path):
        try:
            with open(path) as f:
                overrides = json.load(f)
            for k in ("port", "apiKeys", "jwt_secret", "jwt_ttl_hours"):
                if k in overrides:
                    defaults[k] = overrides[k]
            if "db" in overrides:
                defaults["db"].update(overrides["db"])
        except Exception as e:
            print(f"[config] 无法解析 {path}: {e}", file=sys.stderr)
    return defaults


config = load_config()

# 环境变量覆盖
_env_map = {
    "MCP_PORT":        ("port", int),
    "MCP_JWT_SECRET":  ("jwt_secret", str),
    "DB_HOST":         ("db.host", str),
    "DB_PORT":         ("db.port", int),
    "DB_USER":         ("db.user", str),
    "DB_PASSWORD":     ("db.password", str),
    "DB_DATABASE":     ("db.database", str),
}
for env_key, (cfg_path, cast) in _env_map.items():
    val = os.environ.get(env_key)
    if val:
        try:
            v = cast(val)
            if "." in cfg_path:
                section, key = cfg_path.split(".")
                config[section][key] = v
            else:
                config[cfg_path] = v
        except (ValueError, TypeError):
            pass

# ── 数据库 ───────────────────────────────────────────────

DB_CONFIG = dict(
    host=config["db"]["host"],
    port=config["db"]["port"],
    user=config["db"]["user"],
    password=config["db"]["password"],
    database=config["db"]["database"],
    charset="utf8mb4",
    cursorclass=pymysql.cursors.DictCursor,
)


def get_db():
    return pymysql.connect(**DB_CONFIG)


# ── JWT 认证 ──────────────────────────────────────────────

def create_token(user: dict) -> str:
    payload = {
        "sub": str(user["id"]),
        "username": user["username"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=config["jwt_ttl_hours"]),
    }
    return jwt.encode(payload, config["jwt_secret"], algorithm="HS256")


def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, config["jwt_secret"], algorithms=["HS256"])
        return {"id": int(payload["sub"]), "username": payload["username"], "role": payload["role"]}
    except jwt.ExpiredSignatureError:
        raise ValueError("登录已过期，请重新登录")
    except jwt.InvalidTokenError:
        raise ValueError("无效的登录凭证")


def verify_auth(token: str | None, required_roles: list[str] | None = None) -> dict:
    if not token:
        raise ValueError("未登录，请先调用 login 工具获取 token")
    user = verify_token(token)
    if required_roles and user["role"] not in required_roles:
        raise ValueError(f"权限不足，需要角色: {'/'.join(required_roles)}")
    return user


def verify_project(token: str, project_id: int, write: bool = False):
    user = verify_auth(token)
    if user["role"] in ("root", "admin"):
        return
    db = get_db()
    with db.cursor() as cur:
        cur.execute("SELECT operator_id FROM projects WHERE id=%s", (project_id,))
        proj = cur.fetchone()
        if not proj:
            raise ValueError("项目不存在")
        if proj["operator_id"] == user["id"]:
            return
        cur.execute(
            "SELECT role FROM project_members WHERE project_id=%s AND user_id=%s",
            (project_id, user["id"]),
        )
        member = cur.fetchone()
        if not member:
            raise ValueError("无权访问该项目")
        if write and member["role"] != "operator":
            raise ValueError("无权修改该项目")
    db.close()


# ── MCP Server ────────────────────────────────────────────

mcp = FastMCP(
    "datacop",
    port=config["port"],
    host="0.0.0.0",
    stateless_http=True,
)


@mcp.tool()
def login(username: str, password: str) -> str:
    """验证用户身份并登录。返回 token，后续调用其他工具时传入此 token。"""
    db = get_db()
    with db.cursor() as cur:
        cur.execute("SELECT id, username, password_hash, role FROM users WHERE username=%s", (username,))
        user = cur.fetchone()
    db.close()

    if not user or not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        return "登录失败：用户名或密码错误"

    token = create_token(user)
    return (
        f"登录成功\n"
        f"用户ID: {user['id']}\n"
        f"用户名: {user['username']}\n"
        f"角色: {user['role']}\n"
        f"token: {token}\n\n"
        f"后续调用其他工具时，请将此 token 作为 token 参数传入。"
    )


@mcp.tool()
def list_projects(token: str) -> str:
    """获取当前用户可见的项目列表。token 从 login 工具获取。"""
    user = verify_auth(token)
    db = get_db()
    with db.cursor() as cur:
        if user["role"] in ("root", "admin"):
            cur.execute("""
                SELECT p.id, p.name, p.description, u.username as operator_name
                FROM projects p LEFT JOIN users u ON p.operator_id = u.id ORDER BY p.id
            """)
        else:
            cur.execute("""
                SELECT DISTINCT p.id, p.name, p.description, u.username as operator_name
                FROM projects p
                LEFT JOIN users u ON p.operator_id = u.id
                LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = %s
                WHERE pm.user_id IS NOT NULL OR p.operator_id = %s
            """, (user["id"], user["id"]))
        projects = cur.fetchall()
    db.close()

    if not projects:
        return "暂无可见项目"
    lines = [f"[{p['id']}] {p['name']} | {p['description'] or '无描述'} | 管理员: {p['operator_name'] or '-'}" for p in projects]
    return f"共 {len(projects)} 个项目:\n\n" + "\n".join(lines)


@mcp.tool()
def list_problems(token: str, project_id: int, status: str | None = None) -> str:
    """获取指定项目的问题列表。status 可选 pending/valid。"""
    verify_project(token, project_id)
    db = get_db()
    with db.cursor() as cur:
        sql = "SELECT id, name, description, status FROM problems WHERE project_id=%s"
        params = [project_id]
        if status:
            sql += " AND status=%s"
            params.append(status)
        sql += " ORDER BY status DESC, id"
        cur.execute(sql, params)
        problems = cur.fetchall()
    db.close()

    if not problems:
        return "该项目暂无问题"
    lines = [f"[{p['id']}] {p['name']} ({p['status']}) | {p['description'] or '无描述'}" for p in problems]
    return f"项目 {project_id} 共 {len(problems)} 个问题:\n\n" + "\n".join(lines)


@mcp.tool()
def search_problems(
    token: str,
    project_id: int,
    keyword: str,
    field: str | None = None,
    status: str | None = None,
) -> str:
    """在指定项目内搜索问题。field 可指定搜索字段，不填则搜索全部文本字段。"""
    verify_project(token, project_id)
    searchable = ["name", "description", "scenario", "trigger_method", "symptoms", "cause", "solution", "verification", "notes"]

    db = get_db()
    with db.cursor() as cur:
        like = f"%{keyword}%"
        sql = "SELECT id, name, description, status, scenario, cause, solution FROM problems WHERE project_id=%s"
        params: list = [project_id]

        if status:
            sql += " AND status=%s"
            params.append(status)
        if field and field in searchable:
            sql += f" AND {field} LIKE %s"
            params.append(like)
        else:
            sql += " AND (" + " OR ".join(f"{f} LIKE %s" for f in searchable) + ")"
            params.extend([like] * len(searchable))

        sql += " ORDER BY status DESC, id"
        cur.execute(sql, params)
        results = cur.fetchall()
    db.close()

    if not results:
        return f'未找到与"{keyword}"相关的问题'

    lines = []
    for p in results:
        parts = [f"[{p['id']}] {p['name']} ({p['status']})"]
        if p.get("description"):
            parts.append(f"描述: {p['description']}")
        if p.get("cause"):
            parts.append(f"原因: {p['cause']}")
        if p.get("solution"):
            parts.append(f"方案: {p['solution']}")
        lines.append(" | ".join(parts))
    return f'搜索"{keyword}"找到 {len(results)} 个问题:\n\n' + "\n\n".join(lines)


@mcp.tool()
def get_index(token: str, level: int, project_id: int | None = None) -> str:
    """获取分层检索索引。level=1 返回项目列表，level=2 返回指定项目的问题索引。"""
    if level == 1:
        user = verify_auth(token)
        db = get_db()
        with db.cursor() as cur:
            if user["role"] in ("root", "admin"):
                cur.execute("""
                    SELECT p.id, p.name, p.description, u.username as operator_name
                    FROM projects p LEFT JOIN users u ON p.operator_id = u.id ORDER BY p.id
                """)
            else:
                cur.execute("""
                    SELECT DISTINCT p.id, p.name, p.description, u.username as operator_name
                    FROM projects p
                    LEFT JOIN users u ON p.operator_id = u.id
                    LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = %s
                    WHERE pm.user_id IS NOT NULL OR p.operator_id = %s
                """, (user["id"], user["id"]))
            projects = cur.fetchall()
        db.close()

        if not projects:
            return "=== Level 1 索引: 项目列表 ===\n\n暂无项目"
        lines = [f"[{p['id']}] {p['name']} | {p['description'] or '无描述'} | 管理员: {p['operator_name'] or '-'}" for p in projects]
        return "=== Level 1 索引: 项目列表 ===\n\n" + "\n".join(lines) + "\n\n使用 get_index(level=2, project_id=N) 获取具体项目的问题索引"

    if level == 2:
        if not project_id:
            raise ValueError("level=2 时必须提供 project_id")
        verify_project(token, project_id)
        db = get_db()
        with db.cursor() as cur:
            cur.execute("SELECT id, name, description FROM projects WHERE id=%s", (project_id,))
            proj = cur.fetchone()
            if not proj:
                raise ValueError("项目不存在")
            cur.execute(
                "SELECT id, name, description, status, scenario, cause, solution FROM problems WHERE project_id=%s ORDER BY status DESC, id",
                (project_id,),
            )
            problems = cur.fetchall()
        db.close()

        if not problems:
            return f"项目「{proj['name']}」暂无问题"

        valid = [p for p in problems if p["status"] == "valid"]
        pending = [p for p in problems if p["status"] == "pending"]

        def fmt(p):
            parts = [f"[{p['id']}] {p['name']}"]
            if p.get("description"):
                parts.append(f"描述:{p['description']}")
            if p.get("solution"):
                parts.append(f"方案:{p['solution'] or ''}")
            return " | ".join(parts)

        text = f"=== Level 2 索引: {proj['name']} ===\n描述: {proj['description'] or '-'}\n问题总数: {len(problems)}\n\n"
        if valid:
            text += f"--- 有效问题 ({len(valid)}) ---\n" + "\n".join(fmt(p) for p in valid) + "\n\n"
        if pending:
            text += f"--- 待定问题 ({len(pending)}) ---\n" + "\n".join(fmt(p) for p in pending)
        return text

    raise ValueError("level 只能是 1 或 2")


# ── 启动 ──────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"[config] port={config['port']}", file=sys.stderr)
    print(f"[config] db={config['db']['host']}:{config['db']['port']}/{config['db']['database']}", file=sys.stderr)
    print(f"[server] DataCop MCP server (HTTP) 已启动", file=sys.stderr)
    print(f"[server] 端点: http://0.0.0.0:{config['port']}/mcp", file=sys.stderr)
    mcp.run(transport="streamable-http")

import hashlib
import hmac
import json
import os
import re
import sys
import time
import contextvars

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
    }
    path = config_path or os.environ.get(
        "MCP_CONFIG",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json"),
    )
    if os.path.exists(path):
        try:
            with open(path) as f:
                overrides = json.load(f)
            for k in ("port", "apiKeys"):
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

# MCP_API_KEYS: 逗号分隔的 API 密钥列表，覆盖 config 中的 apiKeys（仅认证，不绑定身份）
_env_keys = os.environ.get("MCP_API_KEYS")
if _env_keys:
    config["apiKeys"] = [k.strip() for k in _env_keys.split(",") if k.strip()]

# 标准化 apiKeys，支持两种格式：
#   - 字符串 "key"                          → 仅 HTTP 认证
#   - 对象 {"key":..,"username":..}         → HTTP 认证 + 绑定身份（密钥即 token，免登录）
#         或 {"key":..,"userId":..}
def _normalize_api_keys(raw):
    result = []
    for item in raw:
        if isinstance(item, str):
            k = item.strip()
            if k:
                result.append({"key": k})
        elif isinstance(item, dict) and item.get("key"):
            entry = {"key": str(item["key"])}
            for f in ("username", "userId"):
                if f in item:
                    entry[f] = item[f]
            result.append(entry)
    return result


config["apiKeys"] = _normalize_api_keys(config["apiKeys"])

# 密钥 → 用户绑定映射（用于"密钥即身份"免登录）
_api_key_bindings: dict[str, dict] = {}
for _ak in config["apiKeys"]:
    if "username" in _ak or "userId" in _ak:
        _api_key_bindings[_ak["key"]] = {f: _ak[f] for f in ("username", "userId") if f in _ak}

# 绑定密钥 → 用户信息缓存，避免每次工具调用都查 DB
_api_key_user_cache: dict[str, dict | None] = {}

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


# ── DB 密钥缓存 ──────────────────────────────────────────
# 从 mcp_api_keys 表加载已启用密钥（SHA-256 hash → 用户信息），TTL 30s。
# 当 config apiKeys 为空且 DB 也无密钥时 → 放行（保持向后兼容）。
# 一旦前端创建了密钥，下次缓存刷新后自动开始强制认证。

_db_key_cache: dict[str, dict] = {}
_db_key_cache_time: float = 0
_db_has_any_keys: bool = False  # mcp_api_keys 表是否有任何行（含禁用的）
_DB_KEY_CACHE_TTL = 30


def _load_db_keys() -> dict[str, dict]:
    """加载已启用的 DB 密钥到缓存，返回 {sha256_hex: {id, username, role}}。

    同时更新 _db_has_any_keys：表有行（含禁用）则为 True。
    中间件用此标志区分"从未创建密钥→放行"和"全部已禁用→拒绝"。
    """
    global _db_key_cache, _db_key_cache_time, _db_has_any_keys
    now = time.time()
    if _db_key_cache and (now - _db_key_cache_time) < _DB_KEY_CACHE_TTL:
        return _db_key_cache
    try:
        db = get_db()
        with db.cursor() as cur:
            cur.execute("""
                SELECT k.key_hash, k.enabled, u.id, u.username, u.role
                FROM mcp_api_keys k JOIN users u ON k.user_id = u.id
            """)
            rows = cur.fetchall()
        db.close()
        _db_has_any_keys = len(rows) > 0
        _db_key_cache = {
            r["key_hash"]: {"id": r["id"], "username": r["username"], "role": r["role"]}
            for r in rows if r["enabled"]
        }
        _db_key_cache_time = now
    except Exception as e:
        print(f"[mcp] 加载数据库密钥失败: {e}", file=sys.stderr)
    return _db_key_cache


def _verify_db_key(key: str) -> dict | None:
    """验证密钥是否在 DB 中且已启用，返回用户信息或 None。"""
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    return _load_db_keys().get(key_hash)


# 当前请求的已认证用户（由 ApiKeyMiddleware 设置，工具函数通过 verify_auth 读取）
_request_user: contextvars.ContextVar[dict | None] = contextvars.ContextVar("_request_user", default=None)


def _auth_by_api_key(token: str) -> dict | None:
    """尝试把 token 当作已绑定用户身份的 API 密钥解析。

    优先检查 DB 密钥（前端管理页面创建），其次检查 config.json 绑定密钥。
    返回 {"id","username","role"}；token 不是绑定密钥时返回 None；
    是绑定密钥但对应用户不存在时抛 ValueError。结果缓存。
    """
    # 路径 A: DB 密钥（通过前端管理页面创建，自动绑定用户身份）
    db_user = _verify_db_key(token)
    if db_user is not None:
        return db_user

    # 路径 B: config.json 绑定密钥
    if token not in _api_key_bindings:
        return None
    if token in _api_key_user_cache:
        cached = _api_key_user_cache[token]
        if cached is None:
            raise ValueError("API 密钥绑定的用户不存在，请检查 apiKeys 配置")
        return cached
    binding = _api_key_bindings[token]
    db = get_db()
    try:
        with db.cursor() as cur:
            if "userId" in binding:
                cur.execute("SELECT id, username, role FROM users WHERE id=%s", (binding["userId"],))
            else:
                cur.execute("SELECT id, username, role FROM users WHERE username=%s", (binding["username"],))
            u = cur.fetchone()
    finally:
        db.close()
    if not u:
        _api_key_user_cache[token] = None
        raise ValueError(f"API 密钥绑定的用户不存在: {binding}")
    user = {"id": u["id"], "username": u["username"], "role": u["role"]}
    _api_key_user_cache[token] = user
    return user


def verify_auth(required_roles: list[str] | None = None) -> dict:
    """从当前请求上下文获取已认证用户（由 ApiKeyMiddleware 设置）。"""
    user = _request_user.get()
    if user is None:
        raise ValueError("未认证：请在 MCP 客户端配置 API 密钥请求头")
    if required_roles and user["role"] not in required_roles:
        raise ValueError(f"权限不足，需要角色: {'/'.join(required_roles)}")
    return user


def verify_project(project_id: int, write: bool = False) -> dict:
    user = verify_auth()
    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute("SELECT operator_id FROM projects WHERE id=%s", (project_id,))
            proj = cur.fetchone()
            if not proj:
                raise ValueError("项目不存在")
            if user["role"] in ("root", "admin"):
                return user
            if proj["operator_id"] == user["id"]:
                return user
            cur.execute(
                "SELECT role FROM project_members WHERE project_id=%s AND user_id=%s",
                (project_id, user["id"]),
            )
            member = cur.fetchone()
            if not member:
                raise ValueError("无权访问该项目")
            if write and member["role"] != "operator":
                raise ValueError("无权修改该项目")
            return user
    finally:
        db.close()


# ── API 密钥中间件 ──────────────────────────────────────────

class ApiKeyMiddleware:
    """ASGI 中间件：HTTP 层 API 密钥白名单认证。

    密钥来源：
      1. config.json apiKeys（纯字符串或绑定身份的对象）
      2. 数据库 mcp_api_keys 表（通过前端管理页面创建，自动绑定用户身份）
    当两个来源都为空时放行所有请求（保持向后兼容）。
    支持以下两种传递方式：
      - Authorization: Bearer <key>
      - X-API-Key: <key>
    """

    def __init__(self, app, api_keys, use_db=True):
        self.app = app
        self.api_keys = {str(k) for k in api_keys}
        self.use_db = use_db

    async def __call__(self, scope, receive, send):
        # 非 HTTP/WebSocket 流量直接放行
        if scope["type"] not in ("http", "websocket"):
            return await self.app(scope, receive, send)

        db_keys = _load_db_keys() if self.use_db else {}

        # 无任何密钥源 → 放行（兼容无认证部署）
        # _db_has_any_keys 区分"从未创建密钥→放行"和"全部已禁用→拒绝"
        if not self.api_keys and not db_keys and not _db_has_any_keys:
            return await self.app(scope, receive, send)

        key = _extract_api_key(scope)
        user_info = None
        authenticated = False
        if key:
            # 检查 config 密钥（常量时间比较）
            if any(hmac.compare_digest(k, key) for k in self.api_keys):
                authenticated = True
                user_info = _auth_by_api_key(key)  # 绑定身份则解析，纯字符串则 None
            # 检查 DB 密钥（SHA-256 查找）
            elif self.use_db and db_keys:
                key_hash = hashlib.sha256(key.encode()).hexdigest()
                if key_hash in db_keys:
                    authenticated = True
                    user_info = db_keys[key_hash]

        if not authenticated:
            await _send_unauthorized(send)
            return

        # 认证通过：设置 contextvar 让工具函数读取用户身份
        token = _request_user.set(user_info)
        try:
            await self.app(scope, receive, send)
        finally:
            _request_user.reset(token)


def _extract_api_key(scope) -> str | None:
    """从请求头提取 API 密钥，优先 Authorization: Bearer，其次 X-API-Key。

    HTTP header 名大小写不敏感，ASGI 规范规定为小写 bytes，
    这里仍做 lower() 比较以增强健壮性。
    """
    headers = scope.get("headers") or []
    auth = None
    x_api_key = None
    for name, value in headers:
        lname = name.lower() if isinstance(name, (bytes, bytearray)) else name
        if lname == b"authorization":
            auth = value
        elif lname == b"x-api-key":
            x_api_key = value
    if auth:
        try:
            scheme, _, token = auth.decode("latin-1").partition(" ")
            if scheme.lower() == "bearer" and token.strip():
                return token.strip()
        except UnicodeDecodeError:
            pass
    if x_api_key:
        return x_api_key.decode("latin-1", errors="ignore").strip() or None
    return None


async def _send_unauthorized(send) -> None:
    import json
    body = json.dumps({"error": "无效或缺失的 API 密钥"}).encode("utf-8")
    await send({"type": "http.response.start", "status": 401, "headers": [
        (b"content-type", b"application/json"),
        (b"www-authenticate", b'Bearer realm="datacop-mcp"'),
    ]})
    await send({"type": "http.response.body", "body": body})


# ── 请求日志中间件（调试用）──────────────────────────────────

class RequestLogMiddleware:
    """记录每个 HTTP 请求的方法、路径、JSON-RPC method 和响应状态。"""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        method = scope.get("method", "?")
        path = scope.get("path", "?")

        # 读 body（需要缓存以便后续使用）
        body_chunks = []
        original_receive = receive

        async def logging_receive():
            msg = await original_receive()
            if msg.get("type") == "http.request" and msg.get("body"):
                body_chunks.append(msg["body"])
            return msg

        # 跟踪响应状态
        response_status = {"status": None}
        original_send = send

        async def logging_send(msg):
            if msg.get("type") == "http.response.start":
                response_status["status"] = msg.get("status")
            await original_send(msg)

        await self.app(scope, logging_receive, logging_send)

        # 解析 JSON-RPC method
        body = b"".join(body_chunks)
        rpc_method = "?"
        if body:
            try:
                data = json.loads(body)
                rpc_method = data.get("method", "?")
            except Exception:
                rpc_method = "<non-json>"
        print(f"[req] {method} {path} rpc={rpc_method} → {response_status['status']}", file=sys.stderr)


# ── MCP Server ────────────────────────────────────────────

mcp = FastMCP(
    "datacop",
    port=config["port"],
    host="0.0.0.0",
    stateless_http=True,
    json_response=True,
)


@mcp.tool()
def list_projects() -> str:
    """获取当前用户可见的项目列表。"""
    user = verify_auth()
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
def list_problems(project_id: int, status: str | None = None) -> str:
    """获取指定项目的问题列表。status 可选 pending/valid。"""
    verify_project(project_id)
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
    project_id: int,
    keyword: str,
    field: str | None = None,
    status: str | None = None,
    exact_match: bool = False,
) -> str:
    """在指定项目内搜索问题。field 可指定搜索字段，不填则搜索全部文本字段。

    exact_match=True 时按整词精确匹配（如错误码 -108 不会命中 -5108 或 1080），
    exact_match=False（默认）时模糊匹配（keyword 中的 % 和 _ 按字面处理）。
    """
    verify_project(project_id)
    searchable = ["name", "description", "scenario", "trigger_method", "symptoms", "cause", "solution", "verification", "notes"]
    kw = (keyword or "").strip()
    if not kw:
        raise ValueError("keyword 不能为空")

    db = get_db()
    try:
        with db.cursor() as cur:
            sql = "SELECT id, name, description, status, scenario, cause, solution FROM problems WHERE project_id=%s"
            params: list = [project_id]

            if status:
                sql += " AND status=%s"
                params.append(status)

            if exact_match:
                # 整词匹配：两侧必须是字段边界或非字母数字字符，保证错误码 -108 不命中 -5108/1080
                pattern = f"(^|[^a-zA-Z0-9]){re.escape(kw)}([^a-zA-Z0-9]|$)"
                if field and field in searchable:
                    sql += f" AND {field} REGEXP %s"
                    params.append(pattern)
                else:
                    sql += " AND (" + " OR ".join(f"{f} REGEXP %s" for f in searchable) + ")"
                    params.extend([pattern] * len(searchable))
            else:
                # 转义 LIKE 通配符，避免 % 和 _ 被当作通配符匹配全部记录
                escaped = kw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                like = f"%{escaped}%"
                if field and field in searchable:
                    sql += f" AND {field} LIKE %s"
                    params.append(like)
                else:
                    sql += " AND (" + " OR ".join(f"{f} LIKE %s" for f in searchable) + ")"
                    params.extend([like] * len(searchable))

            sql += " ORDER BY status DESC, id"
            cur.execute(sql, params)
            results = cur.fetchall()
    finally:
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
def get_problem(project_id: int, problem_id: int) -> str:
    """获取单个问题的完整详情（含触发方式、症状、原因、解决方案、验证方式、备注等全部字段）。"""
    verify_project(project_id)
    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                "SELECT id, name, description, scenario, trigger_method, symptoms, cause, solution, verification, notes, status, created_at, updated_at FROM problems WHERE id=%s AND project_id=%s",
                (problem_id, project_id),
            )
            p = cur.fetchone()
    finally:
        db.close()

    if not p:
        raise ValueError(f"问题 {problem_id} 不存在")

    lines = [f"[{p['id']}] {p['name']} (status: {p['status']})"]
    for label, key in [
        ("描述", "description"),
        ("场景", "scenario"),
        ("触发方式", "trigger_method"),
        ("症状", "symptoms"),
        ("原因", "cause"),
        ("方案", "solution"),
        ("验证方式", "verification"),
        ("备注", "notes"),
    ]:
        if p.get(key):
            lines.append(f"{label}: {p[key]}")
    lines.append(f"创建时间: {p['created_at']}")
    if p.get("updated_at"):
        lines.append(f"更新时间: {p['updated_at']}")
    return "\n".join(lines)


@mcp.tool()
def get_index(level: int, project_id: int | None = None) -> str:
    """获取分层检索索引。level=1 返回项目列表，level=2 返回指定项目的问题索引。"""
    if level == 1:
        user = verify_auth()
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
        verify_project(project_id)
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


@mcp.tool()
def create_problem(
    project_id: int,
    name: str,
    description: str | None = None,
    scenario: str | None = None,
    trigger_method: str | None = None,
    symptoms: str | None = None,
    cause: str | None = None,
    solution: str | None = None,
    verification: str | None = None,
    notes: str | None = None,
) -> str:
    """创建（上传）一个问题到指定项目。name 必填，其余字段可选。需要项目写权限（root/admin/项目operator）。"""
    user = verify_project(project_id, write=True)
    name = (name or "").strip()
    if not name:
        raise ValueError("问题名称不能为空")

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                "INSERT INTO problems (project_id, name, description, scenario, trigger_method, symptoms, cause, solution, verification, notes, created_by) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (project_id, name, description, scenario, trigger_method, symptoms, cause, solution, verification, notes, user["id"]),
            )
            problem_id = cur.lastrowid
        db.commit()
    finally:
        db.close()
    return f"问题创建成功 (ID: {problem_id})"


@mcp.tool()
def import_problems(project_id: int, problems: list) -> str:
    """批量导入问题到指定项目。problems 为对象数组，每项必须包含 name，可选 description/scenario/trigger_method/symptoms/cause/solution/verification/notes/status（status 仅 pending/valid 有效）。需要项目写权限（root/admin/项目operator）。"""
    user = verify_project(project_id, write=True)
    if not isinstance(problems, list) or len(problems) == 0:
        raise ValueError("problems 必须是非空数组")

    db = get_db()
    imported = 0
    try:
        with db.cursor() as cur:
            for p in problems:
                if not isinstance(p, dict):
                    continue
                name = str(p.get("name") or "").strip()
                if not name:
                    continue
                status = p.get("status") if p.get("status") in ("pending", "valid") else "pending"
                cur.execute(
                    "INSERT INTO problems (project_id, name, description, scenario, trigger_method, symptoms, cause, solution, verification, notes, status, created_by) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    (project_id, name, p.get("description"), p.get("scenario"), p.get("trigger_method"), p.get("symptoms"), p.get("cause"), p.get("solution"), p.get("verification"), p.get("notes"), status, user["id"]),
                )
                imported += 1
        db.commit()
    finally:
        db.close()
    if imported == 0:
        return "没有可导入的问题（每项必须包含 name）"
    return f"成功导入 {imported} 个问题"


# ── 启动 ──────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    mcp_app = mcp.streamable_http_app()
    api_key_strings = [ak["key"] for ak in config["apiKeys"]]
    bound = sum(1 for ak in config["apiKeys"] if "username" in ak or "userId" in ak)
    authed_app = ApiKeyMiddleware(mcp_app, api_keys=api_key_strings, use_db=True)
    final_app = RequestLogMiddleware(authed_app)
    if api_key_strings:
        print(f"[config] API 密钥认证: config {len(api_key_strings)} 个 + DB 密钥, {bound} 个 config 绑定身份", file=sys.stderr)
    else:
        print(f"[config] API 密钥认证: DB 密钥模式（通过前端管理页面创建密钥；无密钥时放行）", file=sys.stderr)
    print(f"[config] port={config['port']}", file=sys.stderr)
    print(f"[config] db={config['db']['host']}:{config['db']['port']}/{config['db']['database']}", file=sys.stderr)
    print(f"[server] DataCop MCP server (HTTP) 已启动", file=sys.stderr)
    print(f"[server] 端点: http://0.0.0.0:{config['port']}/mcp", file=sys.stderr)
    uvicorn.run(final_app, host="0.0.0.0", port=config["port"])

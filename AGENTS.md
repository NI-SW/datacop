# AGENTS.md

## What this is

DataCop — a knowledge base management system with problem tracking per project. Two separate packages: `server/` (Express + TypeScript) and `client/` (React + Vite + TypeScript). Not a monorepo/workspace — no shared root lockfile.

## Commands

```bash
# Server (port 3001) — uses tsx for ESM TypeScript
cd server && npm install && npm run dev       # dev with watch
cd server && npm run start                    # single run (no watch)
cd server && npm run db:init                  # re-run schema migration only

# Client (port 5173, proxies /api to :3001)
cd client && npm install && npm run dev
cd client && npm run build                    # tsc --noEmit + vite build

# Type check (run from client/)
cd client && npx tsc --noEmit
```

## Architecture

- **Server** lives at `server/src/`. Entry: `index.ts` → loads routes from `routes/*.ts`, runs DB migration from `db/schema.ts` on startup. Runs on `0.0.0.0:3001`.
- **Client** lives at `client/src/`. Entry: `main.tsx` → `App.tsx` (React Router v6 routes). Vite dev server at `:5173` proxies `/api` to backend.
- **Database**: MySQL at `192.168.34.65:3306`, database `datacop`. Connection pool in `db/connection.ts` uses a lazy `getPool()` pattern — must call `initPool()` before `initDB()` in `index.ts`.
- **Schema migrations** run inside `db/schema.ts` `initDB()` on every server start. Uses `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` to idempotently add columns/indexes. Existing tables are never recreated, only patched.
- **`problems` table has no foreign keys** — all FK constraints were intentionally removed. `project_id` still has an index for query performance but no cascade.
- **Document/file processing was removed** — no `documents` table, uploads dir, or multer/pdf-parse/mammoth deps. The project page redirects directly to its problems list.
- **Auth**: JWT tokens in `Authorization: Bearer <token>` header. Default root account: `root` / `admin123` (seeded on first start).
- **RBAC middleware** in `middleware/rbac.ts`: `requireRole()` checks global role; `requireProjectRead/Write()` checks project access via `projects.operator_id` first, then `project_members` table.

## Key gotchas

- The server uses `"type": "module"` with ESM. All local imports must include `.ts` extension (tsx resolves them).
- `getPool()` is a lazy getter — calling DB functions before `initPool()` throws. Both calls happen in `index.ts` in order.
- The `db/schema.ts` init runs ALTER TABLE migrations for each startup idempotently. Adding a new column to `problems`? Add it to the CREATE TABLE AND add an ALTER TABLE block with `SHOW COLUMNS` guard.
- Vite proxies `/api` to `localhost:3001` — the client never calls the backend directly. CORS is configured for `http://localhost:5173` only.
- `npm install` in `client/` may hang in some environments — use `--no-audit --no-fund` if slow. React is pinned to 18.x (not 19).
- The backend background process gets killed when bash sessions timeout. Use `nohup` or a cron keepalive loop for long-running instances.

## Conventions

- All pages are in `client/src/pages/`. Admin pages in `pages/admin/`. Shared components in `components/`.
- Routes are defined manually in `App.tsx` (not file-based). `ProjectLayout` wraps project pages with a tab navbar (文件列表/问题列表).
- API responses use `{ error: "message" }` for errors, `{ message: "success text" }` or `{ id, message }` for success.
- No test framework is set up — verification is manual API testing or frontend typecheck (`npx tsc --noEmit`).
- The `docs/API.md` file is the canonical API reference with all endpoints, request/response formats, and DB schema.

## Files to check after changes

- After modifying `server/src/db/schema.ts`: restart server, check `cat /tmp/datacop.log` for migration output.
- After modifying routes: verify with `curl` using a root JWT token.
- After modifying frontend components: `cd client && npx tsc --noEmit` to typecheck.
- After adding new routes: register them in `server/src/index.ts`.

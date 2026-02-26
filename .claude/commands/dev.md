---
name: dev
description: "Start/restart dev server and monitor browser for errors via DevTools MCP"
category: Development
tags: [dev, server, browser, debugging]
---

Dev server management and browser error monitoring for Bush.

**Arguments**: Optional action after `/dev`:
- No args or `start`: Start the dev server and connect browser monitoring
- `restart`: Kill existing dev processes and restart fresh
- `check`: Check browser console for errors without restarting
- `kill`: Stop all dev processes
- `status`: Show what's running

## Workflow

### 1. Server Management

**Starting/Restarting:**
1. Kill any existing processes on ports 3000, 3001:
   ```bash
   lsof -ti:3000 -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null
   ```
2. Wait 1 second for ports to free up
3. Start dev server in background:
   ```bash
   bun run dev 2>&1
   ```
   Run this as a background task. The command runs two processes:
   - `bun --watch --env-file .env.local src/api/index.ts` (Hono API on port 3001, auto-restarts on file changes)
   - `next dev src/web` (Next.js frontend on port 3000)
4. Optionally start the media worker if needed:
   ```bash
   bun run dev:worker 2>&1
   ```
   - `bun --watch --env-file .env.local src/media/worker.ts` (BullMQ media processing worker)
5. Wait 5 seconds, then read the background task output to verify:
   - API listening on port 3001
   - Next.js ready on port 3000
6. Report status to user

**Checking status:**
```bash
lsof -i:3000 -i:3001 | grep LISTEN
```

**Killing:**
```bash
lsof -ti:3000 -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null
```
Also stop any background tasks tracking the dev server.

### 2. Browser Error Monitoring (DevTools MCP)

After the dev server is running, call MCP tools directly to check for browser errors.
Do NOT invoke the `devtools-mcp` skill — just call the `mcp__brave-devtools__*` tools yourself.

**IMPORTANT: Keep the browser open.** The user works alongside the browser during development. Never close pages.

**On `/dev start` or `/dev restart`:**
1. `mcp__brave-devtools__navigate_page` → url: `http://localhost:3000`
2. `mcp__brave-devtools__list_console_messages` → types: `["error", "warn"]`
3. `mcp__brave-devtools__list_network_requests` → resourceTypes: `["xhr", "fetch", "websocket"]`
4. Report findings — summarize errors and suggest fixes

**On `/dev check`:**
The browser should already be open. Don't re-navigate unless needed.
1. `mcp__brave-devtools__list_console_messages` → types: `["error", "warn"]`
2. `mcp__brave-devtools__list_network_requests` → resourceTypes: `["xhr", "fetch", "websocket"]`
3. Report findings

### 3. When to Use

**Use `/dev start` or `/dev restart`:**
- At the beginning of a development session
- After making server-side changes that `bun --watch` didn't pick up
- After crashes or port conflicts
- After changing environment config

**Use `/dev check`:**
- After implementing frontend changes to verify they work
- When the user reports something isn't working
- To check for console errors after a change
- As part of the implement-verify-fix loop

**Use `/dev kill`:**
- When done developing
- Before running tests (to free ports)
- When switching tasks

### 4. Error Recovery

If the dev server fails to start:
- Check if ports are still in use: `lsof -i:3000 -i:3001`
- Force kill with `-9` and retry
- Check for TypeScript compilation errors in the output
- Check if `.env.local` exists and is valid

If browser shows errors:
- Use `mcp__brave-devtools__get_console_message` for stack traces on specific errors
- Fix the code
- The frontend should auto-refresh via Next.js Fast Refresh
- Run `/dev check` again to verify the fix

## Key Details

- Frontend (Next.js): `http://localhost:3000` (SSR, routing, API routes)
- Backend (Hono API): `http://localhost:3001` (REST API, WebSocket)
- Media Worker: `bun run dev:worker` (BullMQ + FFmpeg, start separately when needed)
- Caddy handles path-based routing in production (`/v4/*` → API, everything else → Next.js)
- The API `bun --watch` auto-restarts on ANY server file change
- The frontend Next.js Fast Refresh auto-refreshes on ANY frontend file change
- Only manual restart needed: env changes, dependency changes, or crashes

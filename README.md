# planora-mcp

The official Model Context Protocol (MCP) server for [Planora](https://planora-frontend.pages.dev/) — connect your AI assistant (Claude Desktop, Cursor, Windsurf, etc.) directly to your notes and files.

Once installed, your AI can read, create, edit, delete, and export your Planora files without you leaving the conversation.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Authentication](#authentication)
  - [Login](#login)
  - [Refresh Token](#refresh-token)
  - [Logout](#logout)
- [Connecting to an AI Client](#connecting-to-an-ai-client)
  - [Claude Desktop](#claude-desktop)
  - [Cursor](#cursor)
  - [Windsurf](#windsurf)
- [Available Tools](#available-tools)
  - [list\_files](#list_files)
  - [create\_file](#create_file)
  - [read\_file](#read_file)
  - [edit\_file](#edit_file)
  - [delete\_file](#delete_file)
  - [generate\_pdf\_download\_link](#generate_pdf_download_link)
  - [get\_active\_sessions](#get_active_sessions)
  - [revoke\_session](#revoke_session)
- [Multi-Device Usage](#multi-device-usage)
- [Session Lifecycle](#session-lifecycle)
- [Security Model](#security-model)
- [Troubleshooting](#troubleshooting)

---

## Requirements

- **Node.js** 18 or higher
- A **Planora account** with **Google Authenticator (2FA) enabled**
  - 2FA can be enabled in Planora → Settings → Security → Two-Factor Authentication
- An MCP-compatible AI client (Claude Desktop, Cursor, Windsurf, etc.)

---

## Installation

Install the package globally so the CLI commands are available system-wide:

```bash
npm install -g planora-mcp
```

Or use `npx` without installing (you will need to run login separately):

```bash
npx planora-mcp
```

---

## Authentication

The MCP server authenticates using your **Google Authenticator TOTP code** — no password required. This means you must have 2FA enabled on your Planora account before using the MCP server.

Your session token is stored locally at `~/.planora/mcp.env` with `600` permissions (readable only by you).

### Login

Run this once to connect a device to your Planora account:

```bash
planora-login
```

You will be prompted for:

```
Connecting to Planora...

Email: you@example.com
Authenticator code (TOTP): 482910
Device name [MacBook-Pro.local]: MacBook Work
```

- **Email** — your Planora account email
- **Authenticator code** — the 6-digit code from Google Authenticator (standard 30-second rotating code)
- **Device name** — a human-readable label for this device (defaults to your machine's hostname). Used to identify sessions when managing devices. Duplicates are allowed.

On success:

```
Connected as you@example.com on "MacBook Work".
Token valid for 30 days. Run 'planora-login --refresh' before it expires.
```

Your session token is saved to `~/.planora/mcp.env`. The MCP server reads it automatically on every request.

---

### Refresh Token

Sessions expire after **30 days**. Refresh before expiry to avoid interruption:

```bash
planora-login --refresh
```

This rotates your token server-side (old token is immediately invalidated) and saves a new 30-day token. No TOTP code needed — your existing valid session authorizes the refresh.

```
Refreshing session token...
Session refreshed. New token valid for 30 days.
```

> **Tip:** The MCP server will warn you on your first tool call of the day if your token expires within 3 days, giving you time to refresh before it breaks.

---

### Logout

To disconnect this device from your Planora account:

```bash
planora-login --logout
```

This revokes your session on the server and deletes `~/.planora/mcp.env` locally.

```
Logging out...
Logged out. Local session cleared.
```

---

## Connecting to an AI Client

After logging in, register the MCP server with your AI client. The server communicates over **stdio** (standard input/output) — it runs as a subprocess spawned by the client.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "planora": {
      "command": "planora-mcp"
    }
  }
}
```

If you used `npx` instead of a global install, use:

```json
{
  "mcpServers": {
    "planora": {
      "command": "npx",
      "args": ["planora-mcp"]
    }
  }
}
```

Restart Claude Desktop. A "planora" server entry will appear in the MCP tools panel.

---

### Cursor

Open Cursor Settings → MCP → Add new server:

```json
{
  "planora": {
    "command": "planora-mcp"
  }
}
```

Or via `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "planora": {
      "command": "planora-mcp"
    }
  }
}
```

---

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "planora": {
      "command": "planora-mcp"
    }
  }
}
```

---

## Available Tools

Once connected, the following tools are available to your AI assistant. You can ask the AI naturally — it will choose the right tool automatically.

---

### `list_files`

Lists your files and folders. Without a filter, returns root-level items. Pass a folder ID to list its contents.

**Input schema:**

| Field | Type | Required | Description |
|---|---|---|---|
| `folderPath` | string | No | Folder UUID to list children of. Omit for root-level items. |

**Example prompts:**

> "Show me all my files"

> "List everything inside my Projects folder"

> "What's in my root directory?"

**Example response:**

```
Found 4 items:

[folder] Projects  —  path: /Projects  (id: 019...)
[folder] Journal   —  path: /Journal   (id: 01a...)
[file]   todo.md   —  path: /todo.md   (id: 01b...)
[file]   ideas.md  —  path: /ideas.md  (id: 01c...)
```

---

### `create_file`

Creates a new markdown file or folder.

**Input schema:**

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `"file"` \| `"folder"` | Yes | Whether to create a file or a folder |
| `fileName` | string | Yes | Name of the file (e.g. `meeting-notes.md`) or folder |
| `folderPath` | string | No | Parent folder UUID. Defaults to root `/` if omitted |
| `content` | string | No | Initial markdown content (only for files) |

**Example prompts:**

> "Create a new file called roadmap.md in my Projects folder with a brief outline"

> "Make a folder called Q4-Planning inside Projects"

> "Create a daily journal entry for today with some template sections"

**Example — creating a file with content:**

The AI calls `create_file` with:
```json
{
  "type": "file",
  "fileName": "roadmap.md",
  "folderPath": "019abc...",
  "content": "# Product Roadmap\n\n## Q1\n- Launch v2\n\n## Q2\n- Mobile app"
}
```

Response:
```
Created file 'roadmap.md' at /Projects/roadmap.md (id: 019def...)
```

---

### `read_file`

Returns the full markdown content of a file. If the ID belongs to a folder, lists its contents instead.

**Input schema:**

| Field | Type | Required | Description |
|---|---|---|---|
| `fileId` | string | Yes | The unique ID of the file or folder |

**Example prompts:**

> "Read my roadmap file"

> "Show me what's in my Projects folder"

> "What does my meeting-notes.md say?"

**Example — reading a file:**

```
# Product Roadmap

## Q1
- Launch v2

## Q2
- Mobile app
```

**Example — reading a folder:**

```
This is a folder: "Projects"
Path: /Projects

Contents (3 items):
  - [folder] Archive  (id: 019...)
  - [file] roadmap.md  (id: 01a...)
  - [file] sprint-1.md  (id: 01b...)
```

---

### `edit_file`

Updates a file's content. Supports two modes:

- **`replace`** — overwrites the entire file with new content
- **`patch`** — finds a specific piece of text and replaces only that part

> The AI will ask you whether you want to replace the whole file or patch specific changes before calling this tool.

**Input schema:**

| Field | Type | Required | Description |
|---|---|---|---|
| `fileId` | string | Yes | The unique ID of the file |
| `mode` | `"replace"` \| `"patch"` | Yes | Edit strategy |
| `newContent` | string | If `mode=replace` | Full new markdown content |
| `searchContent` | string | If `mode=patch` | Exact text to find in the file |
| `replaceContent` | string | If `mode=patch` | Text to substitute in |

**Example prompts:**

> "Add a Q3 section to my roadmap"

> "Update the status of the 'Launch v2' item to done"

> "Rewrite my todo.md completely with these new tasks"

**Example — patch mode:**

The AI calls `edit_file` with:
```json
{
  "fileId": "019def...",
  "mode": "patch",
  "searchContent": "- Launch v2",
  "replaceContent": "- ~~Launch v2~~ (done)"
}
```

Response:
```
File updated successfully.
```

**Example — replace mode:**

```json
{
  "fileId": "019def...",
  "mode": "replace",
  "newContent": "# Product Roadmap\n\n## Q1\n- ~~Launch v2~~ (done)\n\n## Q2\n- Mobile app\n\n## Q3\n- Analytics dashboard"
}
```

---

### `delete_file`

Permanently deletes a file. **This action is irreversible.** The AI will confirm with you before calling this tool.

**Input schema:**

| Field | Type | Required | Description |
|---|---|---|---|
| `fileId` | string | Yes | The unique ID of the file to delete |

**Example prompts:**

> "Delete my old draft.md file"

> "Remove the sprint-1.md file from Projects"

**Example response:**

```
File permanently deleted.
```

---

### `generate_pdf_download_link`

Exports a file as a PDF and returns a secure download link valid for **1 hour**.

The PDF is rendered with proper formatting — headings, bullet points, checkboxes, code blocks, dividers, and quotes are all styled correctly.

**Input schema:**

| Field | Type | Required | Description |
|---|---|---|---|
| `fileId` | string | Yes | The unique ID of the file to export |

**Example prompts:**

> "Export my roadmap as a PDF"

> "Give me a download link for the meeting notes as PDF"

> "I want to share my project plan as a PDF"

**Example response:**

```
PDF ready. Download link (expires in 1 hour):
https://r2.planora.app/pdf-exports/019.../roadmap.pdf?X-Amz-Expires=3600&...
```

---

### `get_active_sessions`

Lists all active MCP sessions across your devices, including the device name, last used time, and expiry date. Useful for auditing which devices are connected.

**Input schema:** None

**Example prompts:**

> "Show me all my connected devices"

> "Which machines are logged into my Planora MCP?"

> "List my active sessions"

**Example response:**

```
Active sessions (3):

- MacBook Work  (id: 019aaa...)
  Last used: 9/28/2026, 10:14 AM  |  Expires: 10/28/2026

- Home iMac  (id: 019bbb...)
  Last used: 9/25/2026, 8:02 PM  |  Expires: 10/22/2026

- Work Cursor  (id: 019ccc...)
  Last used: Never  |  Expires: 10/01/2026
```

---

### `revoke_session`

Revokes any MCP session by its ID, immediately logging out that device. You can revoke any session — including the current one.

**Input schema:**

| Field | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | Yes | Session ID from `get_active_sessions` |

**Example prompts:**

> "Log out my Home iMac session"

> "Revoke the session that hasn't been used recently"

> "Remove all sessions except this one" (call `get_active_sessions` first, then revoke each)

**Example response:**

```
Session 019bbb... revoked. That device has been logged out.
```

---

## Multi-Device Usage

You can log in from multiple devices simultaneously — each device gets its own independent 30-day session token.

**Setup on a second device:**

```bash
npm install -g planora-mcp
planora-login
```

```
Email: you@example.com
Authenticator code (TOTP): 719284
Device name [office-macbook.local]: Work Laptop
```

Both devices share the same Planora data. Tokens are independent — refreshing or revoking one device does not affect others.

**Recommended workflow for team machines or shared computers:**

1. Log in with a descriptive device name (e.g. `"Office Desktop"`, `"Home MacBook"`)
2. Periodically audit sessions via `get_active_sessions`
3. Revoke sessions for devices you no longer use

---

## Session Lifecycle

```
planora-login           → 30-day token saved to ~/.planora/mcp.env
                           (mode 0600 — owner read/write only)

Day 27                  → MCP server warns on first tool call:
                           "Your session expires in 3 days. Run planora-login --refresh"

planora-login --refresh → Old token invalidated, new 30-day token saved
                           (no TOTP code needed)

Day 30 (expired)        → All tool calls return:
                           "Your session token has expired. Run 'planora-login --refresh'"

planora-login --logout  → Session revoked server-side, ~/.planora/mcp.env deleted
```

---

## Security Model

| Concern | How it's handled |
|---|---|
| Token storage | `~/.planora/mcp.env` with `0600` permissions — only your OS user can read it |
| Token in transit | HTTPS only — token sent as `Authorization: Bearer <token>` header |
| Token in database | Only the SHA-256 hash is stored — the raw token is never persisted server-side |
| Authentication | TOTP-only (Google Authenticator) — requires 2FA to be enabled on your account |
| Session scope | Every API request is scoped strictly to your user ID — no access to other users' data |
| Token expiry | 30-day TTL enforced server-side — expired tokens are rejected at the DB query level |
| Token rotation | `--refresh` issues a new token and immediately invalidates the old one |
| Remote revocation | Any session can be revoked from any other authenticated device via `revoke_session` |

---

## Troubleshooting

**`Error: No session found. Run 'planora-login' to authenticate.`**

You haven't logged in yet, or `~/.planora/mcp.env` was deleted. Run:
```bash
planora-login
```

---

**`Your session token has expired. Run 'planora-login --refresh' to renew.`**

Your 30-day token has expired. Run:
```bash
planora-login --refresh
```
If this also fails with a 401, the session was revoked remotely. Run a full login instead:
```bash
planora-login
```

---

**`Two-factor authentication is not enabled on this account.`**

The MCP server requires Google Authenticator 2FA to be active. Enable it in Planora:
Settings → Security → Two-Factor Authentication → Enable

---

**`Invalid TOTP code`**

- Make sure your device clock is accurate (TOTP codes are time-sensitive)
- The code changes every 30 seconds — try again with the freshly generated code
- Ensure you're using the correct Planora entry in Google Authenticator

---

**The MCP server doesn't appear in Claude Desktop / Cursor**

- Confirm `planora-mcp` is in your PATH: `which planora-mcp`
- If installed globally via npm, check: `npm list -g planora-mcp`
- Restart your AI client after editing the config file
- Check the client's MCP logs for startup errors

---

**`planora-mcp: command not found`**

The global npm bin directory may not be in your PATH. Find it with:
```bash
npm config get prefix
```
Add `<prefix>/bin` to your `PATH` in `~/.zshrc` or `~/.bashrc`:
```bash
export PATH="$(npm config get prefix)/bin:$PATH"
```

---

**Tool calls succeed but show stale data**

The MCP server reads live from the Planora API on every call — there is no local cache. If data appears stale, it reflects what's currently in your Planora account. Check the app directly to confirm.

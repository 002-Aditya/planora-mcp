# planora-mcp

The official MCP server for [Planora](https://planora-frontend.pages.dev/) — lets AI assistants (Claude, Cursor, Windsurf, etc.) read, create, edit, and manage your notes directly.

---

## Requirements

- Node.js 18+
- A Planora account with **Google Authenticator (2FA) enabled**
  _(Settings → Security → Two-Factor Authentication)_

---

## Setup

### 1. Authenticate

Run once to link a device to your Planora account:

```bash
npx -y --package planora-mcp planora
```

You'll be prompted for your email, TOTP code, and a device name. Your session token is saved to `~/.planora/mcp.env`.

---

### 2. Connect to your AI client

**Claude Code (CLI)**

```bash
claude mcp add planora-mcp --scope user -- npx -y planora-mcp
```

Restart Claude Code, then verify with `claude mcp list`.

---

**Claude Desktop**

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "planora": {
      "command": "npx",
      "args": ["-y", "planora-mcp"]
    }
  }
}
```

Restart Claude Desktop.

---

**Cursor / Windsurf / other clients**

Add to your client's MCP config file:

```json
{
  "mcpServers": {
    "planora": {
      "command": "npx",
      "args": ["-y", "planora-mcp"]
    }
  }
}
```

- Cursor: Settings → MCP, or `.cursor/mcp.json`
- Windsurf: `~/.codeium/windsurf/mcp_config.json`

---

## Available Tools

| Tool | Description |
|---|---|
| `list_files` | List files and folders (optionally filter by folder ID) |
| `read_file` | Read a file's content, or list a folder's children |
| `create_file` | Create a new markdown file or folder |
| `edit_file` | Update file content — `replace` (full) or `patch` (find & replace) |
| `rename_file` | Rename a file or folder |
| `delete_file` | Permanently delete a file _(irreversible)_ |
| `get_file_link` | Get a direct link to open any file or folder in the Planora app |
| `get_recent_documents` | Fetch the 10 most recently modified documents |
| `get_pinned_documents` | Fetch all pinned files and folders |
| `generate_pdf_download_link` | Export a file as PDF — returns a download link valid for 1 hour |
| `get_active_sessions` | List all active MCP sessions across devices |
| `revoke_session` | Log out a specific device by session ID |

---

## Session Management

Sessions expire after **30 days**. Refresh before expiry:

```bash
npx -y --package planora-mcp planora --refresh
```

To log out:

```bash
npx -y --package planora-mcp planora --logout
```

The MCP server warns you automatically when your token expires within 3 days.

---

## Troubleshooting

**`No Planora account found for this email`**
You don't have a Planora account yet. Sign up first at **https://planora-frontend.pages.dev**, then run the auth step.

**`No session found`**
Run the auth step again: `npx -y --package planora-mcp planora`

**`Session token has expired`**
Run: `npx -y --package planora-mcp planora --refresh`
If that also fails, re-authenticate from scratch.

**Server doesn't appear in Claude Code**
Make sure you used `--scope user` (not local):
```bash
claude mcp remove planora-mcp
claude mcp add planora-mcp --scope user -- npx -y planora-mcp
```

**`Invalid TOTP code`**
Your device clock may be out of sync, or the code rotated. Wait for the next 30-second code and try again.

**`planora-mcp: command not found` (after global install)**
Add npm's global bin to your PATH:
```bash
export PATH="$(npm config get prefix)/bin:$PATH"
```

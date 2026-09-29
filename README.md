# planora-mcp

The official MCP server for [Planora](https://planora-frontend.pages.dev/) — lets AI assistants read, create, edit, and manage your notes directly.

---

## Requirements

- Node.js 18+
- A Planora account with **Google Authenticator (2FA) enabled**
  _(Settings → Security → Two-Factor Authentication)_

---

## Install

```bash
# macOS / Linux
sudo npm install -g planora-mcp

# Windows (run terminal as Administrator)
npm install -g planora-mcp
```

---

## Login

```bash
planora
```

You'll be prompted for your email, TOTP code, and a device name. Your session is saved locally and lasts 30 days.

> Don't have an account? Sign up at **https://planora-frontend.pages.dev** first.

---

## Connect to an AI Client

Run one command to configure your AI client:

```bash
planora connect claude           # Claude Code (CLI)
planora connect claude-desktop   # Claude Desktop
planora connect cursor           # Cursor
planora connect windsurf         # Windsurf
planora connect gemini           # Gemini CLI
```

Then restart your client. That's it — all tools are available immediately.

---

## Session Commands

```bash
planora                # Login (or show current session status)
planora --refresh      # Extend session for another 30 days
planora --logout       # Log out and delete the local session
```

The MCP server warns you automatically 3 days before your token expires.

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
| `generate_pdf_download_link` | Export a file as PDF — link valid for 1 hour |
| `get_active_sessions` | List all active MCP sessions across devices |
| `revoke_session` | Log out a specific device by session ID |

---

## Troubleshooting

**`No Planora account found`**
Sign up at https://planora-frontend.pages.dev, then run `planora`.

**`No session found`**
Run `planora` to authenticate.

**`Session token has expired`**
Run `planora --refresh`. If that also fails, run `planora` to re-authenticate.

**`planora: command not found`**
The global npm bin isn't in your PATH. Add it:
```bash
export PATH="$(npm config get prefix)/bin:$PATH"
```
Add that line to `~/.zshrc` or `~/.bashrc` to make it permanent.

**Server doesn't appear after `planora connect`**
Make sure you restarted the client. For Claude Code, also try running `/mcp` in the session to reload. You can verify with `claude mcp list`.

**`Invalid TOTP code`**
Your device clock may be out of sync, or the code rotated. Wait for the next 30-second code and try again.

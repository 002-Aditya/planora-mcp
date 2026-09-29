import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getTokenExpiresAt } from './config.js';
import { TOKEN_WARNING_DAYS } from './constants.js';
import * as fileTools from './tools/files.js';
import * as exportTools from './tools/export.js';
import * as sessionTools from './tools/sessions.js';

// Check once at process startup — warning is prepended to the first tool response only
let startupWarning = null;

(function checkTokenExpiry() {
  const expiresAt = getTokenExpiresAt();
  if (!expiresAt) return;
  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft > 0 && daysLeft <= TOKEN_WARNING_DAYS) {
    startupWarning = `Warning: Your session expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Run 'planora --refresh' to renew.`;
  }
})();

const server = new Server(
  { name: 'planora-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: 'list_files',
    description: 'Lists all documents and folders belonging to the authenticated user.',
    inputSchema: {
      type: 'object',
      properties: {
        folderPath: {
          type: 'string',
          description: "Optional folder path to filter results (e.g. '/notes/projects')",
        },
      },
    },
  },
  {
    name: 'create_file',
    description: 'Creates a new markdown file or folder.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['file', 'folder'],
          description: "Whether to create a 'file' or a 'folder'",
        },
        fileName: {
          type: 'string',
          description: 'Name including extension for files (e.g. roadmap.md)',
        },
        folderPath: {
          type: 'string',
          description: "Target parent folder path. Defaults to '/' if omitted",
        },
        content: {
          type: 'string',
          description: 'Initial markdown content (only applicable when type is file)',
        },
      },
      required: ['type', 'fileName'],
    },
  },
  {
    name: 'read_file',
    description:
      'Returns the full content of a file. If the ID belongs to a folder, lists its children instead.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The unique ID of the file or folder to read',
        },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'edit_file',
    description:
      "Updates a file's content. Ask the user whether they want to completely replace the content or patch specific changes before calling this tool.",
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The unique ID of the file to edit',
        },
        mode: {
          type: 'string',
          enum: ['replace', 'patch'],
          description:
            "'replace' overwrites the entire file content. 'patch' does a targeted find-and-replace.",
        },
        newContent: {
          type: 'string',
          description: "The full new content to write (required when mode is 'replace')",
        },
        searchContent: {
          type: 'string',
          description: "Exact text to find in the file (required when mode is 'patch')",
        },
        replaceContent: {
          type: 'string',
          description: "Text to substitute in place of searchContent (required when mode is 'patch')",
        },
      },
      required: ['fileId', 'mode'],
    },
  },
  {
    name: 'delete_file',
    description: 'Permanently deletes a file. This action is irreversible — confirm with the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The unique ID of the file to delete',
        },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'rename_file',
    description: 'Renames a file or folder.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'The unique ID of the file or folder to rename' },
        name:   { type: 'string', description: 'The new name (include extension for files, e.g. notes.md)' },
      },
      required: ['fileId', 'name'],
    },
  },
  {
    name: 'get_file_link',
    description: 'Returns a direct link to open a file or folder in the Planora app.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'The unique ID of the file or folder' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'get_recent_documents',
    description: 'Returns the 10 most recently modified documents with their names, types, and last-modified dates.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_pinned_documents',
    description: 'Returns all files and folders the user has pinned.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'generate_pdf_download_link',
    description: 'Exports a file as a PDF and returns a secure download URL valid for 1 hour.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The unique ID of the file to export as PDF',
        },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'get_active_sessions',
    description:
      'Lists all active login sessions across devices, including device name, last used time, and expiry date.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'revoke_session',
    description:
      'Revokes a session by its ID, immediately logging out that device. The current session can also be revoked.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID to revoke (obtain from get_active_sessions)',
        },
      },
      required: ['sessionId'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Prepend startup warning to the first tool response, then clear it
  let prefix = '';
  if (startupWarning) {
    prefix = `${startupWarning}\n\n`;
    startupWarning = null;
  }

  try {
    let result;

    switch (name) {
      case 'list_files':
        result = await fileTools.list_files(args);
        return { content: [{ type: 'text', text: prefix + formatFileList(result) }] };

      case 'create_file':
        result = await fileTools.create_file(args);
        return {
          content: [
            {
              type: 'text',
              text: prefix + `Created ${args.type} '${result.name}' at ${result.path} (id: ${result.id})`,
            },
          ],
        };

      case 'read_file':
        result = await fileTools.read_file(args);
        return { content: [{ type: 'text', text: prefix + formatReadResult(result) }] };

      case 'edit_file':
        await fileTools.edit_file(args);
        return { content: [{ type: 'text', text: prefix + 'File updated successfully.' }] };

      case 'delete_file':
        await fileTools.delete_file(args);
        return { content: [{ type: 'text', text: prefix + 'File permanently deleted.' }] };

      case 'rename_file':
        result = await fileTools.rename_file(args);
        return { content: [{ type: 'text', text: prefix + `Renamed to '${result.name}' (id: ${result.id})` }] };

      case 'get_file_link':
        result = await fileTools.get_file_link(args);
        return { content: [{ type: 'text', text: prefix + `Link for '${result.name}':\n${result.url}` }] };

      case 'get_recent_documents':
        result = await fileTools.get_recent_documents();
        return { content: [{ type: 'text', text: prefix + formatRecentDocs(result) }] };

      case 'get_pinned_documents':
        result = await fileTools.get_pinned_documents();
        return { content: [{ type: 'text', text: prefix + formatPinnedDocs(result) }] };

      case 'generate_pdf_download_link':
        result = await exportTools.generate_pdf_download_link(args);
        return {
          content: [
            {
              type: 'text',
              text: prefix + `PDF ready. Download link (expires in 1 hour):\n${result.url}`,
            },
          ],
        };

      case 'get_active_sessions':
        result = await sessionTools.get_active_sessions();
        return { content: [{ type: 'text', text: prefix + formatSessions(result) }] };

      case 'revoke_session':
        await sessionTools.revoke_session(args);
        return {
          content: [
            {
              type: 'text',
              text: prefix + `Session ${args.sessionId} revoked. That device has been logged out.`,
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') {
      return {
        content: [
          {
            type: 'text',
            text: "Your session token has expired. Run 'planora --refresh' to renew.",
          },
        ],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// --- Formatting helpers ---

function formatFileList(items) {
  if (!items?.length) return 'No files or folders found.';
  const lines = items.map(
    (item) => `[${item.type}] ${item.name}  —  path: ${item.path}  (id: ${item.id})`
  );
  return `Found ${items.length} item${items.length === 1 ? '' : 's'}:\n\n${lines.join('\n')}`;
}

function formatReadResult(result) {
  if (result.type === 'folder') {
    const children = result.children ?? [];
    if (!children.length) {
      return `This is a folder: "${result.name}"\nPath: ${result.path}\n\nThis folder is empty.`;
    }
    const lines = children.map((c) => `  - [${c.type}] ${c.name}  (id: ${c.id})`);
    return (
      `This is a folder: "${result.name}"\nPath: ${result.path}\n\n` +
      `Contents (${children.length} item${children.length === 1 ? '' : 's'}):\n${lines.join('\n')}`
    );
  }
  return result.content ?? '(empty file)';
}

function formatRecentDocs(items) {
  if (!items?.length) return 'No recent documents found.';
  const lines = items.map((f) => {
    const date = new Date(f.updatedAt).toLocaleDateString();
    const loc = f.folder ? ` — in ${f.folder}` : '';
    return `- ${f.name}${loc}  (id: ${f.id})  · ${date}`;
  });
  return `Recent documents (${items.length}):\n\n${lines.join('\n')}`;
}

function formatPinnedDocs(items) {
  if (!items?.length) return 'No pinned items found.';
  const lines = items.map((f) => {
    const tag = f.type === 'folder' ? '[folder]' : '[file]';
    const loc = f.folder ? ` — in ${f.folder}` : '';
    return `${tag} ${f.name}${loc}  (id: ${f.id})`;
  });
  return `Pinned items (${items.length}):\n\n${lines.join('\n')}`;
}

function formatSessions(sessions) {
  if (!sessions?.length) return 'No active sessions found.';
  const lines = sessions.map((s) => {
    const expiry = new Date(s.expires_at).toLocaleDateString();
    const lastUsed = s.last_used_at ? new Date(s.last_used_at).toLocaleString() : 'Never';
    return `- ${s.device_name}  (id: ${s.id})\n  Last used: ${lastUsed}  |  Expires: ${expiry}`;
  });
  return `Active sessions (${sessions.length}):\n\n${lines.join('\n\n')}`;
}

const transport = new StdioServerTransport();
await server.connect(transport);

import { apiRequest } from '../api.js';

export async function list_files({ folderPath } = {}) {
  const params = new URLSearchParams();
  if (folderPath) params.set('folderPath', folderPath);
  const qs = params.toString() ? `?${params}` : '';
  return apiRequest(`/api/mcp/files${qs}`);
}

export async function create_file({ type, fileName, folderPath = '/', content = '' }) {
  return apiRequest('/api/mcp/files', {
    method: 'POST',
    body: JSON.stringify({ type, fileName, folderPath, content }),
  });
}

export async function read_file({ fileId }) {
  return apiRequest(`/api/mcp/files/${fileId}`);
}

export async function edit_file({ fileId, mode, newContent, searchContent, replaceContent }) {
  return apiRequest(`/api/mcp/files/${fileId}`, {
    method: 'PATCH',
    body: JSON.stringify({ mode, newContent, searchContent, replaceContent }),
  });
}

export async function delete_file({ fileId }) {
  return apiRequest(`/api/mcp/files/${fileId}`, { method: 'DELETE' });
}

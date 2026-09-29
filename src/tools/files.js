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

export async function rename_file({ fileId, name }) {
  return apiRequest(`/api/mcp/files/${fileId}/rename`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function get_recent_documents() {
  return apiRequest('/api/mcp/files/recent');
}

export async function get_pinned_documents() {
  return apiRequest('/api/mcp/files/pinned');
}

export async function get_file_link({ fileId }) {
  return apiRequest(`/api/mcp/files/${fileId}/link`);
}

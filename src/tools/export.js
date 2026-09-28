import { apiRequest } from '../api.js';

export async function generate_pdf_download_link({ fileId }) {
  return apiRequest(`/api/mcp/files/${fileId}/export/pdf`, { method: 'POST' });
}

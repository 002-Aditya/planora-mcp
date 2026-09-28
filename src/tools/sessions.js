import { apiRequest } from '../api.js';

export async function get_active_sessions() {
  return apiRequest('/api/mcp/sessions');
}

export async function revoke_session({ sessionId }) {
  return apiRequest(`/api/mcp/sessions/${sessionId}`, { method: 'DELETE' });
}

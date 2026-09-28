import { API_BASE_URL } from './constants.js';
import { getToken } from './config.js';

export async function apiRequest(path, options = {}) {
  const token = getToken();
  if (!token) {
    throw new Error("No session found. Run 'planora-login' to authenticate.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 401) {
    throw new Error('SESSION_EXPIRED');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? `Request failed with status ${response.status}`);
  }

  return data;
}

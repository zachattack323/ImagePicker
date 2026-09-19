// Only the local Flask API is permitted. No remote service receives page data.
export const API_URL = 'http://127.0.0.1:5001/api';
export const APP_URL = 'http://127.0.0.1:5173/';

export function validImageUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && value.length <= 2048;
  } catch { return false; }
}

export async function api(path, body) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new Error('Cannot reach ImageShare. Start the backend with ./scripts/backend.sh, then click Retry connection.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `ImageShare returned an error (${response.status}).`);
  return data;
}

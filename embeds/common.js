// Point this at your backend. In a real integration, inject it at build/deploy time.
export const BACKEND_URL = 'http://localhost:4000';

export const TAB_NAMES = ['builder', 'workflow', 'participant'];

export const $ = (id) => document.getElementById(id);
export const embedArea = $('embed-area');

export const PLACEHOLDER_HTML = '<p class="embed-placeholder">Component will render here once loaded.</p>';

export function setStatus(id, msg, isError = false) {
  const el = $(id);
  el.classList.toggle('error', isError);
  if (!msg) {
    el.textContent = '';
    return;
  }
  const icon = isError ? 'error' : 'check_circle';
  el.innerHTML = `<span class="material-icons-outlined">${icon}</span>${escapeHtml(msg)}`;
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export async function mintToken(body) {
  const res = await fetch(`${BACKEND_URL}/api/embed-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      allowedOrigins: [window.location.origin],
      ...body,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend returned ${res.status}: ${text}`);
  }
  return res.json();
}

export function clearAll() {
  embedArea.innerHTML = PLACEHOLDER_HTML;
  TAB_NAMES.forEach((name) => setStatus(`${name}-status`, ''));
}

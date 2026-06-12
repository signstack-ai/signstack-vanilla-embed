import { $, embedArea, setStatus, mintToken } from './common.js';

$('builder-load').addEventListener('click', async () => {
  const resourceKey = $('builder-resource-key').value.trim();
  const resourceKind = $('builder-resource-kind').value.trim();
  const version = $('builder-version').value.trim();
  if (!resourceKey || !resourceKind) return setStatus('builder-status', 'Resource key and kind are required', true);
  setStatus('builder-status', 'Minting token…');
  try {
    const { embedToken } = await mintToken({
      component: 'builder',
      resourceKey,
      resourceKind,
      ...(version ? { version } : {}),
    });
    embedArea.innerHTML = '';
    const el = document.createElement('signstack-builder');
    el.setAttribute('embed-token', embedToken);
    el.addEventListener('saved', (e) => setStatus('builder-status', `Saved: ${JSON.stringify(e.detail)}`));
    el.addEventListener('published', (e) => setStatus('builder-status', `Published: ${JSON.stringify(e.detail)}`));
    el.addEventListener('error', (e) => setStatus('builder-status', `Error: ${JSON.stringify(e.detail)}`, true));
    embedArea.appendChild(el);
    setStatus('builder-status', 'Builder loaded');
  } catch (err) {
    setStatus('builder-status', err.message, true);
  }
});

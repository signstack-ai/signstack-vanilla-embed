import { $, embedArea, setStatus, mintToken } from './common.js';

$('workflow-load').addEventListener('click', async () => {
  const workflowId = $('workflow-id').value.trim();
  if (!workflowId) return setStatus('workflow-status', 'Workflow ID is required', true);
  setStatus('workflow-status', 'Minting token…');
  try {
    const { embedToken } = await mintToken({ component: 'workflow', workflowId });
    embedArea.innerHTML = '';
    const el = document.createElement('signstack-workflow');
    el.setAttribute('embed-token', embedToken);
    embedArea.appendChild(el);
    setStatus('workflow-status', 'Workflow loaded');
  } catch (err) {
    setStatus('workflow-status', err.message, true);
  }
});

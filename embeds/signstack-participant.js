import { $, embedArea, setStatus, mintToken } from './common.js';

$('participant-load').addEventListener('click', async () => {
  const workflowId = $('participant-workflow-id').value.trim();
  const stepKey = $('participant-step-key').value.trim();
  if (!workflowId || !stepKey) return setStatus('participant-status', 'Workflow ID and Step key are required', true);
  setStatus('participant-status', 'Minting token…');
  try {
    const { embedToken } = await mintToken({ component: 'participant', workflowId, stepKey });
    embedArea.innerHTML = '';
    const el = document.createElement('signstack-participant');
    el.setAttribute('embed-token', embedToken);
    el.addEventListener('signed', (e) => setStatus('participant-status', `Signed: ${JSON.stringify(e.detail)}`));
    el.addEventListener('declined', (e) => setStatus('participant-status', `Declined: ${JSON.stringify(e.detail)}`, true));
    el.addEventListener('signingError', (e) => setStatus('participant-status', `Error: ${JSON.stringify(e.detail)}`, true));
    el.addEventListener('sessionExpired', () => setStatus('participant-status', 'Session expired', true));
    el.addEventListener('closed', () => setStatus('participant-status', 'Closed'));
    embedArea.appendChild(el);
    setStatus('participant-status', 'Participant session loaded');
  } catch (err) {
    setStatus('participant-status', err.message, true);
  }
});

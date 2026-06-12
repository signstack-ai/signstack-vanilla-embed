import { $, clearAll, TAB_NAMES } from './embeds/common.js';
import './embeds/signstack-builder.js';
import './embeds/signstack-workflow.js';
import './embeds/signstack-participant.js';

// Tab switching — also clears state/status so users don't see stale messages.
document.querySelectorAll('.tabs .tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs .tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    TAB_NAMES.forEach((name) => {
      $(`panel-${name}`).classList.toggle('hidden', name !== btn.dataset.tab);
    });
    clearAll();
  });
});

// Per-panel Reset buttons
document.querySelectorAll('[data-reset]').forEach((btn) => {
  btn.addEventListener('click', clearAll);
});

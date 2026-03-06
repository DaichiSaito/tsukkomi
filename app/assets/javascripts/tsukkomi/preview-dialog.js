/**
 * Preview dialog module - Shows LLM-generated task for user confirmation before submission
 */

const CATEGORY_LABELS = {
  bug: { label: 'バグ', color: '#dc2626', bg: '#fef2f2' },
  improvement: { label: '改善', color: '#2563eb', bg: '#eff6ff' },
  question: { label: '質問', color: '#7c3aed', bg: '#f5f3ff' },
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Show a preview dialog with the LLM-generated task.
 * Returns { action: 'confirm', syncToBackend: boolean } to proceed,
 * 'retry' to go back, or null if cancelled.
 */
export function showPreviewDialog(shadowRoot, task) {
  return new Promise((resolve) => {
    const cat = CATEGORY_LABELS[task.category] || { label: task.category, color: '#6b7280', bg: '#f3f4f6' };

    const backdrop = document.createElement('div');
    Object.assign(backdrop.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.4)',
      zIndex: '2147483646',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    const dialog = document.createElement('div');
    Object.assign(dialog.style, {
      background: '#fff',
      borderRadius: '12px',
      padding: '24px',
      width: '440px',
      maxWidth: '90vw',
      maxHeight: '80vh',
      overflowY: 'auto',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    });

    const descriptionHtml = task.description
      ? `<div style="margin:12px 0;padding:12px;background:#f9fafb;border-radius:8px;font-size:13px;color:#374151;line-height:1.6;white-space:pre-wrap;max-height:200px;overflow-y:auto;">${escapeHtml(task.description)}</div>`
      : '';

    const labelsHtml = task.labels && task.labels.length > 0
      ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px;">${task.labels.map(l => `<span style="font-size:11px;padding:2px 8px;border-radius:9999px;background:#f3f4f6;color:#6b7280;">${escapeHtml(l)}</span>`).join('')}</div>`
      : '';

    dialog.innerHTML = `
      <h3 style="margin:0 0 16px;font-size:16px;color:#1a1a1a;">AIが生成したタスクを確認</h3>
      <div style="margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:15px;font-weight:600;color:#1a1a1a;">${escapeHtml(task.title)}</span>
        </div>
        <span style="display:inline-block;font-size:12px;padding:2px 10px;border-radius:9999px;background:${cat.bg};color:${cat.color};font-weight:500;">${cat.label}</span>
        ${labelsHtml}
      </div>
      ${descriptionHtml}
      <label style="display:flex;align-items:center;gap:6px;margin-top:12px;font-size:13px;color:#374151;cursor:pointer;">
        <input type="checkbox" id="fc-sync-backend" checked style="accent-color:#2563eb;">
        バックエンドに連携する（GitHub Issues等）
      </label>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
        <button id="fc-preview-retry" style="padding:8px 16px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;font-size:14px;color:#666;">やり直す</button>
        <button id="fc-preview-confirm" style="padding:8px 16px;border:none;border-radius:6px;background:#2563eb;color:#fff;cursor:pointer;font-size:14px;font-weight:500;">登録する</button>
      </div>
    `;

    backdrop.appendChild(dialog);
    shadowRoot.appendChild(backdrop);

    const syncCheckbox = dialog.querySelector('#fc-sync-backend');

    function cleanup() {
      backdrop.remove();
    }

    dialog.querySelector('#fc-preview-confirm').addEventListener('click', () => {
      cleanup();
      resolve({ action: 'confirm', syncToBackend: syncCheckbox.checked });
    });

    dialog.querySelector('#fc-preview-retry').addEventListener('click', () => {
      cleanup();
      resolve('retry');
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        cleanup();
        resolve(null);
      }
    });

    // Escape key to cancel
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        cleanup();
        resolve(null);
        document.removeEventListener('keydown', onKeyDown);
      }
    }
    document.addEventListener('keydown', onKeyDown);
  });
}

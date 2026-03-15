/**
 * History panel module - Side drawer showing past feedback entries
 * Supports real-time status updates and backend sync actions.
 * Background polling runs independently of panel open/close state
 * to detect status transitions and fire toast notifications.
 */

const CATEGORY_COLORS = {
  bug: { bg: '#fef2f2', color: '#dc2626', label: 'バグ' },
  improvement: { bg: '#eff6ff', color: '#2563eb', label: '改善' },
  question: { bg: '#f5f3ff', color: '#7c3aed', label: '質問' },
};

const STATUS_LABELS = {
  processing: { label: '生成中...', color: '#f59e0b', bg: '#fffbeb' },
  generated: { label: '確認待ち', color: '#2563eb', bg: '#eff6ff' },
  pending: { label: '登録中...', color: '#f59e0b', bg: '#fffbeb' },
  synced: { label: '登録済み', color: '#10b981', bg: '#ecfdf5' },
  failed: { label: '失敗', color: '#ef4444', bg: '#fef2f2' },
};

const POLL_INTERVAL = 3000;

function formatDate(isoString) {
  const d = new Date(isoString);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

function getBackendUrl(backendResults) {
  if (!backendResults) return null;
  const results = typeof backendResults === 'string' ? JSON.parse(backendResults) : backendResults;
  if (results.url) return results.url;
  if (results.html_url) return results.html_url;
  for (const key of Object.keys(results)) {
    const b = results[key];
    if (b && b.result) {
      if (b.result.html_url) return b.result.html_url;
      if (b.result.url) return b.result.url;
    }
  }
  return null;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildStatusBadge(status) {
  const s = STATUS_LABELS[status] || { label: status || '不明', color: '#6b7280', bg: '#f3f4f6' };
  const isAnimated = status === 'processing' || status === 'pending';
  return `<span style="font-size:10px;padding:2px 6px;border-radius:9999px;background:${s.bg};color:${s.color};font-weight:500;white-space:nowrap;flex-shrink:0;${isAnimated ? 'animation:fc-pulse 1.5s ease-in-out infinite;' : ''}">${s.label}</span>`;
}

function getSyncLabel(backend) {
  switch (backend) {
    case 'github_issues': return 'GitHub に登録';
    case 'vibe_kanban': return 'VibeKanban に登録';
    default: return 'バックエンドに登録';
  }
}

function buildFeedbackCard(entry, apiBase, backend) {
  const task = entry.task;
  const cat = CATEGORY_COLORS[task?.category] || { bg: '#f3f4f6', color: '#6b7280', label: task?.category || '不明' };
  const backendUrl = getBackendUrl(task?.backendResults);
  const status = task?.status;

  const links = [];

  if (task?.id) {
    links.push(`<a href="${apiBase}/admin/tasks/${task.id}" target="_blank" rel="noopener" style="color:#2563eb;font-size:12px;text-decoration:none;">詳細 ↗</a>`);
  }

  if (backendUrl) {
    links.push(`<a href="${backendUrl}" target="_blank" rel="noopener" style="color:#2563eb;font-size:12px;text-decoration:none;">Issue ↗</a>`);
  }

  const linkHtml = links.length > 0
    ? `<div style="display:flex;gap:8px;">${links.join('')}</div>`
    : '';

  const syncBtnHtml = (status === 'generated' || status === 'failed') && backend
    ? `<button data-sync-feedback-id="${entry.id}" style="margin-top:6px;padding:4px 10px;border:none;border-radius:4px;background:#2563eb;color:#fff;cursor:pointer;font-size:11px;font-weight:500;">${getSyncLabel(backend)}</button>`
    : '';

  const titleText = status === 'processing'
    ? entry.comment
    : (task?.title || entry.comment);

  return `
    <div data-feedback-id="${entry.id}" style="padding:12px 16px;border-bottom:1px solid #f3f4f6;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:13px;font-weight:600;color:#1a1a1a;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${escapeHtml(titleText)}
        </span>
        ${task ? `<span style="flex-shrink:0;font-size:11px;padding:2px 8px;border-radius:9999px;background:${cat.bg};color:${cat.color};font-weight:500;">${cat.label}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:nowrap;">
        ${task ? buildStatusBadge(status) : '<span style="font-size:10px;padding:2px 6px;border-radius:9999px;background:#fffbeb;color:#f59e0b;font-weight:500;white-space:nowrap;flex-shrink:0;">受付済み</span>'}
        <span style="font-size:12px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">
          ${escapeHtml(entry.comment)}
        </span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:11px;color:#9ca3af;">${entry.submittedAt ? formatDate(entry.submittedAt) : ''} · ${escapeHtml(entry.pageUrl || '')}</span>
        ${linkHtml}
      </div>
      ${syncBtnHtml}
    </div>
  `;
}

/**
 * @param {ShadowRoot} shadowRoot
 * @param {string} apiBase
 * @param {object} options
 * @param {function} options.onStatusChange - Called when a feedback's status transitions.
 *   Receives ({ feedbackId, task, oldStatus, newStatus }).
 */
export function createHistoryPanel(shadowRoot, apiBase, backend, options = {}) {
  let panel = null;
  let isOpen = false;
  let bgPollTimer = null;

  // Track previous statuses to detect transitions
  const prevStatuses = new Map();
  // Cache latest feedbacks for rendering
  let latestFeedbacks = [];
  // Track whether there are active (in-progress) items
  let hasActiveItems = false;

  // --- Background polling (runs regardless of panel state) ---

  async function fetchAndDetect() {
    try {
      const res = await fetch(`${apiBase}/api/feedbacks`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      latestFeedbacks = data.feedbacks || [];

      // Detect status transitions
      if (options.onStatusChange) {
        for (const entry of latestFeedbacks) {
          const id = entry.id;
          const newStatus = entry.task?.status || null;
          const oldStatus = prevStatuses.get(id) || null;

          if (oldStatus && newStatus && oldStatus !== newStatus) {
            options.onStatusChange({
              feedbackId: id,
              task: entry.task,
              oldStatus,
              newStatus,
            });
          }

          prevStatuses.set(id, newStatus);
        }
      }

      // Update active items flag
      hasActiveItems = latestFeedbacks.some(f =>
        f.task?.status === 'processing' || f.task?.status === 'pending' || !f.task
      );

      // If panel is open, re-render
      if (isOpen) {
        renderPanel();
      }

      // Stop polling if nothing active
      if (!hasActiveItems) {
        stopBgPoll();
      }
    } catch (err) {
      console.error('[feedback-collector] Failed to fetch history:', err);
    }
  }

  function startBgPoll() {
    if (bgPollTimer) return;
    bgPollTimer = setInterval(fetchAndDetect, POLL_INTERVAL);
  }

  function stopBgPoll() {
    if (bgPollTimer) {
      clearInterval(bgPollTimer);
      bgPollTimer = null;
    }
  }

  function ensurePolling() {
    // Always start polling - fetchAndDetect will stop it when no active items
    if (!bgPollTimer) {
      startBgPoll();
    }
  }

  // --- Panel rendering ---

  function renderPanel() {
    if (!panel) return;
    const content = panel.querySelector('[data-history-content]');
    if (!content) return;

    if (latestFeedbacks.length === 0) {
      content.innerHTML = '<div style="padding:40px 16px;text-align:center;color:#9ca3af;font-size:14px;">まだフィードバックがありません</div>';
      return;
    }

    content.innerHTML = latestFeedbacks.map(f => buildFeedbackCard(f, apiBase, backend)).join('');

    // Attach sync button handlers
    content.querySelectorAll('[data-sync-feedback-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const feedbackId = e.target.dataset.syncFeedbackId;
        e.target.disabled = true;
        e.target.textContent = '登録中...';
        e.target.style.opacity = '0.6';

        try {
          const res = await fetch(`${apiBase}/api/feedbacks/${feedbackId}/sync_backend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Error: ${res.status}`);
          }
          e.target.textContent = '登録開始しました';
          // Restart polling to track sync progress
          ensurePolling();
        } catch (err) {
          e.target.textContent = '登録失敗';
          e.target.style.background = '#ef4444';
          console.error('[feedback-collector] Sync error:', err);
        }
      });
    });
  }

  function open() {
    if (isOpen) return;
    isOpen = true;

    panel = document.createElement('div');
    Object.assign(panel.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      width: '380px',
      maxWidth: '100vw',
      height: '100vh',
      background: '#fff',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
      zIndex: '2147483646',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      transform: 'translateX(100%)',
      transition: 'transform 0.25s ease',
    });

    // Inject pulse animation
    if (!shadowRoot.querySelector('#fc-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'fc-pulse-style';
      style.textContent = '@keyframes fc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }';
      shadowRoot.appendChild(style);
    }

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      padding: '16px',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: '0',
    });
    header.innerHTML = `
      <span style="font-size:15px;font-weight:600;color:#1a1a1a;">フィードバック履歴</span>
      <button id="fc-history-close" style="background:none;border:none;cursor:pointer;font-size:18px;color:#9ca3af;padding:4px 8px;border-radius:4px;">✕</button>
    `;
    panel.appendChild(header);

    // Content area
    const content = document.createElement('div');
    content.setAttribute('data-history-content', '');
    Object.assign(content.style, {
      flex: '1',
      overflowY: 'auto',
    });
    content.innerHTML = '<div style="padding:40px 16px;text-align:center;color:#9ca3af;font-size:14px;">読み込み中...</div>';
    panel.appendChild(content);

    shadowRoot.appendChild(panel);

    // Animate in
    requestAnimationFrame(() => {
      panel.style.transform = 'translateX(0)';
    });

    // Close button
    header.querySelector('#fc-history-close').addEventListener('click', close);

    // Fetch immediately and start polling
    fetchAndDetect();
    ensurePolling();
  }

  function close() {
    if (!panel || !isOpen) return;
    isOpen = false;
    panel.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (panel) {
        panel.remove();
        panel = null;
      }
    }, 250);
    // Don't stop bg polling - it continues for toast notifications
  }

  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  function refresh() {
    fetchAndDetect();
  }

  // Called by widget after submitting a new feedback
  function notifyNewFeedback() {
    fetchAndDetect();
    ensurePolling();
  }

  return { open, close, toggle, refresh, notifyNewFeedback };
}

/**
 * History panel module - Side drawer showing past feedback entries
 */

const CATEGORY_COLORS = {
  bug: { bg: '#fef2f2', color: '#dc2626', label: 'バグ' },
  improvement: { bg: '#eff6ff', color: '#2563eb', label: '改善' },
  question: { bg: '#f5f3ff', color: '#7c3aed', label: '質問' },
};

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
  // Check for direct url/html_url
  if (results.url) return results.url;
  if (results.html_url) return results.html_url;
  // Check nested backend results (e.g. { github_issues: { result: { url: ... } } })
  for (const key of Object.keys(results)) {
    const b = results[key];
    if (b && b.result) {
      if (b.result.html_url) return b.result.html_url;
      if (b.result.url) return b.result.url;
    }
  }
  return null;
}

function buildFeedbackCard(entry, apiBase) {
  const cat = CATEGORY_COLORS[entry.task?.category] || { bg: '#f3f4f6', color: '#6b7280', label: entry.task?.category || '不明' };
  const backendUrl = getBackendUrl(entry.task?.backendResults);

  const links = [];

  // 管理画面リンク
  if (entry.task?.id) {
    links.push(`<a href="${apiBase}/admin/tasks/${entry.task.id}" target="_blank" rel="noopener" style="color:#2563eb;font-size:12px;text-decoration:none;">詳細 ↗</a>`);
  }

  // バックエンドリンク
  if (backendUrl) {
    links.push(`<a href="${backendUrl}" target="_blank" rel="noopener" style="color:#2563eb;font-size:12px;text-decoration:none;">Issue ↗</a>`);
  }

  const linkHtml = links.length > 0
    ? `<div style="display:flex;gap:8px;">${links.join('')}</div>`
    : '';

  return `
    <div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:13px;font-weight:600;color:#1a1a1a;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${escapeHtml(entry.task?.title || entry.comment)}
        </span>
        <span style="flex-shrink:0;font-size:11px;padding:2px 8px;border-radius:9999px;background:${cat.bg};color:${cat.color};font-weight:500;">
          ${cat.label}
        </span>
      </div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${escapeHtml(entry.comment)}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:11px;color:#9ca3af;">${entry.submittedAt ? formatDate(entry.submittedAt) : ''} · ${escapeHtml(entry.pageUrl || '')}</span>
        ${linkHtml}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function createHistoryPanel(shadowRoot, apiBase) {
  let panel = null;
  let isOpen = false;

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

    // Fetch history
    fetchHistory(content);
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
  }

  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  async function fetchHistory(content) {
    try {
      const res = await fetch(`${apiBase}/api/feedbacks`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const feedbacks = data.feedbacks || [];

      if (feedbacks.length === 0) {
        content.innerHTML = '<div style="padding:40px 16px;text-align:center;color:#9ca3af;font-size:14px;">まだフィードバックがありません</div>';
        return;
      }

      content.innerHTML = feedbacks.map(f => buildFeedbackCard(f, apiBase)).join('');
    } catch (err) {
      console.error('[feedback-collector] Failed to fetch history:', err);
      content.innerHTML = '<div style="padding:40px 16px;text-align:center;color:#ef4444;font-size:14px;">履歴の取得に失敗しました</div>';
    }
  }

  return { open, close, toggle };
}

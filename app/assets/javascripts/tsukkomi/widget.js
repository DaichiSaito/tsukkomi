/**
 * Tsukkomi Feedback Widget
 * Injected into the target app via <script src="/tsukkomi/widget.js">
 * Uses Shadow DOM for style isolation.
 */

import { captureScreenshot } from './screenshot.js';
import { createAnnotator } from './annotator.js';
import { showCommentForm } from './comment-form.js';
import { createHistoryPanel } from './history-panel.js';

(function () {
  // Read config from script tag data attributes
  const currentScript = document.currentScript;
  const apiBase = currentScript?.getAttribute('data-api-base') || '/tsukkomi';

  // Don't show widget on tsukkomi admin pages
  if (window.location.pathname.startsWith(apiBase + '/admin')) return;

  const reporter = currentScript?.getAttribute('data-reporter') || 'anonymous';
  const position = currentScript?.getAttribute('data-position') || 'bottom-right';
  const backend = currentScript?.getAttribute('data-backend') || '';

  // Create Shadow DOM host
  const host = document.createElement('div');
  host.id = 'feedback-collector-host';
  Object.assign(host.style, {
    position: 'fixed',
    zIndex: '2147483647',
    ...getPositionStyles(position),
  });
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  // Create floating button
  const isMobile = window.innerWidth <= 768;
  const btn = document.createElement('button');
  Object.assign(btn.style, {
    width: isMobile ? '44px' : '56px',
    height: isMobile ? '44px' : '56px',
    borderRadius: '50%',
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
    fontSize: isMobile ? '18px' : '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s, box-shadow 0.15s',
    fontFamily: 'sans-serif',
  });
  btn.innerHTML = '💬';
  btn.title = 'フィードバックを送信';

  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.1)';
    btn.style.boxShadow = '0 6px 20px rgba(37,99,235,0.5)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 14px rgba(37,99,235,0.4)';
  });

  shadow.appendChild(btn);

  // History button (small icon above the main button)
  const historyBtn = document.createElement('button');
  Object.assign(historyBtn.style, {
    width: isMobile ? '28px' : '36px',
    height: isMobile ? '28px' : '36px',
    borderRadius: '50%',
    border: 'none',
    background: '#f3f4f6',
    color: '#6b7280',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    fontSize: isMobile ? '12px' : '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s, background 0.15s',
    fontFamily: 'sans-serif',
    marginBottom: '8px',
  });
  historyBtn.innerHTML = '📋';
  historyBtn.title = 'フィードバック履歴';

  historyBtn.addEventListener('mouseenter', () => {
    historyBtn.style.background = '#e5e7eb';
    historyBtn.style.transform = 'scale(1.1)';
  });
  historyBtn.addEventListener('mouseleave', () => {
    historyBtn.style.background = '#f3f4f6';
    historyBtn.style.transform = 'scale(1)';
  });

  // Insert history button before main button
  shadow.insertBefore(historyBtn, btn);

  // Initialize history panel with status change notifications
  const historyPanel = createHistoryPanel(shadow, apiBase, backend, {
    onStatusChange({ task, oldStatus, newStatus }) {
      const title = task?.title || 'タスク';

      if (newStatus === 'generated' && oldStatus === 'processing') {
        showToast(`タスク生成完了: ${title}`, '#10b981');
      } else if (newStatus === 'synced') {
        const dest = backend === 'github_issues' ? 'GitHub' : backend === 'vibe_kanban' ? 'VibeKanban' : 'バックエンド';
        showToast(`${dest} 登録完了: ${title}`, '#10b981');
      } else if (newStatus === 'failed' && oldStatus === 'pending') {
        const dest = backend === 'github_issues' ? 'GitHub' : backend === 'vibe_kanban' ? 'VibeKanban' : 'バックエンド';
        showToast(`${dest} 登録失敗: ${title}`, '#ef4444');
      } else if (newStatus === 'failed' && oldStatus === 'processing') {
        showToast(`タスク生成失敗: ${title}`, '#ef4444');
      }
    },
  });
  historyBtn.addEventListener('click', () => historyPanel.toggle());

  // Inline status for screenshot capture / submit errors only
  let activeStatus = null;

  function showStatus(message, { isError = false, loading = false } = {}) {
    if (activeStatus) {
      activeStatus.remove();
      activeStatus = null;
    }

    const status = document.createElement('div');
    Object.assign(status.style, {
      position: 'fixed',
      bottom: '80px',
      right: '24px',
      background: isError ? '#ef4444' : loading ? '#2563eb' : '#10b981',
      color: '#fff',
      padding: '12px 20px',
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: '2147483647',
      transition: 'opacity 0.3s',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });

    if (loading) {
      const spinner = document.createElement('span');
      Object.assign(spinner.style, {
        display: 'inline-block',
        width: '16px',
        height: '16px',
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'fc-spin 0.8s linear infinite',
      });
      if (!shadow.querySelector('#fc-spinner-style')) {
        const style = document.createElement('style');
        style.id = 'fc-spinner-style';
        style.textContent = '@keyframes fc-spin { to { transform: rotate(360deg); } }';
        shadow.appendChild(style);
      }
      status.appendChild(spinner);
    }

    const text = document.createElement('span');
    text.textContent = message;
    status.appendChild(text);
    shadow.appendChild(status);
    activeStatus = status;

    // Auto-dismiss after 3s
    if (!loading) {
      setTimeout(() => {
        status.style.opacity = '0';
        setTimeout(() => {
          status.remove();
          if (activeStatus === status) activeStatus = null;
        }, 300);
      }, 3000);
    }
  }

  function dismissStatus() {
    if (activeStatus) {
      activeStatus.style.opacity = '0';
      const ref = activeStatus;
      setTimeout(() => ref.remove(), 300);
      activeStatus = null;
    }
  }

  // Toast notification (non-blocking, auto-dismiss)
  function showToast(message, color) {
    const toast = document.createElement('div');
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '90px',
      right: '24px',
      background: color || '#10b981',
      color: '#fff',
      padding: '10px 16px',
      borderRadius: '8px',
      fontSize: '13px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: '2147483647',
      transition: 'opacity 0.3s, transform 0.3s',
      maxWidth: '300px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
    toast.textContent = message;
    shadow.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  // Submit lock
  let isSubmitting = false;
  let cooldownTimer = null;
  const COOLDOWN_MS = 3000;

  function setSubmitLock(locked) {
    isSubmitting = locked;
    btn.disabled = locked;
    if (locked) {
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.style.pointerEvents = 'none';
    } else {
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.pointerEvents = 'auto';
    }
  }

  function startCooldown() {
    setSubmitLock(true);
    cooldownTimer = setTimeout(() => {
      setSubmitLock(false);
      cooldownTimer = null;
    }, COOLDOWN_MS);
  }

  // Main feedback flow
  async function startFeedbackFlow() {
    if (isSubmitting) return;

    try {
      // 1. Capture screenshot
      showStatus('スクリーンショットを取得中...', { loading: true });

      let screenshotDataUrl;
      try {
        screenshotDataUrl = await captureScreenshot(host);
      } catch (ssErr) {
        dismissStatus();
        console.error('[feedback-collector] Screenshot failed:', ssErr);
        showStatus('スクリーンショットの取得に失敗しました', { isError: true });
        return;
      }

      dismissStatus();

      // 2. Range selection
      const annotation = await createAnnotator();
      if (!annotation) return;

      // 3. Show comment form
      const result = await showCommentForm(shadow, screenshotDataUrl, annotation.coordinates);
      if (!result) return;

      // 4. Collect metadata
      const payload = {
        screenshot: screenshotDataUrl,
        cropped_screenshot: result.croppedScreenshot,
        comment: result.comment,
        page_url: window.location.pathname + window.location.search,
        selector: annotation.selector,
        coordinates: annotation.coordinates,
        reporter: reporter,
        browser: getBrowserInfo(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        timestamp: new Date().toISOString(),
      };

      // 5. Submit feedback (always async)
      setSubmitLock(true);
      showStatus('送信中...', { loading: true });

      const res = await fetch(`${apiBase}/api/feedbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      dismissStatus();

      // Start background polling and open history panel
      historyPanel.notifyNewFeedback();
      historyPanel.open();

      startCooldown();
    } catch (err) {
      console.error('[feedback-collector]', err);
      dismissStatus();

      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('net::')) {
        showStatus('サーバーに接続できません', { isError: true });
      } else {
        showStatus('送信に失敗しました', { isError: true });
      }

      setSubmitLock(false);
    }
  }

  btn.addEventListener('click', startFeedbackFlow);

  // Keyboard shortcut: Ctrl+Shift+F or Cmd+Shift+F
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      startFeedbackFlow();
    }
  });

  function getPositionStyles(pos) {
    switch (pos) {
      case 'bottom-left':
        return { bottom: '24px', left: '24px' };
      case 'top-right':
        return { top: '24px', right: '24px' };
      case 'top-left':
        return { top: '24px', left: '24px' };
      case 'bottom-right':
      default:
        return { bottom: '24px', right: '24px' };
    }
  }

  function getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';

    const versionMatch = ua.match(new RegExp(`${browser}\\/([\\d.]+)`));
    const version = versionMatch ? versionMatch[1].split('.')[0] : '';

    let os = 'Unknown';
    if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Linux')) os = 'Linux';

    return `${browser} ${version} / ${os}`;
  }
})();

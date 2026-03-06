/**
 * Tsukkomi Feedback Widget
 * Injected into the target app via <script src="/tsukkomi/widget.js">
 * Uses Shadow DOM for style isolation.
 */

import { captureScreenshot } from './screenshot.js';
import { createAnnotator } from './annotator.js';
import { showCommentForm } from './comment-form.js';
import { createHistoryPanel } from './history-panel.js';
import { showPreviewDialog } from './preview-dialog.js';

(function () {
  // Read config from script tag data attributes
  const currentScript = document.currentScript;
  const reporter = currentScript?.getAttribute('data-reporter') || 'anonymous';
  const position = currentScript?.getAttribute('data-position') || 'bottom-right';
  const confirmBeforeSubmit = currentScript?.getAttribute('data-confirm-before-submit') !== 'false';
  const apiBase = currentScript?.getAttribute('data-api-base') || '/tsukkomi';

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
  const btn = document.createElement('button');
  Object.assign(btn.style, {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
    fontSize: '24px',
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
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    background: '#f3f4f6',
    color: '#6b7280',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    fontSize: '16px',
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

  // Initialize history panel
  const historyPanel = createHistoryPanel(shadow, apiBase);
  historyBtn.addEventListener('click', () => historyPanel.toggle());

  // Status indicator
  let activeStatus = null;

  function showStatus(message, { isError = false, loading = false } = {}) {
    // Remove previous status if exists
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
      spinner.textContent = '';
      Object.assign(spinner.style, {
        display: 'inline-block',
        width: '16px',
        height: '16px',
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'fc-spin 0.8s linear infinite',
      });

      // Inject keyframes if not already done
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

    // Auto-dismiss non-loading statuses after 3s
    if (!loading) {
      setTimeout(() => {
        status.style.opacity = '0';
        setTimeout(() => {
          status.remove();
          if (activeStatus === status) activeStatus = null;
        }, 300);
      }, 3000);
    }

    return { updateText: (msg) => { text.textContent = msg; } };
  }

  function dismissStatus() {
    if (activeStatus) {
      activeStatus.style.opacity = '0';
      const ref = activeStatus;
      setTimeout(() => ref.remove(), 300);
      activeStatus = null;
    }
  }

  // Category labels and colors for display
  const CATEGORY_LABELS = { bug: 'バグ', improvement: '改善', question: '質問' };
  const CATEGORY_COLORS = {
    bug: { bg: '#fef2f2', color: '#dc2626' },
    improvement: { bg: '#eff6ff', color: '#2563eb' },
    question: { bg: '#f5f3ff', color: '#7c3aed' },
  };

  function getIssueUrl(backends) {
    if (!backends) return null;
    for (const key of Object.keys(backends)) {
      const b = backends[key];
      if (b && b.result) {
        if (b.result.html_url) return b.result.html_url;
        if (b.result.url) return b.result.url;
        if (b.result.issueUrl) return b.result.issueUrl;
      }
    }
    return null;
  }

  /**
   * Show a rich completion toast with task title, category badge, and optional issue link.
   * Stays for 8 seconds or until manually closed. Persists if it has a link.
   */
  function showRichToast({ task, backends }) {
    dismissStatus();

    const title = task?.title || 'タスク';
    const catLabel = CATEGORY_LABELS[task?.category] || task?.category || '';
    const catColor = CATEGORY_COLORS[task?.category] || { bg: '#f3f4f6', color: '#6b7280' };
    const issueUrl = getIssueUrl(backends);

    const toast = document.createElement('div');
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '80px',
      right: '24px',
      background: '#fff',
      color: '#1a1a1a',
      padding: '16px',
      borderRadius: '12px',
      fontSize: '14px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      zIndex: '2147483647',
      transition: 'opacity 0.3s, transform 0.3s',
      maxWidth: '340px',
      borderLeft: `4px solid ${catColor.color}`,
    });

    // Close button
    const closeBtn = document.createElement('button');
    Object.assign(closeBtn.style, {
      position: 'absolute',
      top: '8px',
      right: '8px',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '14px',
      color: '#9ca3af',
      padding: '2px 6px',
      borderRadius: '4px',
    });
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => dismissToast(toast));
    toast.appendChild(closeBtn);

    // Success icon + title
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '8px',
      paddingRight: '20px',
    });
    header.innerHTML = `<span style="color:#10b981;font-size:16px;">✓</span><span style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(title)}</span>`;
    toast.appendChild(header);

    // Category badge
    const badge = document.createElement('span');
    Object.assign(badge.style, {
      display: 'inline-block',
      fontSize: '11px',
      padding: '2px 8px',
      borderRadius: '9999px',
      background: catColor.bg,
      color: catColor.color,
      fontWeight: '500',
      marginBottom: issueUrl ? '8px' : '0',
    });
    badge.textContent = catLabel;
    toast.appendChild(badge);

    // Issue link
    if (issueUrl) {
      const link = document.createElement('a');
      Object.assign(link.style, {
        display: 'block',
        fontSize: '12px',
        color: '#2563eb',
        textDecoration: 'none',
        marginTop: '8px',
      });
      link.href = issueUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Issue を確認する ↗';
      link.addEventListener('mouseenter', () => { link.style.textDecoration = 'underline'; });
      link.addEventListener('mouseleave', () => { link.style.textDecoration = 'none'; });
      toast.appendChild(link);
    }

    shadow.appendChild(toast);
    activeStatus = toast;

    // Auto-dismiss: 8 seconds, or persist if there's a link
    const autoDismissTime = issueUrl ? 12000 : 8000;
    setTimeout(() => dismissToast(toast), autoDismissTime);
  }

  function dismissToast(toast) {
    if (!toast) return;
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => {
      toast.remove();
      if (activeStatus === toast) activeStatus = null;
    }, 300);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Submit lock: prevents double submission
  let isSubmitting = false;
  let cooldownTimer = null;
  const COOLDOWN_MS = 5000;

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
      // 1. Capture screenshot with loading indicator
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

      // 2. Range selection (transparent overlay on top of real page)
      const annotation = await createAnnotator();
      if (!annotation) {
        // User cancelled
        return;
      }

      // 3. Show comment form
      const comment = await showCommentForm(shadow, screenshotDataUrl, annotation.coordinates);
      if (!comment) {
        // User cancelled
        return;
      }

      // 4. Collect metadata
      const payload = {
        screenshot: screenshotDataUrl,
        comment: comment,
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

      // Lock the button during submission
      setSubmitLock(true);

      if (confirmBeforeSubmit) {
        await submitWithPreview(payload);
      } else {
        await submitDirect(payload);
      }

      // Start cooldown after successful submission
      startCooldown();
    } catch (err) {
      console.error('[feedback-collector]', err);
      dismissStatus();

      // Context-aware error messages
      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('net::')) {
        showStatus('サーバーに接続できません', { isError: true });
      } else if (msg.includes('500') || msg.includes('LLM') || msg.includes('generate')) {
        showStatus('AIタスク生成に失敗しました', { isError: true });
      } else if (msg.includes('502') || msg.includes('503')) {
        showStatus('タスク登録に失敗しました', { isError: true });
      } else {
        showStatus('送信に失敗しました', { isError: true });
      }

      // Unlock on error
      setSubmitLock(false);
    }
  }

  // Active async job count for badge display
  let activeJobs = 0;

  function updateBadge() {
    if (activeJobs > 0) {
      btn.innerHTML = `<span style="position:relative;">💬<span style="position:absolute;top:-8px;right:-8px;background:#ef4444;color:#fff;font-size:10px;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${activeJobs}</span></span>`;
    } else {
      btn.innerHTML = '💬';
    }
  }

  // Direct submit using async SSE mode
  async function submitDirect(payload) {
    const loader = showStatus('送信中...', { loading: true });

    try {
      // Send with async header
      const res = await fetch(`${apiBase}/api/feedbacks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Async': 'true',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();

      if (data.status === 'accepted' && data.feedbackId) {
        // Async mode: listen for SSE progress, unlock button immediately
        dismissStatus();
        activeJobs++;
        updateBadge();

        listenForProgress(data.feedbackId);
        // Unlock for next submission (async mode doesn't block)
        startCooldown();
      } else {
        // Fallback: sync response
        dismissStatus();
        showRichToast({ task: data.task, backends: data.backends });
      }
    } catch (fetchErr) {
      throw fetchErr;
    }
  }

  function listenForProgress(feedbackId) {
    const evtSource = new EventSource(`${apiBase}/api/feedbacks/${feedbackId}/status`);

    evtSource.addEventListener('status', (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.step === 'llm_processing') {
          showStatus(data.message || 'AIがタスクを生成中...', { loading: true });
        } else if (data.step === 'llm_done') {
          showStatus('タスク生成完了。登録中...', { loading: true });
        } else if (data.step === 'submitting') {
          showStatus(data.message || 'タスクを登録中...', { loading: true });
        } else if (data.step === 'completed') {
          evtSource.close();
          activeJobs = Math.max(0, activeJobs - 1);
          updateBadge();
          dismissStatus();
          showRichToast({ task: data.task, backends: data.backends });
        } else if (data.step === 'error') {
          evtSource.close();
          activeJobs = Math.max(0, activeJobs - 1);
          updateBadge();
          dismissStatus();
          setSubmitLock(false);
          showStatus(data.message || '処理に失敗しました', { isError: true });
        }
      } catch (parseErr) {
        console.error('[feedback-collector] SSE parse error:', parseErr);
      }
    });

    evtSource.onerror = () => {
      evtSource.close();
      activeJobs = Math.max(0, activeJobs - 1);
      updateBadge();
    };
  }

  // Preview-based submit (confirm mode)
  async function submitWithPreview(payload) {
    const loader = showStatus('AIがタスクを生成中...', { loading: true });
    const timer1 = setTimeout(() => loader.updateText('もう少しお待ちください...'), 10000);

    try {
      // Step 1: Get LLM preview
      const previewRes = await fetch(`${apiBase}/api/feedbacks/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      clearTimeout(timer1);

      if (!previewRes.ok) throw new Error(`Server error: ${previewRes.status}`);

      const previewData = await previewRes.json();
      dismissStatus();

      // Step 2: Show preview dialog
      const result = await showPreviewDialog(shadow, previewData.task);

      if (result === 'retry') {
        // Go back to comment form (restart flow)
        return startFeedbackFlow();
      }

      if (!result || result === null) {
        // User cancelled
        return;
      }

      // Step 3: Confirm and submit to backends
      const confirmLoader = showStatus('タスクを登録中...', { loading: true });

      const confirmBody = { previewId: previewData.previewId };
      if (typeof result === 'object' && result.action === 'confirm') {
        confirmBody.sync_to_backend = result.syncToBackend;
      }

      const confirmRes = await fetch(`${apiBase}/api/feedbacks/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmBody),
      });

      if (!confirmRes.ok) throw new Error(`Server error: ${confirmRes.status}`);

      const confirmData = await confirmRes.json();
      dismissStatus();
      showRichToast({ task: confirmData.task, backends: confirmData.backends });
    } catch (fetchErr) {
      clearTimeout(timer1);
      throw fetchErr;
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

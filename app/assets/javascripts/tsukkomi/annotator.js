/**
 * Annotator module - Range selection UI
 * Simple transparent overlay on top of the real page (like macOS Cmd+Shift+4).
 * No screenshot image is displayed — the user sees the actual page through
 * a semi-transparent dim layer and drags to select a region.
 */

export function createAnnotator() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '2147483646',
      cursor: 'crosshair',
      background: 'rgba(0,0,0,0.3)',
    });

    // Selection rectangle - box-shadow dims everything outside
    const selection = document.createElement('div');
    Object.assign(selection.style, {
      position: 'absolute',
      border: '2px solid #ff0000',
      boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)',
      display: 'none',
      pointerEvents: 'none',
    });
    overlay.appendChild(selection);

    // Top bar with hint and cancel button
    const topBar = document.createElement('div');
    Object.assign(topBar.style, {
      position: 'absolute',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.7)',
      color: '#fff',
      padding: '8px 16px',
      borderRadius: '6px',
      fontSize: '14px',
      fontFamily: 'sans-serif',
      zIndex: '1',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    });

    const hint = document.createElement('span');
    hint.style.pointerEvents = 'none';
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    hint.textContent = isTouchDevice
      ? 'ドラッグで範囲を選択'
      : 'ドラッグで範囲を選択（ESCでキャンセル）';
    topBar.appendChild(hint);

    const cancelBtn = document.createElement('button');
    Object.assign(cancelBtn.style, {
      background: 'rgba(255,255,255,0.2)',
      border: '1px solid rgba(255,255,255,0.4)',
      color: '#fff',
      borderRadius: '4px',
      padding: '2px 10px',
      fontSize: '13px',
      cursor: 'pointer',
      fontFamily: 'sans-serif',
      flexShrink: '0',
    });
    cancelBtn.textContent = 'キャンセル';
    cancelBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    cancelBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); });
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cleanup();
      resolve(null);
    });
    topBar.appendChild(cancelBtn);

    overlay.appendChild(topBar);

    let startX = 0, startY = 0, isDragging = false;

    function escHandler(e) {
      if (e.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    }

    function cleanup() {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }

    function onPointerStart(clientX, clientY) {
      startX = clientX;
      startY = clientY;
      isDragging = true;
      overlay.style.background = 'transparent';
      selection.style.display = 'block';
    }

    function onPointerMove(clientX, clientY) {
      if (!isDragging) return;
      const x = Math.min(startX, clientX);
      const y = Math.min(startY, clientY);
      const w = Math.abs(clientX - startX);
      const h = Math.abs(clientY - startY);
      Object.assign(selection.style, {
        left: x + 'px',
        top: y + 'px',
        width: w + 'px',
        height: h + 'px',
      });
    }

    function onPointerEnd(clientX, clientY) {
      if (!isDragging) return;
      isDragging = false;

      const x = Math.min(startX, clientX);
      const y = Math.min(startY, clientY);
      const w = Math.abs(clientX - startX);
      const h = Math.abs(clientY - startY);

      if (w < 5 || h < 5) {
        selection.style.display = 'none';
        overlay.style.background = 'rgba(0,0,0,0.3)';
        return;
      }

      cleanup();

      const centerEl = document.elementFromPoint(x + w / 2, y + h / 2);
      const selector = centerEl ? getCssSelector(centerEl) : '';

      resolve({
        coordinates: { x, y, w, h },
        selector,
      });
    }

    // Mouse events
    overlay.addEventListener('mousedown', (e) => onPointerStart(e.clientX, e.clientY));
    overlay.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
    overlay.addEventListener('mouseup', (e) => onPointerEnd(e.clientX, e.clientY));

    // Touch events
    overlay.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      onPointerStart(t.clientX, t.clientY);
    }, { passive: false });
    overlay.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      onPointerMove(t.clientX, t.clientY);
    }, { passive: false });
    overlay.addEventListener('touchend', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      onPointerEnd(t.clientX, t.clientY);
    });

    document.addEventListener('keydown', escHandler);

    document.body.appendChild(overlay);
  });
}

function getCssSelector(el) {
  if (!el || el === document.body || el === document.documentElement) {
    return el ? el.tagName.toLowerCase() : '';
  }

  if (el.id) {
    return `#${el.id}`;
  }

  const parts = [];
  let current = el;
  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(Boolean);
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 2).join('.');
      }
    }
    parts.unshift(selector);
    current = current.parentElement;
    if (parts.length >= 4) break;
  }
  return parts.join(' > ');
}

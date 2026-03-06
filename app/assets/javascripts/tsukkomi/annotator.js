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

    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'absolute',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.7)',
      color: '#fff',
      padding: '8px 20px',
      borderRadius: '6px',
      fontSize: '14px',
      fontFamily: 'sans-serif',
      pointerEvents: 'none',
      zIndex: '1',
    });
    hint.textContent = 'ドラッグで範囲を選択してください（ESCでキャンセル）';
    overlay.appendChild(hint);

    let startX = 0, startY = 0, isDragging = false;

    overlay.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startY = e.clientY;
      isDragging = true;
      // Switch from full dim to selection-based dim
      overlay.style.background = 'transparent';
      selection.style.display = 'block';
    });

    overlay.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);
      Object.assign(selection.style, {
        left: x + 'px',
        top: y + 'px',
        width: w + 'px',
        height: h + 'px',
      });
    });

    overlay.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;

      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);

      if (w < 5 || h < 5) {
        // Too small - reset to initial state
        selection.style.display = 'none';
        overlay.style.background = 'rgba(0,0,0,0.3)';
        return;
      }

      overlay.remove();

      // Get CSS selector of the element at center of selection
      const centerEl = document.elementFromPoint(x + w / 2, y + h / 2);
      const selector = centerEl ? getCssSelector(centerEl) : '';

      resolve({
        coordinates: { x, y, w, h },
        selector,
      });
    });

    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
        resolve(null); // cancelled
      }
    });

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

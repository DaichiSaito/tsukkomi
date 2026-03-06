/**
 * Comment form module - Popup form for entering feedback comments
 */

/**
 * Crop the selected region from the full screenshot using an offscreen canvas.
 * Returns a data URL of the cropped area.
 */
function cropScreenshot(screenshotDataUrl, coords) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // The screenshot was drawn at viewport size, so coords map directly
      const scaleX = img.naturalWidth / window.innerWidth;
      const scaleY = img.naturalHeight / window.innerHeight;
      const sx = coords.x * scaleX;
      const sy = coords.y * scaleY;
      const sw = coords.w * scaleX;
      const sh = coords.h * scaleY;

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = screenshotDataUrl;
  });
}

export function showCommentForm(shadowRoot, screenshotDataUrl, coordinates) {
  return new Promise(async (resolve) => {
    // Crop the selected area for the thumbnail
    let thumbnailSrc = null;
    if (screenshotDataUrl && coordinates) {
      thumbnailSrc = await cropScreenshot(screenshotDataUrl, coordinates);
    }

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

    const form = document.createElement('div');
    Object.assign(form.style, {
      background: '#fff',
      borderRadius: '12px',
      padding: '24px',
      width: '400px',
      maxWidth: '90vw',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    });

    const thumbnailHtml = thumbnailSrc
      ? `<div style="margin:0 0 12px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#f9fafb;">
           <img src="${thumbnailSrc}" style="display:block;width:100%;max-height:160px;object-fit:contain;" />
         </div>`
      : '';

    form.innerHTML = `
      <h3 style="margin:0 0 16px;font-size:16px;color:#1a1a1a;">フィードバックを入力</h3>
      ${thumbnailHtml}
      <textarea
        id="fc-comment"
        placeholder="気になった点を入力してください..."
        style="width:100%;height:120px;border:1px solid #ddd;border-radius:8px;padding:12px;font-size:14px;resize:vertical;box-sizing:border-box;font-family:inherit;"
      ></textarea>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
        <button id="fc-cancel" style="padding:8px 16px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;font-size:14px;color:#666;">キャンセル</button>
        <button id="fc-submit" style="padding:8px 16px;border:none;border-radius:6px;background:#2563eb;color:#fff;cursor:pointer;font-size:14px;font-weight:500;">送信</button>
      </div>
    `;

    backdrop.appendChild(form);
    shadowRoot.appendChild(backdrop);

    const textarea = form.querySelector('#fc-comment');
    const cancelBtn = form.querySelector('#fc-cancel');
    const submitBtn = form.querySelector('#fc-submit');

    textarea.focus();

    function cleanup() {
      backdrop.remove();
    }

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    submitBtn.addEventListener('click', () => {
      const comment = textarea.value.trim();
      if (!comment) {
        textarea.style.borderColor = '#ef4444';
        return;
      }
      cleanup();
      resolve(comment);
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        submitBtn.click();
      }
      if (e.key === 'Escape') {
        cancelBtn.click();
      }
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        cancelBtn.click();
      }
    });
  });
}

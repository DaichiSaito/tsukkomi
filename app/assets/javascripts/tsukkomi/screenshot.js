/**
 * Screenshot module - SVG foreignObject capture.
 * Implements the capture directly (no html-to-image dependency) to avoid
 * the library's known side-effects that mutate the host page's stylesheets
 * and break layout.
 *
 * Approach: clone body → inline computed styles → inline images →
 *           serialize to SVG foreignObject → render to canvas.
 * All operations are READ-ONLY on the original DOM.
 */

export async function captureScreenshot(excludeNode) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // 1. Deep-clone body
  const clone = document.body.cloneNode(true);

  // 2. Inline computed styles from original → clone (parallel tree walk)
  //    Must happen before removing excludeNode so tree indices match.
  inlineAllStyles(document.body, clone);

  // 3. Convert <img> src to data-URLs using already-loaded originals
  inlineAllImages(document.body, clone);

  // 4. Remove excluded element (e.g. widget host) from the clone
  if (excludeNode) {
    removeFromClone(excludeNode, clone);
  }

  // 5. Remove elements that are not needed and could cause tainting or XML issues
  clone.querySelectorAll('script, link[rel="stylesheet"], link[rel="icon"]').forEach((s) => s.remove());

  // 6. Include page CSS rules so pseudo-elements (::before/::after) render
  const cssText = collectCSSRules();
  if (cssText) {
    const style = document.createElement('style');
    style.textContent = cssText;
    clone.insertBefore(style, clone.firstChild);
  }

  // 7. Apply scroll offset so the currently visible viewport is captured
  const scrollX = window.scrollX || 0;
  const scrollY = window.scrollY || 0;
  if (scrollX || scrollY) {
    clone.style.transform = `translate(${-scrollX}px, ${-scrollY}px)`;
    clone.style.transformOrigin = 'top left';
    clone.style.overflow = 'visible';
  }

  // 8. Serialize to XHTML
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  const bodyXHTML = new XMLSerializer().serializeToString(clone);

  // 9. Wrap in SVG foreignObject
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">` +
    bodyXHTML +
    `</foreignObject></svg>`;

  // 10. Render SVG → Canvas → data-URL
  //    IMPORTANT: Must use data: URL, not Blob URL.
  //    Chrome taints the canvas when drawing SVG foreignObject from Blob URLs.
  const svgDataUrl =
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const img = await loadImg(svgDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas.toDataURL();
}

/* ------------------------------------------------------------------ */

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Walk source & target trees in parallel; copy computed styles to target. */
function inlineAllStyles(source, target) {
  if (source.nodeType !== Node.ELEMENT_NODE) return;
  try {
    let cssText = window.getComputedStyle(source).cssText;
    // Strip external url() references that would taint the canvas.
    // Keep data: URLs which are already inlined.
    cssText = cssText.replace(
      /url\(["']?(?!["']?data:)([^"')]+)["']?\)/g,
      'url("")',
    );
    target.style.cssText = cssText;
  } catch (_) {
    /* skip (e.g. SVG elements without style property) */
  }
  const sKids = source.children;
  const tKids = target.children;
  for (let i = 0; i < sKids.length && i < tKids.length; i++) {
    inlineAllStyles(sKids[i], tKids[i]);
  }
}

/** Replace <img> src in the clone with data-URLs drawn from loaded originals. */
function inlineAllImages(source, target) {
  const srcImgs = source.querySelectorAll('img');
  const tgtImgs = target.querySelectorAll('img');
  for (let i = 0; i < srcImgs.length && i < tgtImgs.length; i++) {
    try {
      const s = srcImgs[i];
      if (!s.naturalWidth || !s.naturalHeight) continue;
      const c = document.createElement('canvas');
      c.width = s.naturalWidth;
      c.height = s.naturalHeight;
      c.getContext('2d').drawImage(s, 0, 0);
      tgtImgs[i].setAttribute('src', c.toDataURL());
    } catch (_) {
      /* cross-origin image – replace with transparent 1×1 to avoid tainting */
      tgtImgs[i].setAttribute(
        'src',
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      );
    }
  }
}

/** Collect all accessible CSS rule text (read-only on document.styleSheets). */
function collectCSSRules() {
  let css = '';
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        // Strip external url() references from CSS rules too
        css +=
          rule.cssText.replace(
            /url\(["']?(?!["']?data:)([^"')]+)["']?\)/g,
            'url("")',
          ) + '\n';
      }
    } catch (_) {
      /* cross-origin sheet – skip */
    }
  }
  return css;
}

/** Remove a node from the clone by matching id or child index. */
function removeFromClone(original, clone) {
  if (original.id) {
    const el = clone.querySelector('#' + original.id);
    if (el) {
      el.remove();
      return;
    }
  }
  // Fallback: match by child index in body
  const idx = Array.from(document.body.children).indexOf(original);
  if (idx >= 0 && clone.children[idx]) {
    clone.children[idx].remove();
  }
}

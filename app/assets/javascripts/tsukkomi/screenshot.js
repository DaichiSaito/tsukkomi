/**
 * Screenshot module.
 *
 * Primary strategy: the native Screen Capture API (getDisplayMedia) grabs the
 * real rendered pixels of the current tab. This is pixel-perfect — it handles
 * Retina (devicePixelRatio), web fonts, images and any CSS layout faithfully,
 * so the region the user drag-selects always matches the captured screenshot.
 *
 * Fallback strategy: SVG foreignObject DOM reconstruction, used only when
 * getDisplayMedia is unavailable (e.g. non-secure context or unsupported
 * browser). This reconstruction can distort modern layouts and is a last resort.
 *
 * captureScreenshot() resolves to a data-URL of the visible viewport, or `null`
 * when the user cancels the screen-share permission prompt (flow should abort).
 */

/**
 * Sentinel returned when the user dismisses the getDisplayMedia picker.
 * The caller treats this as "abort silently", not "capture failed".
 */
export const CAPTURE_CANCELLED = null;

export async function captureScreenshot(excludeNode) {
  const supportsDisplayMedia =
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function' &&
    window.isSecureContext;

  if (supportsDisplayMedia) {
    try {
      return await captureViaDisplayMedia(excludeNode);
    } catch (err) {
      // User dismissed the share picker → abort the whole flow silently.
      if (err && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
        return CAPTURE_CANCELLED;
      }
      // Any other failure → fall back to the (less reliable) DOM reconstruction.
      console.warn(
        '[tsukkomi] getDisplayMedia failed, falling back to foreignObject:',
        err,
      );
    }
  }

  return await captureViaForeignObject(excludeNode);
}

/* ================================================================== */
/* Primary: native Screen Capture API                                 */
/* ================================================================== */

/**
 * The active screen-capture stream, kept alive across captures so the user is
 * only prompted once per page load. It survives soft (SPA/Inertia) navigations
 * because the widget's JS context persists; a full reload tears it down and the
 * next capture prompts again. Cleared when the user clicks Chrome's "Stop
 * sharing", so the next capture re-acquires it.
 */
let sharedStream = null;

function streamIsLive(stream) {
  const track = stream && stream.getVideoTracks()[0];
  return !!track && track.readyState === 'live';
}

async function captureViaDisplayMedia(excludeNode) {
  if (!streamIsLive(sharedStream)) {
    sharedStream = await acquireDisplayStream();
  }
  // Reuse the live stream: grab a fresh frame without stopping the tracks.
  return await grabFrameFromStream(sharedStream, excludeNode);
}

async function acquireDisplayStream() {
  // Keep options minimal: `preferCurrentTab` (Chrome) defaults the picker to
  // this tab. It is mutually exclusive with surfaceSwitching / monitorTypeSurfaces,
  // so we pass nothing else to avoid an InvalidStateError from conflicting hints.
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 8 } },
    audio: false,
    preferCurrentTab: true,
  });

  // If the user stops sharing (Chrome's "Stop sharing" bar), drop the cache so
  // the next capture prompts again instead of reusing a dead stream.
  stream.getVideoTracks().forEach((track) => {
    track.addEventListener('ended', () => {
      if (sharedStream === stream) sharedStream = null;
    });
  });

  return stream;
}

/**
 * Draw one frame from a MediaStream into a canvas and return its data-URL.
 * Hides `excludeNode` (the widget host) for the instant of capture so our own
 * UI never appears in the shot, then restores it. Exported for testing with a
 * synthetic canvas.captureStream().
 */
export async function grabFrameFromStream(stream, excludeNode) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;

  await video.play().catch(() => {});
  await waitForVideoFrame(video);

  const prevVisibility = excludeNode ? excludeNode.style.visibility : null;
  if (excludeNode) excludeNode.style.visibility = 'hidden';
  try {
    // Let the visibility change propagate into the capture stream before we
    // sample a frame, otherwise the widget UI may still be in the pixels.
    await waitForVideoFrame(video);
    await delay(120);

    const vw = video.videoWidth || video.getBoundingClientRect().width;
    const vh = video.videoHeight || video.getBoundingClientRect().height;
    const canvas = document.createElement('canvas');
    canvas.width = vw;
    canvas.height = vh;
    canvas.getContext('2d').drawImage(video, 0, 0, vw, vh);
    return canvas.toDataURL('image/png');
  } finally {
    if (excludeNode) excludeNode.style.visibility = prevVisibility || '';
    video.srcObject = null;
  }
}

function waitForVideoFrame(video) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => done());
    } else if (video.readyState >= 2) {
      done();
      return;
    } else {
      video.addEventListener('loadeddata', done, { once: true });
    }
    // Safety timeout so we never hang if no frame callback fires.
    setTimeout(done, 500);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ================================================================== */
/* Fallback: SVG foreignObject DOM reconstruction                     */
/* ================================================================== */

async function captureViaForeignObject(excludeNode) {
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

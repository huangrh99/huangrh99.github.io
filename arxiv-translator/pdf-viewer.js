const PDFJS_VERSION = '4.8.69';
const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
// CJK fonts in XeLaTeX output need character maps; cdnjs does not host them, jsDelivr does (with CORS).
const PDFJS_ASSETS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;

const pdfjsLib = await import(PDFJS_URL);
pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

const PAGE_GAP = 14;
const STAGE_PADDING = 14;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 4;
const MAX_FIT_SCALE = 1.75;
const MAX_CANVAS_PIXELS = 16_000_000;
const KEEP_RENDERED_PAGES = 10;
const ANCHOR_RATIO = 0.35;

const STYLE = `
.pdf-viewer { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--pdf-bg, #e9edf4); color: #172033; }
.pdf-toolbar { flex: 0 0 auto; display: flex; align-items: center; gap: 4px; padding: 5px 8px; background: #172033; color: #fff; overflow-x: auto; scrollbar-width: none; }
.pdf-toolbar::-webkit-scrollbar { display: none; }
.pdf-toolbar .pdf-sep { flex: 0 0 1px; align-self: stretch; margin: 4px 4px; background: #3a4762; }
.pdf-toolbar .pdf-spacer { flex: 1 1 auto; }
.pdf-label { flex: 0 0 auto; padding: 3px 8px; margin-right: 2px; border-radius: 6px; background: #2457d6; font-size: 12px; font-weight: 700; letter-spacing: .02em; white-space: nowrap; }
.pdf-btn { flex: 0 0 auto; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 0 8px; border: 1px solid transparent; border-radius: 7px; background: transparent; color: #dfe6f3; font: inherit; font-size: 13px; line-height: 1; text-decoration: none; cursor: pointer; white-space: nowrap; }
.pdf-btn:hover:not(:disabled) { background: #26334c; color: #fff; }
.pdf-btn:disabled { opacity: .35; cursor: default; }
.pdf-btn.active { background: #2457d6; color: #fff; }
.pdf-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.pdf-back[hidden] { display: none; }
.pdf-page-input { width: 44px; height: 28px; padding: 0 4px; border: 1px solid #45516a; border-radius: 6px; background: #26334c; color: #fff; font: inherit; font-size: 13px; text-align: center; -moz-appearance: textfield; }
.pdf-page-input::-webkit-inner-spin-button, .pdf-page-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.pdf-page-total, .pdf-zoom-label { flex: 0 0 auto; color: #aeb9cf; font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.pdf-zoom-label { min-width: 42px; text-align: center; }
.pdf-body { position: relative; flex: 1 1 auto; min-height: 0; display: flex; }
.pdf-stage { flex: 1 1 auto; min-width: 0; overflow: auto; scrollbar-gutter: stable; outline: none; overscroll-behavior: contain; }
.pdf-pages { display: flex; flex-direction: column; align-items: center; gap: ${PAGE_GAP}px; padding: ${STAGE_PADDING}px; width: max-content; min-width: 100%; box-sizing: border-box; }
.pdf-page { position: relative; flex: 0 0 auto; background: #fff; box-shadow: 0 2px 4px rgba(23, 32, 51, .08), 0 8px 24px rgba(23, 32, 51, .12); }
.pdf-page::before { content: attr(data-page); position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #c3cad8; font-size: 28px; font-weight: 700; }
.pdf-page.rendered::before { display: none; }
.pdf-page canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.pdf-text-layer { position: absolute; inset: 0; overflow: clip; line-height: 1; text-align: initial; text-size-adjust: none; forced-color-adjust: none; transform-origin: 0 0; caret-color: CanvasText; z-index: 1; }
.pdf-text-layer :is(span, br) { color: transparent; position: absolute; white-space: pre; cursor: text; transform-origin: 0% 0%; }
.pdf-text-layer span.markedContent { top: 0; height: 0; }
.pdf-text-layer ::selection { background: rgba(36, 87, 214, .3); }
.pdf-text-layer br::selection { background: transparent; }
.pdf-text-layer .endOfContent { display: block; position: absolute; inset: 100% 0 0; z-index: -1; cursor: default; user-select: none; }
.pdf-text-layer.selecting .endOfContent { top: 0; }
.pdf-link-layer { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.pdf-link-layer a { position: absolute; pointer-events: auto; border-radius: 2px; cursor: pointer; }
.pdf-link-layer a:hover { background: rgba(36, 87, 214, .14); box-shadow: inset 0 -2px 0 rgba(36, 87, 214, .55); }
.pdf-overlay { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); max-width: calc(100% - 32px); padding: 12px 16px; border-radius: 10px; background: rgba(255, 255, 255, .96); box-shadow: 0 8px 30px rgba(23, 32, 51, .16); color: #596579; font-size: 14px; text-align: center; white-space: pre-wrap; z-index: 5; }
.pdf-overlay.error { color: #b42318; }
.pdf-overlay[hidden] { display: none; }
.pdf-progress { height: 3px; margin-top: 8px; border-radius: 3px; background: #e2e7f0; overflow: hidden; }
.pdf-progress > i { display: block; height: 100%; width: 0; background: #2457d6; transition: width .2s; }
.pdf-outline { position: absolute; top: 0; bottom: 0; left: 0; width: min(300px, 85%); overflow: auto; padding: 8px 0; background: #fff; border-right: 1px solid #d9e0ec; box-shadow: 8px 0 24px rgba(23, 32, 51, .12); z-index: 4; font-size: 13px; }
.pdf-outline[hidden] { display: none; }
.pdf-outline ul { list-style: none; margin: 0; padding: 0 0 0 12px; }
.pdf-outline > ul { padding-left: 0; }
.pdf-outline button { display: block; width: 100%; padding: 6px 14px; border: 0; background: none; color: #253049; font: inherit; text-align: left; line-height: 1.4; cursor: pointer; }
.pdf-outline button:hover { background: #eef3ff; color: #2457d6; }
.pdf-outline .pdf-outline-empty { padding: 10px 14px; color: #8a94a8; }
.pdf-toast { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); padding: 6px 12px; border-radius: 999px; background: rgba(23, 32, 51, .86); color: #fff; font-size: 13px; pointer-events: none; opacity: 0; transition: opacity .2s; z-index: 6; }
.pdf-toast.show { opacity: 1; }
:root.pdf-night .pdf-viewer { --pdf-bg: #1b2130; }
:root.pdf-night .pdf-page { background: #20242c; box-shadow: 0 8px 24px rgba(0, 0, 0, .4); }
:root.pdf-night .pdf-page canvas { filter: invert(.88) hue-rotate(180deg) contrast(.95); }
:root.pdf-night .pdf-night-toggle { background: #2457d6; color: #fff; }
@media (max-width: 620px) {
  .pdf-toolbar { gap: 2px; padding: 4px 6px; }
  .pdf-btn { min-width: 28px; height: 28px; padding: 0 6px; }
  .pdf-hide-narrow { display: none; }
  .pdf-pages { padding: 8px; gap: 8px; }
}
`;

const ICONS = {
  outline: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h13"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  night: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  open: '<svg viewBox="0 0 24 24"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
};

function injectStyle() {
  if (document.getElementById('pdf-viewer-style')) return;
  const style = document.createElement('style');
  style.id = 'pdf-viewer-style';
  style.textContent = STYLE;
  document.head.append(style);
}

function element(tag, className = '', attributes = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function iconButton(icon, title, className = '') {
  const node = element('button', `pdf-btn ${className}`.trim(), { type: 'button', title, 'aria-label': title });
  node.innerHTML = ICONS[icon] || '';
  return node;
}

function textButton(label, title, className = '') {
  const node = element('button', `pdf-btn ${className}`.trim(), { type: 'button', title });
  node.textContent = label;
  return node;
}

function readStorage(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (error) { return null; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* storage may be unavailable */ }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isCancelled(error) {
  return error?.name === 'RenderingCancelledException' || error?.name === 'AbortException';
}

export function setNightMode(enabled) {
  document.documentElement.classList.toggle('pdf-night', enabled);
  writeStorage('pdf-viewer-night', enabled);
}

setNightMode(Boolean(readStorage('pdf-viewer-night')));

export async function createPdfViewer(root, source, { label = '', storageKey = '', onPositionChange, onActivate } = {}) {
  injectStyle();
  root.replaceChildren();
  root.classList.add('pdf-viewer');

  const toolbar = element('div', 'pdf-toolbar');
  const labelChip = label ? element('span', 'pdf-label') : null;
  if (labelChip) labelChip.textContent = label;
  const outlineButton = iconButton('outline', '目录');
  const previous = iconButton('prev', '上一页 (←)');
  const pageInput = element('input', 'pdf-page-input', { type: 'number', min: '1', value: '1', 'aria-label': '页码' });
  const pageTotal = element('span', 'pdf-page-total');
  const next = iconButton('next', '下一页 (→)');
  const zoomOut = iconButton('minus', '缩小 (−)');
  const zoomLabel = element('span', 'pdf-zoom-label');
  const zoomIn = iconButton('plus', '放大 (+)');
  const fitWidth = textButton('适宽', '适应宽度 (0)', 'pdf-hide-narrow');
  const fitPage = textButton('整页', '整页显示', 'pdf-hide-narrow');
  const back = iconButton('back', '返回跳转前位置 (Alt+←)', 'pdf-back');
  back.hidden = true;
  const night = iconButton('night', '夜间模式', 'pdf-night-toggle');
  const open = element('a', 'pdf-btn pdf-hide-narrow', { href: source, target: '_blank', rel: 'noreferrer', title: '新窗口打开' });
  open.innerHTML = ICONS.open;
  toolbar.append(
    ...(labelChip ? [labelChip] : []),
    outlineButton, element('span', 'pdf-sep'),
    previous, pageInput, pageTotal, next, element('span', 'pdf-sep'),
    zoomOut, zoomLabel, zoomIn, fitWidth, fitPage,
    element('span', 'pdf-spacer'), back, night, open,
  );

  const body = element('div', 'pdf-body');
  const outline = element('nav', 'pdf-outline', { 'aria-label': '目录' });
  outline.hidden = true;
  const stage = element('div', 'pdf-stage', { tabindex: '0' });
  const pagesHost = element('div', 'pdf-pages');
  stage.append(pagesHost);
  const overlay = element('div', 'pdf-overlay');
  const overlayText = element('div');
  overlayText.textContent = '正在加载 PDF…';
  const progressBar = element('div', 'pdf-progress');
  const progressFill = element('i');
  progressBar.append(progressFill);
  overlay.append(overlayText, progressBar);
  const toast = element('div', 'pdf-toast');
  body.append(outline, stage, overlay, toast);
  root.append(toolbar, body);

  const saved = storageKey ? readStorage(`pdf-viewer-pos:${storageKey}`) : null;
  let pdf;
  let views = [];
  let scale = 1;
  let fitMode = saved?.fitMode ?? 'width';
  let zoom = clamp(Number(saved?.zoom) || 1, MIN_ZOOM, MAX_ZOOM);
  let currentPage = 1;
  let laidOut = false;
  let expectedScrollTop = null;
  let renderTimer = 0;
  let saveTimer = 0;
  let toastTimer = 0;
  const history = [];

  function showError(error) {
    overlay.hidden = false;
    overlay.classList.add('error');
    progressBar.hidden = true;
    overlayText.textContent = `PDF 加载失败：${error?.message || error}`;
  }

  function flash(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1200);
  }

  function stageSize() {
    return { width: stage.clientWidth - STAGE_PADDING * 2, height: stage.clientHeight - STAGE_PADDING * 2 };
  }

  function computeScale() {
    const { width, height } = stageSize();
    const maxWidth = Math.max(...views.map(view => view.width));
    const maxHeight = Math.max(...views.map(view => view.height));
    const widthScale = width / maxWidth;
    if (fitMode === 'width') return clamp(Math.min(widthScale, MAX_FIT_SCALE), MIN_ZOOM, MAX_ZOOM);
    if (fitMode === 'page') return clamp(Math.min(widthScale, height / maxHeight), MIN_ZOOM, MAX_ZOOM);
    return zoom;
  }

  function updateControls() {
    if (!pdf) return;
    if (document.activeElement !== pageInput) pageInput.value = String(currentPage);
    pageTotal.textContent = `/ ${pdf.numPages}`;
    previous.disabled = currentPage <= 1;
    next.disabled = currentPage >= pdf.numPages;
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    fitWidth.classList.toggle('active', fitMode === 'width');
    fitPage.classList.toggle('active', fitMode === 'page');
  }

  // Position = page number plus the fraction of that page at the anchor line.
  // It survives zoom changes and lets two documents with different page sizes stay aligned.
  function getPosition() {
    if (!views.length) return { page: 1, fraction: 0 };
    const anchor = stage.scrollTop + stage.clientHeight * ANCHOR_RATIO;
    let view = views[0];
    for (const candidate of views) {
      if (candidate.element.offsetTop <= anchor) view = candidate;
      else break;
    }
    const fraction = clamp((anchor - view.element.offsetTop) / view.element.offsetHeight, 0, 1);
    return { page: view.number, fraction };
  }

  function scrollToPosition({ page, fraction = 0 }, { align = 'anchor', silent = true } = {}) {
    if (!views.length) return;
    const view = views[clamp(Math.round(page), 1, views.length) - 1];
    const offset = align === 'top' ? Math.min(24, stage.clientHeight * 0.1) : stage.clientHeight * ANCHOR_RATIO;
    const target = clamp(view.element.offsetTop + clamp(fraction, 0, 1) * view.element.offsetHeight - offset, 0, stage.scrollHeight - stage.clientHeight);
    if (silent) expectedScrollTop = Math.round(target);
    stage.scrollTop = target;
    if (silent && Math.abs(stage.scrollTop - target) < 1 && stage.scrollTop === Math.round(stage.scrollTop) && expectedScrollTop === stage.scrollTop) {
      // A no-op scroll does not fire an event, so clear the guard on the next frame.
      setTimeout(() => { if (expectedScrollTop === stage.scrollTop) expectedScrollTop = null; }, 50);
    }
    handleScroll(false);
  }

  function layout() {
    if (!views.length || stage.clientWidth <= 0) return;
    const position = laidOut ? getPosition() : { page: 1, fraction: 0 };
    laidOut = true;
    const horizontal = stage.scrollWidth > stage.clientWidth ? (stage.scrollLeft + stage.clientWidth / 2) / stage.scrollWidth : 0.5;
    scale = computeScale();
    for (const view of views) {
      view.element.style.width = `${Math.floor(view.width * scale)}px`;
      view.element.style.height = `${Math.floor(view.height * scale)}px`;
    }
    scrollToPosition(position);
    if (stage.scrollWidth > stage.clientWidth) stage.scrollLeft = horizontal * stage.scrollWidth - stage.clientWidth / 2;
    updateControls();
    scheduleRender();
  }

  function setZoom(nextZoom) {
    zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    fitMode = 'custom';
    layout();
    savePosition();
  }

  function setFitMode(mode) {
    fitMode = mode;
    zoom = scale;
    layout();
    savePosition();
  }

  function scheduleRender(delay = 120) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderVisible, delay);
  }

  function nearPageNumbers() {
    const top = stage.scrollTop - stage.clientHeight;
    const bottom = stage.scrollTop + stage.clientHeight * 2;
    return views
      .filter(view => view.element.offsetTop + view.element.offsetHeight >= top && view.element.offsetTop <= bottom)
      .map(view => view.number);
  }

  function renderVisible() {
    const center = currentPage;
    const nearPages = new Set(nearPageNumbers());
    const targets = [...nearPages].sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    for (const number of targets) renderView(views[number - 1]);
    const rendered = views.filter(view => view.renderedScale);
    if (rendered.length > KEEP_RENDERED_PAGES) {
      rendered
        .filter(view => !nearPages.has(view.number))
        .sort((a, b) => Math.abs(b.number - center) - Math.abs(a.number - center))
        .slice(0, rendered.length - KEEP_RENDERED_PAGES)
        .forEach(releaseView);
    }
  }

  function releaseView(view) {
    view.task?.cancel();
    view.task = null;
    view.canvas?.remove();
    view.canvas = null;
    view.textLayer?.remove();
    view.textLayer = null;
    view.renderedScale = 0;
    view.element.classList.remove('rendered');
  }

  async function renderView(view) {
    if (!view || view.renderedScale === scale || view.pendingScale === scale) return;
    view.task?.cancel();
    const renderScale = scale;
    view.pendingScale = renderScale;
    try {
      const page = view.page;
      const viewport = page.getViewport({ scale: renderScale });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height)));
      const canvas = element('canvas');
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      const task = page.render({
        canvasContext: canvas.getContext('2d', { alpha: false }),
        viewport,
        transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      });
      view.task = task;
      await task.promise;
      if (view.pendingScale !== renderScale) return;
      // Swap in the finished canvas so zooming never flashes a blank page.
      view.canvas?.remove();
      view.element.prepend(canvas);
      view.canvas = canvas;
      view.renderedScale = renderScale;
      view.element.classList.add('rendered');
      view.task = null;

      view.textContent ??= await page.getTextContent();
      if (view.pendingScale !== renderScale) return;
      const textLayer = element('div', 'pdf-text-layer');
      textLayer.style.setProperty('--scale-factor', String(renderScale));
      textLayer.style.setProperty('--total-scale-factor', String(renderScale));
      await new pdfjsLib.TextLayer({ textContentSource: view.textContent, container: textLayer, viewport }).render();
      if (view.pendingScale !== renderScale) return;
      bindSelectionEnd(textLayer);
      view.textLayer?.remove();
      view.canvas.after(textLayer);
      view.textLayer = textLayer;
      if (!view.links) await renderLinks(view);
    } catch (error) {
      if (!isCancelled(error)) console.warn(`PDF page ${view.number} render failed`, error);
    } finally {
      if (view.pendingScale === renderScale) view.pendingScale = 0;
    }
  }

  function bindSelectionEnd(textLayer) {
    const end = textLayer.querySelector('.endOfContent');
    if (!end) return;
    textLayer.addEventListener('mousedown', () => textLayer.classList.add('selecting'));
    window.addEventListener('mouseup', () => textLayer.classList.remove('selecting'));
  }

  async function renderLinks(view) {
    view.links = element('div', 'pdf-link-layer');
    view.element.append(view.links);
    const annotations = await view.page.getAnnotations({ intent: 'display' });
    const base = view.page.getViewport({ scale: 1 });
    for (const annotation of annotations) {
      if (annotation.subtype !== 'Link' || (!annotation.url && !annotation.dest)) continue;
      const [x1, y1, x2, y2] = base.convertToViewportRectangle(annotation.rect);
      const link = element('a');
      link.style.left = `${(Math.min(x1, x2) / base.width) * 100}%`;
      link.style.top = `${(Math.min(y1, y2) / base.height) * 100}%`;
      link.style.width = `${(Math.abs(x2 - x1) / base.width) * 100}%`;
      link.style.height = `${(Math.abs(y2 - y1) / base.height) * 100}%`;
      if (annotation.url) {
        link.href = annotation.url;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.title = annotation.url;
      } else {
        link.href = '#';
        link.addEventListener('click', event => {
          event.preventDefault();
          followDestination(annotation.dest, true).catch(error => console.warn('PDF link failed', error));
        });
      }
      view.links.append(link);
    }
  }

  async function resolveDestination(dest) {
    const explicit = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
    if (!Array.isArray(explicit)) return null;
    const [ref, kind, ...args] = explicit;
    const pageIndex = typeof ref === 'object' && ref !== null ? await pdf.getPageIndex(ref) : Number(ref);
    if (!Number.isInteger(pageIndex) || !views[pageIndex]) return null;
    const view = views[pageIndex];
    let top = null;
    if (kind?.name === 'XYZ') top = args[1];
    else if (kind?.name === 'FitH' || kind?.name === 'FitBH') top = args[0];
    else if (kind?.name === 'FitR') top = args[3];
    let fraction = 0;
    if (typeof top === 'number') {
      const base = view.page.getViewport({ scale: 1 });
      fraction = clamp(base.convertToViewportPoint(0, top)[1] / base.height, 0, 1);
    }
    return { page: pageIndex + 1, fraction };
  }

  async function followDestination(dest, remember) {
    const position = await resolveDestination(dest);
    if (!position) return;
    if (remember) {
      history.push(getPosition());
      back.hidden = false;
    }
    scrollToPosition(position, { align: 'top', silent: false });
  }

  function goBack() {
    const position = history.pop();
    back.hidden = history.length === 0;
    if (position) scrollToPosition(position, { silent: false });
  }

  async function buildOutline() {
    const items = await pdf.getOutline().catch(() => null);
    if (!items?.length) {
      outline.innerHTML = '<div class="pdf-outline-empty">此 PDF 没有目录书签</div>';
      return;
    }
    const build = entries => {
      const list = element('ul');
      for (const entry of entries) {
        const item = element('li');
        const link = element('button', '', { type: 'button' });
        link.textContent = entry.title;
        link.addEventListener('click', () => {
          if (entry.dest) followDestination(entry.dest, true);
          else if (entry.url) window.open(entry.url, '_blank', 'noreferrer');
          if (stage.clientWidth < 700) outline.hidden = true;
        });
        item.append(link);
        if (entry.items?.length) item.append(build(entry.items));
        list.append(item);
      }
      return list;
    };
    outline.replaceChildren(build(items));
  }

  function handleScroll(emit = true) {
    const position = getPosition();
    if (position.page !== currentPage) {
      currentPage = position.page;
      updateControls();
    }
    scheduleRender(60);
    savePosition();
    if (emit) onPositionChange?.(position);
  }

  function savePosition() {
    if (!storageKey || !pdf) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => writeStorage(`pdf-viewer-pos:${storageKey}`, { ...getPosition(), fitMode, zoom: scale }), 400);
  }

  function goToPage(value) {
    if (!pdf) return;
    const page = clamp(Number.parseInt(value, 10) || currentPage, 1, pdf.numPages);
    scrollToPosition({ page, fraction: 0 }, { align: 'top', silent: false });
  }

  function handleKey(event) {
    if (!pdf || event.target === pageInput) return false;
    const key = event.key;
    if (event.altKey && key === 'ArrowLeft') { goBack(); return true; }
    if (event.metaKey || event.ctrlKey || event.altKey) {
      if (key === '=' || key === '+') { setZoom(scale * 1.15); return true; }
      if (key === '-') { setZoom(scale / 1.15); return true; }
      if (key === '0') { setFitMode('width'); return true; }
      return false;
    }
    if (key === 'ArrowRight' || key === 'n' || key === 'j') { goToPage(currentPage + 1); return true; }
    if (key === 'ArrowLeft' || key === 'p' || key === 'k') { goToPage(currentPage - 1); return true; }
    if (key === 'Home') { goToPage(1); return true; }
    if (key === 'End') { goToPage(pdf.numPages); return true; }
    if (key === '+' || key === '=') { setZoom(scale * 1.15); return true; }
    if (key === '-') { setZoom(scale / 1.15); return true; }
    if (key === '0') { setFitMode('width'); return true; }
    return false;
  }

  outlineButton.addEventListener('click', () => {
    outline.hidden = !outline.hidden;
    outlineButton.classList.toggle('active', !outline.hidden);
  });
  previous.addEventListener('click', () => goToPage(currentPage - 1));
  next.addEventListener('click', () => goToPage(currentPage + 1));
  pageInput.addEventListener('change', () => goToPage(pageInput.value));
  pageInput.addEventListener('keydown', event => { if (event.key === 'Enter') { goToPage(pageInput.value); stage.focus(); } });
  zoomOut.addEventListener('click', () => setZoom(scale / 1.15));
  zoomIn.addEventListener('click', () => setZoom(scale * 1.15));
  fitWidth.addEventListener('click', () => setFitMode('width'));
  fitPage.addEventListener('click', () => setFitMode('page'));
  back.addEventListener('click', goBack);
  night.addEventListener('click', () => setNightMode(!document.documentElement.classList.contains('pdf-night')));
  root.addEventListener('pointerdown', () => onActivate?.(), true);
  root.addEventListener('focusin', () => onActivate?.());
  stage.addEventListener('keydown', event => { if (handleKey(event)) event.preventDefault(); });
  stage.addEventListener('scroll', () => {
    if (expectedScrollTop !== null && Math.abs(stage.scrollTop - expectedScrollTop) <= 1) {
      expectedScrollTop = null;
      handleScroll(false);
      return;
    }
    expectedScrollTop = null;
    handleScroll(true);
  }, { passive: true });
  // Trackpad pinch arrives as ctrl+wheel; zoom around the current reading position.
  stage.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom(scale * Math.exp(-event.deltaY * 0.01));
  }, { passive: false });

  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (fitMode !== 'custom') layout(); else scheduleRender(); }, 50);
  }).observe(stage);

  try {
    const loadingTask = pdfjsLib.getDocument({
      url: source,
      withCredentials: false,
      cMapUrl: `${PDFJS_ASSETS_URL}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${PDFJS_ASSETS_URL}/standard_fonts/`,
    });
    loadingTask.onProgress = ({ loaded, total }) => {
      if (total) progressFill.style.width = `${Math.min(100, (loaded / total) * 100)}%`;
    };
    pdf = await loadingTask.promise;
    const pages = await Promise.all(Array.from({ length: pdf.numPages }, (_, index) => pdf.getPage(index + 1)));
    views = pages.map((page, index) => {
      const base = page.getViewport({ scale: 1 });
      const pageElement = element('div', 'pdf-page', { 'data-page': String(index + 1) });
      pagesHost.append(pageElement);
      return { number: index + 1, page, width: base.width, height: base.height, element: pageElement, renderedScale: 0, pendingScale: 0 };
    });
    overlay.hidden = true;
    layout();
    if (saved?.page) scrollToPosition(saved, { silent: true });
    if (saved?.page > 1) flash(`已回到上次阅读位置：第 ${saved.page} 页`);
    buildOutline();
  } catch (error) {
    showError(error);
  }

  return {
    getPosition,
    setPosition: position => scrollToPosition(position, { silent: true }),
    getPageCount: () => pdf?.numPages || 0,
    handleKey,
    focus: () => stage.focus({ preventScroll: true }),
  };
}

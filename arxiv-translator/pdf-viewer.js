const PDFJS_VERSION = '4.8.69';
const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

const pdfjsLib = await import(PDFJS_URL);
pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

function button(label, className = '') {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.className = className;
  return element;
}

export async function createPdfViewer(root, source, { onPageChange } = {}) {
  root.replaceChildren();
  root.className = 'pdf-viewer';

  const toolbar = document.createElement('div');
  toolbar.className = 'pdf-toolbar';
  const previous = button('上一页');
  const next = button('下一页');
  const pageInput = document.createElement('input');
  pageInput.type = 'number';
  pageInput.min = '1';
  pageInput.value = '1';
  pageInput.className = 'pdf-page-input';
  const pageTotal = document.createElement('span');
  pageTotal.className = 'pdf-page-total';
  const zoomOut = button('−');
  const zoomLabel = document.createElement('span');
  zoomLabel.className = 'pdf-zoom-label';
  const zoomIn = button('+');
  const fitWidth = button('适应宽度', 'active');
  const open = document.createElement('a');
  open.textContent = '新窗口打开';
  open.href = source;
  open.target = '_blank';
  open.rel = 'noreferrer';
  open.className = 'pdf-open-link';
  toolbar.append(previous, next, pageInput, pageTotal, zoomOut, zoomLabel, zoomIn, fitWidth, open);

  const status = document.createElement('div');
  status.className = 'pdf-viewer-status';
  status.textContent = '正在加载 PDF…';
  const stage = document.createElement('div');
  stage.className = 'pdf-page-stage';
  const pageFrame = document.createElement('div');
  pageFrame.className = 'pdf-page-frame';
  const canvas = document.createElement('canvas');
  canvas.className = 'pdf-page-canvas';
  const textLayer = document.createElement('div');
  textLayer.className = 'pdf-text-layer';
  pageFrame.append(canvas, textLayer);
  stage.append(pageFrame);
  root.append(toolbar, status, stage);

  let pdf;
  let pageNumber = 1;
  let zoom = 1;
  let useFitWidth = true;
  let renderId = 0;

  function updateControls() {
    pageInput.value = String(pageNumber);
    pageTotal.textContent = `/ ${pdf.numPages}`;
    previous.disabled = pageNumber <= 1;
    next.disabled = pageNumber >= pdf.numPages;
    zoomLabel.textContent = useFitWidth ? '宽度' : `${Math.round(zoom * 100)}%`;
    fitWidth.classList.toggle('active', useFitWidth);
  }

  async function renderPage() {
    const currentRender = ++renderId;
    updateControls();
    const page = await pdf.getPage(pageNumber);
    if (currentRender !== renderId) return;
    const baseViewport = page.getViewport({ scale: 1 });
    const availableWidth = Math.max(stage.clientWidth - 24, 320);
    const scale = useFitWidth ? Math.min(availableWidth / baseViewport.width, 2.4) : zoom;
    const viewport = page.getViewport({ scale });
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(viewport.width * ratio);
    canvas.height = Math.ceil(viewport.height * ratio);
    canvas.style.width = `${Math.ceil(viewport.width)}px`;
    canvas.style.height = `${Math.ceil(viewport.height)}px`;
    pageFrame.style.width = `${Math.ceil(viewport.width)}px`;
    pageFrame.style.height = `${Math.ceil(viewport.height)}px`;
    textLayer.replaceChildren();
    textLayer.style.width = `${Math.ceil(viewport.width)}px`;
    textLayer.style.height = `${Math.ceil(viewport.height)}px`;
    const context = canvas.getContext('2d', { alpha: false });
    const renderTask = page.render({
      canvasContext: context,
      viewport,
      transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
    });
    const textContent = await page.getTextContent();
    const textLayerTask = new pdfjsLib.TextLayer({
      textContentSource: textContent,
      container: textLayer,
      viewport,
    });
    await Promise.all([renderTask.promise, textLayerTask.render()]);
    if (currentRender === renderId) {
      status.textContent = `第 ${pageNumber} / ${pdf.numPages} 页`;
      onPageChange?.(pageNumber);
    }
  }

  function setPage(value) {
    if (!pdf) return;
    const nextPage = Math.min(Math.max(Number.parseInt(value, 10) || 1, 1), pdf.numPages);
    if (nextPage === pageNumber) return;
    pageNumber = nextPage;
    renderPage().catch(showError);
  }

  function showError(error) {
    status.className = 'pdf-viewer-status error';
    status.textContent = `PDF 加载失败：${error.message}`;
  }

  previous.addEventListener('click', () => setPage(pageNumber - 1));
  next.addEventListener('click', () => setPage(pageNumber + 1));
  pageInput.addEventListener('change', () => setPage(pageInput.value));
  zoomOut.addEventListener('click', () => {
    useFitWidth = false;
    zoom = Math.max(0.5, zoom - 0.1);
    renderPage().catch(showError);
  });
  zoomIn.addEventListener('click', () => {
    useFitWidth = false;
    zoom = Math.min(3, zoom + 0.1);
    renderPage().catch(showError);
  });
  fitWidth.addEventListener('click', () => {
    useFitWidth = true;
    renderPage().catch(showError);
  });
  window.addEventListener('resize', () => {
    if (useFitWidth) renderPage().catch(showError);
  });

  try {
    pdf = await pdfjsLib.getDocument({ url: source, withCredentials: false }).promise;
    updateControls();
    await renderPage();
  } catch (error) {
    showError(error);
  }

  return {
    setPage,
    getPage: () => pageNumber,
    getPageCount: () => pdf?.numPages || 0,
  };
}

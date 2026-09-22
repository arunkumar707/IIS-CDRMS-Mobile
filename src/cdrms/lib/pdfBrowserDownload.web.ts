type Html2CanvasFn = (
  element: HTMLElement,
  options?: Record<string, unknown>,
) => Promise<HTMLCanvasElement>;

type JsPdfCtor = new (opts: {
  orientation: 'portrait';
  unit: 'mm';
  format: 'a4';
}) => {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  addImage: (
    data: string,
    format: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => void;
  addPage: () => void;
  save: (name: string) => void;
};

function loadScript(src: string): Promise<void> {
  const marker = `pdf-lib:${src}`;
  if (document.querySelector(`script[data-lib="${marker}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.lib = marker;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

async function loadPdfLibraries(): Promise<{ html2canvas: Html2CanvasFn; JsPDF: JsPdfCtor }> {
  const w = window as unknown as {
    html2canvas?: Html2CanvasFn;
    jspdf?: { jsPDF: JsPdfCtor };
  };
  if (!w.html2canvas) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  }
  if (!w.jspdf?.jsPDF) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js');
  }
  const html2canvas = (window as unknown as { html2canvas?: Html2CanvasFn }).html2canvas;
  const JsPDF = (window as unknown as { jspdf?: { jsPDF: JsPdfCtor } }).jspdf?.jsPDF;
  if (!html2canvas || !JsPDF) {
    throw new Error('PDF libraries failed to load');
  }
  return { html2canvas, JsPDF };
}

function printHtmlFallback(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  if (!win || !doc) {
    frame.remove();
    throw new Error('Could not open print preview');
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 400);
  setTimeout(() => frame.remove(), 60_000);
}

/** Same survey HTML as native — saved as a PDF file in the browser. */
export async function downloadPdfInBrowser(html: string, fileName: string): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('PDF download is not available in this browser.');
  }

  try {
    const { html2canvas, JsPDF } = await loadPdfLibraries();

    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
      'position:fixed;top:0;left:0;width:794px;opacity:0;pointer-events:none;background:#ffffff;z-index:-1;';
    const pageStyle = document.createElement('style');
    pageStyle.textContent = parsed.head.querySelector('style')?.textContent ?? '';
    host.appendChild(pageStyle);
    while (parsed.body.firstChild) {
      host.appendChild(parsed.body.firstChild);
    }
    document.body.appendChild(host);

    try {
      const images = Array.from(host.querySelectorAll('img'));
      await Promise.all(
        images.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }),
        ),
      );
      await new Promise((r) => setTimeout(r, 80));

      const canvas = await html2canvas(host, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        width: 794,
        scrollX: 0,
        scrollY: 0,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0.5) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(fileName);
    } finally {
      host.remove();
    }
  } catch {
    printHtmlFallback(html);
  }
}

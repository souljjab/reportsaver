import { normalizeText } from './text';

/** PDF 텍스트 추출. pdf.js 는 크기가 커서 필요할 때만 불러온다. */
export async function parsePdf(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const cMapUrl = new URL('cmaps/', document.baseURI).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(data), cMapUrl, cMapPacked: true });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      let line = '';
      let text = '';
      for (const item of tc.items) {
        if (!('str' in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          text += line + '\n';
          line = '';
        }
      }
      text += line;
      pages.push(text);
      page.cleanup();
    }
    const joined = normalizeText(pages.join('\n\n'));
    if (!joined) {
      throw new Error('PDF 에서 텍스트를 찾지 못했습니다. 스캔(이미지) PDF 일 수 있습니다. 텍스트를 직접 붙여넣어 주세요.');
    }
    return joined;
  } finally {
    await task.destroy();
  }
}

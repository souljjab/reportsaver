import JSZip from 'jszip';
import { decodeXmlEntities, normalizeText } from './text';

/**
 * HWPX(OWPML) 섹션 XML 에서 본문 텍스트를 뽑는다.
 * 네임스페이스 접두사(hp: 등)에 의존하지 않도록 로컬 이름으로만 판단하며,
 * DOMParser 가 없는 환경(테스트)에서도 동작하도록 간단한 토크나이저를 쓴다.
 */
export function extractHwpxSectionText(xml: string): string {
  const re = /<(\/?)(?:[\w.-]+:)?([\w.-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g;
  let out = '';
  let inText = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const [, closing, name, , selfClosing, text] = m;
    if (text !== undefined) {
      if (inText > 0) out += decodeXmlEntities(text);
      continue;
    }
    if (name === 't') {
      if (selfClosing) continue;
      inText += closing ? -1 : 1;
      if (inText < 0) inText = 0;
    } else if (name === 'p' && closing) {
      out += '\n';
    } else if (name === 'tab' && inText > 0) {
      out += '\t';
    } else if (name === 'lineBreak' && inText > 0) {
      out += '\n';
    }
  }
  return out;
}

export async function parseHwpx(data: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const sections = Object.keys(zip.files)
    .map((path) => ({ path, m: /^Contents\/section(\d+)\.xml$/i.exec(path) }))
    .filter((x): x is { path: string; m: RegExpExecArray } => !!x.m)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]));
  if (sections.length === 0) {
    throw new Error('HWPX 본문(Contents/section*.xml)을 찾을 수 없습니다.');
  }
  const parts: string[] = [];
  for (const s of sections) {
    const xml = await zip.file(s.path)!.async('string');
    parts.push(extractHwpxSectionText(xml));
  }
  return normalizeText(parts.join('\n'));
}

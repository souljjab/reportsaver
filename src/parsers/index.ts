import type { SourceType } from '../types';

export interface ParsedFile {
  title: string;
  content: string;
  sourceType: SourceType;
}

export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.hwp', '.hwpx', '.txt', '.md'];
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',');

export function detectType(fileName: string): SourceType | null {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf': return 'pdf';
    case 'docx': return 'docx';
    case 'hwp': return 'hwp';
    case 'hwpx': return 'hwpx';
    case 'txt':
    case 'md': return 'text';
    case 'doc': throw new Error('구형 Word(.doc) 파일은 지원하지 않습니다. Word 에서 .docx 로 저장한 뒤 올려 주세요.');
    default: return null;
  }
}

export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim() || name;
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const type = detectType(file.name);
  if (!type) throw new Error(`지원하지 않는 파일 형식입니다: ${file.name}`);
  const buf = await file.arrayBuffer();
  let content: string;
  switch (type) {
    case 'pdf': content = await (await import('./pdf')).parsePdf(buf); break;
    case 'docx': content = await (await import('./docx')).parseDocx(buf); break;
    case 'hwp': content = (await import('./hwp')).parseHwp(buf); break;
    case 'hwpx': content = await (await import('./hwpx')).parseHwpx(buf); break;
    case 'text': {
      const { normalizeText } = await import('./text');
      content = normalizeText(decodeText(buf));
      break;
    }
  }
  return { title: titleFromFileName(file.name), content, sourceType: type };
}

/** UTF-8 로 읽고, 깨지면 한국어 윈도우 기본 인코딩(EUC-KR/CP949)으로 다시 시도 */
function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('euc-kr').decode(buf);
  }
}

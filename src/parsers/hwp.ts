import * as CFB from 'cfb';
import { inflateRaw } from 'pako';
import { normalizeText } from './text';

// HWP 5.0 바이너리 문서 형식 (한글과컴퓨터 공개 문서 기준)
const HWPTAG_BEGIN = 0x10;
const HWPTAG_PARA_TEXT = HWPTAG_BEGIN + 51;

/** 1 WCHAR 크기의 문자 컨트롤. 나머지 0~31 컨트롤은 8 WCHAR(16바이트) 크기. */
const CHAR_CONTROLS = new Set([0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31]);

function toU8(content: unknown): Uint8Array {
  if (content instanceof Uint8Array) return content;
  if (Array.isArray(content)) return Uint8Array.from(content as number[]);
  throw new Error('HWP 스트림을 읽을 수 없습니다.');
}

/** PARA_TEXT 레코드(UTF-16LE)를 문자열로 변환하면서 컨트롤 문자를 처리한다. */
export function decodeParaText(buf: Uint8Array): string {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let out = '';
  let i = 0;
  const n = Math.floor(buf.byteLength / 2);
  while (i < n) {
    const c = view.getUint16(i * 2, true);
    if (c >= 32) {
      out += String.fromCharCode(c);
      i += 1;
      continue;
    }
    if (CHAR_CONTROLS.has(c)) {
      if (c === 10 || c === 13) out += '\n';
      else if (c === 24) out += '-';
      else if (c === 30 || c === 31) out += ' ';
      i += 1;
    } else {
      if (c === 9) out += '\t';
      i += 8;
    }
  }
  return out;
}

/** 섹션 스트림(압축 해제 후)의 레코드를 훑어 문단 텍스트를 모은다. */
export function extractSectionText(data: Uint8Array): string {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 0;
  const paras: string[] = [];
  while (pos + 4 <= data.byteLength) {
    const header = view.getUint32(pos, true);
    pos += 4;
    const tagId = header & 0x3ff;
    let size = (header >>> 20) & 0xfff;
    if (size === 0xfff) {
      if (pos + 4 > data.byteLength) break;
      size = view.getUint32(pos, true);
      pos += 4;
    }
    if (pos + size > data.byteLength) break;
    if (tagId === HWPTAG_PARA_TEXT) {
      paras.push(decodeParaText(data.subarray(pos, pos + size)).replace(/\n+$/, ''));
    }
    pos += size;
  }
  return paras.join('\n');
}

export function parseHwp(data: ArrayBuffer): string {
  let cfb: CFB.CFB$Container;
  try {
    cfb = CFB.read(new Uint8Array(data), { type: 'array' });
  } catch {
    throw new Error('HWP 파일 구조를 읽을 수 없습니다. (HWP 5.0 이상만 지원)');
  }
  const headerEntry = CFB.find(cfb, 'FileHeader');
  if (!headerEntry) throw new Error('HWP 파일 헤더가 없습니다. (HWP 3.0 이하 문서는 지원하지 않습니다)');
  const header = toU8(headerEntry.content);
  const signature = new TextDecoder('ascii').decode(header.subarray(0, 17));
  if (signature !== 'HWP Document File') throw new Error('올바른 HWP 5.0 문서가 아닙니다.');
  const props = new DataView(header.buffer, header.byteOffset, header.byteLength).getUint32(36, true);
  const compressed = (props & 0x1) !== 0;
  if (props & 0x2) throw new Error('암호가 설정된 HWP 문서는 읽을 수 없습니다. 암호를 해제한 뒤 다시 올려 주세요.');
  if (props & 0x4) throw new Error('배포용 HWP 문서는 읽을 수 없습니다. 일반 문서로 저장한 뒤 다시 올려 주세요.');

  const sections = cfb.FullPaths
    .map((path, idx) => ({ idx, m: /\/BodyText\/Section(\d+)$/i.exec(path) }))
    .filter((x): x is { idx: number; m: RegExpExecArray } => !!x.m)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]));
  if (sections.length === 0) throw new Error('HWP 본문(BodyText)을 찾을 수 없습니다.');

  const parts = sections.map(({ idx }) => {
    let raw = toU8(cfb.FileIndex[idx].content);
    if (compressed) raw = inflateRaw(raw);
    return extractSectionText(raw);
  });
  return normalizeText(parts.join('\n'));
}

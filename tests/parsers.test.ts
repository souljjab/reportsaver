import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as CFB from 'cfb';
import JSZip from 'jszip';
import { deflateRaw } from 'pako';
import { describe, expect, it } from 'vitest';
import { parseDocx } from '../src/parsers/docx';
import { decodeParaText, parseHwp } from '../src/parsers/hwp';
import { extractHwpxSectionText, parseHwpx } from '../src/parsers/hwpx';
import { detectType, titleFromFileName } from '../src/parsers/index';
import { normalizeText } from '../src/parsers/text';

// ---- HWP 5.0 테스트용 문서 생성 도우미 ----
function utf16(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    out.push(c & 0xff, c >> 8);
  }
  return out;
}
function ctrl(code: number, extended: boolean): number[] {
  // 확장/인라인 컨트롤은 8 WCHAR, 문자 컨트롤은 1 WCHAR
  const words = extended ? [code, 0, 0, 0, 0, 0, 0, code] : [code];
  return words.flatMap((w) => [w & 0xff, w >> 8]);
}
function record(tagId: number, payload: number[]): number[] {
  const out: number[] = [];
  const size = payload.length;
  const header = (tagId & 0x3ff) | (0 << 10) | ((size >= 0xfff ? 0xfff : size) << 20);
  out.push(header & 0xff, (header >>> 8) & 0xff, (header >>> 16) & 0xff, (header >>> 24) & 0xff);
  if (size >= 0xfff) out.push(size & 0xff, (size >>> 8) & 0xff, (size >>> 16) & 0xff, (size >>> 24) & 0xff);
  return out.concat(payload);
}
const PARA_HEADER = 66;
const PARA_TEXT = 67;

function buildHwp(sections: number[][][], props = 1): ArrayBuffer {
  const header = new Uint8Array(256);
  header.set(new TextEncoder().encode('HWP Document File'), 0);
  new DataView(header.buffer).setUint32(32, 0x05000300, true);
  new DataView(header.buffer).setUint32(36, props, true);
  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, '/FileHeader', header);
  sections.forEach((paras, i) => {
    const raw = paras.flatMap((p) => [...record(PARA_HEADER, [0, 0, 0, 0]), ...record(PARA_TEXT, p)]);
    const bytes = new Uint8Array(raw);
    CFB.utils.cfb_add(cfb, `/BodyText/Section${i}`, props & 1 ? deflateRaw(bytes) : bytes);
  });
  const out = CFB.write(cfb, { type: 'array' }) as number[] | Uint8Array;
  return Uint8Array.from(out).buffer;
}

describe('HWP 5.0', () => {
  it('압축된 본문에서 문단 텍스트를 추출하고 컨트롤 문자를 처리한다', () => {
    const buf = buildHwp([
      [
        [...utf16('자료구조 보고서'), ...ctrl(13, false)],
        [...ctrl(11, true), ...utf16('이진'), ...ctrl(9, true), ...utf16('탐색 트리'), ...ctrl(13, false)],
      ],
      [[...utf16('두 번째 구역'), ...ctrl(10, false), ...utf16('줄바꿈'), ...ctrl(13, false)]],
    ]);
    expect(parseHwp(buf)).toBe('자료구조 보고서\n이진\t탐색 트리\n두 번째 구역\n줄바꿈');
  });

  it('비압축 문서와 긴 레코드(확장 크기)도 읽는다', () => {
    const long = '가'.repeat(3000); // 6000 바이트 > 0xFFF
    const buf = buildHwp([[[...utf16(long), ...ctrl(13, false)]]], 0);
    expect(parseHwp(buf)).toBe(long);
  });

  it('암호 문서와 배포용 문서는 안내 메시지로 거부한다', () => {
    expect(() => parseHwp(buildHwp([[utf16('x')]], 0b11))).toThrow(/암호/);
    expect(() => parseHwp(buildHwp([[utf16('x')]], 0b101))).toThrow(/배포용/);
  });

  it('HWP 가 아닌 파일은 거부한다', () => {
    expect(() => parseHwp(new TextEncoder().encode('hello').buffer)).toThrow();
  });

  it('decodeParaText: 묶음 빈칸·고정폭 빈칸은 공백으로', () => {
    expect(decodeParaText(new Uint8Array([...utf16('A'), ...ctrl(30, false), ...utf16('B'), ...ctrl(31, false), ...utf16('C')]))).toBe('A B C');
  });
});

describe('HWPX', () => {
  const section = `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p id="1"><hp:run charPrIDRef="0"><hp:secPr><hp:pagePr width="59528"/></hp:secPr><hp:t>실험 보고서 &amp; 결과</hp:t></hp:run></hp:p>
  <hp:p id="2"><hp:run><hp:t>온도<hp:tab width="4000"/>25℃</hp:t></hp:run><hp:run><hp:t/></hp:run></hp:p>
  <hp:p id="3"><hp:run><hp:tbl><hp:tr><hp:tc><hp:subList><hp:p><hp:run><hp:t>표 안 글자</hp:t></hp:run></hp:p></hp:subList></hp:tc></hp:tr></hp:tbl></hp:run></hp:p>
</hs:sec>`;

  it('섹션 XML 에서 텍스트를 추출한다', () => {
    expect(normalizeText(extractHwpxSectionText(section))).toBe('실험 보고서 & 결과\n온도\t25℃\n표 안 글자');
  });

  it('여러 섹션을 번호 순서대로 합친다', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/hwp+zip');
    zip.file('Contents/section10.xml', '<hs:sec xmlns:hp="x"><hp:p><hp:run><hp:t>열 번째</hp:t></hp:run></hp:p></hs:sec>');
    zip.file('Contents/section0.xml', section);
    zip.file('Contents/section2.xml', '<hs:sec xmlns:hp="x"><hp:p><hp:run><hp:t>두 번째</hp:t></hp:run></hp:p></hs:sec>');
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const text = await parseHwpx(buf);
    expect(text.split('\n').filter(Boolean).slice(-2)).toEqual(['두 번째', '열 번째']);
    expect(text.startsWith('실험 보고서 & 결과')).toBe(true);
  });
});

describe('DOCX', () => {
  it('본문과 표 텍스트를 추출한다', async () => {
    const file = readFileSync(join(__dirname, 'fixtures', 'sample.docx'));
    const text = await parseDocx(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    expect(text).toContain('경영학원론 기말 보고서');
    expect(text).toContain('마케팅 4P');
    expect(text).toContain('제품');
    expect(text).toContain('차별화가 중요하다');
  });
});

describe('공통', () => {
  it('확장자로 형식을 판별한다', () => {
    expect(detectType('a.PDF')).toBe('pdf');
    expect(detectType('보고서.hwpx')).toBe('hwpx');
    expect(detectType('memo.txt')).toBe('text');
    expect(detectType('img.png')).toBeNull();
    expect(() => detectType('old.doc')).toThrow(/docx/);
  });
  it('파일 이름에서 제목을 만든다', () => {
    expect(titleFromFileName('2024 기말 보고서.final.hwp')).toBe('2024 기말 보고서.final');
  });
  it('텍스트 정리', () => {
    expect(normalizeText('a  \r\n\n\n\nb c')).toBe('a\n\nb c');
  });
});

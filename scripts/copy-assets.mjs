// pdf.js 가 한글(CJK) PDF 의 글꼴 매핑을 해석하려면 CMap 파일이 필요하다.
// 빌드 전에 node_modules 에서 public/cmaps 로 복사한다.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'pdfjs-dist', 'cmaps');
const dest = join(root, 'public', 'cmaps');
if (!existsSync(src)) {
  console.error('pdfjs-dist cmaps not found:', src);
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('copied pdf.js cmaps -> public/cmaps');

import mammoth from 'mammoth';
import { normalizeText } from './text';

export async function parseDocx(data: ArrayBuffer): Promise<string> {
  // 브라우저 빌드는 arrayBuffer, Node(테스트) 빌드는 buffer 옵션을 받는다.
  const NodeBuffer = (globalThis as { Buffer?: { from(b: ArrayBuffer): unknown } }).Buffer;
  const input = typeof window === 'undefined' && NodeBuffer ? { buffer: NodeBuffer.from(data) } : { arrayBuffer: data };
  const result = await mammoth.extractRawText(input as { arrayBuffer: ArrayBuffer });
  return normalizeText(result.value);
}

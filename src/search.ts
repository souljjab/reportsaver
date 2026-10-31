import type { Report } from './types';

export type Filter =
  | { kind: 'all' }
  | { kind: 'favorite' }
  | { kind: 'unfiled' }
  | { kind: 'unanalyzed' }
  | { kind: 'folder'; id: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'subject'; subject: string; topic?: string }
  | { kind: 'keyword'; keyword: string };

export type SortKey = 'updated' | 'created' | 'title' | 'written';

export function matchesFilter(r: Report, f: Filter, folderIds?: Set<string>): boolean {
  switch (f.kind) {
    case 'all': return true;
    case 'favorite': return r.favorite;
    case 'unfiled': return !r.folderId;
    case 'unanalyzed': return !r.ai;
    case 'folder': return !!r.folderId && (folderIds ? folderIds.has(r.folderId) : r.folderId === f.id);
    case 'tag': return r.tags.includes(f.tag);
    case 'subject':
      return r.ai?.subject === f.subject && (f.topic === undefined || r.ai?.topic === f.topic);
    case 'keyword': return !!r.ai?.keywords.includes(f.keyword);
  }
}

/** 공백으로 나눈 모든 단어가 (제목·본문·메모·태그·AI 분류 중 어딘가에) 포함되어야 일치 */
export function matchesQuery(r: Report, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = [
    r.title,
    r.content,
    r.note,
    r.fileName ?? '',
    r.tags.join(' '),
    r.ai ? [r.ai.subject, r.ai.topic, r.ai.keywords.join(' '), r.ai.summary].join(' ') : '',
  ]
    .join('\n')
    .toLowerCase();
  return terms.every((t) => hay.includes(t));
}

export function sortReports(list: Report[], key: SortKey): Report[] {
  const arr = [...list];
  switch (key) {
    case 'updated': return arr.sort((a, b) => b.updatedAt - a.updatedAt);
    case 'created': return arr.sort((a, b) => b.createdAt - a.createdAt);
    case 'title': return arr.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
    case 'written':
      return arr.sort((a, b) => (b.writtenDate || '').localeCompare(a.writtenDate || '') || b.createdAt - a.createdAt);
  }
}

/** 검색어 주변 본문 일부를 잘라 미리보기로 보여준다 */
export function snippet(r: Report, query: string, len = 140): string {
  const text = r.content.replace(/\s+/g, ' ');
  const term = query.toLowerCase().split(/\s+/).filter(Boolean)[0];
  if (term) {
    const i = text.toLowerCase().indexOf(term);
    if (i >= 0) {
      const start = Math.max(0, i - 40);
      return (start > 0 ? '…' : '') + text.slice(start, start + len) + (start + len < text.length ? '…' : '');
    }
  }
  if (r.ai?.summary) return r.ai.summary.length > len ? r.ai.summary.slice(0, len) + '…' : r.ai.summary;
  return text.length > len ? text.slice(0, len) + '…' : text;
}

export const SOURCE_LABEL: Record<Report['sourceType'], string> = {
  pdf: 'PDF',
  docx: 'Word',
  hwp: '한글',
  hwpx: '한글',
  text: '텍스트',
};

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

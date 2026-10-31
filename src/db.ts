import Dexie, { type EntityTable } from 'dexie';
import type { Folder, Report, StoredFile } from './types';

export class ReportDB extends Dexie {
  reports!: EntityTable<Report, 'id'>;
  files!: EntityTable<StoredFile, 'reportId'>;
  folders!: EntityTable<Folder, 'id'>;

  constructor() {
    super('reportsaver');
    this.version(1).stores({
      reports: 'id, folderId, *tags, sourceType, createdAt, updatedAt, favorite',
      files: 'reportId',
      folders: 'id, parentId, name',
    });
  }
}

export const db = new ReportDB();

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export async function addReport(
  data: Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'hasFile'>,
  file?: Blob,
): Promise<string> {
  const id = newId();
  const now = Date.now();
  await db.transaction('rw', db.reports, db.files, async () => {
    await db.reports.add({ ...data, id, hasFile: !!file, createdAt: now, updatedAt: now });
    if (file) await db.files.add({ reportId: id, blob: file });
  });
  return id;
}

export async function updateReport(id: string, changes: Partial<Report>): Promise<void> {
  await db.reports.update(id, { ...changes, updatedAt: Date.now() });
}

export async function deleteReports(ids: string[]): Promise<void> {
  await db.transaction('rw', db.reports, db.files, async () => {
    await db.reports.bulkDelete(ids);
    await db.files.bulkDelete(ids);
  });
}

/** 폴더와 모든 하위 폴더를 삭제하고, 그 안의 보고서는 '미분류'로 옮긴다. */
export async function deleteFolder(id: string): Promise<void> {
  const all = await db.folders.toArray();
  const toDelete = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of all) {
      if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
        toDelete.add(f.id);
        grew = true;
      }
    }
  }
  await db.transaction('rw', db.folders, db.reports, async () => {
    await db.reports.where('folderId').anyOf([...toDelete]).modify({ folderId: null });
    await db.folders.bulkDelete([...toDelete]);
  });
}

/** 이름으로 최상위 폴더를 찾고, 없으면 만든다. (AI 제안 폴더 적용 시 사용) */
export async function ensureFolder(name: string): Promise<string> {
  const trimmed = name.trim();
  const existing = (await db.folders.toArray()).find(
    (f) => f.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) return existing.id;
  const id = newId();
  await db.folders.add({ id, name: trimmed, parentId: null, createdAt: Date.now() });
  return id;
}

/** 폴더 id → "상위 / 하위" 형태의 경로 문자열 */
export function folderPath(folders: Folder[], id: string | null): string {
  if (!id) return '미분류';
  const byId = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  let cur = byId.get(id);
  let guard = 0;
  while (cur && guard++ < 50) {
    parts.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return parts.join(' / ') || '미분류';
}

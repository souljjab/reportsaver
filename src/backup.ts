import { db } from './db';
import { blobToBase64 } from './platform';
import type { Folder, Report } from './types';

interface BackupFile {
  reportId: string;
  type: string;
  base64: string;
}

interface Backup {
  app: 'reportsaver';
  version: 1;
  exportedAt: string;
  folders: Folder[];
  reports: Report[];
  files: BackupFile[];
}

export async function exportBackup(includeFiles: boolean): Promise<Blob> {
  const [folders, reports] = await Promise.all([db.folders.toArray(), db.reports.toArray()]);
  const files: BackupFile[] = [];
  if (includeFiles) {
    for (const f of await db.files.toArray()) {
      files.push({ reportId: f.reportId, type: f.blob.type, base64: await blobToBase64(f.blob) });
    }
  }
  const backup: Backup = {
    app: 'reportsaver',
    version: 1,
    exportedAt: new Date().toISOString(),
    folders,
    reports: includeFiles ? reports : reports.map((r) => ({ ...r, hasFile: false })),
    files,
  };
  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** 백업을 현재 보관함에 합친다. 같은 id 는 백업 내용으로 덮어쓴다. */
export async function importBackup(file: File): Promise<{ reports: number; folders: number }> {
  let data: Backup;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('백업 파일을 읽을 수 없습니다. (JSON 형식 아님)');
  }
  if (data?.app !== 'reportsaver' || !Array.isArray(data.reports)) {
    throw new Error('ReportSaver 백업 파일이 아닙니다.');
  }
  const fileIds = new Set((data.files ?? []).map((f) => f.reportId));
  await db.transaction('rw', db.reports, db.files, db.folders, async () => {
    // 이 기기에 이미 원본 파일이 있는 보고서는 파일 없는 백업으로 덮어써도 원본을 유지한다.
    for (const key of await db.files.toCollection().primaryKeys()) fileIds.add(key);
    await db.folders.bulkPut(data.folders ?? []);
    await db.reports.bulkPut(
      data.reports.map((r) => ({ ...r, hasFile: r.hasFile && fileIds.has(r.id) })),
    );
    await db.files.bulkPut(
      (data.files ?? []).map((f) => ({ reportId: f.reportId, blob: base64ToBlob(f.base64, f.type) })),
    );
  });
  return { reports: data.reports.length, folders: (data.folders ?? []).length };
}

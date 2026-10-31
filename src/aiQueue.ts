import { useSyncExternalStore } from 'react';
import { analyzeReport, toAiAnalysis } from './ai';
import { db, ensureFolder, updateReport } from './db';
import { getSettings } from './settings';
import type { Report } from './types';

export const UNTITLED = '제목 없는 보고서';

interface QueueState {
  pending: string[];
  active: string[];
  done: number;
  total: number;
  errors: Record<string, string>;
}

let state: QueueState = { pending: [], active: [], done: 0, total: 0, errors: {} };
const listeners = new Set<() => void>();
const CONCURRENCY = 2;

function set(patch: Partial<QueueState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useAiQueue(): QueueState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export function isQueued(id: string): boolean {
  return state.pending.includes(id) || state.active.includes(id);
}

export function enqueueAnalysis(ids: string[]): void {
  const fresh = ids.filter((id) => !isQueued(id));
  if (!fresh.length) return;
  const errors = { ...state.errors };
  fresh.forEach((id) => delete errors[id]);
  const idle = state.pending.length === 0 && state.active.length === 0;
  set({
    pending: [...state.pending, ...fresh],
    total: (idle ? 0 : state.total) + fresh.length,
    done: idle ? 0 : state.done,
    errors,
  });
  pump();
}

export function clearAiErrors(): void {
  set({ errors: {} });
}

function pump() {
  while (state.active.length < CONCURRENCY && state.pending.length > 0) {
    const [id, ...rest] = state.pending;
    set({ pending: rest, active: [...state.active, id] });
    void runOne(id).finally(() => {
      set({ active: state.active.filter((x) => x !== id), done: state.done + 1 });
      pump();
    });
  }
}

async function runOne(id: string) {
  const report = await db.reports.get(id);
  if (!report) return;
  try {
    const result = await analyzeReport(report);
    const changes: Partial<Report> = { ai: toAiAnalysis(result) };
    if ((!report.title.trim() || report.title === UNTITLED) && result.suggestedTitle) {
      changes.title = result.suggestedTitle;
    }
    if (getSettings().autoApply) {
      changes.tags = [...new Set([...report.tags, ...result.suggestedTags])];
      if (!report.folderId && result.suggestedFolder) {
        changes.folderId = await ensureFolder(result.suggestedFolder);
      }
    }
    await updateReport(id, changes);
  } catch (err) {
    set({ errors: { ...state.errors, [id]: err instanceof Error ? err.message : String(err) } });
  }
}

import { useSyncExternalStore } from 'react';

export type Effort = 'low' | 'medium' | 'high';

export interface Settings {
  apiKey: string;
  model: string;
  effort: Effort;
  /** 보고서를 추가하면 바로 AI 분석 실행 (API 키가 있을 때) */
  autoAnalyze: boolean;
  /** AI 가 제안한 태그·폴더를 자동으로 적용 */
  autoApply: boolean;
}

export const MODEL_OPTIONS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (가장 정확, 기본값)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (빠르고 저렴)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (가장 저렴)' },
];

const DEFAULTS: Settings = {
  apiKey: '',
  model: 'claude-opus-5-5',
  effort: 'medium',
  autoAnalyze: true,
  autoApply: false,
};

const KEY = 'reportsaver.settings';
const listeners = new Set<() => void>();
let current: Settings = load();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getSettings(): Settings {
  return current;
}

export function saveSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(current));
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

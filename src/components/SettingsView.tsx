import { useRef, useState } from 'react';
import { testApiKey } from '../ai';
import { exportBackup, importBackup } from '../backup';
import { db } from '../db';
import { askConfirm, showAlert } from '../dialogs';
import { isNative, saveFile } from '../platform';
import { MODEL_OPTIONS, saveSettings, useSettings, type Effort } from '../settings';

export function SettingsView({ reportCount }: { reportCount: number }) {
  const s = useSettings();
  const [key, setKey] = useState(s.apiKey);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const saveKey = async () => {
    const k = key.trim();
    saveSettings({ apiKey: k });
    if (!k) return setStatus('API 키를 삭제했습니다.');
    setTesting(true);
    setStatus('확인 중…');
    try {
      await testApiKey(k);
      setStatus('✔ 저장 완료 — API 키가 정상 동작합니다.');
    } catch (err) {
      setStatus(`저장했지만 확인에 실패했습니다: ${err instanceof Error ? err.message : err}`);
    } finally {
      setTesting(false);
    }
  };

  const doExport = async (includeFiles: boolean) => {
    const blob = await exportBackup(includeFiles);
    const date = new Date().toISOString().slice(0, 10);
    await saveFile(blob, `reportsaver-backup-${date}.json`);
  };

  return (
    <div className="settings">
      <div className="list-head">
        <h2>설정</h2>
      </div>

      <section className="panel">
        <h3>Claude AI 연결</h3>
        <p className="muted small">
          AI 자동 분류·요약에는 Anthropic Claude API 키가 필요합니다.{' '}
          <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">platform.claude.com</a>
          에서 발급받을 수 있으며, 사용량에 따라 요금이 부과됩니다. 키는 이 기기에만 저장되고 Claude API 외 다른 곳으로 전송되지 않습니다.
        </p>
        <label className="field">
          <span>API 키</span>
          <div className="row gap">
            <input
              type={show ? 'text' : 'password'}
              value={key}
              placeholder="sk-ant-..."
              autoComplete="off"
              onChange={(e) => setKey(e.target.value)}
            />
            <button className="btn" type="button" onClick={() => setShow(!show)}>{show ? '숨기기' : '보기'}</button>
            <button className="btn primary" onClick={saveKey} disabled={testing}>저장</button>
          </div>
        </label>
        {status && <p className="small">{status}</p>}
        <label className="field">
          <span>모델</span>
          <select value={s.model} onChange={(e) => saveSettings({ model: e.target.value })}>
            {MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>분석 깊이</span>
          <select value={s.effort} onChange={(e) => saveSettings({ effort: e.target.value as Effort })}>
            <option value="low">빠르게 (비용 절약)</option>
            <option value="medium">보통 (권장)</option>
            <option value="high">꼼꼼하게</option>
          </select>
        </label>
        <label className="row gap-s">
          <input type="checkbox" checked={s.autoAnalyze} onChange={(e) => saveSettings({ autoAnalyze: e.target.checked })} />
          보고서를 추가하면 자동으로 AI 분석
        </label>
        <label className="row gap-s">
          <input type="checkbox" checked={s.autoApply} onChange={(e) => saveSettings({ autoApply: e.target.checked })} />
          AI 가 제안한 태그와 폴더를 자동 적용 (미분류 보고서만 폴더 이동)
        </label>
      </section>

      <section className="panel">
        <h3>백업 · 다른 기기로 옮기기</h3>
        <p className="muted small">
          보고서는 이 {isNative ? '앱' : '브라우저/프로그램'} 안에 저장됩니다 (현재 {reportCount}개). 다른 기기(PC ↔ 휴대폰)로 옮기거나
          만일을 대비하려면 백업 파일을 내보낸 뒤, 다른 기기에서 가져오세요.
        </p>
        <div className="row gap wrap">
          <button className="btn primary" onClick={() => doExport(true)}>백업 내보내기 (원본 파일 포함)</button>
          <button className="btn" onClick={() => doExport(false)}>백업 내보내기 (텍스트만, 가벼움)</button>
          <button className="btn" onClick={() => importRef.current?.click()}>백업 가져오기</button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const r = await importBackup(f);
                await showAlert(`보고서 ${r.reports}개, 폴더 ${r.folders}개를 가져왔습니다.`);
              } catch (err) {
                await showAlert(err instanceof Error ? err.message : String(err));
              }
            }}
          />
        </div>
      </section>

      <section className="panel">
        <h3>데이터 초기화</h3>
        <button
          className="btn danger"
          onClick={async () => {
            if (await askConfirm('모든 보고서와 폴더를 삭제할까요? 되돌릴 수 없습니다. 먼저 백업을 권장합니다.', true)) {
              await db.transaction('rw', db.reports, db.files, db.folders, async () => {
                await Promise.all([db.reports.clear(), db.files.clear(), db.folders.clear()]);
              });
            }
          }}
        >
          모든 데이터 삭제
        </button>
      </section>
      <p className="muted small center">ReportSaver v{__APP_VERSION__}</p>
    </div>
  );
}

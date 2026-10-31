import { clearAiErrors, useAiQueue } from '../aiQueue';

export function AiStatusBar() {
  const q = useAiQueue();
  const running = q.pending.length + q.active.length;
  const errorCount = Object.keys(q.errors).length;
  if (!running && !errorCount) return null;
  return (
    <div className="ai-status" role="status">
      {running > 0 ? (
        <>
          <span className="spinner" aria-hidden /> AI 분석 중 {q.done}/{q.total}
          <progress max={q.total} value={q.done} />
        </>
      ) : (
        <>
          <span>⚠ AI 분석 실패 {errorCount}건 — {Object.values(q.errors)[0]}</span>
          <button className="btn small" onClick={clearAiErrors}>닫기</button>
        </>
      )}
    </div>
  );
}

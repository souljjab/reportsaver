import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

// Electron 은 window.prompt 를 지원하지 않으므로 직접 만든 대화상자를 쓴다.

type Req =
  | { kind: 'text'; title: string; value: string; resolve: (v: string | null) => void }
  | { kind: 'confirm'; title: string; danger: boolean; resolve: (v: boolean) => void }
  | { kind: 'alert'; title: string; resolve: () => void };

let current: Req | null = null;
const listeners = new Set<() => void>();
function setCurrent(r: Req | null) {
  current = r;
  listeners.forEach((l) => l());
}

export function askText(title: string, value = ''): Promise<string | null> {
  return new Promise((resolve) => setCurrent({ kind: 'text', title, value, resolve }));
}
export function askConfirm(title: string, danger = false): Promise<boolean> {
  return new Promise((resolve) => setCurrent({ kind: 'confirm', title, danger, resolve }));
}
export function showAlert(title: string): Promise<void> {
  return new Promise((resolve) => setCurrent({ kind: 'alert', title, resolve }));
}

export function DialogHost() {
  const req = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (req?.kind === 'text') {
      setText(req.value);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [req]);
  if (!req) return null;

  const close = (ok: boolean) => {
    setCurrent(null);
    if (req.kind === 'text') req.resolve(ok ? text.trim() || null : null);
    else if (req.kind === 'confirm') req.resolve(ok);
    else req.resolve();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <form
        className="modal small"
        onSubmit={(e) => {
          e.preventDefault();
          close(true);
        }}
      >
        <p className="dialog-title">{req.title}</p>
        {req.kind === 'text' && (
          <input ref={inputRef} autoFocus value={text} onChange={(e) => setText(e.target.value)} />
        )}
        <div className="row end gap">
          {req.kind !== 'alert' && (
            <button type="button" className="btn" onClick={() => close(false)}>
              취소
            </button>
          )}
          <button
            type="submit"
            autoFocus={req.kind !== 'text'}
            className={`btn ${req.kind === 'confirm' && req.danger ? 'danger' : 'primary'}`}
          >
            확인
          </button>
        </div>
      </form>
    </div>
  );
}

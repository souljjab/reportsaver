import { useRef, useState } from 'react';
import { addReport } from '../db';
import { enqueueAnalysis, UNTITLED } from '../aiQueue';
import { ACCEPT_ATTR, parseFile } from '../parsers';
import { isNative } from '../platform';
import { useSettings } from '../settings';
import type { Folder } from '../types';
import { FolderSelect } from './FolderSelect';
import { TagInput } from './TagInput';

interface Props {
  folders: Folder[];
  allTags: string[];
  defaultFolderId: string | null;
  onClose: () => void;
  onOpen: (id: string) => void;
}

interface Item {
  key: string;
  name: string;
  status: 'waiting' | 'reading' | 'done' | 'error';
  message?: string;
  reportId?: string;
}

export function AddReportDialog({ folders, allTags, defaultFolderId, onClose, onOpen }: Props) {
  const settings = useSettings();
  const [tab, setTab] = useState<'file' | 'text'>('file');
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const [tags, setTags] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [writtenDate, setWrittenDate] = useState('');
  const [analyze, setAnalyze] = useState(settings.autoAnalyze && !!settings.apiKey);
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...p } : it)));

  const handleFiles = async (files: FileList | File[]) => {
    const list = [...files];
    const newItems = list.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, name: f.name, status: 'waiting' as const }));
    setItems((prev) => [...prev, ...newItems]);
    const created: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const key = newItems[i].key;
      patch(key, { status: 'reading' });
      try {
        const parsed = await parseFile(file);
        const id = await addReport(
          {
            title: parsed.title,
            content: parsed.content,
            sourceType: parsed.sourceType,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            folderId,
            tags,
            note: '',
            writtenDate: file.lastModified ? new Date(file.lastModified).toISOString().slice(0, 10) : '',
            favorite: false,
          },
          file,
        );
        created.push(id);
        patch(key, { status: 'done', reportId: id, message: `${parsed.content.length.toLocaleString()}자 추출` });
      } catch (err) {
        patch(key, { status: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    }
    if (analyze && created.length) enqueueAnalysis(created);
  };

  const saveText = async () => {
    if (!text.trim()) return;
    const id = await addReport({
      title: title.trim() || UNTITLED,
      content: text.trim(),
      sourceType: 'text',
      folderId,
      tags,
      note: '',
      writtenDate,
      favorite: false,
    });
    if (analyze) enqueueAnalysis([id]);
    onOpen(id);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="보고서 추가">
        <div className="row between">
          <h2>보고서 추가</h2>
          <button className="btn ghost" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className="tabs">
          <button className={tab === 'file' ? 'active' : ''} onClick={() => setTab('file')}>📄 파일 올리기</button>
          <button className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}>📝 텍스트 붙여넣기</button>
        </div>

        <div className="add-options">
          <label className="field">
            <span>저장할 폴더</span>
            <FolderSelect folders={folders} value={folderId} onChange={setFolderId} />
          </label>
          <div className="field">
            <span>태그</span>
            <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
          </div>
          <label className="row gap-s small">
            <input type="checkbox" checked={analyze} disabled={!settings.apiKey} onChange={(e) => setAnalyze(e.target.checked)} />
            저장 후 AI 자동 분류·요약 {settings.apiKey ? '' : '(설정에서 API 키 입력 필요)'}
          </label>
        </div>

        {tab === 'file' ? (
          <>
            <div
              className={`dropzone ${dragging ? 'dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
            >
              <p><strong>여기를 눌러 파일 선택</strong> 또는 파일을 끌어다 놓으세요</p>
              <p className="muted small">PDF · Word(.docx) · 한글(.hwp, .hwpx) · 텍스트(.txt) — 여러 개 동시 가능</p>
              <input
                ref={fileRef}
                type="file"
                multiple
                // Android 파일 선택기는 .hwp 같은 확장자 필터를 잘 처리하지 못해 파일이 숨겨질 수 있으므로
                // 앱에서는 모든 파일을 보여주고, 선택 후 형식을 검사한다.
                accept={isNative ? undefined : ACCEPT_ATTR}
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) void handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
            {items.length > 0 && (
              <ul className="upload-list">
                {items.map((it) => (
                  <li key={it.key} className={`upload-${it.status}`}>
                    <span className="upload-name">{it.name}</span>
                    <span className="upload-status">
                      {it.status === 'waiting' && '대기'}
                      {it.status === 'reading' && '읽는 중…'}
                      {it.status === 'done' && (
                        <button className="link" onClick={() => it.reportId && onOpen(it.reportId)}>✔ {it.message} · 열기</button>
                      )}
                      {it.status === 'error' && <span className="error-text">✖ {it.message}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="row end">
              <button className="btn primary" onClick={onClose}>완료</button>
            </div>
          </>
        ) : (
          <>
            <label className="field">
              <span>제목</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="비워 두면 AI 가 제목을 제안합니다" />
            </label>
            <label className="field">
              <span>작성일</span>
              <input type="date" value={writtenDate} onChange={(e) => setWrittenDate(e.target.value)} />
            </label>
            <label className="field">
              <span>본문</span>
              <textarea className="paste-area" value={text} onChange={(e) => setText(e.target.value)} placeholder="보고서 내용을 붙여넣으세요" />
            </label>
            <div className="row between">
              <span className="muted small">{text.length.toLocaleString()}자</span>
              <button className="btn primary" onClick={saveText} disabled={!text.trim()}>저장</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

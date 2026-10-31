import { useState } from 'react';
import { deleteReports, folderPath, updateReport } from '../db';
import { askConfirm, showAlert } from '../dialogs';
import { enqueueAnalysis, useAiQueue } from '../aiQueue';
import { formatDate, snippet, SOURCE_LABEL, type SortKey } from '../search';
import { useSettings } from '../settings';
import type { Folder, Report } from '../types';
import { FolderSelect } from './FolderSelect';
import { TagInput } from './TagInput';

interface Props {
  title: string;
  reports: Report[];
  folders: Folder[];
  allTags: string[];
  query: string;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  onOpen: (id: string) => void;
  onAdd: () => void;
}

export function ReportList({ title, reports, folders, allTags, query, sort, onSort, onOpen, onAdd }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const queue = useAiQueue();
  const settings = useSettings();
  const busy = new Set([...queue.pending, ...queue.active]);

  const visibleSelected = reports.filter((r) => selected.has(r.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const allChecked = reports.length > 0 && visibleSelected.length === reports.length;

  const bulkMove = async (folderId: string | null) => {
    await Promise.all(visibleSelected.map((r) => updateReport(r.id, { folderId })));
  };
  const bulkAddTags = async () => {
    if (!bulkTags.length) return;
    await Promise.all(
      visibleSelected.map((r) => updateReport(r.id, { tags: [...new Set([...r.tags, ...bulkTags])] })),
    );
    setBulkTags([]);
  };
  const bulkAnalyze = async () => {
    if (!settings.apiKey) return showAlert('설정에서 Claude API 키를 먼저 입력해 주세요.');
    enqueueAnalysis(visibleSelected.map((r) => r.id));
  };
  const bulkDelete = async () => {
    if (await askConfirm(`선택한 보고서 ${visibleSelected.length}개를 삭제할까요? 되돌릴 수 없습니다.`, true)) {
      await deleteReports(visibleSelected.map((r) => r.id));
      setSelected(new Set());
    }
  };

  return (
    <div className="list-view">
      <div className="list-head">
        <h2>
          {title} <span className="muted">{reports.length}</span>
        </h2>
        <div className="row gap wrap">
          <label className="row gap-s small">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={() => setSelected(allChecked ? new Set() : new Set(reports.map((r) => r.id)))}
            />
            전체 선택
          </label>
          <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)} aria-label="정렬">
            <option value="updated">최근 수정순</option>
            <option value="created">최근 추가순</option>
            <option value="written">작성일순</option>
            <option value="title">제목순</option>
          </select>
        </div>
      </div>

      {visibleSelected.length > 0 && (
        <div className="bulk-bar">
          <strong>{visibleSelected.length}개 선택</strong>
          <label className="row gap-s">
            폴더 이동
            <FolderSelect folders={folders} value={null} onChange={bulkMove} />
          </label>
          <div className="row gap-s bulk-tags">
            <TagInput tags={bulkTags} onChange={setBulkTags} suggestions={allTags} placeholder="추가할 태그" />
            <button className="btn" onClick={bulkAddTags} disabled={!bulkTags.length}>태그 추가</button>
          </div>
          <button className="btn" onClick={bulkAnalyze}>🤖 AI 분석</button>
          <button className="btn danger" onClick={bulkDelete}>삭제</button>
          <button className="btn ghost" onClick={() => setSelected(new Set())}>선택 해제</button>
        </div>
      )}

      {reports.length === 0 ? (
        <div className="empty">
          <p>{query ? '검색 결과가 없습니다.' : '아직 보고서가 없습니다.'}</p>
          {!query && (
            <button className="btn primary" onClick={onAdd}>
              ＋ 첫 보고서 추가하기
            </button>
          )}
        </div>
      ) : (
        <ul className="cards">
          {reports.map((r) => (
            <li key={r.id} className={`card ${selected.has(r.id) ? 'selected' : ''}`}>
              <input
                type="checkbox"
                className="card-check"
                aria-label="선택"
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
              />
              <button className="card-body" onClick={() => onOpen(r.id)}>
                <div className="card-title">
                  {r.favorite && <span title="즐겨찾기">⭐</span>}
                  <span className={`badge src-${r.sourceType}`}>{SOURCE_LABEL[r.sourceType]}</span>
                  <strong>{r.title}</strong>
                </div>
                <div className="card-meta">
                  <span>📁 {folderPath(folders, r.folderId)}</span>
                  {r.ai && (
                    <span>
                      📘 {r.ai.subject} › {r.ai.topic}
                    </span>
                  )}
                  {busy.has(r.id) && <span className="ai-busy">🤖 분석 중…</span>}
                  {queue.errors[r.id] && <span className="error-text">⚠ 분석 실패</span>}
                  <span>{r.writtenDate ? r.writtenDate.replaceAll('-', '.') : formatDate(r.createdAt)}</span>
                </div>
                <p className="card-snippet">{snippet(r, query)}</p>
                {r.tags.length > 0 && (
                  <div className="card-tags">
                    {r.tags.map((t) => (
                      <span key={t} className="chip small">#{t}</span>
                    ))}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

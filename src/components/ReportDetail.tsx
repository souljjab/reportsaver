import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteReports, ensureFolder, folderPath, updateReport } from '../db';
import { askConfirm, askText, showAlert } from '../dialogs';
import { enqueueAnalysis, useAiQueue } from '../aiQueue';
import { saveFile } from '../platform';
import { formatDate, SOURCE_LABEL, type Filter } from '../search';
import { useSettings } from '../settings';
import type { AiAnalysis, Folder, Report } from '../types';
import { FolderSelect } from './FolderSelect';
import { TagInput } from './TagInput';

interface Props {
  id: string;
  folders: Folder[];
  allTags: string[];
  onBack: () => void;
  onFilter: (f: Filter) => void;
}

const EXT: Record<Report['sourceType'], string> = { pdf: 'pdf', docx: 'docx', hwp: 'hwp', hwpx: 'hwpx', text: 'txt' };

export function ReportDetail({ id, folders, allTags, onBack, onFilter }: Props) {
  const report = useLiveQuery(() => db.reports.get(id), [id]);
  const queue = useAiQueue();
  const settings = useSettings();
  const [editingContent, setEditingContent] = useState(false);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [title, setTitle] = useState('');

  // 저장된 값이 바뀌면(다른 보고서로 이동, AI 가 제목 제안 등) 입력칸도 맞춘다
  useEffect(() => {
    if (report) setTitle(report.title);
  }, [report?.id, report?.title]);
  useEffect(() => {
    if (report) setNote(report.note);
  }, [report?.id, report?.note]);

  if (report === undefined) return <div className="pad">불러오는 중…</div>;
  if (report === null) return <div className="pad">보고서를 찾을 수 없습니다.</div>;

  const busy = queue.pending.includes(id) || queue.active.includes(id);
  const aiError = queue.errors[id];
  const save = (changes: Partial<Report>) => updateReport(id, changes);
  const ai = report.ai;
  const saveAi = (changes: Partial<AiAnalysis>) => ai && save({ ai: { ...ai, ...changes } });

  const runAi = () => {
    if (!settings.apiKey) return showAlert('설정에서 Claude API 키를 먼저 입력해 주세요.');
    enqueueAnalysis([id]);
  };

  const download = async () => {
    const f = await db.files.get(id);
    if (f) await saveFile(f.blob, report.fileName || `${report.title}.${EXT[report.sourceType]}`);
  };

  const exportText = () => {
    const lines = [
      `# ${report.title}`,
      '',
      `폴더: ${folderPath(folders, report.folderId)}`,
      report.tags.length ? `태그: ${report.tags.map((t) => '#' + t).join(' ')}` : '',
      ai ? `과목: ${ai.subject} / 주제: ${ai.topic}` : '',
      ai ? `키워드: ${ai.keywords.join(', ')}` : '',
      ai ? `\n## 요약\n${ai.summary}` : '',
      report.note ? `\n## 메모\n${report.note}` : '',
      '\n## 본문\n',
      report.content,
    ].filter((l) => l !== '');
    return saveFile(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }), `${report.title}.txt`);
  };

  const unappliedTags = ai ? ai.suggestedTags.filter((t) => !report.tags.includes(t)) : [];
  const currentFolderName = report.folderId ? folders.find((f) => f.id === report.folderId)?.name : null;

  return (
    <article className="detail">
      <div className="detail-top">
        <button className="btn ghost" onClick={onBack}>← 목록</button>
        <div className="row gap wrap">
          <button className="btn" onClick={() => save({ favorite: !report.favorite })}>
            {report.favorite ? '⭐ 즐겨찾기 해제' : '☆ 즐겨찾기'}
          </button>
          {report.hasFile && <button className="btn" onClick={download}>⬇ 원본 파일</button>}
          <button className="btn" onClick={exportText}>⬇ 텍스트로 내보내기</button>
          <button
            className="btn danger"
            onClick={async () => {
              if (await askConfirm(`'${report.title}' 보고서를 삭제할까요? 되돌릴 수 없습니다.`, true)) {
                await deleteReports([id]);
                onBack();
              }
            }}
          >
            삭제
          </button>
        </div>
      </div>

      <input
        className="title-input"
        value={title}
        aria-label="제목"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title !== report.title && save({ title: title.trim() })}
      />
      <p className="muted small">
        <span className={`badge src-${report.sourceType}`}>{SOURCE_LABEL[report.sourceType]}</span>{' '}
        {report.fileName && <>{report.fileName} · </>}
        {report.content.length.toLocaleString()}자 · 추가 {formatDate(report.createdAt)} · 수정 {formatDate(report.updatedAt)}
      </p>

      <div className="detail-grid">
        <section className="panel">
          <h3>내 분류</h3>
          <label className="field">
            <span>폴더</span>
            <FolderSelect folders={folders} value={report.folderId} onChange={(folderId) => save({ folderId })} />
          </label>
          <label className="field">
            <span>작성일</span>
            <input type="date" value={report.writtenDate} onChange={(e) => save({ writtenDate: e.target.value })} />
          </label>
          <div className="field">
            <span>태그</span>
            <TagInput tags={report.tags} onChange={(tags) => save({ tags })} suggestions={allTags} />
          </div>
          <label className="field">
            <span>메모</span>
            <textarea
              rows={3}
              value={note}
              placeholder="이 보고서에 대한 메모 (점수, 피드백 등)"
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => note !== report.note && save({ note })}
            />
          </label>
        </section>

        <section className="panel ai-panel">
          <div className="row between">
            <h3>🤖 AI 분류 · 요약</h3>
            <button className="btn primary" onClick={runAi} disabled={busy}>
              {busy ? '분석 중…' : ai ? '다시 분석' : 'AI 분석'}
            </button>
          </div>
          {aiError && <p className="error-text">⚠ {aiError}</p>}
          {!ai && !busy && !aiError && (
            <p className="muted">
              Claude AI 가 과목·주제·키워드를 자동으로 분류하고 요약합니다.
              {!settings.apiKey && ' (설정에서 API 키 입력 필요)'}
            </p>
          )}
          {ai && (
            <>
              <dl className="ai-fields">
                <dt>과목</dt>
                <dd>
                  <button className="link" onClick={() => onFilter({ kind: 'subject', subject: ai.subject })}>{ai.subject}</button>
                  <button className="icon-btn" title="수정" onClick={async () => {
                    const v = await askText('과목 수정', ai.subject);
                    if (v) await saveAi({ subject: v });
                  }}>✎</button>
                </dd>
                <dt>주제</dt>
                <dd>
                  <button className="link" onClick={() => onFilter({ kind: 'subject', subject: ai.subject, topic: ai.topic })}>{ai.topic}</button>
                  <button className="icon-btn" title="수정" onClick={async () => {
                    const v = await askText('주제 수정', ai.topic);
                    if (v) await saveAi({ topic: v });
                  }}>✎</button>
                </dd>
                <dt>키워드</dt>
                <dd className="wrap-chips">
                  {ai.keywords.map((k) => (
                    <button key={k} className="chip clickable" onClick={() => onFilter({ kind: 'keyword', keyword: k })}>{k}</button>
                  ))}
                  <button className="icon-btn" title="수정" onClick={async () => {
                    const v = await askText('키워드 수정 (쉼표로 구분)', ai.keywords.join(', '));
                    if (v !== null) await saveAi({ keywords: [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean))] });
                  }}>✎</button>
                </dd>
              </dl>
              <h4>요약</h4>
              <p className="summary">{ai.summary}</p>
              {(unappliedTags.length > 0 || (ai.suggestedFolder && ai.suggestedFolder !== currentFolderName)) && (
                <div className="suggest">
                  <h4>AI 제안</h4>
                  {unappliedTags.length > 0 && (
                    <div className="row gap wrap">
                      <span className="small">태그:</span>
                      {unappliedTags.map((t) => (
                        <button key={t} className="chip clickable suggest-chip" title="클릭하면 태그에 추가"
                          onClick={() => save({ tags: [...report.tags, t] })}>＋ #{t}</button>
                      ))}
                      <button className="btn small" onClick={() => save({ tags: [...report.tags, ...unappliedTags] })}>모두 추가</button>
                    </div>
                  )}
                  {ai.suggestedFolder && ai.suggestedFolder !== currentFolderName && (
                    <div className="row gap wrap">
                      <span className="small">폴더:</span>
                      <button className="btn small" onClick={async () => save({ folderId: await ensureFolder(ai.suggestedFolder) })}>
                        📁 '{ai.suggestedFolder}'(으)로 이동
                      </button>
                    </div>
                  )}
                </div>
              )}
              <p className="muted small">분석: {formatDate(ai.analyzedAt)} · {ai.model}</p>
            </>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="row between">
          <h3>본문</h3>
          {editingContent ? (
            <div className="row gap">
              <button className="btn" onClick={() => setEditingContent(false)}>취소</button>
              <button className="btn primary" onClick={async () => {
                await save({ content: draft });
                setEditingContent(false);
              }}>저장</button>
            </div>
          ) : (
            <button className="btn" onClick={() => {
              setDraft(report.content);
              setEditingContent(true);
            }}>✎ 본문 수정</button>
          )}
        </div>
        {editingContent ? (
          <textarea className="content-edit" value={draft} onChange={(e) => setDraft(e.target.value)} />
        ) : (
          <div className="content-view">{report.content || <span className="muted">(본문 없음)</span>}</div>
        )}
      </section>
    </article>
  );
}

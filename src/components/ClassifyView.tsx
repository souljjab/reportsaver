import { useMemo, useState } from 'react';
import { db } from '../db';
import { askText, showAlert } from '../dialogs';
import { enqueueAnalysis, useAiQueue } from '../aiQueue';
import type { Filter } from '../search';
import { useSettings } from '../settings';
import type { Report } from '../types';

interface Props {
  reports: Report[];
  onFilter: (f: Filter) => void;
  onOpen: (id: string) => void;
}

/** 과목·주제 이름을 여러 보고서에 걸쳐 한꺼번에 바꾸거나 합친다 */
async function renameAi(match: (r: Report) => boolean, change: (r: Report) => Partial<NonNullable<Report['ai']>>) {
  await db.reports.toCollection().modify((r) => {
    if (r.ai && match(r)) {
      r.ai = { ...r.ai, ...change(r) };
      r.updatedAt = Date.now();
    }
  });
}

export function ClassifyView({ reports, onFilter, onOpen }: Props) {
  const settings = useSettings();
  const queue = useAiQueue();
  const [open, setOpen] = useState<Set<string>>(new Set());

  const tree = useMemo(() => {
    const subjects = new Map<string, Map<string, Report[]>>();
    for (const r of reports) {
      if (!r.ai) continue;
      const s = r.ai.subject || '(과목 없음)';
      const t = r.ai.topic || '(주제 없음)';
      if (!subjects.has(s)) subjects.set(s, new Map());
      const topics = subjects.get(s)!;
      if (!topics.has(t)) topics.set(t, []);
      topics.get(t)!.push(r);
    }
    return [...subjects]
      .map(([s, topics]) => ({
        subject: s,
        count: [...topics.values()].reduce((n, l) => n + l.length, 0),
        topics: [...topics].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ko')),
      }))
      .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject, 'ko'));
  }, [reports]);

  const keywords = useMemo(() => {
    const m = new Map<string, number>();
    reports.forEach((r) => r.ai?.keywords.forEach((k) => m.set(k, (m.get(k) ?? 0) + 1)));
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
  }, [reports]);

  const unanalyzed = reports.filter((r) => !r.ai);
  const running = queue.pending.length + queue.active.length > 0;
  const maxKw = keywords[0]?.[1] ?? 1;

  const toggle = (key: string) => {
    const next = new Set(open);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpen(next);
  };

  return (
    <div className="classify">
      <div className="list-head">
        <h2>분류 정리</h2>
      </div>

      <section className="panel">
        <div className="row between wrap gap">
          <div>
            <h3>AI 자동 분류</h3>
            <p className="muted small">
              전체 {reports.length}개 중 {reports.length - unanalyzed.length}개 분석 완료 · 미분석 {unanalyzed.length}개
            </p>
          </div>
          <div className="row gap wrap">
            <button
              className="btn primary"
              disabled={!unanalyzed.length || running}
              onClick={() => {
                if (!settings.apiKey) return showAlert('설정에서 Claude API 키를 먼저 입력해 주세요.');
                enqueueAnalysis(unanalyzed.map((r) => r.id));
              }}
            >
              미분석 {unanalyzed.length}개 분석
            </button>
            <button
              className="btn"
              disabled={!reports.length || running}
              onClick={() => {
                if (!settings.apiKey) return showAlert('설정에서 Claude API 키를 먼저 입력해 주세요.');
                enqueueAnalysis(reports.map((r) => r.id));
              }}
              title="이미 분석한 보고서도 다시 분석합니다. 기존 분류 체계를 참고해 이름을 통일합니다."
            >
              전체 다시 분석
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>과목 › 주제별 보고서</h3>
        <p className="muted small">과목·주제 이름 옆 ✎ 를 누르면 해당하는 모든 보고서의 이름이 함께 바뀝니다. 같은 이름으로 바꾸면 하나로 합쳐집니다.</p>
        {tree.length === 0 && <p className="muted">아직 AI 분석된 보고서가 없습니다.</p>}
        <ul className="subject-tree">
          {tree.map(({ subject, count, topics }) => (
            <li key={subject}>
              <div className="subject-row">
                <button className="twisty" onClick={() => toggle(subject)}>{open.has(subject) ? '▾' : '▸'}</button>
                <button className="link strong" onClick={() => onFilter({ kind: 'subject', subject })}>📘 {subject}</button>
                <span className="count">{count}</span>
                <button className="icon-btn" title="과목 이름 바꾸기/합치기" onClick={async () => {
                  const v = await askText(`'${subject}' 과목 이름 바꾸기 (기존 과목 이름을 입력하면 합쳐집니다)`, subject);
                  if (v && v !== subject) await renameAi((r) => r.ai?.subject === subject, () => ({ subject: v }));
                }}>✎</button>
              </div>
              {open.has(subject) && (
                <ul>
                  {topics.map(([topic, list]) => (
                    <li key={topic}>
                      <div className="topic-row">
                        <button className="twisty" onClick={() => toggle(subject + '\u0000' + topic)}>
                          {open.has(subject + '\u0000' + topic) ? '▾' : '▸'}
                        </button>
                        <button className="link" onClick={() => onFilter({ kind: 'subject', subject, topic })}>{topic}</button>
                        <span className="count">{list.length}</span>
                        <button className="icon-btn" title="주제 이름 바꾸기/합치기" onClick={async () => {
                          const v = await askText(`'${topic}' 주제 이름 바꾸기`, topic);
                          if (v && v !== topic) await renameAi((r) => r.ai?.subject === subject && r.ai?.topic === topic, () => ({ topic: v }));
                        }}>✎</button>
                      </div>
                      {open.has(subject + '\u0000' + topic) && (
                        <ul className="report-links">
                          {list.map((r) => (
                            <li key={r.id}>
                              <button className="link" onClick={() => onOpen(r.id)}>📄 {r.title}</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>키워드 모아보기</h3>
        {keywords.length === 0 && <p className="muted">키워드가 없습니다.</p>}
        <div className="keyword-cloud">
          {keywords.map(([k, n]) => (
            <button
              key={k}
              className="chip clickable"
              style={{ fontSize: `${0.8 + 0.5 * (n / maxKw)}rem` }}
              onClick={() => onFilter({ kind: 'keyword', keyword: k })}
            >
              {k} <small>{n}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

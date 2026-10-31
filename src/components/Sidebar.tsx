import { useMemo, useState } from 'react';
import { db, deleteFolder, newId } from '../db';
import { askConfirm, askText } from '../dialogs';
import type { Filter } from '../search';
import type { Folder, Report } from '../types';

interface Props {
  reports: Report[];
  folders: Folder[];
  filter: Filter;
  onFilter: (f: Filter) => void;
}

export function Sidebar({ reports, folders, filter, onFilter }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const byFolder = new Map<string, number>();
    const byTag = new Map<string, number>();
    let unfiled = 0, fav = 0, unanalyzed = 0;
    for (const r of reports) {
      if (r.folderId) byFolder.set(r.folderId, (byFolder.get(r.folderId) ?? 0) + 1);
      else unfiled++;
      if (r.favorite) fav++;
      if (!r.ai) unanalyzed++;
      r.tags.forEach((t) => byTag.set(t, (byTag.get(t) ?? 0) + 1));
    }
    return { byFolder, byTag, unfiled, fav, unanalyzed };
  }, [reports]);

  const children = useMemo(() => {
    const m = new Map<string | null, Folder[]>();
    for (const f of folders) {
      const k = f.parentId && folders.some((p) => p.id === f.parentId) ? f.parentId : null;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(f);
    }
    m.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name, 'ko')));
    return m;
  }, [folders]);

  const subtreeCount = (id: string): number =>
    (counts.byFolder.get(id) ?? 0) + (children.get(id) ?? []).reduce((s, c) => s + subtreeCount(c.id), 0);

  const addFolder = async (parentId: string | null) => {
    const name = await askText(parentId ? '하위 폴더 이름' : '새 폴더 이름');
    if (name) await db.folders.add({ id: newId(), name, parentId, createdAt: Date.now() });
  };

  const renderFolder = (f: Folder, depth: number) => {
    const kids = children.get(f.id) ?? [];
    const isOpen = !collapsed.has(f.id);
    const active = filter.kind === 'folder' && filter.id === f.id;
    return (
      <li key={f.id}>
        <div className={`nav-item folder ${active ? 'active' : ''}`} style={{ paddingLeft: 8 + depth * 14 }}>
          <button
            className="twisty"
            aria-label={isOpen ? '접기' : '펼치기'}
            style={{ visibility: kids.length ? 'visible' : 'hidden' }}
            onClick={() => {
              const next = new Set(collapsed);
              if (isOpen) next.add(f.id);
              else next.delete(f.id);
              setCollapsed(next);
            }}
          >
            {isOpen ? '▾' : '▸'}
          </button>
          <button className="nav-label" onClick={() => onFilter({ kind: 'folder', id: f.id })}>
            📁 {f.name}
          </button>
          <span className="count">{subtreeCount(f.id)}</span>
          <span className="folder-actions">
            <button title="하위 폴더 추가" onClick={() => addFolder(f.id)}>＋</button>
            <button
              title="이름 바꾸기"
              onClick={async () => {
                const name = await askText('폴더 이름 바꾸기', f.name);
                if (name) await db.folders.update(f.id, { name });
              }}
            >
              ✎
            </button>
            <button
              title="삭제"
              onClick={async () => {
                if (await askConfirm(`'${f.name}' 폴더와 하위 폴더를 삭제할까요?\n안에 있던 보고서는 '미분류'로 옮겨집니다.`, true)) {
                  await deleteFolder(f.id);
                  if (active) onFilter({ kind: 'all' });
                }
              }}
            >
              🗑
            </button>
          </span>
        </div>
        {isOpen && kids.length > 0 && <ul>{kids.map((k) => renderFolder(k, depth + 1))}</ul>}
      </li>
    );
  };

  const navItem = (label: string, f: Filter, count: number) => {
    const active = filter.kind === f.kind && (f.kind !== 'tag' || (filter.kind === 'tag' && filter.tag === f.tag));
    return (
      <div className={`nav-item ${active ? 'active' : ''}`}>
        <button className="nav-label" onClick={() => onFilter(f)}>
          {label}
        </button>
        <span className="count">{count}</span>
      </div>
    );
  };

  const tags = [...counts.byTag].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));

  return (
    <nav className="sidebar-inner">
      <section>
        {navItem('📚 전체 보고서', { kind: 'all' }, reports.length)}
        {navItem('⭐ 즐겨찾기', { kind: 'favorite' }, counts.fav)}
        {navItem('📥 미분류', { kind: 'unfiled' }, counts.unfiled)}
        {navItem('🤖 AI 미분석', { kind: 'unanalyzed' }, counts.unanalyzed)}
      </section>
      <section>
        <div className="section-head">
          <span>폴더</span>
          <button className="link" onClick={() => addFolder(null)}>＋ 새 폴더</button>
        </div>
        <ul className="tree">{(children.get(null) ?? []).map((f) => renderFolder(f, 0))}</ul>
        {folders.length === 0 && <p className="muted small pad">폴더가 없습니다.</p>}
      </section>
      <section>
        <div className="section-head">
          <span>태그</span>
        </div>
        {tags.length === 0 && <p className="muted small pad">태그가 없습니다.</p>}
        <div className="tag-cloud">
          {tags.map(([t, n]) => (
            <button
              key={t}
              className={`chip clickable ${filter.kind === 'tag' && filter.tag === t ? 'active' : ''}`}
              onClick={() => onFilter({ kind: 'tag', tag: t })}
            >
              #{t} <small>{n}</small>
            </button>
          ))}
        </div>
      </section>
    </nav>
  );
}

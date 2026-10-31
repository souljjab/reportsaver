import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, folderPath } from './db';
import { DialogHost } from './dialogs';
import { isNative } from './platform';
import { matchesFilter, matchesQuery, sortReports, type Filter, type SortKey } from './search';
import { AddReportDialog } from './components/AddReportDialog';
import { AiStatusBar } from './components/AiStatusBar';
import { ClassifyView } from './components/ClassifyView';
import { ReportDetail } from './components/ReportDetail';
import { ReportList } from './components/ReportList';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import type { Folder } from './types';

type View = 'list' | 'classify' | 'settings';

function descendantIds(folders: Folder[], id: string): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return ids;
}

export default function App() {
  const reports = useLiveQuery(() => db.reports.toArray(), []);
  const folders = useLiveQuery(() => db.folders.toArray(), []);
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');
  const [view, setView] = useState<View>('list');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [drawer, setDrawer] = useState(false);

  const allTags = useMemo(
    () => [...new Set((reports ?? []).flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, 'ko')),
    [reports],
  );

  const visible = useMemo(() => {
    if (!reports || !folders) return [];
    const ids = filter.kind === 'folder' ? descendantIds(folders, filter.id) : undefined;
    return sortReports(
      reports.filter((r) => matchesFilter(r, filter, ids) && matchesQuery(r, query)),
      sort,
    );
  }, [reports, folders, filter, query, sort]);

  // Android 뒤로 가기 버튼: 열린 창 → 상세 → 다른 화면 순서로 닫고, 목록에서는 앱 종료
  const navRef = useRef({ adding, openId, view, drawer });
  navRef.current = { adding, openId, view, drawer };
  useEffect(() => {
    if (!isNative) return;
    let remove: (() => void) | undefined;
    void import('@capacitor/app').then(({ App: CapApp }) =>
      CapApp.addListener('backButton', () => {
        const s = navRef.current;
        if (s.adding) setAdding(false);
        else if (s.drawer) setDrawer(false);
        else if (s.openId) setOpenId(null);
        else if (s.view !== 'list') setView('list');
        else void CapApp.exitApp();
      }).then((h) => (remove = () => void h.remove())),
    );
    return () => remove?.();
  }, []);

  if (!reports || !folders) return <div className="loading">불러오는 중…</div>;

  const goFilter = (f: Filter) => {
    setFilter(f);
    setView('list');
    setOpenId(null);
    setDrawer(false);
  };

  const filterTitle = (() => {
    switch (filter.kind) {
      case 'all': return '전체 보고서';
      case 'favorite': return '즐겨찾기';
      case 'unfiled': return '미분류';
      case 'unanalyzed': return 'AI 미분석';
      case 'folder': return '📁 ' + folderPath(folders, filter.id);
      case 'tag': return '#' + filter.tag;
      case 'subject': return '📘 ' + filter.subject + (filter.topic ? ' › ' + filter.topic : '');
      case 'keyword': return '🔑 ' + filter.keyword;
    }
  })();

  return (
    <div className={`app ${drawer ? 'drawer-open' : ''}`}>
      <header className="topbar">
        <button className="btn ghost menu-btn" aria-label="메뉴" onClick={() => setDrawer(!drawer)}>☰</button>
        <button className="brand" onClick={() => goFilter({ kind: 'all' })}>
          <img src="./icon.svg" alt="" width={26} height={26} /> <span>ReportSaver</span>
        </button>
        <input
          className="search"
          type="search"
          placeholder="제목·본문·태그·키워드 검색"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setView('list');
            setOpenId(null);
          }}
        />
        <nav className="top-actions">
          <button className={`btn ghost ${view === 'classify' ? 'active' : ''}`} onClick={() => { setView('classify'); setOpenId(null); }}>
            🗂 <span className="hide-sm">분류 정리</span>
          </button>
          <button className={`btn ghost ${view === 'settings' ? 'active' : ''}`} onClick={() => { setView('settings'); setOpenId(null); }}>
            ⚙ <span className="hide-sm">설정</span>
          </button>
          <button className="btn primary" onClick={() => setAdding(true)}>
            ＋ <span className="hide-sm">보고서 추가</span>
          </button>
        </nav>
      </header>

      <aside className="sidebar">
        <Sidebar reports={reports} folders={folders} filter={filter} onFilter={goFilter} />
      </aside>
      <div className="drawer-scrim" onClick={() => setDrawer(false)} />

      <main className="main">
        {openId ? (
          <ReportDetail id={openId} folders={folders} allTags={allTags} onBack={() => setOpenId(null)} onFilter={goFilter} />
        ) : view === 'classify' ? (
          <ClassifyView reports={reports} onFilter={goFilter} onOpen={setOpenId} />
        ) : view === 'settings' ? (
          <SettingsView reportCount={reports.length} />
        ) : (
          <ReportList
            title={query ? `'${query}' 검색 · ${filterTitle}` : filterTitle}
            reports={visible}
            folders={folders}
            allTags={allTags}
            query={query}
            sort={sort}
            onSort={setSort}
            onOpen={setOpenId}
            onAdd={() => setAdding(true)}
          />
        )}
      </main>

      {adding && (
        <AddReportDialog
          folders={folders}
          allTags={allTags}
          defaultFolderId={filter.kind === 'folder' ? filter.id : null}
          onClose={() => setAdding(false)}
          onOpen={(id) => {
            setAdding(false);
            setView('list');
            setOpenId(id);
          }}
        />
      )}
      <AiStatusBar />
      <DialogHost />
    </div>
  );
}

// Windows 데스크톱 앱 (Electron). 웹 빌드 결과물(dist)을 app:// 프로토콜로 불러온다.
// file:// 대신 전용 프로토콜을 쓰면 IndexedDB 저장소와 Claude API 호출(CORS)이 안정적으로 동작한다.
const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const DIST = path.join(__dirname, '..', 'dist');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    title: 'ReportSaver',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // 외부 링크(API 키 발급 페이지 등)는 기본 브라우저로 연다
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) {
      e.preventDefault();
      if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    }
  });
  void win.loadURL('app://bundle/index.html');
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const target = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
    if (!target.startsWith(DIST)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(target).toString());
  });
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

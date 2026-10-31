# ReportSaver — 보고서 보관·분류·요약 프로그램

지금까지 작성한 보고서를 **파일로 올리거나 텍스트로 붙여넣어** 한곳에 모으고,
**폴더·태그로 직접 정리**하거나 **Claude AI 로 과목 → 주제 → 키워드 자동 분류 + 요약**을 할 수 있는 프로그램입니다.

같은 코드로 세 가지 형태를 만듭니다.

| 형태 | 결과물 | 설명 |
|---|---|---|
| 🌐 웹 | GitHub Pages 주소 | 브라우저에서 바로 사용 |
| 🪟 Windows | `ReportSaver-Setup-x.y.z.exe` (설치형), `ReportSaver-Portable-x.y.z.exe` (설치 없이 실행) | Electron |
| 🤖 Android | `ReportSaver-x.y.z.apk` | Capacitor |

## 주요 기능

- **올리기**: PDF, Word(.docx), 한글(.hwp, .hwpx), 텍스트(.txt) 파일 — 여러 개 동시에 끌어다 놓기 가능 / 텍스트 직접 붙여넣기
  - 파일에서 본문 텍스트를 자동 추출하고, 원본 파일도 함께 보관 (언제든 다시 내려받기)
- **직접 정리**: 폴더(하위 폴더 포함), 태그, 즐겨찾기, 작성일, 메모, 여러 개 선택 후 한꺼번에 폴더 이동·태그 추가
- **AI 자동 분류·요약 (Claude API)**: 과목 / 주제 / 키워드 / 요약 / 추천 태그 / 추천 폴더 / 제목 제안
  - 이미 있는 과목·태그·폴더 이름을 참고해 같은 과목이 여러 이름으로 흩어지지 않게 분류
  - 추천 태그·폴더는 클릭 한 번으로 적용하거나, 설정에서 자동 적용
- **분류 정리 화면**: 과목 › 주제별 트리, 키워드 모아보기, 과목·주제 이름 일괄 변경/합치기, 미분석 보고서 일괄 분석
- **검색**: 제목·본문·메모·태그·AI 분류를 모두 대상으로 검색
- **백업**: 전체 데이터를 JSON 파일로 내보내기/가져오기 (PC ↔ 휴대폰 이동용)

## 사용 방법

1. 앱을 열고 오른쪽 위 **＋ 보고서 추가**로 파일을 올리거나 텍스트를 붙여넣습니다.
2. AI 분류를 쓰려면 **⚙ 설정**에서 Claude API 키를 입력합니다.
   - 키 발급: <https://platform.claude.com/settings/keys> (사용량에 따라 요금 부과)
   - 키는 이 기기에만 저장되며 Claude API 로만 전송됩니다.
   - 기본 모델은 Claude Opus 5.5 이며, 설정에서 Sonnet 5.5 / Haiku 5.5 (더 저렴)로 바꿀 수 있습니다.
3. **🗂 분류 정리**에서 과목·주제·키워드별로 모아 보고, 이름을 다듬습니다.

> 💾 **데이터 저장 위치**: 보고서는 서버가 아니라 각 기기(브라우저/프로그램/앱) 안에 저장됩니다.
> 기기를 바꾸거나 앱을 지우기 전에는 **설정 → 백업 내보내기**를 해 두세요.
> 웹 버전은 브라우저 데이터를 지우면 함께 지워집니다.

### 지원 범위와 제한

- 한글: HWP 5.0 이상(.hwp)과 .hwpx 지원. 암호가 걸린 문서·배포용 문서·HWP 3.0 이하는 읽을 수 없습니다.
- Word: .docx 만 지원 (.doc 는 Word 에서 .docx 로 저장 후 올리기)
- PDF: 텍스트가 들어 있는 PDF 지원. 스캔한 이미지 PDF 는 글자를 추출할 수 없어 텍스트 붙여넣기를 이용하세요.
- 표·각주 등은 순수 텍스트로 추출되며 서식은 유지되지 않습니다.

## 설치 파일 받기 (GitHub Actions)

저장소에 코드를 올리면(push) GitHub Actions 가 자동으로 빌드합니다.

- **Windows / Android**: 저장소의 **Actions** 탭 → 최근 *Build* 실행 → 아래 *Artifacts* 에서
  `ReportSaver-Windows`, `ReportSaver-Android` 다운로드
- **정식 배포(Release)**: `v1.0.0` 같은 태그를 push 하면 Releases 페이지에 exe/apk 가 자동 첨부됩니다.
  ```bash
  git tag v1.0.0 && git push origin v1.0.0
  ```
- **웹**: 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꾸면
  `main` 브랜치에 push 할 때마다 `https://<사용자명>.github.io/reportsaver/` 로 배포됩니다.

### Windows 설치 시 참고
코드 서명 인증서가 없어 처음 실행할 때 "Windows의 PC 보호" 창이 뜰 수 있습니다. **추가 정보 → 실행**을 누르면 됩니다.

### Android 설치 시 참고
APK 파일을 휴대폰에서 열고 "출처를 알 수 없는 앱 설치"를 허용하면 설치됩니다.

**업데이트할 때 데이터를 유지하려면** 항상 같은 키로 서명해야 합니다. 서명 키를 등록하지 않으면 디버그 서명(`-debug.apk`)으로
빌드되며, 빌드마다 키가 달라 새 버전 설치 시 기존 앱을 지워야 할 수 있습니다(→ 먼저 백업!). 서명 키 등록 방법:

```bash
keytool -genkeypair -v -keystore release.jks -alias reportsaver -keyalg RSA -keysize 2048 -validity 10000
```

```bash
base64 -w0 release.jks
```

저장소 **Settings → Secrets and variables → Actions** 에 다음 4개를 추가합니다.

| 이름 | 값 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | 위 base64 출력 |
| `ANDROID_KEYSTORE_PASSWORD` | 키스토어 비밀번호 |
| `ANDROID_KEY_ALIAS` | `reportsaver` |
| `ANDROID_KEY_PASSWORD` | 키 비밀번호 |

`release.jks` 파일과 비밀번호는 잃어버리지 않게 안전한 곳에 보관하세요 (저장소에 올리지 마세요).

## 직접 빌드하기 (개발자용)

Node.js 22 이상이 필요합니다.

```bash
npm install
```

```bash
npm run dev
```

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (http://localhost:5173) |
| `npm run build` | 웹 빌드 → `dist/` |
| `npm test` | 파서 단위 테스트 |
| `npm run electron:dev` | 데스크톱 앱으로 실행 |
| `npm run electron:build` | Windows 설치 파일 빌드 → `release/` (Windows 에서 실행) |
| `npm run android:sync` | 웹 빌드를 Android 프로젝트에 반영 (이후 Android Studio 로 `android/` 열기) |

### 구조

```
src/
  parsers/      파일 → 텍스트 추출 (pdf.js, mammoth, HWPX: JSZip, HWP: cfb + pako 직접 구현)
  ai.ts         Claude API 호출 (구조화 출력으로 과목/주제/키워드/요약 생성)
  aiQueue.ts    여러 보고서 일괄 분석 큐
  db.ts         IndexedDB(Dexie) 저장소
  components/   화면 (목록, 상세, 추가, 분류 정리, 설정)
electron/       Windows 앱 (Electron)
android/        Android 앱 (Capacitor)
```

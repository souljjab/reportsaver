export type SourceType = 'pdf' | 'docx' | 'hwp' | 'hwpx' | 'text';

export interface AiAnalysis {
  /** 과목 (예: 경영학원론, 자료구조) */
  subject: string;
  /** 주제 (예: 마케팅 전략, 이진 탐색 트리) */
  topic: string;
  keywords: string[];
  summary: string;
  /** AI 가 제안하는 태그 — 사용자가 적용 여부를 결정 */
  suggestedTags: string[];
  /** AI 가 제안하는 폴더 이름 */
  suggestedFolder: string;
  model: string;
  analyzedAt: number;
}

export interface Report {
  id: string;
  title: string;
  /** 파일에서 추출했거나 붙여넣은 본문 텍스트 */
  content: string;
  sourceType: SourceType;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  /** 원본 파일이 files 테이블에 보관되어 있는지 */
  hasFile: boolean;
  folderId: string | null;
  tags: string[];
  note: string;
  /** 보고서 작성일 (사용자 입력, YYYY-MM-DD) */
  writtenDate: string;
  favorite: boolean;
  ai?: AiAnalysis;
  createdAt: number;
  updatedAt: number;
}

export interface StoredFile {
  reportId: string;
  blob: Blob;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

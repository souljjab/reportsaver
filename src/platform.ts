import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * 파일 저장(다운로드).
 * - 웹/Windows(Electron): 브라우저 다운로드
 * - Android: 앱 캐시에 쓴 뒤 공유 시트로 넘겨 '파일에 저장'·드라이브 등으로 보낼 수 있게 함
 */
export async function saveFile(blob: Blob, fileName: string): Promise<void> {
  if (isNative) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const data = await blobToBase64(blob);
    const res = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache });
    await Share.share({ title: fileName, files: [res.uri] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export { blobToBase64 };

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

/** iPhone: Teilen-Menü (z. B. „In Dateien sichern“). Sonst normaler Download. */
export async function shareOrDownload(data: BlobPart, fileName: string, type: string, title: string): Promise<ShareResult> {
  const file = new File([data], fileName, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // Teilen nicht möglich – auf Download ausweichen
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

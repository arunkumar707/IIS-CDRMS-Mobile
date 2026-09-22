export async function downloadPdfInBrowser(_html: string, _fileName: string): Promise<void> {
  throw new Error('Browser PDF download is only available on web.');
}

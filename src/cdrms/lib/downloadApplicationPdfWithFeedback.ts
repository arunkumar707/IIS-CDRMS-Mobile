import { Platform } from 'react-native';

import { showAppDialog } from '@/src/cdrms/components/AppDialog';
import {
  downloadApplicationPdf,
  type PdfDownloadResult,
} from '@/src/cdrms/lib/downloadApplicationPdf';
import { openPdfWithChooser } from '@/src/cdrms/lib/pdfFileShare';
import { showPdfDownloadBanner } from '@/src/cdrms/lib/pdfDownloadBanner';
import {
  canUsePdfDownloadNotifications,
  showPdfDownloadCompleteNotification,
  showPdfDownloadErrorNotification,
  showPdfDownloadProgressNotification,
} from '@/src/cdrms/lib/pdfDownloadNotification';
import type { PdfDownloadProgressHandler } from '@/src/cdrms/lib/pdfDownloadProgress';
import type { MobileApplication } from '@/src/api/applications';

function pdfLabel(app: MobileApplication) {
  return `${app.applicationNumber.replace(/[^\w.-]+/g, '_')}-CDR.pdf`;
}

/** Download PDF — progress UI, system notification on APK, banner on web & Expo Go. */
export async function downloadApplicationPdfWithFeedback(
  app: MobileApplication,
  token: string,
  onProgress?: PdfDownloadProgressHandler,
): Promise<PdfDownloadResult> {
  const label = pdfLabel(app);
  const useSystemNotification =
    Platform.OS !== 'web' && (await canUsePdfDownloadNotifications());

  const pushProgress: PdfDownloadProgressHandler = (update) => {
    onProgress?.(update);
    if (useSystemNotification) {
      void showPdfDownloadProgressNotification(label, update.percent, update.label);
      return;
    }
    showPdfDownloadBanner({
      title: `Downloading… ${update.percent}%`,
      body: update.label,
      variant: 'progress',
      percent: update.percent,
    });
  };

  pushProgress({ percent: 0, label: 'Starting…' });

  try {
    const result = await downloadApplicationPdf(app, token, pushProgress);

    if (useSystemNotification) {
      await showPdfDownloadCompleteNotification(
        result.fileName,
        result.fileSizeBytes,
        result.openUri || result.savedPath,
      );
    } else {
      showPdfDownloadBanner({
        title: 'Download completed',
        body: result.fileName,
        variant: 'complete',
        openUri: result.openUri || result.savedPath,
        percent: 100,
      });
    }

    showAppDialog({
      variant: 'success',
      title: 'Download completed',
      message:
        Platform.OS === 'web'
          ? 'The survey report PDF was saved to your downloads.'
          : 'Your PDF has been saved on this device.',
      highlightLabel: 'File',
      highlight: result.fileName,
      hideCancel: Platform.OS === 'web',
      cancelLabel: 'OK',
      confirmLabel: Platform.OS === 'web' ? 'OK' : 'Open PDF',
      onConfirm:
        Platform.OS === 'web'
          ? undefined
          : () => void openPdfWithChooser(result.openUri || result.savedPath),
    });

    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not generate PDF';

    if (useSystemNotification) {
      await showPdfDownloadErrorNotification(label, message);
    } else {
      showPdfDownloadBanner({
        title: 'Download failed',
        body: message,
        variant: 'error',
      });
    }

    showAppDialog({
      variant: 'error',
      title: 'Download failed',
      message,
      hideCancel: true,
      confirmLabel: 'OK',
    });

    throw e;
  }
}

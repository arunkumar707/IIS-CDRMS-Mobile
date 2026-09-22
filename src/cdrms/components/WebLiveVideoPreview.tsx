import { forwardRef, useImperativeHandle } from 'react';

import type {
  WebLiveVideoHandle,
  WebLiveVideoPreviewProps,
} from '@/src/cdrms/components/WebLiveVideoPreview.types';

export type { WebLiveVideoHandle, WebLiveVideoPreviewProps };

/** Native stub — live browser recording lives in `WebLiveVideoPreview.web.tsx`. */
export const WebLiveVideoPreview = forwardRef<
  WebLiveVideoHandle,
  WebLiveVideoPreviewProps
>(function WebLiveVideoPreview(_props, ref) {
  useImperativeHandle(ref, () => ({
    startRecording: () => undefined,
    stopRecording: async () => ({ uri: '', mimeType: '' }),
    captureStill: () => ({ uri: '', width: 0, height: 0 }),
    abort: () => undefined,
  }));
  return null;
});

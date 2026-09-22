export type WebLiveVideoHandle = {
  startRecording: () => void;
  stopRecording: () => Promise<{ uri: string; mimeType: string }>;
  captureStill: () => { uri: string; width: number; height: number };
  abort: () => void;
};

export type WebLiveVideoPreviewProps = {
  facing: 'front' | 'back';
  /** Site photos do not need the mic — requesting both often fails on Android rear cameras. */
  audio?: boolean;
  onReady?: () => void;
  onError?: (message: string) => void;
};

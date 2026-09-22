import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  captureWebStill,
  startWebCameraStream,
  startWebMediaRecorder,
  stopMediaStream,
  stopWebMediaRecorder,
} from '@/src/cdrms/camera/webLiveVideo';
import type {
  WebLiveVideoHandle,
  WebLiveVideoPreviewProps,
} from '@/src/cdrms/components/WebLiveVideoPreview.types';

export type { WebLiveVideoHandle, WebLiveVideoPreviewProps };

const HOST_ID = 'cdrms-web-live-video';

function resolveHost(node: unknown): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (node instanceof HTMLElement) return node;
  const rec = node as { _nativeNode?: unknown; node?: unknown } | null;
  if (rec?._nativeNode instanceof HTMLElement) return rec._nativeNode;
  if (rec?.node instanceof HTMLElement) return rec.node;
  const byId = document.getElementById(HOST_ID);
  return byId instanceof HTMLElement ? byId : null;
}

/** Live `<video>` + MediaRecorder — expo-camera cannot record on web. */
export const WebLiveVideoPreview = forwardRef<
  WebLiveVideoHandle,
  WebLiveVideoPreviewProps
>(function WebLiveVideoPreview({ facing, audio = true, onReady, onError }, ref) {
  const hostNodeRef = useRef<unknown>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  onReadyRef.current = onReady;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    let video: HTMLVideoElement | null = null;

    const tryStart = (attempt: number) => {
      if (cancelled) return;
      const host = resolveHost(hostNodeRef.current);
      if (!host) {
        if (attempt < 12) {
          requestAnimationFrame(() => tryStart(attempt + 1));
          return;
        }
        onErrorRef.current?.('Could not start the camera in this browser.');
        return;
      }
      void startOnHost(host);
    };

    const startOnHost = async (host: HTMLElement) => {
      video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('muted', 'true');
      video.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000';
      host.appendChild(video);
      videoRef.current = video;

      try {
        const stream = await startWebCameraStream(video, facing, audio);
        if (cancelled) {
          stopMediaStream(stream);
          return;
        }
        streamRef.current = stream;
        onReadyRef.current?.();
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error && /notallowed|permission/i.test(err.name + err.message)
            ? 'Allow Camera and Microphone in the browser address bar, then try again.'
            : err instanceof Error
              ? err.message
              : 'Could not start the camera in this browser.';
        onErrorRef.current?.(message);
      }
    };

    const frame = requestAnimationFrame(() => tryStart(0));

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      const rec = recorderRef.current;
      if (rec && rec.state !== 'inactive') {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
      recorderRef.current = null;
      chunksRef.current = [];
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      if (video) {
        video.srcObject = null;
        video.remove();
      }
      videoRef.current = null;
    };
  }, [facing, audio]);

  useImperativeHandle(ref, () => ({
    startRecording: () => {
      const stream = streamRef.current;
      if (!stream || stream.getVideoTracks().length === 0) {
        throw new Error('Camera is not ready. Wait a moment and tap Record again.');
      }
      if (typeof MediaRecorder === 'undefined') {
        throw new Error(
          'This browser cannot record video. Use Chrome or Safari, or record on a phone.',
        );
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        return;
      }
      const { recorder, chunks } = startWebMediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = chunks;
    },
    stopRecording: async () => {
      const recorder = recorderRef.current;
      const chunks = chunksRef.current;
      if (!recorder) {
        throw new Error('Recording did not produce a file. Tap Record and try again.');
      }
      const result = await stopWebMediaRecorder(recorder, chunks);
      recorderRef.current = null;
      chunksRef.current = [];
      return result;
    },
    captureStill: () => {
      const el = videoRef.current;
      if (!el) {
        throw new Error('Camera is not ready. Wait a moment and try again.');
      }
      return captureWebStill(el);
    },
    abort: () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
      }
      recorderRef.current = null;
      chunksRef.current = [];
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      const el = videoRef.current;
      if (el?.srcObject) el.srcObject = null;
    },
  }));

  return (
    <View
      nativeID={HOST_ID}
      collapsable={false}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      ref={(node) => {
        hostNodeRef.current = node;
      }}
    />
  );
});

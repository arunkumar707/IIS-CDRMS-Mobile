/** Browser live video/photo — expo-camera's CameraView often fails on phone rear cameras. */

export function pickWebRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  });
}

async function attachStream(
  videoEl: HTMLVideoElement,
  stream: MediaStream,
): Promise<MediaStream> {
  videoEl.srcObject = stream;
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.setAttribute('playsinline', 'true');
  videoEl.setAttribute('webkit-playsinline', 'true');
  await videoEl.play().catch(() => undefined);
  return stream;
}

function isAndroidBrowser() {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
}

function pickFacingDevice(
  devices: MediaDeviceInfo[],
  facing: 'front' | 'back',
): MediaDeviceInfo | undefined {
  const videos = devices.filter((d) => d.kind === 'videoinput');
  const backRe = /back|rear|environment|world|ultra|wide/i;
  const frontRe = /front|user|face|selfie/i;
  if (facing === 'back') {
    return (
      videos.find((d) => backRe.test(d.label) && !frontRe.test(d.label)) ||
      videos.find((d) => backRe.test(d.label)) ||
      (videos.length > 1 ? videos[videos.length - 1] : videos[0])
    );
  }
  return videos.find((d) => frontRe.test(d.label)) || videos[0];
}

async function gum(
  video: MediaTrackConstraints | boolean,
  audio: boolean,
): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ video, audio });
}

/**
 * Phone Chrome often throws "Could not start video source" if:
 * - facingMode is exact, or
 * - a previous track was not fully released, or
 * - we never enumerate deviceIds after a permission warmup.
 */
async function openCameraStream(
  facing: 'front' | 'back',
  audio: boolean,
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera is not available in this browser.');
  }

  let warmup: MediaStream | null = null;
  try {
    warmup = await gum(true, false);
  } catch {
    warmup = null;
  }
  if (warmup) {
    stopMediaStream(warmup);
    // Android keeps the hardware locked for a beat after stop().
    await wait(isAndroidBrowser() ? 350 : 120);
  }

  const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === 'videoinput',
  );
  const preferred = pickFacingDevice(devices, facing);
  const mode = facing === 'front' ? 'user' : 'environment';

  const attempts: Array<MediaTrackConstraints | boolean> = [];
  if (preferred?.deviceId) {
    attempts.push({ deviceId: { exact: preferred.deviceId } });
  }
  attempts.push({ facingMode: { ideal: mode } });
  attempts.push({ facingMode: mode });
  attempts.push(true);

  let lastError: unknown;
  for (const video of attempts) {
    try {
      return await gum(video, audio);
    } catch (err) {
      lastError = err;
      await wait(220);
      try {
        return await gum(video, false);
      } catch (err2) {
        lastError = err2;
      }
    }
  }

  const raw =
    lastError instanceof Error
      ? lastError.message
      : 'Could not start video source';
  if (/notallowed|permission|denied/i.test(raw + String((lastError as Error)?.name ?? ''))) {
    throw new Error(
      'Allow Camera in the browser address bar, then open this screen again.',
    );
  }
  throw new Error(
    facing === 'back'
      ? 'Could not start the rear camera. Close other camera apps, then try again.'
      : raw || 'Could not start the camera.',
  );
}

export async function startWebCameraStream(
  videoEl: HTMLVideoElement,
  facing: 'front' | 'back',
  audio = true,
): Promise<MediaStream> {
  const stream = await openCameraStream(facing, audio);
  return attachStream(videoEl, stream);
}

export function captureWebStill(videoEl: HTMLVideoElement): {
  uri: string;
  width: number;
  height: number;
} {
  if (videoEl.videoWidth < 2 || videoEl.videoHeight < 2) {
    throw new Error('Camera is not ready. Wait a moment and try again.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not capture photo');
  ctx.drawImage(videoEl, 0, 0);
  return {
    uri: canvas.toDataURL('image/jpeg', 0.85),
    width: canvas.width,
    height: canvas.height,
  };
}

export function startWebMediaRecorder(stream: MediaStream): {
  recorder: MediaRecorder;
  chunks: Blob[];
} {
  const mime = pickWebRecorderMime();
  const recorder = mime
    ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_500_000 })
    : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };
  recorder.start(250);
  return { recorder, chunks };
}

export function stopWebMediaRecorder(
  recorder: MediaRecorder,
  chunks: Blob[],
): Promise<{ uri: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const finish = () => {
      const mimeType = recorder.mimeType || chunks[0]?.type || 'video/webm';
      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size < 64) {
        reject(new Error('Recording did not produce a file. Tap Record and try again.'));
        return;
      }
      resolve({ uri: URL.createObjectURL(blob), mimeType });
    };

    if (recorder.state === 'inactive') {
      finish();
      return;
    }

    recorder.onerror = () => {
      reject(new Error('Video recording failed. Tap Record and try again.'));
    };
    recorder.onstop = finish;
    try {
      if (recorder.state === 'recording') {
        try {
          recorder.requestData();
        } catch {
          /* some browsers throw if requestData is unsupported */
        }
      }
      recorder.stop();
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Could not stop recording'));
    }
  });
}

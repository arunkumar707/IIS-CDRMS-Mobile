import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { API_BASE_URL } from './config';
import { ApiError } from './client';

type UploadResult = {
  id: number;
  image_url: string;
  key: string;
  fileName: string;
  message: string;
};

function entityIdFromUuid(uuid: string): number {
  let h = 0;
  for (const ch of uuid.replace(/-/g, '')) {
    h = (Math.imul(h, 31) + parseInt(ch, 16)) >>> 0;
  }
  return h % 2147483646 || 1;
}

function guessMime(uri: string, kind: 'image' | 'video'): string {
  const lower = uri.toLowerCase();
  if (kind === 'video') {
    if (lower.includes('.mov')) return 'video/quicktime';
    if (lower.includes('.webm')) return 'video/webm';
    if (lower.includes('.m4v')) return 'video/x-m4v';
    if (lower.includes('.3gp')) return 'video/3gpp';
    return 'video/mp4';
  }
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function fileNameFromUri(uri: string, kind: 'image' | 'video', refKey: string) {
  const lower = uri.toLowerCase();
  const ext =
    kind === 'video'
      ? lower.includes('.mov')
        ? 'mov'
        : lower.includes('.webm')
          ? 'webm'
          : lower.includes('.m4v')
            ? 'm4v'
            : 'mp4'
      : lower.includes('.png')
        ? 'png'
        : 'jpg';
  // Safe ASCII name so Multer originalname always has the video extension.
  const safeKey = refKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'media';
  return `${safeKey}.${ext}`;
}

function networkHint(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/network request failed|failed to fetch|network error/i.test(msg)) {
    return (
      `Network request failed. Phone cannot reach ${API_BASE_URL}. ` +
      `Confirm backend is up and EXPO_PUBLIC_API_URL points at UAT.`
    );
  }
  return msg || 'Upload failed';
}

async function blobFromUri(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  if (!res.ok) {
    throw new Error(`Could not read file (${res.status})`);
  }
  return res.blob();
}

/** Browser multipart upload — `FileSystem.uploadAsync` is native-only. */
async function uploadViaFetch(params: {
  uploadUrl: string;
  fileUri: string;
  fileName: string;
  mime: string;
  kind: 'image' | 'video';
  token: string;
}): Promise<{ status: number; bodyText: string }> {
  const blob = await blobFromUri(params.fileUri);
  const type =
    (blob.type && blob.type !== 'application/octet-stream' ? blob.type : params.mime) ||
    'application/octet-stream';
  let fileName = params.fileName;
  if (type.includes('webm') && !fileName.toLowerCase().endsWith('.webm')) {
    fileName = `${fileName.replace(/\.[^.]+$/, '') || 'video'}.webm`;
  } else if (
    (type.includes('mp4') || type === 'video/quicktime') &&
    !/\.(mp4|mov|m4v)$/i.test(fileName)
  ) {
    fileName = `${fileName.replace(/\.[^.]+$/, '') || 'video'}.mp4`;
  }
  const file =
    typeof File !== 'undefined' ? new File([blob], fileName, { type }) : blob;
  const form = new FormData();
  (form as unknown as { append: (name: string, value: Blob, fileName?: string) => void }).append(
    'file',
    file,
    fileName,
  );
  form.append('filename', fileName);
  form.append('mediaKind', params.kind);

  const res = await fetch(params.uploadUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: form,
  });
  return { status: res.status, bodyText: await res.text() };
}

/**
 * Copy to a cache file whose path ends with .mp4/.jpg so Multer originalname
 * always carries a valid extension (required by backend validation).
 */
async function ensureUploadableUri(
  uri: string,
  kind: 'image' | 'video',
  fileName: string,
): Promise<string> {
  const trimmed = uri.trim();
  if (Platform.OS === 'web') return trimmed;
  const cache = FileSystem.cacheDirectory;
  if (!cache) return trimmed;

  const dest = `${cache}cdrms-upload-${Date.now()}-${fileName}`;
  try {
    await FileSystem.copyAsync({ from: trimmed, to: dest });
    return dest;
  } catch {
    if (trimmed.startsWith('file://') && /\.(mp4|mov|webm|m4v|jpe?g|png)$/i.test(trimmed)) {
      return trimmed;
    }
    return trimmed;
  }
}

/**
 * Upload a local file URI to MinIO via the Nest object-store API.
 * Videos send mediaKind=video so .mp4 is accepted on BE.
 */
export async function uploadMobileMedia(params: {
  token: string;
  applicationId: string;
  refKey: string;
  uri: string;
  kind: 'image' | 'video';
}): Promise<string> {
  const { token, applicationId, refKey, uri, kind } = params;
  const fileName = fileNameFromUri(uri, kind, refKey);
  const fileUri = await ensureUploadableUri(uri, kind, fileName);
  const mime = guessMime(fileUri, kind);

  const qs = new URLSearchParams({
    entityType: 'DOCUMENT',
    entityId: String(entityIdFromUuid(applicationId)),
    refType: kind === 'video' ? 'OTHER' : 'LAYOUT_IMAGE',
    refId: `${applicationId}:${refKey}`,
    mediaKind: kind,
  });

  const uploadUrl = `${API_BASE_URL}/object-store/upload?${qs.toString()}`;

  let status = 0;
  let bodyText = '';

  try {
    if (Platform.OS === 'web') {
      const result = await uploadViaFetch({
        uploadUrl,
        fileUri,
        fileName,
        mime,
        kind,
        token,
      });
      status = result.status;
      bodyText = result.bodyText;
    } else {
      const result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: mime,
        parameters: {
          filename: fileName,
          mediaKind: kind,
        },
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      });
      status = result.status;
      bodyText = result.body ?? '';
    }
  } catch (err) {
    throw new ApiError(0, networkHint(err));
  }

  let data: unknown = null;
  if (bodyText) {
    try {
      data = JSON.parse(bodyText);
    } catch {
      data = bodyText;
    }
  }

  if (status < 200 || status >= 300) {
    const msg =
      data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof (data as { message: unknown }).message === 'string'
        ? (data as { message: string }).message
        : Array.isArray(
              data &&
                typeof data === 'object' &&
                'message' in data &&
                (data as { message: unknown }).message,
            )
          ? String(((data as { message: unknown[] }).message || []).join(', '))
          : `Upload failed (${status || 'network'})`;

    if (status >= 500 || status === 0) {
      try {
        const existing = await fetch(
          `${API_BASE_URL}/object-store/by-ref?refId=${encodeURIComponent(`${applicationId}:${refKey}`)}`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (existing.ok) {
          const body = (await existing.json()) as { image_url?: string };
          if (body.image_url) return body.image_url;
        }
      } catch {
        /* fall through */
      }
    }
    throw new ApiError(status || 0, msg);
  }

  const url = String((data as UploadResult)?.image_url || '');
  if (!url) throw new ApiError(500, 'Upload returned no URL');
  return url;
}

/** Same as web `deleteObjectStoreFile` — clear by URL and/or refId. */
export async function deleteMobileMedia(params: {
  token: string;
  url?: string;
  refId?: string;
}): Promise<void> {
  const { token, url, refId } = params;
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  if (url && !url.startsWith('data:') && /^https?:\/\//i.test(url)) {
    const qs = new URLSearchParams({ url });
    try {
      const res = await fetch(`${API_BASE_URL}/object-store/by-url?${qs.toString()}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) return;
    } catch (err) {
      throw new ApiError(0, networkHint(err));
    }
  }

  if (refId) {
    const qs = new URLSearchParams({ refId });
    try {
      const res = await fetch(`${API_BASE_URL}/object-store/by-ref?${qs.toString()}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok && res.status !== 404) {
        const text = await res.text().catch(() => '');
        throw new ApiError(res.status, text || `Delete failed (${res.status})`);
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, networkHint(err));
    }
  }
}

import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { API_BASE_URL } from '@/src/api/config';

/** True for http(s) media already stored via the API / object-store. */
export function isRemoteMediaUri(uri: string | null | undefined): boolean {
  return Boolean(uri && /^https?:\/\//i.test(uri.trim()));
}

function isLocalMediaUri(uri: string): boolean {
  return (
    uri.startsWith('file://') ||
    uri.startsWith('blob:') ||
    uri.startsWith('content://') ||
    uri.startsWith('data:') ||
    uri.startsWith('ph://') ||
    uri.startsWith('assets-library://')
  );
}

/** Authenticated object-store proxy URL (same as web view-by-url). */
export function objectStoreProxyUrl(storedUrl: string): string {
  return `${API_BASE_URL}/object-store/view-by-url?url=${encodeURIComponent(storedUrl.trim())}`;
}

/** Fetch MinIO/object-store media with JWT — `<img src>` cannot send Authorization. */
export async function fetchAuthenticatedMediaBlob(
  storedUrl: string,
  token: string,
): Promise<Blob> {
  const res = await fetch(objectStoreProxyUrl(storedUrl), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: '*/*',
    },
  });
  if (!res.ok) {
    throw new Error(`Media fetch failed (${res.status})`);
  }
  const blob = await res.blob();
  if (blob.size < 32) {
    throw new Error('Media file empty');
  }
  return blob;
}

/**
 * Build a source for RN Image/Video.
 * Prefer `useResolvedMediaUri` for remote URLs — Image headers are unreliable on device.
 */
export function mediaSource(
  uri: string | null | undefined,
  token: string | null | undefined
): { uri: string; headers?: Record<string, string> } | null {
  if (!uri?.trim()) return null;
  const trimmed = uri.trim();

  if (isLocalMediaUri(trimmed)) {
    return { uri: trimmed };
  }

  if (!isRemoteMediaUri(trimmed)) {
    return { uri: trimmed };
  }

  const proxy = objectStoreProxyUrl(trimmed);
  if (token) {
    return {
      uri: proxy,
      headers: { Authorization: `Bearer ${token}` },
    };
  }
  return { uri: proxy };
}

function cacheKeyFromUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i += 1) {
    h = (Math.imul(h, 31) + url.charCodeAt(i)) >>> 0;
  }
  const extMatch = url
    .toLowerCase()
    .match(/\.(jpe?g|png|webp|gif|mp4|mov|webm)(?:\?|$)/);
  const ext = extMatch?.[1] ?? 'bin';
  return `cdrms-media-${h.toString(16)}.${ext}`;
}

/**
 * Resolve media for display on device:
 * - local file/content → as-is
 * - remote MinIO / API URL → download via authenticated proxy into cache
 *
 * Required after reload: DB stores http://127.0.0.1:9000/... which phones
 * cannot open, and RN <Image headers> often fail to send Authorization.
 */
export function useResolvedMediaUri(
  uri: string | null | undefined,
  token: string | null | undefined
): {
  displayUri: string | null;
  loading: boolean;
  error: boolean;
} {
  const trimmed = uri?.trim() || '';
  const local = Boolean(trimmed && isLocalMediaUri(trimmed));

  const [displayUri, setDisplayUri] = useState<string | null>(
    local ? trimmed : null
  );
  const [loading, setLoading] = useState(!local && Boolean(trimmed));
  const [error, setError] = useState(false);

  const remoteKey = useMemo(() => {
    if (!trimmed || local) return '';
    return trimmed;
  }, [trimmed, local]);

  useEffect(() => {
    if (!trimmed) {
      setDisplayUri(null);
      setLoading(false);
      setError(false);
      return;
    }

    if (isLocalMediaUri(trimmed)) {
      setDisplayUri(trimmed);
      setLoading(false);
      setError(false);
      return;
    }

    if (!isRemoteMediaUri(trimmed)) {
      setDisplayUri(trimmed);
      setLoading(false);
      setError(false);
      return;
    }

    // Web <img>/<video> cannot send Authorization. Fetch a blob URL instead.
    if (Platform.OS === 'web') {
      if (!token) {
        setDisplayUri(null);
        setLoading(false);
        setError(true);
        return;
      }

      let cancelled = false;
      let objectUrl: string | null = null;
      void (async () => {
        setLoading(true);
        setError(false);
        try {
          const blob = await fetchAuthenticatedMediaBlob(trimmed, token);
          objectUrl = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          setDisplayUri(objectUrl);
          setLoading(false);
        } catch {
          if (!cancelled) {
            setDisplayUri(null);
            setLoading(false);
            setError(true);
          }
        }
      })();

      return () => {
        cancelled = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }

    let cancelled = false;
    const cacheDir = FileSystem.cacheDirectory;
    const dest = cacheDir ? `${cacheDir}${cacheKeyFromUrl(trimmed)}` : null;

    void (async () => {
      setLoading(true);
      setError(false);
      setDisplayUri(null);

      try {
        if (!token) {
          throw new Error('Not signed in');
        }
        if (!dest) {
          throw new Error('No cache directory');
        }

        const info = await FileSystem.getInfoAsync(dest);
        if (info.exists && 'size' in info && (info.size ?? 0) > 64) {
          // Tiny files are likely JSON error bodies from a previous failed download.
          if (!cancelled) {
            setDisplayUri(dest);
            setLoading(false);
          }
          return;
        }

        const proxy = objectStoreProxyUrl(trimmed);
        const result = await FileSystem.downloadAsync(proxy, dest, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: '*/*',
          },
        });

        if (cancelled) return;

        if (result.status < 200 || result.status >= 300) {
          await FileSystem.deleteAsync(dest, { idempotent: true }).catch(
            () => undefined
          );
          throw new Error(`Preview failed (${result.status})`);
        }

        // Guard against auth/HTML error payloads saved as the file.
        const saved = await FileSystem.getInfoAsync(dest);
        if (!saved.exists || ('size' in saved && (saved.size ?? 0) < 64)) {
          await FileSystem.deleteAsync(dest, { idempotent: true }).catch(
            () => undefined
          );
          throw new Error('Preview file empty');
        }

        setDisplayUri(result.uri);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setDisplayUri(null);
          setLoading(false);
          setError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [remoteKey, token, trimmed, local]);

  return { displayUri, loading, error };
}

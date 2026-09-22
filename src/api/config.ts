import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
* API base URL — single source is `.env.example` (EXPO_PUBLIC_API_URL),
* injected at build/start via app.config.js. No hardcoded host here.
*/
function readApiProxyUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  const fromExtra =
    typeof Constants.expoConfig?.extra?.apiUrl === 'string'
      ? Constants.expoConfig.extra.apiUrl.trim()
      : '';
  const raw = (fromEnv || fromExtra).replace(/\/api\/?$/, '').replace(/\/$/, '');
  if (!raw) {
    throw new Error(
      'Missing EXPO_PUBLIC_API_URL. Set it once in .env.example (loaded by app.config.js).',
    );
  }
  return raw;
}

export const API_PROXY_URL = readApiProxyUrl();

function apiPort(): number {
  try {
    const u = new URL(API_PROXY_URL);
    if (u.port) return Number(u.port);
    return u.protocol === 'https:' ? 443 : 80;
  } catch {
    return 3710;
  }
}

function apiHostname(): string {
  try {
    return new URL(API_PROXY_URL).hostname;
  } catch {
    return '';
  }
}

/** Extracts active Metro bundler host IP when connected (local LAN only). */
function getAutoDetectedLanIp(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      ?.manifest2?.extra?.expoGo?.debuggerHost;

  const configuredHost = apiHostname();
  if (typeof hostUri === 'string' && hostUri.includes(':')) {
    const ip = hostUri.split(':')[0].trim();
    if (
      ip &&
      ip !== 'localhost' &&
      ip !== '127.0.0.1' &&
      ip !== configuredHost
    ) {
      return ip;
    }
  }
  return null;
}

function isSimulatorOrEmulator(): boolean {
  return Constants.isDevice === false;
}

function withApiPath(host: string) {
  const base = host.replace(/\/api\/?$/, '').replace(/\/$/, '');
  return `${base}/api`;
}

/**
* Resolve API host:
* - Web HTTPS (local :8443 proxy or production) → same origin
* - Web on localhost → localhost:APP_PORT (Chrome blocks localhost→LAN IP)
* - Web on a LAN IP → that IP:APP_PORT
* - Android emulator → 10.0.2.2 only when env points at localhost
* - iOS simulator → localhost only when env points at localhost
*/
function resolveApiHost(): string {
  const envHost = API_PROXY_URL;
  const port = apiPort();

  // Explicit remote / HTTPS backend URL always takes precedence
  if (envHost && (envHost.startsWith('https://') || !envHost.includes('localhost'))) {
    return envHost;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const loc = window.location;
      const pageHost = loc.hostname;
      if (pageHost === 'localhost' || pageHost === '127.0.0.1') {
        return envHost || `http://${pageHost}:${port}`;
      }
      if (pageHost && !envHost) {
        return `http://${pageHost}:${port}`;
      }
    } catch {
      // fall through
    }
  }

  const isLocalEnv =
    envHost.includes('localhost') ||
    envHost.includes('127.0.0.1') ||
    envHost.includes('10.0.2.2');

  if (Platform.OS === 'android' && isSimulatorOrEmulator() && isLocalEnv) {
    return `http://10.0.2.2:${port}`;
  }

  if (Platform.OS === 'ios' && isSimulatorOrEmulator() && isLocalEnv) {
    return `http://127.0.0.1:${port}`;
  }

  return envHost;
}

export const API_BASE_URL = withApiPath(resolveApiHost());

export function apiConnectionHint(): string {
  const lan = getAutoDetectedLanIp();
  return (
    `Cannot reach ${API_BASE_URL}. ` +
    `Confirm backend is up at ${API_PROXY_URL}` +
    (lan ? ` (device LAN ${lan})` : '') +
    '.'
  );
}


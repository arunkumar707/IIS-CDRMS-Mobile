import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { showAppDialog } from '@/src/cdrms/components/AppDialog';
import { ensureForegroundLocationPermission } from '@/src/cdrms/locationPermission';
import type { GpsFix } from '@/src/cdrms/project/types';

export type GeoAddress = {
  village: string;
  taluk: string;
  district: string;
  state: string;
  street?: string;
  name?: string;
  layoutName?: string;
  area?: string;
  block?: string;
  postalCode?: string;
  country?: string;
  /** Place line for UI (no lat/lng). */
  displayName: string;
};

export type LocationResult = {
  gps: GpsFix;
  address: GeoAddress;
};

export type RefreshOptions = {
  /** Skip alerts so permission dialogs don't steal TextInput focus. */
  silent?: boolean;
};

export type LiveLocationOptions = {
  distanceInterval?: number;
  timeInterval?: number;
  silent?: boolean;
};

function pickAddress(parts: Location.LocationGeocodedAddress[]): GeoAddress {
  const a = parts[0];
  if (!a) {
    return {
      village: '',
      taluk: '',
      district: '',
      state: '',
      displayName: '',
    };
  }

  const village = a.city || a.district || a.name || a.subregion || '';
  const taluk = a.subregion || a.district || a.city || '';
  const district = a.district || a.subregion || a.region || '';
  const state = a.region?.toLowerCase().includes('karnataka')
    ? 'Karnataka'
    : a.region || '';
  const street = a.street
    ? a.streetNumber
      ? `${a.streetNumber} ${a.street}`
      : a.street
    : undefined;
  const displayName = [a.name, street, village, district, state, a.postalCode]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(', ');

  return {
    village,
    taluk,
    district,
    state,
    street,
    name: a.name || undefined,
    layoutName: a.name || a.district || undefined,
    area: village,
    block: taluk,
    postalCode: a.postalCode || undefined,
    country: a.country || undefined,
    displayName: displayName || [village, district, state].filter(Boolean).join(', '),
  };
}

function emptyAddress(latitude: number, longitude: number): GeoAddress {
  return {
    village: '',
    taluk: '',
    district: '',
    state: '',
    displayName: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
  };
}

type NominatimReverse = {
  display_name?: string;
  name?: string;
  address?: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    quarter?: string;
    village?: string;
    town?: string;
    city?: string;
    city_district?: string;
    county?: string;
    state_district?: string;
    municipality?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

function fromNominatim(data: NominatimReverse): GeoAddress | null {
  const a = data.address;
  if (!a && !data.display_name) return null;

  const city = a?.city || a?.town || a?.village || a?.municipality || '';
  const suburb = a?.suburb || a?.quarter || a?.neighbourhood || '';
  const street = a?.road
    ? a.house_number
      ? `${a.house_number} ${a.road}`
      : a.road
    : undefined;
  const district = a?.city_district || a?.state_district || a?.county || '';
  const stateRaw = a?.state || '';
  const state = stateRaw.toLowerCase().includes('karnataka') ? 'Karnataka' : stateRaw;
  const displayName =
    data.display_name?.trim() ||
    [data.name, street, suburb, city, district, state, a?.postcode]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join(', ');
  if (!displayName) return null;

  return {
    village: city || suburb,
    taluk: a?.county || suburb,
    district: district || city,
    state,
    street,
    name: data.name || street,
    layoutName: suburb || city || undefined,
    area: city || suburb,
    block: suburb,
    postalCode: a?.postcode,
    country: a?.country,
    displayName,
  };
}

type PhotonFeature = {
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    district?: string;
    county?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

function fromPhoton(feature: PhotonFeature | undefined): GeoAddress | null {
  const p = feature?.properties;
  if (!p) return null;
  const street = p.street
    ? p.housenumber
      ? `${p.housenumber} ${p.street}`
      : p.street
    : undefined;
  const city = p.city || p.locality || '';
  const state = (p.state || '').toLowerCase().includes('karnataka')
    ? 'Karnataka'
    : p.state || '';
  const displayName = [p.name, street, p.locality, city, p.district, state, p.postcode]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(', ');
  if (!displayName) return null;
  return {
    village: city,
    taluk: p.county || p.district || '',
    district: p.district || city,
    state,
    street,
    name: p.name || street,
    layoutName: p.locality || city || undefined,
    area: city || p.locality,
    block: p.locality || p.district,
    postalCode: p.postcode,
    country: p.country,
    displayName,
  };
}

/** expo-location reverse geocode was removed on web (SDK 49) — use OSM. */
async function reverseGeocodeWeb(latitude: number, longitude: number): Promise<GeoAddress | null> {
  const nominatimUrl =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${encodeURIComponent(String(latitude))}` +
    `&lon=${encodeURIComponent(String(longitude))}` +
    `&addressdetails=1`;
  try {
    const res = await fetch(nominatimUrl, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const mapped = fromNominatim((await res.json()) as NominatimReverse);
      if (mapped) return mapped;
    }
  } catch {
    /* try Photon */
  }

  try {
    const res = await fetch(
      `https://photon.komoot.io/reverse?lat=${encodeURIComponent(String(latitude))}` +
        `&lon=${encodeURIComponent(String(longitude))}`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { features?: PhotonFeature[] };
    return fromPhoton(body.features?.[0]);
  } catch {
    return null;
  }
}

async function reverseGeocode(latitude: number, longitude: number): Promise<GeoAddress> {
  if (Platform.OS === 'web') {
    return (await reverseGeocodeWeb(latitude, longitude)) ?? emptyAddress(latitude, longitude);
  }

  try {
    const parts = await Location.reverseGeocodeAsync({ latitude, longitude });
    const mapped = pickAddress(parts);
    if (mapped.displayName.trim()) return mapped;
  } catch {
    /* native geocoder unavailable — keep coordinates */
  }
  return emptyAddress(latitude, longitude);
}

/** Ask iOS/Android for location permission + turn Location on (Android). */
export async function requestLocationPermission(silent = false): Promise<boolean> {
  return ensureForegroundLocationPermission(silent);
}

async function readPosition(): Promise<Location.LocationObject> {
  const accuracy =
    Platform.OS === 'android'
      ? Location.Accuracy.BestForNavigation
      : Location.Accuracy.High;
  try {
    return await Location.getCurrentPositionAsync({
      accuracy,
      mayShowUserSettingsDialog: true,
    });
  } catch {
    // High / Best can fail indoors — retry with balanced.
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: true,
    });
  }
}

/**
 * One-shot GPS fix for submit-time persistence (no React hook).
 * Uses the same permission + accuracy path as live Jio/device location.
 */
export async function captureCurrentGps(silent = true): Promise<GpsFix | null> {
  try {
    const ok = await requestLocationPermission(silent);
    if (!ok) return null;
    const position = await readPosition();
    const { latitude, longitude, accuracy, altitude } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      latitude,
      longitude,
      accuracy,
      altitude,
      timestamp: position.timestamp,
    };
  } catch {
    return null;
  }
}

/** GPS + reverse-geocoded place (step-2 / submit persistence). */
export async function captureCurrentLocation(
  silent = true,
): Promise<LocationResult | null> {
  try {
    const gps = await captureCurrentGps(silent);
    if (!gps) return null;
    const address = await reverseGeocode(gps.latitude, gps.longitude);
    return { gps, address };
  } catch {
    return null;
  }
}

/**
 * One-shot live location (permission → GPS → place name).
 * Matches the simple expo-location flow for iOS + Android.
 */
export function useDeviceLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (opts?: RefreshOptions): Promise<LocationResult | null> => {
      setLoading(true);
      setError(null);

      try {
        if (Platform.OS === 'web') {
          // Browser geolocation via expo-location still works when permitted.
        }

        const ok = await requestLocationPermission(Boolean(opts?.silent));
        if (!ok) {
          setError('Location permission denied');
          return null;
        }

        const position = await readPosition();

        const gps: GpsFix = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          timestamp: position.timestamp,
        };

        const address = await reverseGeocode(gps.latitude, gps.longitude);
        return { gps, address };
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not read GPS';
        setError(message);
        if (!opts?.silent) {
          showAppDialog({
            variant: 'error',
            title: 'GPS error',
            message,
            hideCancel: true,
            confirmLabel: 'OK',
          });
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { refresh, loading, error };
}

/**
 * Continuous live location watch (after login + Step 2).
 */
export function useLiveLocation(opts?: LiveLocationOptions) {
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [address, setAddress] = useState<GeoAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const lastGeocodeAt = useRef(0);
  const lastGeocodeKey = useRef('');
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyFix = useCallback(async (position: Location.LocationObject) => {
    const { latitude, longitude } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError('Waiting for GPS coordinates…');
      return;
    }

    const next: GpsFix = {
      latitude,
      longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      timestamp: position.timestamp,
    };
    setGps(next);
    setError(null);

    const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const now = Date.now();
    if (key !== lastGeocodeKey.current || now - lastGeocodeAt.current > 12_000) {
      lastGeocodeKey.current = key;
      lastGeocodeAt.current = now;
      const addr = await reverseGeocode(latitude, longitude);
      setAddress(addr);
    }
  }, []);

  const restart = useCallback(
    async (silent = true) => {
      setLoading(true);
      setError(null);
      try {
        subRef.current?.remove();
        subRef.current = null;
        if (retryTimer.current) {
          clearTimeout(retryTimer.current);
          retryTimer.current = null;
        }

        const ok = await requestLocationPermission(silent);
        if (!ok) {
          setError('Location permission denied');
          setGps(null);
          setAddress(null);
          return null;
        }

        try {
          const position = await readPosition();
          await applyFix(position);
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Could not read GPS';
          setError(message);
          setGps(null);
          setAddress(null);
          retryTimer.current = setTimeout(() => {
            void restart(true);
          }, 4000);
        }

        if (Platform.OS !== 'web') {
          subRef.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              distanceInterval: opts?.distanceInterval ?? 5,
              timeInterval: opts?.timeInterval ?? 2000,
              mayShowUserSettingsDialog: true,
            },
            (pos) => {
              void applyFix(pos);
            },
          );
        }

        return null;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not read GPS';
        setError(message);
        if (!silent) {
          showAppDialog({
            variant: 'error',
            title: 'GPS error',
            message,
            hideCancel: true,
            confirmLabel: 'OK',
          });
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [applyFix, opts?.distanceInterval, opts?.timeInterval],
  );

  useEffect(() => {
    void restart(opts?.silent ?? true);
    return () => {
      subRef.current?.remove();
      subRef.current = null;
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once on mount
  }, []);

  return {
    gps,
    address,
    loading,
    error,
    refresh: restart,
  };
}

import { createElement } from 'react';
import type { LiveGeoMapProps } from './LiveGeoMap.types';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { View } from 'react-native';

export type { LiveGeoMapProps };

function embedUrl(latitude: number, longitude: number, zoom = 18): string {
  const z = Math.min(21, Math.max(1, zoom));
  const key = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
  if (key) {
    return (
      `https://www.google.com/maps/embed/v1/place` +
      `?key=${encodeURIComponent(key)}` +
      `&q=${latitude}%2C${longitude}&zoom=${z}&maptype=roadmap`
    );
  }
  return `https://maps.google.com/maps?q=${latitude}%2C${longitude}&z=${z}&hl=en&output=embed`;
}

/**
 * Google embed always pins the marker at the iframe center. When a bottom
 * sheet covers the lower map, shift the iframe up so the pin sits in the
 * remaining visible strip (native uses map padding / panBy for the same).
 */
function pinShiftPx(mapHeight: number, bottomPadding: number): number {
  const h = Math.max(1, mapHeight);
  const covered = Math.min(Math.max(0, bottomPadding), h * 0.72);
  return Math.round(covered / 2);
}

/** Web — Google Maps iframe on live GPS. */
export function LiveGeoMap({
  height = 236,
  rounded = 20,
  latitude,
  longitude,
  placeLabel,
  zoom = 18,
  showBrandBadge = true,
  bottomPadding = 0,
  recenterKey = 0,
}: LiveGeoMapProps) {
  const mapH = typeof height === 'number' && height > 0 ? height : 320;
  const shift = pinShiftPx(mapH, bottomPadding ?? 0);
  const src = embedUrl(latitude, longitude, zoom);

  return (
    <View
      style={{
        width: '100%',
        height: height ?? '100%',
        flex: 1,
        minHeight: 0,
        borderRadius: rounded,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {createElement('iframe', {
        key: `gmaps-${recenterKey}-${zoom}-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
        title: 'Google Maps',
        src,
        style: {
          position: 'absolute',
          top: shift > 0 ? -shift : 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 0,
          display: 'block',
        },
        allowFullScreen: true,
        loading: 'eager',
        referrerPolicy: 'no-referrer-when-downgrade',
      })}
      {showBrandBadge ? (
        <Box
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 10,
            bottom: 10,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: 'rgba(15,23,42,0.72)',
            maxWidth: '70%',
          }}
        >
          <Text className="text-[9px] font-bold text-white" numberOfLines={2}>
            {placeLabel || 'Google Maps · Live GPS'}
          </Text>
        </Box>
      ) : null}
    </View>
  );
}

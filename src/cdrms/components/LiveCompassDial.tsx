import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import {
  CARDINAL_DEGREES,
  COMPASS_CARDINALS,
  cardinalNameFromHeading,
  formatLiveReading,
  isDesktopWeb,
  parseCompassReading,
  SIMULATOR_COMPASS_FACE,
  SIMULATOR_COMPASS_HEADING,
  type CompassCardinal,
  useCompass,
} from '@/src/cdrms/hooks/useCompass';
import { useProject } from '@/src/cdrms/project/ProjectContext';
import {
  CARDINAL_ACCENT,
  COLORS,
  FONTS,
  SPACE,
  cardinalAccentColor,
  hexAlpha,
} from '@/src/cdrms/theme';

const RING_DEGREES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

type DialMetrics = {
  dial: number;
  labelPad: number;
  tickInner: number;
  tickOuter: number;
  numberR: number;
  /** Cardinal letters — kept well inside the North arrow tip. */
  labelR: number;
  /** Arrow tip radius (toward center); must stay > labelR. */
  arrowTipR: number;
  /** Arrow base radius (toward ticks). */
  arrowBaseR: number;
  centerDegSize: number;
  cardinalSize: number;
};

const METRICS: Record<'default' | 'compact', DialMetrics> = {
  default: {
    dial: 216,
    labelPad: 22,
    tickInner: 88,
    tickOuter: 100,
    numberR: 112,
    labelR: 54,
    arrowTipR: 72,
    arrowBaseR: 84,
    centerDegSize: 36,
    cardinalSize: 18,
  },
  compact: {
    dial: 172,
    labelPad: 14,
    tickInner: 70,
    tickOuter: 80,
    numberR: 88,
    labelR: 42,
    arrowTipR: 56,
    arrowBaseR: 66,
    centerDegSize: 30,
    cardinalSize: 16,
  },
};

/** 0° at bottom, clockwise — matches native compass apps. */
function dialRad(deg: number): number {
  return ((deg + 90) * Math.PI) / 180;
}

function decimalToDms(decimal: number): string {
  const abs = Math.abs(decimal);
  const d = Math.floor(abs);
  const minFloat = (abs - d) * 60;
  const m = Math.floor(minFloat);
  const s = Math.round((minFloat - m) * 60);
  return `${d}°${m}'${s}"`;
}

/**
 * Live sensor compass (real device).
 * Simulator / no-sensor: auto-seeds North so Continue can unlock.
 */
export function LiveCompassDial({ compact = false }: { compact?: boolean }) {
  const { draft, setCompassReading } = useProject();
  const compass = useCompass(true);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const lastSaved = useRef('');
  const seededFallback = useRef(false);

  const m = METRICS[compact ? 'compact' : 'default'];
  const size = m.dial + m.labelPad * 2;
  const center = size / 2;

  const dialPoint = (deg: number, radius: number) => {
    const rad = dialRad(deg);
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  const parsed = parseCompassReading(draft.compassReading);
  const face: CompassCardinal = compass.available
    ? (parseCompassReading(formatLiveReading(compass.heading))?.face ?? 'N')
    : parsed?.face ?? SIMULATOR_COMPASS_FACE;
  const heading = Math.round(
    compass.available ? compass.heading : parsed?.heading ?? SIMULATOR_COMPASS_HEADING,
  );
  const accent = cardinalAccentColor(face);
  const roseRotation = -heading;
  const hasReading = Boolean(String(draft.compassReading || '').trim());
  const directionName = hasReading ? cardinalNameFromHeading(heading) : '—';
  const desktopWeb = Platform.OS === 'web' && isDesktopWeb();
  const showManualPick =
    Platform.OS === 'web' &&
    (desktopWeb || !compass.available || compass.status === 'unavailable');
  const needsEnableTap =
    Platform.OS === 'web' &&
    !desktopWeb &&
    typeof compass.enableLive === 'function' &&
    (compass.status === 'permission' ||
      (compass.status === 'unavailable' && !compass.available));
  const needsManualPick =
    !needsEnableTap &&
    !showManualPick &&
    (!compass.available ||
      compass.source === 'simulator' ||
      compass.status === 'unavailable' ||
      compass.status === 'permission');
  const waitingForWeb =
    Platform.OS === 'web' &&
    !desktopWeb &&
    compass.status === 'calibrating' &&
    !compass.available;

  const pickFacing = (cardinal: CompassCardinal) => {
    const reading = formatLiveReading(CARDINAL_DEGREES[cardinal]);
    lastSaved.current = reading;
    setCompassReading(reading);
  };

  const tickMajor = hexAlpha(COLORS.primary, 0.42);
  const tickMinor = hexAlpha(COLORS.primary, 0.18);
  const dialLabels = [
    { label: 'N', deg: 0, color: CARDINAL_ACCENT.N, size: m.cardinalSize },
    { label: 'E', deg: 90, color: CARDINAL_ACCENT.E, size: m.cardinalSize - 1 },
    { label: 'S', deg: 180, color: CARDINAL_ACCENT.S, size: m.cardinalSize - 1 },
    { label: 'W', deg: 270, color: CARDINAL_ACCENT.W, size: m.cardinalSize - 1 },
  ] as const;

  const gps = draft.gps;
  const nl = gps ? decimalToDms(gps.latitude) : '—';
  const el = gps ? decimalToDms(gps.longitude) : '—';
  const elevation =
    gps?.altitude != null && Number.isFinite(gps.altitude)
      ? `${gps.altitude.toFixed(1)}m`
      : '—';

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const anim = Animated.timing(rotateAnim, {
      toValue: roseRotation,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => {
      try {
        anim.stop();
        rotateAnim.stopAnimation();
      } catch {
        /* ignore */
      }
    };
  }, [roseRotation, rotateAnim]);

  // Live sensors → save continuously
  useEffect(() => {
    if (!compass.available || compass.source === 'simulator') return;
    const reading = formatLiveReading(compass.heading);
    if (reading === lastSaved.current) return;
    lastSaved.current = reading;
    setCompassReading(reading);
  }, [compass.available, compass.heading, compass.source, setCompassReading]);

  // Simulator / desktop with no sensors → seed North so Continue unlocks.
  // Desktop web: user picks direction manually — do not auto-seed.
  useEffect(() => {
    if (compass.available && compass.source !== 'simulator') return;
    if (Platform.OS === 'web' && isDesktopWeb()) return;
    if (Platform.OS === 'web' && compass.status === 'calibrating') return;
    if (Platform.OS === 'web' && compass.status === 'permission') return;
    if (
      compass.source === 'simulator' ||
      compass.status === 'unavailable'
    ) {
      if (seededFallback.current && String(draft.compassReading || '').trim()) return;
      seededFallback.current = true;
      const reading = formatLiveReading(SIMULATOR_COMPASS_HEADING);
      lastSaved.current = reading;
      setCompassReading(reading);
    }
  }, [
    compass.available,
    compass.source,
    compass.status,
    draft.compassReading,
    setCompassReading,
  ]);

  return (
    <VStack
      className="items-center"
      style={{ gap: compact ? 8 : SPACE[3], width: '100%' }}
    >
      {needsEnableTap ? (
        <Pressable onPress={() => compass.enableLive?.()} hitSlop={8}>
          <Text
            style={{
              fontFamily: FONTS.medium,
              fontSize: 12,
              lineHeight: 15,
              color: COLORS.primary,
              textAlign: 'center',
              paddingHorizontal: 4,
              textDecorationLine: 'underline',
            }}
          >
            {compass.status === 'permission'
              ? 'Tap to enable live compass'
              : 'No compass in this browser — open this page on your phone, then tap here'}
          </Text>
        </Pressable>
      ) : waitingForWeb ? (
        <Text
          style={{
            fontFamily: FONTS.medium,
            fontSize: 12,
            lineHeight: 15,
            color: COLORS.ink,
            textAlign: 'center',
            paddingHorizontal: 4,
          }}
        >
          Hold phone flat — waiting for compass…
        </Text>
      ) : showManualPick && !hasReading ? (
        <Text
          style={{
            fontFamily: FONTS.medium,
            fontSize: 12,
            lineHeight: 15,
            color: COLORS.ink,
            textAlign: 'center',
            paddingHorizontal: 4,
          }}
        >
          No compass on this device — pick facing direction below
        </Text>
      ) : needsManualPick ? (
        <Text
          style={{
            fontFamily: FONTS.medium,
            fontSize: 12,
            lineHeight: 15,
            color: COLORS.ink,
            textAlign: 'center',
            paddingHorizontal: 4,
          }}
        >
          {compass.source === 'simulator' || compass.status === 'unavailable'
            ? `No live compass · facing set to ${SIMULATOR_COMPASS_FACE}.`
            : 'Allow location / use a real device for live compass.'}
        </Text>
      ) : null}

      <Box
        className="relative items-center justify-center"
        style={{
          width: size,
          height: size,
          overflow: 'visible',
          alignSelf: 'center',
        }}
      >
        <Svg width={size} height={size} pointerEvents="none" style={{ overflow: 'visible' }}>
          {Array.from({ length: 72 }).map((_, i) => {
            const deg = i * 5;
            const major = deg % 30 === 0;
            const inner = major ? m.tickInner - 4 : m.tickInner;
            const outer = m.tickOuter;
            const a = dialPoint(deg, inner);
            const b = dialPoint(deg, outer);
            const inArc = hasReading && deg <= heading;
            return (
              <Line
                key={`tick-${deg}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={inArc ? accent : major ? tickMajor : tickMinor}
                strokeWidth={major ? 1.8 : 1}
              />
            );
          })}

          {RING_DEGREES.map((deg) => {
            // Skip 0° numeral — North arrow marks that spot (avoids N/0/arrow pile-up).
            if (deg === 0) return null;
            const { x, y } = dialPoint(deg, m.numberR);
            const inArc = hasReading && deg <= heading;
            return (
              <SvgText
                key={`num-${deg}`}
                x={x}
                y={y}
                fill={inArc ? accent : COLORS.slate}
                fontSize={compact ? 11 : 12}
                fontWeight="700"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {String(deg)}
              </SvgText>
            );
          })}

          {(() => {
            // Arrow sits between cardinal letters and the tick ring — tip never covers N.
            const tip = dialPoint(0, m.arrowTipR);
            const left = dialPoint(348, m.arrowBaseR);
            const right = dialPoint(12, m.arrowBaseR);
            return (
              <Polygon
                points={`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`}
                fill={CARDINAL_ACCENT.N}
              />
            );
          })()}
        </Svg>

        {(() => {
          const labels = dialLabels.map((d) => {
            const { x, y } = dialPoint(d.deg, m.labelR);
            const box = d.size * 1.25;
            return (
              <Text
                key={d.label}
                style={{
                  position: 'absolute',
                  left: x - box / 2,
                  top: y - box / 2,
                  width: box,
                  height: box,
                  textAlign: 'center',
                  fontSize: d.size,
                  lineHeight: box,
                  fontFamily: FONTS.bold,
                  fontWeight: '900',
                  color: d.color,
                }}
              >
                {d.label}
              </Text>
            );
          });
          const roseLayout = {
            position: 'absolute' as const,
            width: size,
            height: size,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
          };
          // Web has no native Animated driver — interpolating rotate here blanks Step 3 on unmount.
          if (Platform.OS === 'web') {
            return (
              <View
                pointerEvents="none"
                style={{ ...roseLayout, transform: [{ rotate: `${roseRotation}deg` }] }}
              >
                {labels}
              </View>
            );
          }
          return (
            <Animated.View
              pointerEvents="none"
              style={{
                ...roseLayout,
                transform: [
                  {
                    rotate: rotateAnim.interpolate({
                      inputRange: [-720, 720],
                      outputRange: ['-720deg', '720deg'],
                    }),
                  },
                ],
              }}
            >
              {labels}
            </Animated.View>
          );
        })()}

        <Box pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <Text
            style={{
              fontFamily: FONTS.bold,
              fontSize: m.centerDegSize,
              lineHeight: m.centerDegSize + 4,
              color: COLORS.primaryDeep,
              fontWeight: '800',
            }}
          >
            {hasReading ? `${heading}°` : '—'}
          </Text>
        </Box>
      </Box>

      <Text
        style={{
          fontFamily: FONTS.bold,
          fontSize: compact ? 15 : 17,
          lineHeight: compact ? 18 : 22,
          color: accent,
          textAlign: 'center',
        }}
      >
        {directionName}
      </Text>

      {showManualPick ? (
        <Box style={{ width: '100%', paddingHorizontal: compact ? 0 : 4 }}>
          <HStack style={{ flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            {COMPASS_CARDINALS.map((cardinal) => {
              const selected = face === cardinal;
              const accentColor = cardinalAccentColor(cardinal);
              return (
                <Pressable
                  key={cardinal}
                  onPress={() => pickFacing(cardinal)}
                  style={{
                    minWidth: compact ? 52 : 58,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: selected ? accentColor : hexAlpha(COLORS.primary, 0.22),
                    backgroundColor: selected ? hexAlpha(accentColor, 0.14) : COLORS.white,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.bold,
                      fontSize: compact ? 12 : 13,
                      color: selected ? accentColor : COLORS.ink,
                      textAlign: 'center',
                    }}
                  >
                    {cardinal}
                  </Text>
                </Pressable>
              );
            })}
          </HStack>
        </Box>
      ) : null}

      <Box
        style={{
          width: '100%',
          borderRadius: 999,
          backgroundColor: COLORS.white,
          borderWidth: 1.5,
          borderColor: hexAlpha(COLORS.primary, 0.22),
          paddingVertical: 6,
          paddingHorizontal: 14,
          gap: 4,
          shadowColor: COLORS.primaryDeep,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <HStack style={{ justifyContent: 'space-around', alignItems: 'center' }}>
          <VStack className="items-center" style={{ gap: 0, flex: 1 }}>
            <Text
              style={{
                fontFamily: FONTS.bold,
                fontSize: 13,
                letterSpacing: 0.3,
                color: COLORS.ink,
                textTransform: 'uppercase',
              }}
            >
              NL
            </Text>
            <Text
              style={{
                fontFamily: FONTS.medium,
                fontSize: 16,
                lineHeight: 19,
                color: COLORS.ink,
              }}
              numberOfLines={1}
            >
              {nl}
            </Text>
          </VStack>
          <Box
            style={{
              width: 1,
              height: 24,
              backgroundColor: hexAlpha(COLORS.primary, 0.16),
            }}
          />
          <VStack className="items-center" style={{ gap: 0, flex: 1 }}>
            <Text
              style={{
                fontFamily: FONTS.bold,
                fontSize: 13,
                letterSpacing: 0.3,
                color: COLORS.ink,
                textTransform: 'uppercase',
              }}
            >
              EL
            </Text>
            <Text
              style={{
                fontFamily: FONTS.medium,
                fontSize: 16,
                lineHeight: 19,
                color: COLORS.ink,
              }}
              numberOfLines={1}
            >
              {el}
            </Text>
          </VStack>
        </HStack>

        <Box style={{ height: StyleSheet.hairlineWidth, backgroundColor: hexAlpha(COLORS.primary, 0.14) }} />

        <VStack className="items-center" style={{ gap: 0 }}>
          <Text
            style={{
              fontFamily: FONTS.bold,
              fontSize: 13,
              letterSpacing: 0.3,
              color: COLORS.ink,
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            Elevation
          </Text>
          <Text
            style={{
              fontFamily: FONTS.medium,
              fontSize: 16,
              lineHeight: 19,
              color: COLORS.ink,
              textAlign: 'center',
            }}
          >
            {elevation}
          </Text>
        </VStack>
      </Box>
    </VStack>
  );
}

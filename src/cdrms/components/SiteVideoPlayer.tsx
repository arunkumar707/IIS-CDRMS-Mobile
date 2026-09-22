import { useEvent, useEventListener } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  Maximize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import { createElement, useEffect, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { ActivityIndicator, Platform } from 'react-native';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/src/auth/AuthContext';
import { useResolvedMediaUri } from '@/src/cdrms/media/displayUri';
import { COLORS, GRADIENT_PRIMARY } from '@/src/cdrms/theme';

type Props = {
  uri: string;
  durationLabel?: string;
  /** When parent has no flex height, pass explicit height (e.g. 220). */
  height?: number;
};

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Custom walk-through player with mock-matched controls. */
export function SiteVideoPlayer({ uri, durationLabel, height }: Props) {
  const { accessToken } = useAuth();
  const viewRef = useRef<VideoView>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [broken, setBroken] = useState(false);

  const safeUri = typeof uri === 'string' ? uri.trim() : '';
  const { displayUri, loading, error } = useResolvedMediaUri(safeUri, accessToken);

  const player = useVideoPlayer(displayUri ?? null, (p) => {
    p.loop = false;
    p.muted = false;
    p.timeUpdateEventInterval = 0.25;
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });
  const { muted } = useEvent(player, 'mutedChange', {
    muted: player.muted,
  });

  useEventListener(player, 'timeUpdate', ({ currentTime: t }) => {
    setCurrentTime(t);
  });

  useEffect(() => {
    if (!displayUri) {
      if (!loading) setBroken(true);
      return;
    }
    setBroken(false);
    try {
      player.replace(displayUri);
      setCurrentTime(0);
    } catch {
      setBroken(true);
    }
  }, [displayUri, player, loading]);

  const duration =
    player.duration > 0
      ? player.duration
      : durationLabel
        ? parseDurationLabel(durationLabel)
        : 0;
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  const togglePlay = () => {
    try {
      if (isPlaying) player.pause();
      else player.play();
    } catch {
      setBroken(true);
    }
  };

  const toggleMute = () => {
    try {
      player.muted = !player.muted;
    } catch {
      // ignore
    }
  };

  const seekFromEvent = (e: GestureResponderEvent) => {
    if (trackWidth <= 0 || duration <= 0) return;
    try {
      const x = e.nativeEvent.locationX;
      const ratio = Math.min(1, Math.max(0, x / trackWidth));
      player.currentTime = ratio * duration;
      setCurrentTime(ratio * duration);
    } catch {
      // ignore seek races
    }
  };

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const enterFullscreen = () => {
    try {
      void viewRef.current?.enterFullscreen();
    } catch {
      // ignore
    }
  };

  const shellStyle = height
    ? { width: '100%' as const, height, backgroundColor: '#000' }
    : { flex: 1, backgroundColor: '#000' };

  if (loading) {
    return (
      <Box style={[shellStyle, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="#fff" />
        <Text className="text-white/70 text-xs font-semibold mt-2">Loading video…</Text>
      </Box>
    );
  }

  if (
    Platform.OS === 'web' &&
    displayUri &&
    (/^blob:|^data:/i.test(displayUri) || /^blob:|^data:/i.test(safeUri))
  ) {
    return (
      <Box style={shellStyle}>
        {createElement('video', {
          src: displayUri,
          controls: true,
          playsInline: true,
          style: {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: '#000',
          },
        })}
      </Box>
    );
  }

  if (!safeUri || broken || error || !displayUri) {
    return (
      <Box style={[shellStyle, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text className="text-white/80 text-sm font-semibold">Video unavailable</Text>
      </Box>
    );
  }

  return (
    <Box style={shellStyle}>
      <VideoView
        ref={viewRef}
        style={{ width: '100%', height: '100%' }}
        player={player}
        allowsFullscreen
        contentFit="cover"
        nativeControls={false}
      />

      {!isPlaying ? (
        <Pressable
          onPress={togglePlay}
          className="absolute inset-0 items-center justify-center"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.28)' }}
        >
          <LinearGradient
            colors={[...GRADIENT_PRIMARY]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              height: 72,
              width: 72,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#1D4ED8',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.45,
              shadowRadius: 16,
              elevation: 8,
              borderWidth: 3,
              borderColor: 'rgba(255,255,255,0.55)',
            }}
          >
            <Play size={28} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
          </LinearGradient>
        </Pressable>
      ) : (
        <Pressable onPress={togglePlay} className="absolute inset-0" />
      )}

      <LinearGradient
        colors={['transparent', 'rgba(15,23,42,0.85)']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 12,
          paddingTop: 28,
          paddingBottom: 10,
        }}
      >
        <HStack className="items-center" style={{ gap: 8 }}>
          <Pressable
            onPress={togglePlay}
            hitSlop={8}
            className="items-center justify-center"
            style={{ width: 28, height: 28 }}
          >
            {isPlaying ? (
              <Pause size={16} color="#fff" fill="#fff" />
            ) : (
              <Play size={16} color="#fff" fill="#fff" />
            )}
          </Pressable>

          <Pressable
            onPress={toggleMute}
            hitSlop={8}
            className="items-center justify-center"
            style={{ width: 28, height: 28 }}
          >
            {muted ? (
              <VolumeX size={15} color="rgba(255,255,255,0.85)" />
            ) : (
              <Volume2 size={15} color="rgba(255,255,255,0.85)" />
            )}
          </Pressable>

          <Pressable
            onPress={seekFromEvent}
            onLayout={onTrackLayout}
            className="flex-1 justify-center"
            style={{ height: 20 }}
          >
            <Box
              style={{
                height: 4,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.28)',
                overflow: 'visible',
              }}
            >
              <Box
                style={{
                  height: 4,
                  width: `${progress * 100}%`,
                  borderRadius: 999,
                  backgroundColor: COLORS.primaryGlow,
                }}
              />
              <Box
                style={{
                  position: 'absolute',
                  left: `${progress * 100}%`,
                  marginLeft: -6,
                  top: -4,
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 2,
                  borderColor: COLORS.primary,
                }}
              />
            </Box>
          </Pressable>

          <Text className="text-[10px] font-bold text-white/90 tabular-nums">
            {formatClock(currentTime)} / {formatClock(duration)}
          </Text>

          <Box
            className="px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
          >
            <Text className="text-[9px] font-extrabold text-white">HD</Text>
          </Box>

          <Pressable
            onPress={enterFullscreen}
            hitSlop={8}
            className="items-center justify-center"
            style={{ width: 28, height: 28 }}
          >
            <Maximize2 size={14} color="rgba(255,255,255,0.9)" />
          </Pressable>
        </HStack>
      </LinearGradient>
    </Box>
  );
}

function parseDurationLabel(label: string): number {
  const parts = label.split(':').map((p) => Number(p));
  if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

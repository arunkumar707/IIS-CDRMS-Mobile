import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react-native';
import React, { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { ScreenShell, ScreenLoader, useMinimumLoading } from '@/src/cdrms/components/primitives';
import { BdaPageWatermark } from '@/src/cdrms/components/WelcomeHomeChrome';
import { HeaderMeshBackground, MeshSheetEdge, WaveSheetEdge } from '@/src/cdrms/components/WaveDecor';
import { useHardwareBack } from '@/src/cdrms/hooks/useHardwareBack';
import { ENGINEER_SURVEY_STEPS, SURVEY_STEPS } from '@/src/cdrms/terminology';
import { COLORS, DESIGN, FONTS, GRADIENT_HEADER, GRADIENT_PRIMARY, GLASS, SPACE, TYPE, gradientStops, headerFg, hexAlpha, isMeshDesign, isWaveDesign, usesLightHeader, usesNormalHeader, usesSolidHeader } from '@/src/cdrms/theme';
import { cardSurfaceStyle } from '@/src/cdrms/lib/cardSurface';
import type { Go, Screen } from '@/src/cdrms/types';
import { useTheme } from '@/src/theme/ThemeContext';

const SURVEY_STEP_HERO = require('../../../assets/illustrations/survey-step-hero.png');

/** City + pin hero for engineer 4-step headers. */
function SurveyStepHeroArt({ size = 72 }: { size?: number }) {
  return (
    <Box pointerEvents="none" style={{ width: size, height: size }}>
      <Image
        source={SURVEY_STEP_HERO}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </Box>
  );
}

function stepsForTotal(total: number) {
  return total === 4 ? ENGINEER_SURVEY_STEPS : SURVEY_STEPS;
}

/** Screen ids for survey step index (1-based). */
export function screenForSurveyStep(step: number, total: number): Screen | null {
  const four: Screen[] = ['project', 'bandi', 'dimensions', 'photos'];
  const five: Screen[] = ['project', 'bandi', 'surroundings', 'photos', 'video'];
  const list = total === 4 ? four : five;
  return list[step - 1] ?? null;
}

const COMPACT_SCROLL_THRESHOLD = 48;
/** Sticky bar: top pad + continue btn */
const STICKY_FOOTER_HEIGHT = 52;
const FOOTER_SCROLL_BUFFER = 2;

/** Geometric completed-step mark — not a generic lucide check. */
function StepDoneMark({ size = 14, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const short = size * 0.32;
  const long = size * 0.62;
  const thickness = Math.max(2.4, size * 0.18);
  return (
    <Box style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Box
        style={{
          position: 'absolute',
          width: short,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
          left: size * 0.12,
          top: size * 0.5,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <Box
        style={{
          position: 'absolute',
          width: long,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
          left: size * 0.28,
          top: size * 0.42,
          transform: [{ rotate: '-48deg' }],
        }}
      />
    </Box>
  );
}

/**
 * Survey step rail — white for pending/current, green when complete.
 * Premium (engineer) matches ZC-details mock: filled blue active + outlined icons.
 * Completed steps are tappable to go back.
 */
export function StepRail({
  step,
  total = 5,
  variant = 'default',
  onStepPress,
}: {
  step: number;
  total?: number;
  variant?: 'default' | 'premium';
  /** Called with 1-based step when a completed step is pressed. */
  onStepPress?: (targetStep: number) => void;
}) {
  const steps = stepsForTotal(total);
  const { themeId } = useTheme();
  const premium = variant === 'premium';
  const node = premium ? 36 : 38;
  const lineTop = 4 + node / 2 - 2;
  const endPadPct = 50 / Math.max(total, 1);
  const progress = Math.max(0, Math.min(1, (step - 1) / Math.max(1, total - 1)));
  const DONE_GREEN = COLORS.success || '#10B981';
  const DONE_GREEN_DEEP = '#059669';
  const trackBg = premium ? hexAlpha(COLORS.primary, 0.14) : hexAlpha('#FFFFFF', 0.35);
  const trackFill = premium ? hexAlpha(COLORS.primary, 0.55) : DONE_GREEN;

  return (
    <Box
      key={themeId}
      style={{ marginTop: premium ? 0 : SPACE[3], marginBottom: 0 }}
    >
      <Box
        style={{
          position: 'relative',
          paddingTop: premium ? 0 : 6,
          paddingBottom: premium ? 0 : 4,
          paddingHorizontal: 2,
        }}
      >
        <Box
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${endPadPct}%`,
            right: `${endPadPct}%`,
            top: lineTop,
            height: premium ? 3 : 4,
            borderRadius: 999,
            backgroundColor: trackBg,
            zIndex: 0,
            overflow: 'hidden',
          }}
        >
          <Box
            style={{
              width: `${Math.round(progress * 100)}%`,
              height: '100%',
              borderRadius: 999,
              backgroundColor: trackFill,
            }}
          />
        </Box>

        <HStack style={{ alignItems: 'flex-start', zIndex: 1 }}>
          {steps.map((item, i) => {
            const stepNum = i + 1;
            const active = i === step - 1;
            const done = i < step - 1;
            const pending = !active && !done;
            const canPress = Boolean(onStepPress) && done;
            const Icon = item.icon;

            const nodeInner = premium ? (
              <Box
                style={{
                  width: node,
                  height: node,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done
                    ? DONE_GREEN
                    : active
                      ? COLORS.primary
                      : COLORS.white,
                  borderWidth: done ? 0 : active ? 0 : 2,
                  borderColor: hexAlpha(COLORS.primary, 0.45),
                  shadowColor: active ? COLORS.primaryDeep : '#0F172A',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: active ? 0.22 : 0.06,
                  shadowRadius: active ? 8 : 4,
                  elevation: active ? 4 : 1,
                }}
              >
                {done ? (
                  <StepDoneMark size={16} color="#FFFFFF" />
                ) : (
                  <Icon
                    size={17}
                    color={active ? COLORS.white : COLORS.primary}
                    strokeWidth={2.4}
                  />
                )}
              </Box>
            ) : (
              <Box
                style={{
                  width: node,
                  height: node,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done ? DONE_GREEN : '#FFFFFF',
                  borderWidth: active ? 3 : done ? 0 : 2,
                  borderColor: active
                    ? hexAlpha('#FFFFFF', 0.95)
                    : done
                      ? 'transparent'
                      : hexAlpha('#FFFFFF', 0.7),
                  shadowColor: done ? DONE_GREEN_DEEP : '#0F172A',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: done || active ? 0.22 : 0.1,
                  shadowRadius: done || active ? 6 : 4,
                  elevation: done || active ? 4 : 2,
                }}
              >
                {done ? (
                  <StepDoneMark size={16} color="#FFFFFF" />
                ) : active ? (
                  <Icon size={16} color={COLORS.primary} strokeWidth={2.5} />
                ) : (
                  <Text
                    style={{
                      fontFamily: FONTS.bold,
                      fontSize: 13,
                      color: hexAlpha(COLORS.primaryDeep, 0.45),
                    }}
                  >
                    {stepNum}
                  </Text>
                )}
              </Box>
            );

            const labelColor = premium
              ? done
                ? DONE_GREEN_DEEP
                : active
                  ? COLORS.primaryDeep
                  : COLORS.ink
              : done
                ? '#A7F3D0'
                : active
                  ? '#FFFFFF'
                  : hexAlpha('#FFFFFF', 0.55);

            return (
              <VStack
                key={item.label}
                className="items-center"
                style={{ flex: 1, gap: premium ? 5 : 8 }}
              >
                {canPress ? (
                  <Pressable
                    onPress={() => onStepPress?.(stepNum)}
                    accessibilityRole="button"
                    accessibilityLabel={`Go back to ${item.label}`}
                    hitSlop={8}
                    className="active:opacity-80"
                  >
                    {nodeInner}
                  </Pressable>
                ) : (
                  <Box
                    accessibilityState={{ selected: active, disabled: pending }}
                    accessibilityLabel={
                      active ? `Current step ${item.label}` : item.label
                    }
                  >
                    {nodeInner}
                  </Box>
                )}
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: active || done ? FONTS.bold : FONTS.semibold,
                    fontSize: premium ? 11 : 11,
                    letterSpacing: 0.3,
                    color: labelColor,
                    textAlign: 'center',
                  }}
                >
                  {item.short}
                </Text>
              </VStack>
            );
          })}
        </HStack>
      </Box>
    </Box>
  );
}

export function SectionTitle({
  title,
  subtitle,
  accent = COLORS.primary,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <HStack className="items-start" style={{ gap: SPACE[3], marginBottom: SPACE[2] }}>
      <Box
        style={{
          width: 3,
          alignSelf: 'stretch',
          borderRadius: 999,
          marginTop: 3,
          backgroundColor: accent,
        }}
      />
      <VStack className="flex-1" style={{ gap: 4 }}>
        <Text style={TYPE.title}>{title}</Text>
        {subtitle ? (
          <Text style={{ ...TYPE.caption, lineHeight: 18 }}>{subtitle}</Text>
        ) : null}
      </VStack>
    </HStack>
  );
}

export function SurveyCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const { themeId } = useTheme();
  return (
    <Box
      key={themeId}
      className={className}
      style={cardSurfaceStyle({ marginHorizontal: SPACE.gutter })}
    >
      {children}
    </Box>
  );
}

/**
 * Engineer premium step body card — same chrome as ZC details (Step 1).
 */
export function PremiumStepCard({
  icon: Icon,
  title,
  subtitle,
  badge,
  children,
  dense = false,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
  /** Tighter padding — Review / Validate summary stacks. */
  dense?: boolean;
}) {
  return (
    <Box style={{ paddingHorizontal: SPACE.gutter }}>
      <Box
        style={{
          backgroundColor: COLORS.white,
          borderRadius: dense ? 14 : 18,
          padding: dense ? 8 : 10,
          borderWidth: 1.5,
          borderColor: hexAlpha(COLORS.primary, 0.28),
          shadowColor: COLORS.primaryDeep,
          shadowOffset: { width: 0, height: dense ? 2 : 4 },
          shadowOpacity: dense ? 0.08 : 0.12,
          shadowRadius: dense ? 6 : 10,
          elevation: dense ? 2 : 4,
        }}
      >
        <HStack
          className="items-start justify-between"
          style={{ gap: 6, marginBottom: subtitle || children ? (dense ? 4 : 8) : 0 }}
        >
          <HStack className="items-start" style={{ gap: 6, flex: 1, minWidth: 0 }}>
            <Box
              style={{
                width: dense ? 26 : 30,
                height: dense ? 26 : 30,
                borderRadius: dense ? 8 : 10,
                backgroundColor: '#EEF4FF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={dense ? 13 : 15} color={COLORS.primary} strokeWidth={2.3} />
            </Box>
            <VStack style={{ flex: 1, minWidth: 0, gap: 0 }}>
              <Text
                style={{
                  fontFamily: FONTS.bold,
                  fontSize: dense ? 15 : 16,
                  color: '#1A368E',
                }}
                numberOfLines={2}
              >
                {title.endsWith(' *') ? (
                  <>
                    {title.slice(0, -2)}
                    <Text style={{ color: '#DC2626', fontFamily: FONTS.bold }}> *</Text>
                  </>
                ) : title.endsWith('*') ? (
                  <>
                    {title.slice(0, -1)}
                    <Text style={{ color: '#DC2626', fontFamily: FONTS.bold }}>*</Text>
                  </>
                ) : (
                  title
                )}
              </Text>
              {subtitle ? (
                <Text
                  style={{
                    fontFamily: FONTS.semibold,
                    fontSize: dense ? 11 : 12,
                    lineHeight: dense ? 14 : 16,
                    color: '#475569',
                  }}
                  numberOfLines={2}
                >
                  {subtitle}
                </Text>
              ) : null}
            </VStack>
          </HStack>
          {badge ? <Box style={{ flexShrink: 0 }}>{badge}</Box> : null}
        </HStack>
        {children}
      </Box>
    </Box>
  );
}

export function SurveyHero({
  title,
  subtitle,
  onBack,
  step,
  showSteps = true,
  total = 5,
  badge: _badge,
  watermark,
  go,
  variant = 'default',
  onStepPress,
  showHeroArt = true,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  step?: number;
  showSteps?: boolean;
  total?: number;
  /** @deprecated Header status line removed — kept for call-site compatibility. */
  badge?: string;
  watermark?: 'compass';
  go?: Go;
  variant?: 'default' | 'premium';
  onStepPress?: (targetStep: number) => void;
  /** City/pin illustration on premium headers (off for Validate). */
  showHeroArt?: boolean;
}) {
  void _badge;
  const insets = useSafeAreaInsets();
  const isPremium = variant === 'premium';
  const displayTitle = step != null ? `Step ${step} - ${title}` : title;
  const underTitle = subtitle;
  /** Show subtitle when there is no step rail (e.g. Validate Report). */
  const showSubtitle = Boolean(underTitle) && !(showSteps && step != null);
  const { themeId } = useTheme();
  const fg = headerFg();

  const solid = usesSolidHeader();
  const light = usesLightHeader();
  const normal = usesNormalHeader();

  /** Engineer premium flow — compact white + blue-shade mock header. */
  if (isPremium) {
    return (
      <Box key={themeId}>
        <Box
          style={{
            backgroundColor: '#F7FAFF',
            paddingHorizontal: SPACE.gutter,
            paddingTop: insets.top + 8,
            paddingBottom: 10,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: 'rgba(26,86,219,0.12)',
            zIndex: 2,
          }}
        >
          <HStack className="items-start" style={{ gap: 10 }}>
            <Pressable
              onPress={onBack}
              hitSlop={10}
              className="active:opacity-75"
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                backgroundColor: COLORS.white,
                borderWidth: 1,
                borderColor: 'rgba(26,86,219,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <ArrowLeft size={16} color={COLORS.primaryDeep} strokeWidth={2.3} />
            </Pressable>

            <VStack className="flex-1 min-w-0" style={{ gap: 3, flexShrink: 1 }}>
              {step != null ? (
                <Box
                  style={{
                    alignSelf: 'flex-start',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: COLORS.primary,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.bold,
                      fontSize: 10,
                      letterSpacing: 0.6,
                      color: COLORS.white,
                      textTransform: 'uppercase',
                    }}
                  >
                    Step {step} of {total}
                  </Text>
                </Box>
              ) : null}
              <Text
                style={{
                  fontFamily: FONTS.displayBold,
                  fontSize: 20,
                  lineHeight: 24,
                  color: '#1A368E',
                  letterSpacing: -0.3,
                  flexWrap: 'wrap',
                }}
                numberOfLines={2}
              >
                {title}
              </Text>
              {showSubtitle ? (
                <Text
                  style={{
                    fontFamily: FONTS.semibold,
                    fontSize: 12,
                    lineHeight: 16,
                    color: '#475569',
                  }}
                  numberOfLines={2}
                >
                  {underTitle}
                </Text>
              ) : null}
            </VStack>

            {showHeroArt ? (
              <Box style={{ flexShrink: 0, marginTop: -4 }}>
                <SurveyStepHeroArt size={78} />
              </Box>
            ) : null}
          </HStack>

          {showSteps && step ? (
            <Box
              style={{
                marginTop: 8,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: hexAlpha(COLORS.primary, 0.28),
                backgroundColor: COLORS.white,
                paddingHorizontal: 6,
                paddingVertical: 6,
              }}
            >
              <StepRail
                step={step}
                total={total}
                variant="premium"
                onStepPress={onStepPress}
              />
            </Box>
          ) : null}
        </Box>
      </Box>
    );
  }

  const headerBody = (
    <>
      <HStack className="items-start" style={{ gap: SPACE[3] }}>
        <Pressable
          onPress={onBack}
          hitSlop={10}
          className="active:opacity-75"
          style={{
            width: 42,
            height: 42,
            borderRadius: DESIGN.buttonRadius,
            overflow: 'hidden',
            marginTop: 2,
            backgroundColor: fg.chipBg,
            borderWidth: 1,
            borderColor: fg.chipBorder,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={18} color={fg.icon} strokeWidth={2.3} />
        </Pressable>

        <VStack className="flex-1 min-w-0" style={{ gap: 6 }}>
          {step != null ? (
            <HStack className="items-center" style={{ gap: 8 }}>
              <Box
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                  borderRadius: DESIGN.chipRadius,
                  backgroundColor: fg.chipBg,
                  borderWidth: 1,
                  borderColor: fg.chipBorder,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.bold,
                    fontSize: 12,
                    letterSpacing: 0.6,
                    color: fg.chipText,
                    textTransform: 'uppercase',
                  }}
                >
                  Step {step} / {total}
                </Text>
              </Box>
            </HStack>
          ) : null}
          <Text
            style={{
              fontFamily: FONTS.displayBold,
              fontSize: 20,
              lineHeight: 26,
              color: fg.title,
              letterSpacing: -0.35,
            }}
            numberOfLines={2}
          >
            {step != null ? title : displayTitle}
          </Text>
          {showSubtitle ? (
            <Text
              style={{
                fontFamily: FONTS.semibold,
                fontSize: 12,
                lineHeight: 16,
                color: fg.muted,
              }}
              numberOfLines={3}
            >
              {underTitle}
            </Text>
          ) : null}
        </VStack>
      </HStack>

      {showSteps && step ? (
        <StepRail
          step={step}
          total={total}
          variant="default"
          onStepPress={onStepPress}
        />
      ) : null}
    </>
  );

  return (
    <Box key={themeId}>
      {light ? (
        <Box
          style={{
            backgroundColor: COLORS.white,
            paddingHorizontal: SPACE.gutter,
            paddingTop: insets.top + SPACE[2],
            paddingBottom: SPACE[4],
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
            zIndex: 2,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: 'rgba(15,23,42,0.08)',
          }}
        >
          {headerBody}
        </Box>
      ) : solid ? (
        <LinearGradient
          colors={gradientStops(GRADIENT_HEADER)}
          start={DESIGN.headerStart}
          end={DESIGN.headerEnd}
          style={{
            paddingHorizontal: SPACE.gutter,
            paddingTop: insets.top + SPACE[2],
            paddingBottom: SPACE[4],
          }}
        >
          {headerBody}
        </LinearGradient>
      ) : (
        <>
          <Box
            style={{
              overflow: 'hidden',
              zIndex: 1,
              ...(isMeshDesign()
                ? {
                    borderBottomLeftRadius: DESIGN.headerRadius || 40,
                    borderBottomRightRadius: Math.round((DESIGN.headerRadius || 40) * 0.35),
                  }
                : null),
            }}
          >
            <HeaderMeshBackground />
            <Box
              style={{
                paddingHorizontal: SPACE.gutter,
                paddingTop: insets.top + SPACE[2],
                paddingBottom: isMeshDesign() ? SPACE[5] : SPACE[8],
                zIndex: 2,
              }}
            >
              {headerBody}
            </Box>
          </Box>
          {isMeshDesign() ? (
            <MeshSheetEdge height={showSteps && step ? 68 : 64} fill={COLORS.white} />
          ) : (
            <WaveSheetEdge
              height={showSteps && step ? 60 : 56}
              fill={COLORS.white}
              variant={isWaveDesign() ? 'glass' : 'sheet'}
            />
          )}
        </>
      )}
    </Box>
  );
}


function CompactSurveyHeader({
  title,
  onBack,
  step,
  total = 5,
  premium = false,
}: {
  title: string;
  onBack: () => void;
  step?: number;
  total?: number;
  badge?: string;
  go?: Go;
  /** Engineer flow — keep white (no blue bar). */
  premium?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const displayTitle = step != null ? `Step ${step} - ${title}` : title;
  const light = usesLightHeader() || premium;
  const fg = headerFg();
  const stepR = DESIGN.stepRadius > 40 ? 999 : DESIGN.stepRadius;

  return (
    <Box
      className="absolute top-0 left-0 right-0"
      style={{
        zIndex: 40,
        elevation: light ? 4 : 12,
        shadowColor: light ? '#0F172A' : COLORS.primaryDeep,
        shadowOffset: { width: 0, height: light ? 2 : 6 },
        shadowOpacity: light ? 0.06 : 0.18,
        shadowRadius: light ? 6 : 12,
      }}
      pointerEvents="box-none"
    >
      {light ? (
        <Box
          style={{
            backgroundColor: premium ? '#F7FAFF' : COLORS.white,
            paddingTop: insets.top + 6,
            paddingBottom: 10,
            paddingHorizontal: 12,
            borderBottomWidth: 1,
            borderBottomColor: premium
              ? 'rgba(26,86,219,0.12)'
              : hexAlpha(COLORS.ink, 0.06),
          }}
        >
          <HStack className="items-center gap-2.5">
            <Pressable
              onPress={onBack}
              hitSlop={10}
              className="items-center justify-center active:opacity-75"
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: COLORS.white,
                borderWidth: 1,
                borderColor: premium ? 'rgba(26,86,219,0.2)' : 'rgba(15,23,42,0.12)',
              }}
            >
              <ArrowLeft size={16} color={COLORS.primaryDeep} strokeWidth={2.2} />
            </Pressable>
            <VStack className="flex-1 min-w-0" style={{ gap: 2 }}>
              {premium && step != null ? (
                <Text
                  style={{
                    fontFamily: FONTS.bold,
                    fontSize: 10,
                    letterSpacing: 0.5,
                    color: COLORS.primary,
                    textTransform: 'uppercase',
                  }}
                  numberOfLines={1}
                >
                  Step {step} of {total}
                </Text>
              ) : null}
              <Text
                style={{
                  fontFamily: FONTS.bold,
                  fontSize: 14,
                  color: COLORS.primaryDeep,
                }}
                numberOfLines={1}
              >
                {premium ? title : displayTitle}
              </Text>
            </VStack>
            {premium ? <SurveyStepHeroArt size={56} /> : null}
          </HStack>
        </Box>
      ) : (
        <LinearGradient
          colors={gradientStops(GRADIENT_PRIMARY)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 6,
            paddingBottom: 10,
            paddingHorizontal: 12,
            overflow: 'hidden',
          }}
        >
          <HStack className="items-center gap-2.5">
            <Pressable
              onPress={onBack}
              hitSlop={10}
              className="items-center justify-center active:opacity-75"
              style={{
                width: 32,
                height: 32,
                borderRadius: stepR,
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={gradientStops(GRADIENT_PRIMARY)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: hexAlpha(COLORS.primaryGlow, 0.4),
                  borderRadius: stepR,
                }}
              >
                <ArrowLeft size={16} color="#fff" strokeWidth={2.2} />
              </LinearGradient>
            </Pressable>
            <VStack className="flex-1 min-w-0">
              <Text className="text-white text-[14px] font-bold" numberOfLines={1}>
                {displayTitle}
              </Text>
            </VStack>
          </HStack>
        </LinearGradient>
      )}
    </Box>
  );
}

export function StickyBar({
  children,
  compactBottom = false,
  variant = 'default',
}: {
  children: ReactNode;
  compactBottom?: boolean;
  variant?: 'default' | 'premium';
}) {
  const insets = useSafeAreaInsets();

  return (
    <Box
      style={{
        paddingHorizontal: SPACE.gutter,
        paddingTop: SPACE[1],
        paddingBottom: compactBottom ? 2 : Math.max(insets.bottom, SPACE[2]),
        backgroundColor: variant === 'premium' ? GLASS.card : COLORS.white,
        borderTopWidth: 1,
        borderTopColor: variant === 'premium' ? GLASS.border : COLORS.border,
        shadowColor: COLORS.ink,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 8,
      }}
    >
      {children}
    </Box>
  );
}

function blurSurveyFocus() {
  Keyboard.dismiss();
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const el = document.activeElement as { blur?: () => void } | null;
    el?.blur?.();
  }
}

/** Compact full-width Continue — same size across all survey steppers. */
export function FooterContinueBtn({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const blocked = Boolean(disabled || loading);
  const { themeId } = useTheme();
  return (
    <Pressable
      key={themeId}
      disabled={blocked}
      onPress={() => {
        blurSurveyFocus();
        onPress?.();
      }}
      className={blocked ? '' : 'active:opacity-92'}
      style={{
        height: DESIGN.ctaHeight,
        borderRadius: 999,
        overflow: 'hidden',
        opacity: blocked ? 0.42 : 1,
        shadowColor: COLORS.primaryDeep,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: DESIGN.shadowOpacity + 0.12,
        shadowRadius: DESIGN.shadowRadius,
        elevation: DESIGN.elevation + 2,
      }}
    >
      <LinearGradient
        colors={gradientStops(GRADIENT_PRIMARY)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingHorizontal: 16,
        }}
      >
        <Text
          style={{
            fontFamily: FONTS.bold,
            fontSize: 15,
            letterSpacing: 0.2,
            color: COLORS.white,
          }}
          numberOfLines={1}
        >
          {loading ? 'Saving…' : label}
        </Text>
        {!loading ? <ArrowRight size={17} color={COLORS.white} strokeWidth={2.6} /> : null}
      </LinearGradient>
    </Pressable>
  );
}

export function SurveyScaffold({
  title,
  subtitle,
  onBack,
  step,
  total = 5,
  badge,
  showSteps = true,
  watermark,
  children,
  footer,
  go,
  surface = 'default',
  onStepNav,
  hero,
  showHeroArt = true,
  loading,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  step?: number;
  total?: number;
  badge?: string;
  showSteps?: boolean;
  watermark?: 'compass';
  children: ReactNode;
  footer?: ReactNode;
  go?: Go;
  /** Cleaner engineer flow styling */
  surface?: 'default' | 'premium';
  /** Extra work after jumping to a prior step (e.g. reloadBackendDraft). */
  onStepNav?: () => void;
  /** Optional custom header (e.g. Create-style Review header). */
  hero?: ReactNode;
  /** City/pin illustration on premium headers (off for Validate). */
  showHeroArt?: boolean;
  loading?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [compact, setCompact] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const keyboardOpenRef = useRef(false);
  const isPremium = surface === 'premium';
  const { themeId } = useTheme();
  const pageLoading = useMinimumLoading(loading !== undefined ? loading : true, 300);
  /** Device back button mirrors the survey header back control. */
  useHardwareBack(onBack);

  const handleStepPress = (targetStep: number) => {
    if (step == null || targetStep >= step || targetStep < 1) return;
    // Step 1 from later steps: same destination as header back when leaving step 2,
    // otherwise jump to that step's screen.
    if (targetStep === step - 1) {
      onBack();
      return;
    }
    const screen = screenForSurveyStep(targetStep, total);
    if (!screen || !go) {
      onBack();
      return;
    }
    go(screen, { replace: true });
    onStepNav?.();
  };

  useEffect(() => {
    // keyboardWill* fires before layout settles — freeze compact header early.
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        keyboardOpenRef.current = true;
        setKeyboardOpen(true);
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        keyboardOpenRef.current = false;
        setKeyboardOpen(false);
      }
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // New step / surface → reset sticky compact so the full hero shows first.
  useEffect(() => {
    setCompact(false);
  }, [step, isPremium, title]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (keyboardOpenRef.current) return;
    const y = e.nativeEvent.contentOffset.y;
    const next = y > COMPACT_SCROLL_THRESHOLD;
    setCompact((prev) => (prev === next ? prev : next));
  };

  return (
    <ScreenShell key={themeId} className="bg-background">
      <BdaPageWatermark />
      {/*
        Plain style (no Uniwind className), wrapping scroll + footer.
        iOS: padding. Android: height only while keyboard is open (avoids Expo 54 sticky gap).
        Do not combine with automaticallyAdjustKeyboardInsets — that remounts focus.
      */}
      <KeyboardAvoidingView
        style={{ flex: 1, zIndex: 1 }}
        enabled={Platform.OS !== 'web'}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : Platform.OS === 'android' && keyboardOpen
              ? 'height'
              : undefined
        }
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 24}
      >
        {/*
          Sticky compact header for all survey themes (default + engineer premium),
          including Review — pins back + title while the large hero scrolls away.
        */}
        <Box
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            elevation: 20,
          }}
        >
          {compact ? (
            <CompactSurveyHeader
              title={title}
              onBack={onBack}
              step={step}
              total={total}
              premium={isPremium}
            />
          ) : null}
        </Box>

        <ScrollView
          key={`survey-scroll-${step ?? 0}-${isPremium ? 'p' : 'd'}`}
          className="flex-1"
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: footer
              ? STICKY_FOOTER_HEIGHT + Math.max(insets.bottom, SPACE[2]) + FOOTER_SCROLL_BUFFER
              : 24 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
          // "always" on web: parent dismiss handlers steal TextInput focus in Chrome.
          keyboardShouldPersistTaps={Platform.OS === 'web' ? 'always' : 'handled'}
          keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
          nestedScrollEnabled
          scrollEventThrottle={16}
          onScroll={onScroll}
        >
          <View>
            {hero ?? (
              <SurveyHero
                title={title}
                subtitle={subtitle}
                onBack={onBack}
                step={step}
                total={total}
                badge={badge}
                showSteps={showSteps}
                watermark={watermark}
                go={go}
                variant={isPremium ? 'premium' : 'default'}
                onStepPress={handleStepPress}
                showHeroArt={showHeroArt}
              />
            )}

            <Box
              style={{
                gap: isPremium ? (showSteps ? 8 : 8) : DESIGN.sectionGap,
                paddingTop: isPremium ? (showSteps ? 10 : 4) : Math.max(14, DESIGN.headerCardGap ?? 14),
                backgroundColor: 'transparent',
                paddingBottom: isPremium ? (showSteps ? 8 : 4) : DESIGN.sectionGap,
              }}
            >
              {pageLoading ? (
                <Box style={{ minHeight: 360, justifyContent: 'center', alignItems: 'center' }}>
                  <ScreenLoader minHeight={340} />
                </Box>
              ) : (
                <Box style={{ gap: isPremium ? (showSteps ? 6 : 8) : DESIGN.sectionGap }}>
                  {children}
                </Box>
              )}
            </Box>
          </View>
        </ScrollView>

        {footer ? (
          <StickyBar compactBottom={keyboardOpen} variant={isPremium ? 'premium' : 'default'}>
            {footer}
          </StickyBar>
        ) : null}
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

export function WorkspaceHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  iconBg = COLORS.primary,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  badge?: string;
  iconBg?: string;
}) {
  return (
    <Box
      style={{
        paddingHorizontal: SPACE.gutter,
        paddingTop: SPACE[2],
        paddingBottom: SPACE[2],
      }}
    >
      <HStack className="items-start" style={{ gap: SPACE[2] }}>
        <Box
          className="items-center justify-center"
          style={{
            width: 44,
            height: 44,
            borderRadius: DESIGN.stepRadius > 40 ? 999 : DESIGN.stepRadius,
            backgroundColor: iconBg,
            marginTop: 2,
          }}
        >
          <Icon size={18} color="#fff" strokeWidth={2.3} />
        </Box>
        <VStack className="flex-1 min-w-0" style={{ gap: 3, paddingRight: badge ? SPACE[1] : 0 }}>
          {typeof title === 'string' && title.includes('*') ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 3 }}>
              <Text
                style={{ ...TYPE.title, color: COLORS.ink, flexShrink: 1 }}
                numberOfLines={2}
              >
                {title.replace(/\s*\*\s*/g, '')}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#DC2626', lineHeight: 22 }}>*</Text>
            </View>
          ) : (
            <Text style={{ ...TYPE.title, color: COLORS.ink }} numberOfLines={2}>
              {title}
            </Text>
          )}
          <Text style={{ ...TYPE.caption, color: COLORS.ink }} numberOfLines={3}>
            {subtitle}
          </Text>
        </VStack>
        {badge ? (
          <Box
            style={{
              flexShrink: 0,
              marginTop: 2,
              paddingHorizontal: SPACE[2],
              paddingVertical: SPACE[1],
              borderRadius: DESIGN.chipRadius,
              backgroundColor: COLORS.white,
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <Text
              style={{
                ...TYPE.caption,
                fontFamily: FONTS.bold,
                color: COLORS.ink,
              }}
            >
              {badge}
            </Text>
          </Box>
        ) : null}
      </HStack>
    </Box>
  );
}

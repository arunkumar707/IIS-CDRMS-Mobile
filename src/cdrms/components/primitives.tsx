import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Bell,
  Check,
  Clock,
  FileText,
  Home,
  LogOut,
  MapPin,
  Plus,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import React, { type ReactNode, forwardRef, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type TextInputProps,
} from 'react-native';
import { useHardwareBack } from '@/src/cdrms/hooks/useHardwareBack';
import type { View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Box } from '@/components/ui/box';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { KeyboardAvoidingView } from '@/components/ui/keyboard-avoiding-view';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/src/auth/AuthContext';
import { resolveAppRole, displayName, roleDisplayTitle } from '@/src/auth/roles';
import { PremiumGradientBackground } from '@/src/cdrms/components/GlassSurface';
import { HeaderMeshBackground, MeshSheetEdge, WaveSheetEdge } from '@/src/cdrms/components/WaveDecor';
import { COLORS, DESIGN, FONTS, GLASS, GRADIENT_CARD_HEADER, GRADIENT_HEADER, GRADIENT_PRIMARY, SPACE, TYPE, gradientStops, headerFg, hexAlpha, isMeshDesign, isWaveDesign, usesLightHeader, usesNormalHeader, usesSolidHeader } from '@/src/cdrms/theme';
import { cardSurfaceStyle } from '@/src/cdrms/lib/cardSurface';
import type { Go, NavTab, Screen } from '@/src/cdrms/types';
import { useTheme } from '@/src/theme/ThemeContext';
import { NotificationBell } from '@/src/cdrms/components/NotificationBell';
import { useProject } from '@/src/cdrms/project/ProjectContext';
import { applicationStatusTone } from '@/src/api/applications';

/** Edge-pinned tab bar — soft U-notch cradles the center + */
const BAR_H = 64;
const FAB_SIZE = 50;
const FAB_GAP = 6;
const NOTCH_R = FAB_SIZE / 2 + FAB_GAP;

export function ScreenShell({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: object;
}) {
  const { themeId } = useTheme();
  // Keep this a plain full-screen shell. Form screens add KeyboardAvoidingView
  // inside SurveyScaffold (iOS-only) so KAV does not fight every screen.
  return (
    <Box
      key={themeId}
      className={`flex-1 bg-background ${className}`}
      style={[{ backgroundColor: COLORS.soft, overflow: 'hidden', minHeight: 0 }, style]}
    >
      <Box style={{ flex: 1, zIndex: 1, minHeight: 0 }}>{children}</Box>
    </Box>
  );
}

export function GradientHeader({
  children,
  className = '',
  rounded = true,
  colors,
}: {
  children: ReactNode;
  className?: string;
  rounded?: boolean;
  /** Override gradient — use AUTH_GRADIENT_HEADER on login/splash. */
  colors?: readonly [string, string, ...string[]] | readonly string[];
}) {
  const insets = useSafeAreaInsets();
  const { themeId } = useTheme();
  // Ocean Blue (solid) · Plain (light) · Mesh (scallops) · else mesh + wave
  const light = usesLightHeader();
  const solid = usesSolidHeader() || Boolean(colors?.length);
  const normal = light || solid || usesNormalHeader();
  const mesh = isMeshDesign();
  const showWaveEdge = !normal;

  return (
    <Box key={themeId} style={!normal ? { zIndex: 30, elevation: 8 } : undefined}>
      <Box
        style={{
          backgroundColor: light ? COLORS.white : undefined,
          ...(light
            ? {
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 6,
                elevation: 2,
                zIndex: 2,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: 'rgba(15,23,42,0.08)',
              }
            : mesh
              ? {
                  overflow: 'hidden',
                  zIndex: 1,
                  borderBottomLeftRadius: DESIGN.headerRadius || 40,
                  borderBottomRightRadius: Math.round((DESIGN.headerRadius || 40) * 0.35),
                }
              : { overflow: 'hidden', zIndex: 1 }),
        }}
      >
        {light ? null : solid ? (
          <PremiumGradientBackground
            colors={colors?.length ? colors : GRADIENT_HEADER}
            start={DESIGN.headerStart}
            end={DESIGN.headerEnd}
          />
        ) : (
          <HeaderMeshBackground />
        )}
        <Box
          style={{
            paddingTop: insets.top + SPACE[2],
            paddingBottom: normal ? SPACE[4] : mesh ? SPACE[5] : SPACE[8],
            zIndex: 1,
          }}
          className={className}
        >
          {children}
        </Box>
      </Box>
      {showWaveEdge ? (
        mesh ? (
          <MeshSheetEdge height={64} fill={COLORS.white} />
        ) : (
          <WaveSheetEdge
            height={56}
            fill={COLORS.white}
            variant={isWaveDesign() ? 'glass' : 'sheet'}
          />
        )
      ) : null}
    </Box>
  );
}

export function ProfileMenu({
  gradient,
  userName,
  roleName,
  loginId,
  photoUrl,
  zoneLabel,
  onLogout,
  onProfile,
}: {
  gradient: boolean;
  userName: string;
  roleName?: string | null;
  loginId?: string | null;
  photoUrl?: string | null;
  zoneLabel?: string | null;
  onLogout: () => void;
  /** When set, tapping the avatar in the open menu navigates to the profile page. */
  onProfile?: () => void;
}) {
  const { themeId } = useTheme();
  const [open, setOpen] = useState(false);
  const [dropTop, setDropTop] = useState(100);
  const btnRef = useRef<RNView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-10)).current;

  const openMenu = () => {
    // measureInWindow is reliable when the avatar sits in a collapsing sticky header
    const place = () => {
      btnRef.current?.measureInWindow((_x, y, _w, h) => {
        setDropTop(Math.max(8, y + h + 4));
      });
    };
    place();
    setOpen(true);
    // Re-measure after open in case layout was mid-collapse
    requestAnimationFrame(place);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 300 }),
    ]).start();
  };

  const closeMenu = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -10, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setOpen(false);
      cb?.();
    });
  };

  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const avatarContent = photoUrl ? (
    <Image
      source={{ uri: photoUrl }}
      style={{ width: '100%', height: '100%', borderRadius: 999 }}
      resizeMode="cover"
    />
  ) : (
    <Text
      style={{
        fontFamily: FONTS.bold,
        fontSize: 14,
        color: COLORS.primaryDeep,
        lineHeight: 18,
      }}
    >
      {initials || '?'}
    </Text>
  );

  const dropdownAvatarContent = photoUrl ? (
    <Image
      source={{ uri: photoUrl }}
      style={{ width: '100%', height: '100%', borderRadius: 999 }}
      resizeMode="cover"
    />
  ) : (
    <Text style={{ fontFamily: FONTS.bold, fontSize: 18, color: COLORS.white }}>
      {initials || '?'}
    </Text>
  );

  return (
    <>
      {/* Trigger avatar button — solid fill so it stays visible & tappable over watermarks */}
      <Pressable
        ref={btnRef as any}
        onPress={openMenu}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Profile menu"
        className="active:opacity-80"
        style={{
          height: 40,
          width: 40,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: gradient ? COLORS.white : COLORS.muted,
          borderWidth: 1.5,
          borderColor: gradient ? 'rgba(255,255,255,0.95)' : COLORS.border,
          overflow: 'hidden',
          zIndex: 50,
          elevation: 14,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.16,
          shadowRadius: 4,
        }}
      >
        {avatarContent}
      </Pressable>

      <Modal transparent animationType="none" visible={open} onRequestClose={() => closeMenu()}>
        <View style={{ flex: 1 }}>
          {/* Backdrop — behind the solid profile card */}
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => closeMenu()}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />

          {/* Dropdown card — opaque so menu actions stay clickable */}
          <Animated.View
            key={themeId}
            pointerEvents="box-none"
            style={[
              {
                position: 'absolute',
                top: dropTop,
                right: 12,
                width: 232,
                borderRadius: 20,
                backgroundColor: COLORS.white,
                shadowColor: GLASS.shadow,
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.22,
                shadowRadius: 24,
                elevation: 24,
                overflow: 'visible',
                zIndex: 20,
              },
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View pointerEvents="auto">
          {/* Caret arrow pointing up */}
          <View
            style={{
              position: 'absolute',
              top: -7,
              right: 14,
              width: 14,
              height: 7,
              overflow: 'visible',
              zIndex: 10,
            }}
            pointerEvents="none"
          >
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: 7,
                borderRightWidth: 7,
                borderBottomWidth: 7,
                borderStyle: 'solid',
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderBottomColor: COLORS.primaryDeep,
              }}
            />
          </View>

          {/* Gradient profile header */}
          <View style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }}>
            <LinearGradient
              colors={gradientStops(GRADIENT_HEADER)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 15 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {/* Avatar — tap to open Profile */}
                <Pressable
                  onPress={() => {
                    if (!onProfile) return;
                    closeMenu(onProfile);
                  }}
                  disabled={!onProfile}
                  accessibilityRole="button"
                  accessibilityLabel="Open profile"
                  className="active:opacity-80"
                  style={{
                    height: 50,
                    width: 50,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: 'rgba(255,255,255,0.55)',
                    overflow: 'hidden',
                  }}
                >
                  {dropdownAvatarContent}
                </Pressable>

                {/* Name + role + loginId */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{ fontFamily: FONTS.bold, fontSize: 14, color: COLORS.white, lineHeight: 20 }}
                    numberOfLines={1}
                  >
                    {userName}
                  </Text>

                  {roleName ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <View
                        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success }}
                      />
                      <Text
                        style={{
                          fontFamily: FONTS.medium ?? FONTS.regular,
                          fontSize: 13,
                          color: 'rgba(255,255,255,0.85)',
                        }}
                        numberOfLines={1}
                      >
                        {roleName}
                      </Text>
                    </View>
                  ) : null}

                  {loginId ? (
                    <Text
                      style={{
                        fontFamily: FONTS.regular,
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.65)',
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                    >
                      ID: {loginId}
                    </Text>
                  ) : null}

                  {zoneLabel ? (
                    <Box style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                      <ZoneTag zone={zoneLabel} onGradient />
                    </Box>
                  ) : null}
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: COLORS.muted }} />

          {/* Logout row */}
          <Pressable
            onPress={() => closeMenu(onLogout)}
            accessibilityRole="button"
            accessibilityLabel="Logout"
            className="active:opacity-70"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              backgroundColor: COLORS.white,
            }}
          >
            <View
              style={{
                height: 34,
                width: 34,
                borderRadius: 10,
                backgroundColor: `${COLORS.destructive}14`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LogOut size={16} color={COLORS.destructive} />
            </View>
            <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: COLORS.destructive }}>Logout</Text>
          </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

export function AppHeader({
  title,
  onBack,
  right,
  gradient = true,
  subtitle,
  go,
  showLogout = true,
  showNotifications = true,
  welcome = false,
  compact = false,
  zoneLabel,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  gradient?: boolean;
  subtitle?: string;
  go?: Go;
  showLogout?: boolean;
  showNotifications?: boolean;
  /** Home greeting: larger “Welcome” + smaller name on the next line. */
  welcome?: boolean;
  /** Tighter padding for secondary screens (create / forms). */
  compact?: boolean;
  /** Zone code shown on welcome header + profile menu. */
  zoneLabel?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const { themeId } = useTheme();
  const { logout, isAuthenticated, user } = useAuth();
  /** Device back button mirrors the in-app header back control. */
  useHardwareBack(onBack);
  const backRadius = DESIGN.stepRadius > 40 ? 999 : DESIGN.stepRadius;
  const role = resolveAppRole(user);
  const isCompactOfficeNav =
    role === 'zc' || role === 'cao' || role === 'super_admin';
  const canLogout = Boolean(showLogout && isAuthenticated && go);
  /** Prefer explicit prop; fall back to post zone from login/profile. */
  const resolvedZone =
    zoneLabel?.trim() || user?.activePost?.zoneCode?.trim() || null;

  const onLogout = async () => {
    await logout();
    go?.('login');
  };

  const userName = displayName(user);
  const welcomeTitle = welcome ? 'Welcome' : title;
  const welcomeSubtitle = welcome ? subtitle || userName : subtitle;

  const titleBlock = (onGradient: boolean) => {
    const fg = headerFg();
    const titleColor = onGradient ? fg.title : COLORS.ink;
    const subColor = onGradient ? fg.soft : COLORS.slate;
    const capColor = onGradient ? fg.muted : undefined;

    return welcome ? (
      <VStack className="flex-1 min-w-0" style={{ gap: isCompactOfficeNav ? 1 : 3 }}>
        <Text
          style={{
            fontFamily: FONTS.bold,
            fontSize: isCompactOfficeNav ? 20 : 22,
            lineHeight: isCompactOfficeNav ? 24 : 28,
            letterSpacing: -0.3,
            color: titleColor,
          }}
          numberOfLines={1}
        >
          {welcomeTitle}
        </Text>
        {welcomeSubtitle ? (
          <Text
            style={{
              fontFamily: FONTS.semibold,
              fontSize: isCompactOfficeNav ? 13 : 14,
              lineHeight: isCompactOfficeNav ? 16 : 18,
              letterSpacing: 0.1,
              color: subColor,
            }}
            numberOfLines={1}
          >
            {welcomeSubtitle}
          </Text>
        ) : null}
      </VStack>
    ) : (
      <VStack className="flex-1 min-w-0" style={{ gap: 2 }}>
        <Text
          style={
            onGradient
              ? { ...TYPE.screen, color: titleColor, fontFamily: FONTS.bold }
              : TYPE.screen
          }
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={
              onGradient
                ? { ...TYPE.caption, color: capColor ?? fg.muted }
                : TYPE.caption
            }
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </VStack>
    );
  };

  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'U';

  const welcomeAvatar =
    welcome && go ? (
      <Pressable
        onPress={() => go('profile')}
        className="active:opacity-85 items-center justify-center overflow-hidden"
        style={{
          width: isCompactOfficeNav ? 42 : 52,
          height: isCompactOfficeNav ? 42 : 52,
          borderRadius: isCompactOfficeNav ? 21 : 26,
          backgroundColor: 'rgba(255,255,255,0.95)',
          shadowColor: GLASS.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        {user?.profilePhoto ? (
          <Image
            source={{ uri: user.profilePhoto }}
            style={{
              width: isCompactOfficeNav ? 42 : 52,
              height: isCompactOfficeNav ? 42 : 52,
            }}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={{
              fontFamily: FONTS.bold,
              fontSize: isCompactOfficeNav ? 14 : 16,
              color: COLORS.primary,
            }}
          >
            {initials}
          </Text>
        )}
      </Pressable>
    ) : null;

  const logoutBtn = canLogout ? (
    <ProfileMenu
      gradient={gradient}
      userName={userName}
      roleName={roleDisplayTitle(user)}
      loginId={user?.officer?.personUniqueId || user?.loginId}
      photoUrl={user?.profilePhoto || user?.officer?.profilePhoto}
      zoneLabel={resolvedZone}
      onLogout={() => void onLogout()}
      onProfile={go ? () => go('profile') : undefined}
    />
  ) : null;

  const zoneBtn =
    welcome && resolvedZone ? <ZoneTag zone={resolvedZone} onGradient /> : null;

  const notifBell =
    go && showNotifications && role === 'cao' ? (
      <NotificationBell go={go} variant={gradient ? 'header' : 'plain'} />
    ) : null;

  const rightSlot =
    right || notifBell || zoneBtn || logoutBtn ? (
      <HStack className="items-center gap-2">
        {right}
        {notifBell}
        {zoneBtn}
        {logoutBtn}
      </HStack>
    ) : null;

  if (!gradient) {
    return (
      <Box
        key={themeId}
        style={{
          backgroundColor: '#F0F4F8',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: 'rgba(26,54,142,0.12)',
          paddingTop: insets.top + (compact ? SPACE[1] : SPACE[2]),
          paddingHorizontal: SPACE.gutter,
          paddingBottom: compact ? SPACE[1] : SPACE[2],
        }}
      >
        <HStack className="items-center justify-between" style={{ gap: SPACE[2] }}>
          <HStack className="items-center flex-1 min-w-0" style={{ gap: SPACE[2] }}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                className="items-center justify-center active:opacity-80"
                style={{
                  height: compact ? 32 : 38,
                  width: compact ? 32 : 38,
                  borderRadius: backRadius,
                  backgroundColor: COLORS.muted,
                }}
              >
                <ArrowLeft size={compact ? 18 : 20} color={COLORS.primaryDeep} />
              </Pressable>
            ) : null}
            {titleBlock(false)}
          </HStack>
          {rightSlot}
        </HStack>
      </Box>
    );
  }

  return (
    <GradientHeader key={themeId}>
      <Box
        style={{
          paddingHorizontal: SPACE.gutter,
          paddingBottom: welcome && isCompactOfficeNav ? SPACE[2] : welcome ? SPACE[3] : SPACE[4],
        }}
      >
        <HStack className="items-center justify-between" style={{ paddingTop: SPACE[1], gap: SPACE[2] }}>
          <HStack className="items-center flex-1 min-w-0" style={{ gap: welcome && isCompactOfficeNav ? SPACE[2] : SPACE[2] }}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                className="items-center justify-center active:opacity-80"
                style={{
                  height: compact ? 32 : 38,
                  width: compact ? 32 : 38,
                  borderRadius: backRadius,
                  backgroundColor: headerFg().chipBg,
                  borderWidth: 1,
                  borderColor: headerFg().chipBorder,
                }}
              >
                <ArrowLeft size={compact ? 18 : 20} color={headerFg().icon} />
              </Pressable>
            ) : null}
            {titleBlock(true)}
          </HStack>
          {rightSlot}
        </HStack>
        {welcome ? (
          <HStack
            className="items-center flex-wrap"
            style={{ marginTop: isCompactOfficeNav ? SPACE[2] : SPACE[2], gap: 6 }}
          >
            <HStack className="items-center" style={{ gap: 6 }}>
              <Clock size={13} color={headerFg().icon} />
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: FONTS.medium,
                  color: headerFg().muted,
                }}
                numberOfLines={1}
              >
                {new Date().toLocaleString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </Text>
            </HStack>
          </HStack>
        ) : null}
      </Box>
    </GradientHeader>
  );
}

export function AppCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const { themeId } = useTheme();
  return (
    <Card
      key={themeId}
      className={className}
      style={[
        cardSurfaceStyle(),
        { padding: SPACE.cardPad },
      ]}
    >
      {children}
    </Card>
  );
}

type BtnVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'success';

export function AppBtn({
  children,
  onPress,
  variant = 'primary',
  className = '',
  disabled,
  icon: Icon,
  compact,
}: {
  children: ReactNode;
  onPress?: () => void;
  variant?: BtnVariant;
  className?: string;
  disabled?: boolean;
  icon?: LucideIcon;
  compact?: boolean;
}) {
  if (variant === 'primary') {
    return (
      <Pressable
        disabled={disabled}
        onPress={onPress}
        className={`w-full overflow-hidden active:opacity-90 ${disabled ? 'opacity-50' : ''} ${className}`}
        style={{
          height: DESIGN.ctaHeight,
          borderRadius: DESIGN.buttonRadius,
          shadowColor: COLORS.primaryDeep,
          shadowOffset: { width: 0, height: DESIGN.id === 'bold' ? 4 : 8 },
          shadowOpacity: DESIGN.shadowOpacity + 0.16,
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
            gap: SPACE[2],
            paddingHorizontal: compact ? SPACE[2] : SPACE[4],
          }}
        >
          {Icon ? <Icon size={18} color={COLORS.white} strokeWidth={2.5} /> : null}
          <Text
            numberOfLines={compact ? 1 : undefined}
            allowFontScaling={compact ? false : true}
            adjustsFontSizeToFit={compact ? true : undefined}
            minimumFontScale={compact ? 0.82 : undefined}
            style={{
              ...TYPE.button,
              color: COLORS.white,
              textAlign: 'center',
              flexShrink: 1,
              ...(compact ? { fontSize: 12, letterSpacing: 0, lineHeight: 15 } : null),
            }}
          >
            {children}
          </Text>
        </LinearGradient>
      </Pressable>
    );
  }

  const styles: Record<Exclude<BtnVariant, 'primary'>, string> = {
    ghost: 'bg-transparent',
    outline: 'bg-card border border-border',
    danger: 'bg-destructive',
    success: 'bg-success',
  };
  const textColor: Record<Exclude<BtnVariant, 'primary'>, string> = {
    ghost: COLORS.primary,
    outline: COLORS.ink,
    danger: COLORS.white,
    success: COLORS.white,
  };
  const iconColor: Record<Exclude<BtnVariant, 'primary'>, string> = {
    ghost: COLORS.primary,
    outline: COLORS.primaryDeep,
    danger: COLORS.white,
    success: COLORS.white,
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className={`w-full flex-row items-center justify-center active:opacity-90 ${disabled ? 'opacity-50' : ''} ${styles[variant]} ${className}`}
      style={{
        height: DESIGN.ctaHeight,
        borderRadius: DESIGN.buttonRadius,
        gap: SPACE[2],
        paddingHorizontal: SPACE[4],
      }}
    >
      {Icon ? <Icon size={16} color={iconColor[variant]} /> : null}
      <Text style={{ ...TYPE.button, color: textColor[variant] }}>{children}</Text>
    </Pressable>
  );
}

export const Field = forwardRef<
  TextInput,
  {
    label: string;
    icon?: LucideIcon;
    showCheck?: boolean;
    endAdornment?: ReactNode;
    /** Smaller control for dense forms (e.g. Step 3 dimensions). */
    compact?: boolean;
    /** Inline validation message — also turns the input border red. */
    error?: string;
    labelStyle?: StyleProp<TextStyle>;
  } & TextInputProps
>(function Field(
  {
    label,
    icon: Icon,
    showCheck = true,
    endAdornment,
    compact = false,
    error,
    labelStyle: customLabelStyle,
    style,
    value,
    defaultValue,
    blurOnSubmit,
    ...props
  },
  ref
) {
  // No setState on focus — any re-render during focus can dismiss the keyboard
  // on Expo Go when parents restyle. Keep this tree static while typing.
  const normalize = (v: unknown) => {
    if (v == null) return '';
    const s = String(v);
    return s === 'undefined' || s === 'null' ? '' : s;
  };
  const displayValue = normalize(value);
  const hasValue = Boolean(displayValue || normalize(defaultValue));
  const isEditable = props.editable ?? true;

  const baseLabel = compact ? { ...TYPE.label, fontSize: 12 } : TYPE.label;
  const labelStyle = customLabelStyle ? [baseLabel, customLabelStyle] : baseLabel;

  return (
    <View style={{ gap: compact ? 4 : SPACE[2] }} collapsable={false}>
      {typeof label === 'string' && label.trim() !== '' ? (
        label.includes('*') ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={labelStyle}>{label.replace(/\s*\*\s*/g, '')}</Text>
            <Text
              style={{
                fontSize: compact ? 13 : 14,
                fontWeight: 'bold',
                color: '#DC2626',
                lineHeight: 16,
              }}
            >
              *
            </Text>
          </View>
        ) : (
          <Text style={labelStyle}>{label}</Text>
        )
      ) : null}
      <View
        collapsable={false}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: compact ? SPACE[2] : SPACE[3],
          minHeight: compact ? 36 : SPACE.touch,
          paddingHorizontal: compact ? SPACE[2] : SPACE[3],
          borderRadius: compact ? 6 : 8,
          borderWidth: DESIGN.borderWidth + 0.5,
          backgroundColor: COLORS.white,
          borderColor: error ? COLORS.destructive : COLORS.border,
        }}
      >
        {Icon ? (
          <View
            pointerEvents="none"
            style={{
              height: compact ? 28 : 36,
              width: compact ? 28 : 36,
              borderRadius: DESIGN.stepRadius > 40 ? 999 : DESIGN.stepRadius,
              backgroundColor: COLORS.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={compact ? 12 : 15} color="#FFFFFF" strokeWidth={2.4} />
          </View>
        ) : null}
        <TextInput
          {...props}
          ref={ref}
          value={displayValue}
          editable={isEditable}
          showSoftInputOnFocus
          blurOnSubmit={blurOnSubmit ?? false}
          autoCorrect={props.autoCorrect ?? false}
          autoCapitalize={props.autoCapitalize ?? 'sentences'}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          placeholderTextColor="#94A3A0"
          underlineColorAndroid="transparent"
          style={[
            {
              flex: 1,
              minWidth: 0,
              minHeight: compact ? 32 : 44,
              paddingVertical: compact ? 6 : 12,
              paddingHorizontal: 0,
              fontSize: 15,
              fontFamily: FONTS.semibold,
              color: COLORS.ink,
              ...(Platform.OS === 'web'
                ? ({ outlineStyle: 'none', outlineWidth: 0, cursor: 'text' } as object)
                : null),
            },
            style,
          ]}
        />
        {endAdornment ? (
          endAdornment
        ) : showCheck && hasValue && !error ? (
          <View
            pointerEvents="none"
            style={{
              width: compact ? 18 : 22,
              height: compact ? 18 : 22,
              borderRadius: compact ? 9 : 11,
              backgroundColor: COLORS.success,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={compact ? 10 : 12} color="#FFFFFF" strokeWidth={3} />
          </View>
        ) : null}
      </View>
      {error ? (
        <Text
          style={{
            fontFamily: FONTS.medium,
            fontSize: compact ? 11 : 12,
            color: COLORS.destructive,
            lineHeight: compact ? 14 : 15,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
});

function NotchedBarBg({
  width,
  height,
  notchR,
  topRadius,
  fill = '#FFFFFF',
}: {
  width: number;
  height: number;
  notchR: number;
  topRadius: number;
  fill?: string;
}) {
  const cx = width / 2;
  const r = topRadius;
  const bowl = notchR + 2;
  // Full-bleed bar: rounded top corners; optional U cutout for the +.
  const d =
    notchR <= 0
      ? [
          `M0,${r}`,
          `Q0,0 ${r},0`,
          `L${width - r},0`,
          `Q${width},0 ${width},${r}`,
          `L${width},${height}`,
          `L0,${height}`,
          'Z',
        ].join(' ')
      : [
          `M0,${r}`,
          `Q0,0 ${r},0`,
          `L${cx - notchR - 12},0`,
          `C${cx - notchR - 2},0 ${cx - notchR + 6},${bowl * 0.85} ${cx},${bowl}`,
          `C${cx + notchR - 6},${bowl * 0.85} ${cx + notchR + 2},0 ${cx + notchR + 12},0`,
          `L${width - r},0`,
          `Q${width},0 ${width},${r}`,
          `L${width},${height}`,
          `L0,${height}`,
          'Z',
        ].join(' ');

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Path d={d} fill={fill} />
    </Svg>
  );
}

/** Floating capsule with a soft U-notch so the center + sits in a curved cradle. */
function CapsuleNotchedBarBg({
  width,
  height,
  notchR,
  fill = '#FFFFFF',
  stroke = 'rgba(15,23,42,0.08)',
}: {
  width: number;
  height: number;
  notchR: number;
  fill?: string;
  stroke?: string;
}) {
  const cx = width / 2;
  const r = height / 2;
  const bowl = Math.min(notchR + 4, height * 0.55);
  const wing = 14;
  const d = [
    `M0,${r}`,
    `A${r},${r} 0 0 1 ${r},0`,
    `L${cx - notchR - wing},0`,
    `C${cx - notchR - 2},0 ${cx - notchR + 8},${bowl * 0.9} ${cx},${bowl}`,
    `C${cx + notchR - 8},${bowl * 0.9} ${cx + notchR + 2},0 ${cx + notchR + wing},0`,
    `L${width - r},0`,
    `A${r},${r} 0 0 1 ${width},${r}`,
    `A${r},${r} 0 0 1 ${width - r},${height}`,
    `L${r},${height}`,
    `A${r},${r} 0 0 1 0,${r}`,
    'Z',
  ].join(' ');

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Path d={d} fill={fill} stroke={stroke} strokeWidth={1} />
    </Svg>
  );
}

export function BottomNav({
  active,
  onNav,
  onPlus,
  homeTarget = 'dashboard',
  appsTarget = 'history',
  hidePlus = false,
  hideAlerts = false,
}: {
  active: NavTab;
  onNav: Go;
  onPlus?: () => void;
  homeTarget?: Screen;
  appsTarget?: Screen;
  hidePlus?: boolean;
  hideAlerts?: boolean;
}) {
  const { themeId } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { startNewProject } = useProject();

  /** Wave design (classic) — deep navy bar + sky FAB like the Search Mechanic mock. */
  const waveNav = DESIGN.id === 'classic';
  const barFill = waveNav ? COLORS.primaryDeep : COLORS.white;
  const tabIdle = waveNav ? 'rgba(255,255,255,0.72)' : COLORS.ink;
  const tabActive = waveNav ? '#FFFFFF' : COLORS.primary;
  const fabOuter = waveNav ? COLORS.primaryGlow : '#FFFFFF';
  const fabInner = waveNav ? COLORS.primaryGlow : COLORS.muted;
  const fabIcon = waveNav ? '#FFFFFF' : COLORS.primary;

  const bottomPad = Math.max(insets.bottom, 8);
  const barH = BAR_H + bottomPad;
  // FAB sits so ~55% is above the bar top.
  const fabOverhang = hidePlus ? 0 : FAB_SIZE * 0.55;

  const handlePlus = () => {
    if (onPlus) {
      onPlus();
      return;
    }
    startNewProject();
    onNav('project');
  };

  const { user } = useAuth();
  const role = resolveAppRole(user);
  const isEngineerOrZc = role === 'engineer' || role === 'zc';
  const isCompactOfficeNav =
    role === 'zc' || role === 'cao' || role === 'super_admin';
  const shouldHideAlerts = hideAlerts || isEngineerOrZc || isCompactOfficeNav;

  const leftItems: Array<{
    k: NavTab;
    label: string;
    icon: LucideIcon;
    target: Screen;
    badge?: number;
  }> = [
    { k: 'home', label: 'Home', icon: Home, target: homeTarget },
    ...(isCompactOfficeNav
      ? []
      : [{ k: 'apps' as const, label: 'Applications', icon: FileText, target: appsTarget }]),
  ];

  const rightItems: Array<{
    k: NavTab;
    label: string;
    icon: LucideIcon;
    target: Screen;
    badge?: number;
  }> = [
    ...(shouldHideAlerts
      ? []
      : [{ k: 'notif' as const, label: 'Alerts', icon: Bell, target: 'notifications' as Screen }]),
    { k: 'profile', label: 'Profile', target: 'profile', icon: User },
  ];

  const renderTab = (it: (typeof leftItems)[number]) => {
    const Icon = it.icon;
    const on = active === it.k;
    const isProfileTab = it.k === 'profile';
    const profilePhoto = user?.profilePhoto?.trim() || null;
    const profileInitials =
      displayName(user)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || '')
        .join('') || 'U';
    return (
      <Pressable
        key={it.k}
        onPress={() => onNav(it.target)}
        accessibilityRole="button"
        accessibilityLabel={it.label}
        accessibilityState={{ selected: on }}
        className="flex-1 items-center justify-center active:opacity-70"
        style={{ height: BAR_H }}
      >
        <Box className="items-center justify-center relative" style={{ height: 24, width: 44 }}>
          {isProfileTab ? (
            <Box
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: profilePhoto ? COLORS.muted : waveNav ? 'rgba(255,255,255,0.2)' : COLORS.primary,
                borderWidth: on ? 2 : 1,
                borderColor: on ? tabActive : waveNav ? 'rgba(255,255,255,0.5)' : COLORS.ink,
              }}
            >
              {profilePhoto ? (
                <Image
                  source={{ uri: profilePhoto }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <Text
                  style={{
                    fontFamily: FONTS.bold,
                    fontSize: 11,
                    color: COLORS.white,
                    lineHeight: 11,
                  }}
                >
                  {profileInitials}
                </Text>
              )}
            </Box>
          ) : (
            <Icon
              size={22}
              color={on ? tabActive : tabIdle}
              strokeWidth={on ? 2.4 : 1.9}
            />
          )}
          {it.badge ? (
            <Box
              className="absolute items-center justify-center rounded-full"
              style={{
                top: -2,
                right: 4,
                minWidth: 15,
                height: 15,
                paddingHorizontal: 3,
                backgroundColor: COLORS.destructive,
                borderWidth: 1.5,
                borderColor: COLORS.white,
              }}
            >
              <Text className="text-[8px] font-extrabold text-white">{it.badge}</Text>
            </Box>
          ) : null}
        </Box>
        <Text
          style={{
            marginTop: 3,
            fontFamily: on ? FONTS.semibold : FONTS.medium,
            fontSize: 10,
            lineHeight: 12,
            color: on ? tabActive : tabIdle,
          }}
        >
          {it.label}
        </Text>
      </Pressable>
    );
  };

  /**
   * Floating capsule nav:
   * - Engineer / CAO: Home · Applications? · Profile (hidePlus)
   * - ZC: Home · center + · Profile (keep capsule + restore plus)
   */
  if (hidePlus || role === 'zc') {
    const capsuleIdle = COLORS.ink;
    const capsuleActive = COLORS.primary;
    const capsuleH = BAR_H + 6;
    const showCapsulePlus = !hidePlus;
    const capsuleFabOverhang = showCapsulePlus ? FAB_SIZE * 0.42 : 0;
    const renderCapsuleTab = (it: (typeof leftItems)[number]) => {
      const Icon = it.icon;
      const on = active === it.k;
      const isProfileTab = it.k === 'profile';
      const profilePhoto = user?.profilePhoto?.trim() || null;
      const profileInitials =
        displayName(user)
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase() || '')
          .join('') || 'U';
      const tone = on ? capsuleActive : capsuleIdle;
      return (
        <Pressable
          key={it.k}
          onPress={() => onNav(it.target)}
          accessibilityRole="button"
          accessibilityLabel={it.label}
          accessibilityState={{ selected: on }}
          className="flex-1 items-center justify-center active:opacity-70"
          style={{ height: capsuleH }}
        >
          <Box className="items-center justify-center relative" style={{ height: 24, width: 44 }}>
            {isProfileTab ? (
              <Box
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: profilePhoto ? COLORS.muted : COLORS.primary,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? capsuleActive : 'rgba(15,23,42,0.2)',
                }}
              >
                {profilePhoto ? (
                  <Image
                    source={{ uri: profilePhoto }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text
                    style={{
                      fontFamily: FONTS.bold,
                      fontSize: 11,
                      color: COLORS.white,
                      lineHeight: 11,
                    }}
                  >
                    {profileInitials}
                  </Text>
                )}
              </Box>
            ) : (
              <Icon size={22} color={tone} strokeWidth={on ? 2.4 : 1.9} />
            )}
          </Box>
          <Text
            style={{
              marginTop: 3,
              fontFamily: on ? FONTS.semibold : FONTS.medium,
              fontSize: 11,
              lineHeight: 13,
              color: tone,
            }}
          >
            {it.label}
          </Text>
        </Pressable>
      );
    };

    const capsuleW = Math.max(0, width - 36);
    const capsuleNotchR = FAB_SIZE / 2 + 5;

    return (
      <Box
        key={themeId}
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingHorizontal: 18,
          paddingTop: capsuleFabOverhang + 4,
          zIndex: 50,
          elevation: 24,
        }}
      >
        <Box
          style={{
            height: capsuleH,
            borderRadius: 999,
            backgroundColor: showCapsulePlus ? 'transparent' : COLORS.white,
            borderWidth: showCapsulePlus ? 0 : 1,
            borderColor: 'rgba(15,23,42,0.08)',
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.14,
            shadowRadius: 16,
            elevation: 16,
            overflow: 'visible',
            paddingHorizontal: 6,
          }}
        >
          {showCapsulePlus ? (
            <CapsuleNotchedBarBg
              width={capsuleW}
              height={capsuleH}
              notchR={capsuleNotchR}
              fill={COLORS.white}
            />
          ) : null}
          <HStack style={{ height: capsuleH, alignItems: 'center' }}>
            {leftItems.map(renderCapsuleTab)}
            {showCapsulePlus ? <Box style={{ width: FAB_SIZE + 18 }} /> : null}
            {rightItems.map(renderCapsuleTab)}
          </HStack>
        </Box>

        {showCapsulePlus ? (
          <Pressable
            onPress={handlePlus}
            accessibilityRole="button"
            accessibilityLabel="New application"
            className="absolute items-center justify-center active:opacity-90"
            style={{
              top: 4,
              left: (width - FAB_SIZE) / 2,
              width: FAB_SIZE,
              height: FAB_SIZE,
              borderRadius: 999,
              backgroundColor: COLORS.primary,
              shadowColor: COLORS.primaryDeep,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.28,
              shadowRadius: 14,
              elevation: 18,
              zIndex: 20,
            }}
          >
            <Plus size={24} color={COLORS.white} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </Box>
    );
  }

  return (
    <Box
      key={themeId}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: fabOverhang + 4,
        zIndex: 50,
        elevation: 24,
      }}
    >
      <Box
        style={{
          width,
          height: barH,
          // Solid base under the SVG notch so the footer never looks transparent
          backgroundColor: barFill,
          overflow: 'hidden',
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 20,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: waveNav ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)',
        }}
      >
        <NotchedBarBg
          width={width}
          height={barH}
          notchR={NOTCH_R}
          topRadius={DESIGN.radiusLg}
          fill={barFill}
        />

        <HStack style={{ height: BAR_H, alignItems: 'center' }}>
          {leftItems.map(renderTab)}
          <Box style={{ width: NOTCH_R * 2 }} />
          {rightItems.map(renderTab)}
        </HStack>
      </Box>

      <Pressable
        onPress={handlePlus}
        accessibilityRole="button"
        accessibilityLabel="New application"
        className="absolute items-center justify-center active:opacity-90"
        style={{
          top: 4,
          left: (width - FAB_SIZE) / 2,
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: 999,
          backgroundColor: fabOuter,
          borderWidth: waveNav ? 0 : 1,
          borderColor: COLORS.border,
          shadowColor: COLORS.primaryDeep,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: waveNav ? 0.28 : 0.16,
          shadowRadius: 14,
          elevation: 18,
          zIndex: 20,
        }}
      >
        <Box
          className="items-center justify-center"
          style={{
            width: FAB_SIZE - 10,
            height: FAB_SIZE - 10,
            borderRadius: 999,
            backgroundColor: fabInner,
          }}
        >
          <Plus size={24} color={fabIcon} strokeWidth={2.4} />
        </Box>
      </Pressable>
    </Box>
  );
}

/** Theme-aware zone pill — uses COLORS so it updates when the theme changes. */
export function ZoneTag({
  zone,
  onGradient = false,
}: {
  zone?: string | null;
  /** Sit on a gradient header (white chip + primary accent). */
  onGradient?: boolean;
}) {
  const code = zone?.trim();
  if (!code) return null;

  if (onGradient) {
    return (
      <HStack
        className="items-center"
        style={{
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
          backgroundColor: COLORS.white,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.95)',
          shadowColor: COLORS.primaryDeep,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 6,
          elevation: 3,
        }}
      >
        <MapPin size={11} color={COLORS.primary} strokeWidth={2.6} />
        <Text
          style={{
            fontFamily: FONTS.bold,
            fontSize: 12,
            letterSpacing: 0.3,
            color: COLORS.primary,
          }}
          numberOfLines={1}
        >
          {code}
        </Text>
      </HStack>
    );
  }

  return (
    <HStack
      className="items-center"
      style={{
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: GLASS.tintBlue,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <MapPin size={11} color={COLORS.primary} strokeWidth={2.6} />
      <Text
        style={{
          fontFamily: FONTS.bold,
          fontSize: 12,
          letterSpacing: 0.3,
          color: COLORS.primaryDeep,
        }}
        numberOfLines={1}
      >
        {code}
      </Text>
    </HStack>
  );
}

/** Same palette as ApplicationStatusBadge — shared across Engineer / ZC / CAO. */
export function statusChipColors(status: string): { bg: string; fg: string } {
  const tone = applicationStatusTone(status);
  return { bg: tone.bg, fg: tone.fg };
}

export function StatusChip({
  status,
  compact = false,
}: {
  status: string;
  /** Smaller pill so long application numbers stay visible. */
  compact?: boolean;
}) {
  const s = statusChipColors(status);
  return (
    <Box
      style={{
        paddingHorizontal: compact ? 6 : 10,
        paddingVertical: compact ? 2 : 5,
        borderRadius: 999,
        backgroundColor: s.bg,
        flexShrink: 0,
      }}
    >
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: FONTS.bold,
          fontSize: compact ? 9 : 12,
          lineHeight: compact ? 11 : 15,
          color: s.fg,
        }}
        numberOfLines={1}
      >
        {status}
      </Text>
    </Box>
  );
}

export function AppSheet({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Box style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={onClose}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.55)',
            }}
          />
          <Box
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 32,
              borderTopWidth: 1,
              borderColor: '#E2E8F0',
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 0.18,
              shadowRadius: 20,
              elevation: 24,
            }}
          >
            <Box
              style={{
                alignSelf: 'center',
                height: 5,
                width: 44,
                borderRadius: 999,
                backgroundColor: '#CBD5E1',
                marginBottom: 14,
              }}
            />
            {title ? (
              <Text
                style={{
                  fontFamily: FONTS.bold,
                  fontSize: 18,
                  color: COLORS.ink,
                  marginBottom: 10,
                }}
              >
                {title}
              </Text>
            ) : null}
            {children}
          </Box>
        </Box>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function StepDots({
  step,
  total = 6,
  label,
}: {
  step: number;
  total?: number;
  label?: string;
}) {
  return (
    <VStack space="sm">
      <HStack className="items-center justify-between">
        <Text className="text-xs font-semibold text-muted-foreground">
          {label ?? `Step ${step} of ${total}`}
        </Text>
        <Box className="px-2.5 py-1 rounded-full bg-primary/10">
          <Text className="text-[11px] font-bold text-primary">
            {step}/{total}
          </Text>
        </Box>
      </HStack>
      <HStack className="items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => {
          const done = i < step - 1;
          const current = i === step - 1;
          return (
            <Box
              key={i}
              className={`h-1.5 rounded-full flex-1 ${
                done || current ? 'bg-primary' : 'bg-border'
              } ${current ? 'opacity-100' : done ? 'opacity-70' : 'opacity-100'}`}
            />
          );
        })}
      </HStack>
    </VStack>
  );
}

export function IconBox({
  children,
  className = 'bg-primary/10',
  size = 'md',
}: {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sizes = {
    sm: 'h-9 w-9 rounded-lg',
    md: 'h-10 w-10 rounded-xl',
    lg: 'h-11 w-11 rounded-xl',
    xl: 'h-16 w-16 rounded-2xl',
  };
  return (
    <Box className={`${sizes[size]} items-center justify-center ${className}`}>
      {children}
    </Box>
  );
}

export {
  ScreenLoader,
  ListLoader,
  ButtonLoader,
  getScreenLoaderConfig,
  useMinimumLoading,
  CardSkeleton,
  ListSkeleton,
  ProfileSkeleton,
  DetailSkeleton,
} from './loaders';


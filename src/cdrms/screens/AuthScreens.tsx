import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Camera,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Globe2,
  Headphones,
  LocateFixed,
  Lock,
  MapPin,
  MapPinned,
  Mic,
  Minus,
  Navigation,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  User,
  UserCheck,
} from 'lucide-react-native';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  TextInput,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
  type ScrollView as RNScrollView,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeInUp,
  FadeOut,
  ZoomIn,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '@/components/ui/box';
import {
  Checkbox,
  CheckboxIcon,
  CheckboxIndicator,
  CheckboxLabel,
} from '@/components/ui/checkbox';
import { HStack } from '@/components/ui/hstack';
import { CheckIcon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import {
  AppBtn,
  AppCard,
  AppHeader,
  Field,
  IconBox,
  ScreenShell,
  ScreenLoader,
} from '@/src/cdrms/components/primitives';
import { LiveGeoMap } from '@/src/cdrms/components/LiveGeoMap';
import { zoomFromLatitudeDelta } from '@/src/cdrms/components/osmMapUrl';
import {
  GEO_FENCE_RADIUS_FT,
  distanceFeet,
} from '@/src/cdrms/location';
import {
  useDeviceLocation,
  type LocationResult,
} from '@/src/cdrms/hooks/useDeviceLocation';
import {
  ensureForegroundLocationPermission,
  hasForegroundLocationPermission,
} from '@/src/cdrms/locationPermission';
import {
  ensureCameraPermission,
  ensureMicrophonePermission,
} from '@/src/cdrms/mediaPermission';
import {
  COLORS,
  FONTS,
  GLASS,
  applyAuthTheme,
} from '@/src/cdrms/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { TERMS } from '@/src/cdrms/terminology';
import { showAppDialog } from '@/src/cdrms/components/AppDialog';
import type { Go } from '@/src/cdrms/types';
import { useAuth } from '@/src/auth/AuthContext';
import { ApiError } from '@/src/api/client';
import { homeScreenForRole, needsGeoValidation } from '@/src/auth/roles';

const BDA_BUILDING = require('../../../assets/bda-building.png');
const BDA_LOGO = require('../../../assets/bda-logo.png');
const LOGIN_LOCK = require('../../../assets/login-lock.png');
const PERM_HERO = require('../../../assets/illustrations/location-access-hero-v2.png');
const PERM_ICON_GPS = require('../../../assets/illustrations/perm-icon-gps.png');
const PERM_ICON_CAMERA = require('../../../assets/illustrations/perm-icon-camera.png');
const PERM_ICON_MIC = require('../../../assets/illustrations/perm-icon-mic.png');
const PERM_ICON_FOREGROUND = require('../../../assets/illustrations/perm-icon-foreground.png');
const PERM_ICON_PRIVACY = require('../../../assets/illustrations/perm-icon-privacy.png');
const GEO_VERIFIED_BADGE = require('../../../assets/illustrations/geo-verified-badge.png');
const LOGIN_NAVY = '#0B1F4A';
const LOGIN_BLUE = '#1A56DB';
const LOGIN_BLUE_BRIGHT = '#2B6CED';
const LOGIN_SKY = '#38BDF8';
const LOGIN_MUTED = '#0F172A';
const LOGIN_LABEL = '#0F172A';
const LOGIN_BORDER = '#D7E3F4';

const SPLASH_HOLD_MS = 3600;
const OTP_LENGTH = 6;
const OTP_TTL_SEC = 60;

/** Deep navy splash — matches BDA + CDRMS intro (no purple tick). */
const SPLASH_NAVY_TOP = '#0A2A6B';
const SPLASH_NAVY_MID = '#071E4A';
const SPLASH_NAVY_BOTTOM = '#020B1F';
const SPLASH_ACCENT = '#5BA3FF';

export function SplashScreen({ go }: { go: Go }) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();

  useLayoutEffect(() => {
    applyAuthTheme();
  }, []);

  const navigateAfterSplash = useCallback(() => {
    // Always show login after splash — do not auto-enter permission/home from a saved session.
    go('login');
  }, [go]);

  const logoScale = useSharedValue(0.35);
  const logoOpacity = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleX = useSharedValue(28);
  const lineWidth = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const footerOpacity = useSharedValue(0);
  const screenOpacity = useSharedValue(1);

  useEffect(() => {
    // 1) BDA seal scales in
    logoOpacity.value = withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSpring(1, { damping: 13, stiffness: 110, mass: 0.9 });

    // Soft halo pulse while logo is visible
    glowPulse.value = withDelay(
      420,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );

    // 2) CDRMS title slides in beside logo
    titleOpacity.value = withDelay(480, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    titleX.value = withDelay(480, withSpring(0, { damping: 16, stiffness: 140 }));

    // 3) Accent underline draws under CDRMS
    lineWidth.value = withDelay(780, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));

    // 4) Full product name
    subtitleOpacity.value = withDelay(980, withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }));

    // 5) Authority footer
    footerOpacity.value = withDelay(1280, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));

    const leave = setTimeout(() => {
      screenOpacity.value = withTiming(0, { duration: 420, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(navigateAfterSplash)();
      });
    }, SPLASH_HOLD_MS);

    return () => clearTimeout(leave);
  }, [
    footerOpacity,
    glowPulse,
    go,
    lineWidth,
    logoOpacity,
    logoScale,
    navigateAfterSplash,
    screenOpacity,
    subtitleOpacity,
    titleOpacity,
    titleX,
  ]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowOuterStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0, 1], [0.28, 0.55]),
    transform: [{ scale: interpolate(glowPulse.value, [0, 1], [1, 1.08]) }],
  }));

  const glowInnerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0, 1], [0.4, 0.72]),
    transform: [{ scale: interpolate(glowPulse.value, [0, 1], [1, 1.04]) }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateX: titleX.value }],
  }));

  const lineStyle = useAnimatedStyle(() => ({
    width: `${interpolate(lineWidth.value, [0, 1], [0, 90])}%` as `${number}%`,
    opacity: interpolate(lineWidth.value, [0, 0.15, 1], [0, 1, 1]),
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
  }));

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const logoSize = Math.min(104, Math.round(winW * 0.26));
  const titleMaxW = Math.min(210, Math.round(winW * 0.48));

  return (
    <ScreenShell>
      <Animated.View style={[{ flex: 1 }, screenStyle]}>
        <LinearGradient
          colors={[SPLASH_NAVY_TOP, SPLASH_NAVY_MID, SPLASH_NAVY_BOTTOM]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
          <Box className="flex-1 items-center justify-center px-5">
            {/* BDA seal + CDRMS copy — horizontal brand lockup */}
            <Box className="flex-row items-center" style={{ maxWidth: winW - 40 }}>
              <Animated.View style={[{ width: logoSize + 36, height: logoSize + 36, alignItems: 'center', justifyContent: 'center' }, logoStyle]}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: 'absolute',
                      width: logoSize + 36,
                      height: logoSize + 36,
                      borderRadius: 999,
                      backgroundColor: 'rgba(91,163,255,0.22)',
                    },
                    glowOuterStyle,
                  ]}
                />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: 'absolute',
                      width: logoSize + 18,
                      height: logoSize + 18,
                      borderRadius: 999,
                      backgroundColor: 'rgba(91,163,255,0.28)',
                    },
                    glowInnerStyle,
                  ]}
                />
                <Box
                  className="overflow-hidden items-center justify-center"
                  style={{
                    width: logoSize,
                    height: logoSize,
                    borderRadius: logoSize / 2,
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <Image
                    source={BDA_LOGO}
                    style={{ width: logoSize, height: logoSize }}
                    resizeMode="contain"
                    accessibilityLabel="Bangalore Development Authority"
                  />
                </Box>
              </Animated.View>

              <Animated.View style={[{ marginLeft: 14, maxWidth: titleMaxW }, titleStyle]}>
                <Text
                  className="font-extrabold text-white"
                  style={{
                    fontSize: Math.min(42, Math.round(winW * 0.105)),
                    lineHeight: Math.min(48, Math.round(winW * 0.12)),
                    letterSpacing: 1.5,
                    includeFontPadding: false,
                  }}
                >
                  {TERMS.app.shortName}
                </Text>
                <Animated.View
                  style={[
                    {
                      height: 2,
                      marginTop: 8,
                      marginBottom: 10,
                      borderRadius: 999,
                      backgroundColor: SPLASH_ACCENT,
                    },
                    lineStyle,
                  ]}
                />
                <Animated.View style={subtitleStyle}>
                  <Text
                    className="text-white/88 font-medium"
                    style={{
                      fontSize: 13,
                      lineHeight: 18,
                      includeFontPadding: false,
                    }}
                  >
                    {TERMS.app.fullName}
                  </Text>
                </Animated.View>
              </Animated.View>
            </Box>

            <Animated.View
              style={[
                {
                  position: 'absolute',
                  bottom: Math.max(insets.bottom, 12) + 28,
                  left: 24,
                  right: 24,
                  alignItems: 'center',
                },
                footerStyle,
              ]}
            >
              <Text
                className="text-center text-white font-extrabold"
                style={{ fontSize: 18, letterSpacing: 0.3, includeFontPadding: false }}
              >
                Bangalore Development Authority
              </Text>
            </Animated.View>
          </Box>
        </LinearGradient>
      </Animated.View>
    </ScreenShell>
  );
}

export function LoginScreen({ go }: { go: Go }) {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const { themeId } = useTheme();
  const { width: winW, height: winH } = useWindowDimensions();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedInput, setFocusedInput] = useState<'loginId' | 'password' | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const loginIdRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const scrollRef = useRef<RNScrollView>(null);
  const formYRef = useRef(0);
  /** Web: fields stay empty until tap so Chrome does not fill on logout. */
  const [allowAutofill, setAllowAutofill] = useState(Platform.OS !== 'web');

  // Fit Oppo A78 / other mid-range widths — keep footer text on-screen
  const isNarrow = winW < 390;
  const isShort = winH < 780;
  const formPadX = isNarrow ? 18 : 24;
  // Photo header — slightly shorter on compact phones so footer stays reachable
  const heroH = keyboardOpen
    ? Math.max(118, Math.round(winH * 0.17))
    : Math.max(isShort ? 250 : 280, Math.round(winH * (isShort ? 0.34 : 0.38)));
  // Soft curve — a bit deeper than before, still not a harsh bowl
  const waveH = keyboardOpen ? 48 : 70;
  const waveW = winW;
  const waveEdgeY = Math.round(waveH * 0.14);
  const waveDipY = Math.round(waveH * 0.66);
  const valleyFromBottom = waveH - waveDipY;
  const lockOuter = Math.round(Math.min(winW * 0.155, 72)); // lock badge — slightly smaller
  const lockHalo = lockOuter + 28; // full overlay footprint (glow included)

  const scrollFormIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      setTimeout(
        () => {
          scrollRef.current?.scrollTo({
            y: Math.max(0, formYRef.current - 8),
            animated: true,
          });
        },
        Platform.OS === 'ios' ? 60 : 180,
      );
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      setKeyboardOpen(true);
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setKeyboardOpen(false);
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!keyboardOpen) return;
    const t = setTimeout(scrollFormIntoView, Platform.OS === 'ios' ? 50 : 160);
    return () => clearTimeout(t);
  }, [keyboardOpen, scrollFormIntoView]);

  async function onSecureLogin() {
    if (loading) return;
    Keyboard.dismiss();
    setError('');
    if (!loginId.trim() || !password.trim()) {
      setError('Enter Login ID / email and password');
      return;
    }
    setLoading(true);
    try {
      const loggedIn = await login(loginId, password);
      // Geo validation is engineer-only — ZC / CAO go straight home.
      if (needsGeoValidation(loggedIn)) {
        go('permission');
      } else {
        go(homeScreenForRole(loggedIn));
      }
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : 'Unable to reach API. Set EXPO_PUBLIC_API_URL to your machine IP.';
      setError(msg);
      showAppDialog({
        variant: 'error',
        title: 'Login failed',
        message: msg,
        hideCancel: true,
        confirmLabel: 'OK',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box key={themeId} style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: keyboardOpen
              ? Math.max(keyboardHeight * 0.3, 88)
              : Math.max(insets.bottom, 16) + 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Photo hero + BDA logo + smooth center-valley curve */}
          <View style={{ height: heroH, width: '100%' }}>
            <ImageBackground
              source={BDA_BUILDING}
              style={{ flex: 1 }}
              resizeMode="cover"
              imageStyle={{ width: '100%', height: '100%' }}
            >
              <LinearGradient
                colors={[
                  'rgba(8, 24, 56, 0.5)',
                  'rgba(8, 24, 56, 0.22)',
                  'rgba(8, 24, 56, 0.35)',
                ]}
                locations={[0, 0.45, 1]}
                style={{
                  flex: 1,
                  paddingTop: insets.top + (keyboardOpen ? 4 : 8),
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                }}
              >
                <Animated.View
                  entering={FadeInDown.duration(420)}
                  style={{
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    paddingHorizontal: 20,
                  }}
                >
                  {!keyboardOpen ? (
                    <Box
                      className="items-center justify-center overflow-hidden"
                      style={{
                        width: 84,
                        height: 84,
                        borderRadius: 42,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 2.5,
                        borderColor: 'rgba(255,255,255,0.95)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 5 },
                        shadowOpacity: 0.2,
                        shadowRadius: 10,
                        elevation: 7,
                        marginBottom: 18,
                      }}
                    >
                      <Image
                        source={BDA_LOGO}
                        style={{ width: 74, height: 74 }}
                        resizeMode="contain"
                        accessibilityLabel="Bangalore Development Authority"
                      />
                    </Box>
                  ) : null}
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    style={{
                      fontFamily: FONTS.bold,
                      fontSize: keyboardOpen ? 16 : isNarrow ? 20 : 22,
                      letterSpacing: 0.6,
                      color: '#FFFFFF',
                      textAlign: 'center',
                      width: '100%',
                      paddingHorizontal: 8,
                      marginTop: keyboardOpen ? 0 : 4,
                    }}
                  >
                    BDA CDRMS PORTAL
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    style={{
                      fontFamily: FONTS.medium,
                      fontSize: keyboardOpen ? 12 : isNarrow ? 13 : 15,
                      color: 'rgba(255,255,255,0.92)',
                      marginTop: 5,
                      textAlign: 'center',
                      width: '100%',
                      paddingHorizontal: 8,
                    }}
                  >
                    {TERMS.app.ministry}
                  </Text>
                </Animated.View>
              </LinearGradient>
            </ImageBackground>

            {/* Soft shallow valley — gentle arc like 2nd screenshot */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: -1,
                height: waveH,
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              <Svg width={waveW} height={waveH} viewBox={`0 0 ${waveW} ${waveH}`}>
                <Path
                  d={[
                    `M0 ${waveEdgeY}`,
                    `C ${waveW * 0.25} ${waveEdgeY}, ${waveW * 0.35} ${waveDipY}, ${waveW / 2} ${waveDipY}`,
                    `C ${waveW * 0.65} ${waveDipY}, ${waveW * 0.75} ${waveEdgeY}, ${waveW} ${waveEdgeY}`,
                    `L ${waveW} ${waveH} L 0 ${waveH} Z`,
                  ].join(' ')}
                  fill="#FFFFFF"
                />
              </Svg>
            </View>
          </View>

          {/* Lock centered ON the valley — true horizontal center */}
          <View
            pointerEvents="none"
            style={{
              zIndex: 40,
              elevation: 40,
              width: '100%',
              alignItems: 'center',
              height: 0,
            }}
          >
            <Animated.View
              entering={ZoomIn.duration(400)}
              style={{
                // Center of halo box = valley line (was too low before — used disc size not full box)
                marginTop: -(lockHalo / 2 + valleyFromBottom),
                width: lockHalo,
                height: lockHalo,
                alignSelf: 'center',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* One soft white halo (ref style) */}
              <View
                style={{
                  position: 'absolute',
                  width: lockOuter + 16,
                  height: lockOuter + 16,
                  borderRadius: (lockOuter + 16) / 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.75)',
                }}
              />
              {/* Exact lock badge asset + thick white ring */}
              <View
                style={{
                  width: lockOuter,
                  height: lockOuter,
                  borderRadius: lockOuter / 2,
                  backgroundColor: '#FFFFFF',
                  padding: 5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#0F172A',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.18,
                  shadowRadius: 12,
                  elevation: 12,
                }}
              >
                <Image
                  source={LOGIN_LOCK}
                  style={{
                    width: lockOuter - 10,
                    height: lockOuter - 10,
                    borderRadius: (lockOuter - 10) / 2,
                  }}
                  resizeMode="cover"
                  accessibilityLabel="Secure login"
                />
              </View>
            </Animated.View>
          </View>

          {/* Form sheet */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              paddingHorizontal: formPadX,
              paddingTop: lockHalo / 2 - valleyFromBottom + 2,
              marginTop: -2,
              flexGrow: 1,
            }}
          >
            <Animated.View
              entering={FadeInDown.duration(480).delay(60)}
              onLayout={(e) => {
                formYRef.current = e.nativeEvent.layout.y;
              }}
            >
              <Text style={{ textAlign: 'center', marginBottom: 2 }}>
                <Text
                  style={{
                    fontFamily: FONTS.bold,
                    fontSize: 25,
                    color: LOGIN_NAVY,
                  }}
                >
                  Welcome{' '}
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.bold,
                    fontSize: 18,
                    color: LOGIN_BLUE,
                  }}
                >
                  Back!
                </Text>
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.medium,
                  fontSize: 13,
                  color: '#64748B',
                  textAlign: 'center',
                  marginBottom: 10,
                }}
              >
                Sign in with your Login ID to continue
              </Text>

              {loading ? (
                <Box style={{ minHeight: 260, justifyContent: 'center', alignItems: 'center' }}>
                  <ScreenLoader minHeight={240} />
                </Box>
              ) : (
                <VStack style={{ gap: 10 }}>
                  <VStack style={{ gap: 5 }}>
                    <Text
                      style={{
                        fontFamily: FONTS.bold,
                        fontSize: 12,
                        color: LOGIN_LABEL,
                        letterSpacing: 0.8,
                      }}
                    >
                      LOGIN ID / EMAIL
                    </Text>
                    <Pressable
                      onPress={() => loginIdRef.current?.focus()}
                      style={{
                        height: 52,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: focusedInput === 'loginId' ? LOGIN_BLUE : LOGIN_BORDER,
                        backgroundColor: '#FFFFFF',
                        paddingHorizontal: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <Box
                        pointerEvents="none"
                        className="items-center justify-center"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          backgroundColor: '#E8F0FE',
                        }}
                      >
                        <User size={18} color={LOGIN_BLUE} strokeWidth={2.2} />
                      </Box>
                      <TextInput
                        ref={loginIdRef}
                        value={loginId}
                        onChangeText={setLoginId}
                        onFocus={() => {
                          if (Platform.OS === 'web') setAllowAutofill(true);
                          setFocusedInput('loginId');
                          scrollFormIntoView();
                        }}
                        onBlur={() => setFocusedInput(null)}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="username"
                        readOnly={!allowAutofill}
                        placeholder="Enter login ID or email"
                        placeholderTextColor={LOGIN_MUTED}
                        returnKeyType="next"
                        onSubmitEditing={() => passwordRef.current?.focus()}
                        underlineColorAndroid="transparent"
                        style={{
                          flex: 1,
                          height: '100%',
                          fontFamily: FONTS.medium,
                          fontSize: 14,
                          color: LOGIN_NAVY,
                          paddingRight: 4,
                          paddingVertical: 0,
                          ...(Platform.OS === 'web'
                            ? ({ outlineStyle: 'none', outlineWidth: 0 } as object)
                            : null),
                        }}
                      />
                    </Pressable>
                  </VStack>

                  <VStack style={{ gap: 5 }}>
                    <Text
                      style={{
                        fontFamily: FONTS.bold,
                        fontSize: 12,
                        color: LOGIN_LABEL,
                        letterSpacing: 0.8,
                      }}
                    >
                      PASSWORD
                    </Text>
                    <Pressable
                      onPress={() => passwordRef.current?.focus()}
                      style={{
                        height: 52,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: focusedInput === 'password' ? LOGIN_BLUE : LOGIN_BORDER,
                        backgroundColor: '#FFFFFF',
                        paddingHorizontal: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <Box
                        pointerEvents="none"
                        className="items-center justify-center"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          backgroundColor: '#E8F0FE',
                        }}
                      >
                        <Lock size={18} color={LOGIN_BLUE} strokeWidth={2.2} />
                      </Box>
                      <TextInput
                        ref={passwordRef}
                        value={password}
                        onChangeText={setPassword}
                        onFocus={() => {
                          if (Platform.OS === 'web') setAllowAutofill(true);
                          setFocusedInput('password');
                          scrollFormIntoView();
                        }}
                        onBlur={() => setFocusedInput(null)}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="current-password"
                        readOnly={!allowAutofill}
                        placeholder="Enter password"
                        placeholderTextColor={LOGIN_MUTED}
                        returnKeyType="go"
                        onSubmitEditing={() => void onSecureLogin()}
                        underlineColorAndroid="transparent"
                        style={{
                          flex: 1,
                          height: '100%',
                          fontFamily: FONTS.medium,
                          fontSize: 14,
                          color: LOGIN_NAVY,
                          paddingRight: 4,
                          paddingVertical: 0,
                          ...(Platform.OS === 'web'
                            ? ({ outlineStyle: 'none', outlineWidth: 0 } as object)
                            : null),
                        }}
                      />
                      <Pressable
                        onPress={() => setShowPassword((v) => !v)}
                        className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
                      >
                        {showPassword ? (
                          <EyeOff size={18} color="#94A3B8" />
                        ) : (
                          <Eye size={18} color="#94A3B8" />
                        )}
                      </Pressable>
                    </Pressable>
                  </VStack>

                  {error ? (
                    <Text style={{ fontFamily: FONTS.medium, fontSize: 13, color: '#DC2626' }}>
                      {error}
                    </Text>
                  ) : null}

                  <HStack className="items-center justify-between" style={{ marginTop: 2 }}>
                    <Checkbox
                      value="remember"
                      isChecked={remember}
                      onChange={(v) => setRemember(!!v)}
                    >
                      <CheckboxIndicator
                        style={{
                          borderColor: remember ? LOGIN_BLUE : '#CBD5E1',
                          backgroundColor: remember ? LOGIN_BLUE : '#FFFFFF',
                          borderRadius: 4,
                        }}
                      >
                        <CheckboxIcon as={CheckIcon} />
                      </CheckboxIndicator>
                      <CheckboxLabel
                        style={{
                          fontFamily: FONTS.medium,
                          fontSize: 12,
                          color: '#0F172A',
                          marginLeft: 4,
                        }}
                      >
                        Remember this device
                      </CheckboxLabel>
                    </Checkbox>

                    <Pressable className="active:opacity-70">
                      <Text style={{ fontFamily: FONTS.bold, fontSize: 12, color: LOGIN_BLUE }}>
                        Forgot Password?
                      </Text>
                    </Pressable>
                  </HStack>

                  <Pressable
                    onPress={() => void onSecureLogin()}
                    disabled={loading}
                    className="active:opacity-90 overflow-hidden"
                    style={{
                      borderRadius: 12,
                      marginTop: 4,
                      shadowColor: LOGIN_BLUE,
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.32,
                      shadowRadius: 14,
                      elevation: 5,
                    }}
                  >
                    <LinearGradient
                      colors={['#0B2F8A', '#1A56DB', '#3B82F6']}
                      locations={[0, 0.45, 1]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={{
                        height: 52,
                        borderRadius: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        paddingHorizontal: 16,
                      }}
                    >
                      <Text style={{ fontFamily: FONTS.bold, fontSize: 16, color: '#FFFFFF' }}>
                        Secure Login
                      </Text>
                      <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.6} />
                    </LinearGradient>
                  </Pressable>
                </VStack>
              )}
            </Animated.View>

            {!keyboardOpen ? (
              <VStack style={{ marginTop: 10, alignItems: 'center', gap: 8, width: '100%' }}>
                <HStack
                  style={{
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1, height: 1.5, backgroundColor: '#94A3B8' }} />
                  <HStack style={{ alignItems: 'center', gap: 5, paddingHorizontal: 2, flexShrink: 1 }}>
                    <ShieldCheck size={15} color="#0F172A" strokeWidth={2.2} />
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                      style={{
                        fontFamily: FONTS.bold,
                        fontSize: 13,
                        color: '#0F172A',
                      }}
                    >
                      Secured & Trusted
                    </Text>
                  </HStack>
                  <View style={{ flex: 1, height: 1.5, backgroundColor: '#94A3B8' }} />
                </HStack>

                <HStack
                  style={{
                    width: '100%',
                    justifyContent: 'space-around',
                    paddingHorizontal: isNarrow ? 4 : 12,
                  }}
                >
                  <VStack style={{ alignItems: 'center', gap: 2, flex: 1, paddingHorizontal: 4 }}>
                    <ShieldCheck size={16} color={LOGIN_SKY} strokeWidth={2.2} />
                    <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: LOGIN_BLUE }}>
                      Secure
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{
                        fontFamily: FONTS.medium,
                        fontSize: 11,
                        color: '#0F172A',
                        textAlign: 'center',
                      }}
                    >
                      Data Protection
                    </Text>
                  </VStack>
                  <VStack style={{ alignItems: 'center', gap: 2, flex: 1, paddingHorizontal: 4 }}>
                    <UserCheck size={16} color={LOGIN_SKY} strokeWidth={2.2} />
                    <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: LOGIN_BLUE }}>
                      Authorized
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: FONTS.medium,
                        fontSize: 11,
                        color: '#0F172A',
                        textAlign: 'center',
                      }}
                    >
                      Access Only
                    </Text>
                  </VStack>
                </HStack>

                <Text
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={{
                    fontFamily: FONTS.medium,
                    fontSize: isNarrow ? 10 : 11,
                    color: '#64748B',
                    textAlign: 'center',
                    width: '100%',
                    paddingHorizontal: 4,
                  }}
                >
                  © 2026 Bangalore Development Authority. All rights reserved.
                </Text>
              </VStack>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Box>
  );
}

function OtpDigitBox({
  value,
  index,
  focused,
  success,
  onChangeText,
  onKeyPress,
  onFocus,
  inputRef,
}: {
  value: string;
  index: number;
  focused: boolean;
  success: boolean;
  onChangeText: (v: string) => void;
  onKeyPress: (key: string) => void;
  onFocus: () => void;
  inputRef: (el: TextInput | null) => void;
}) {
  const scale = useSharedValue(1);
  const filled = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    filled.value = withTiming(value ? 1 : 0, { duration: 180 });
    if (value) {
      scale.value = withSequence(
        withSpring(1.12, { damping: 10, stiffness: 320 }),
        withSpring(1, { damping: 14, stiffness: 220 })
      );
    }
  }, [value, filled, scale]);

  useEffect(() => {
    if (focused && !success) {
      scale.value = withSpring(1.06, { damping: 16, stiffness: 260 });
    } else if (!value) {
      scale.value = withSpring(1, { damping: 16, stiffness: 220 });
    }
  }, [focused, success, value, scale]);

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(
      filled.value,
      [0, 1],
      [focused ? '#EFF6FF' : '#F4F5F9', '#FFFFFF']
    ),
    borderColor: interpolateColor(
      filled.value,
      [0, 1],
      [focused ? COLORS.primary : '#E4E7EF', COLORS.primary]
    ),
    shadowOpacity: interpolate(filled.value, [0, 1], [0, 0.14]),
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(80 + index * 55)
        .duration(380)
        .springify()
        .damping(16)}
    >
      <Animated.View
        style={[
          {
            height: 58,
            width: 48,
            borderRadius: 16,
            borderWidth: 1.5,
            shadowColor: COLORS.primary,
            shadowOffset: { width: 0, height: 6 },
            shadowRadius: 10,
            elevation: value ? 3 : 0,
            overflow: 'hidden',
          },
          boxStyle,
        ]}
      >
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onKeyPress={({ nativeEvent }) => onKeyPress(nativeEvent.key)}
          onFocus={onFocus}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={OTP_LENGTH}
          selectTextOnFocus
          editable={!success}
          showSoftInputOnFocus
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 22,
            fontWeight: '800',
            color: '#0F172A',
            padding: 0,
            ...(Platform.OS === 'web'
              ? ({ outlineStyle: 'none', outlineWidth: 0 } as object)
              : null),
          }}
        />
      </Animated.View>
    </Animated.View>
  );
}

export function OtpScreen({ go }: { go: Go }) {
  const { user } = useAuth();
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [focused, setFocused] = useState(0);
  const [seconds, setSeconds] = useState(OTP_TTL_SEC);
  const [success, setSuccess] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const refs = useRef<Array<TextInput | null>>([]);

  const iconFloat = useSharedValue(0);
  const ringA = useSharedValue(0);
  const ringB = useSharedValue(0);
  const timerProgress = useSharedValue(1);
  const timerTrackW = useSharedValue(0);
  const btnReady = useSharedValue(0);
  const successPop = useSharedValue(0);

  useEffect(() => {
    iconFloat.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    ringA.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) }),
      -1,
      false
    );
    ringB.value = withDelay(
      700,
      withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) }), -1, false)
    );
  }, [iconFloat, ringA, ringB]);

  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 480);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (seconds <= 0 || success) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, success]);

  useEffect(() => {
    timerProgress.value = withTiming(Math.max(seconds / OTP_TTL_SEC, 0), {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
  }, [seconds, timerProgress]);

  const filled = otp.every(Boolean);

  useEffect(() => {
    btnReady.value = withSpring(filled && !success ? 1 : 0, { damping: 14, stiffness: 180 });
  }, [filled, success, btnReady]);

  useEffect(() => {
    if (!success) return;
    successPop.value = withSpring(1, { damping: 12, stiffness: 160 });
  }, [success, successPop]);

  const applyDigits = useCallback((raw: string, startIndex = 0) => {
    const digits = raw.replace(/\D/g, '').slice(0, OTP_LENGTH - startIndex);
    if (!digits) return;
    setOtp((prev) => {
      const next = [...prev];
      for (let i = 0; i < digits.length; i++) {
        next[startIndex + i] = digits[i];
      }
      return next;
    });
    const nextFocus = Math.min(startIndex + digits.length, OTP_LENGTH - 1);
    refs.current[nextFocus]?.focus();
    setFocused(nextFocus);
  }, []);

  const setDigit = (i: number, v: string) => {
    if (v.length > 1) {
      applyDigits(v, i);
      return;
    }
    const val = v.replace(/\D/g, '').slice(0, 1);
    setOtp((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
    if (val && i < OTP_LENGTH - 1) {
      refs.current[i + 1]?.focus();
      setFocused(i + 1);
    }
  };

  const onKeyPress = (i: number, key: string) => {
    if (key !== 'Backspace') return;
    if (otp[i]) {
      setOtp((prev) => {
        const next = [...prev];
        next[i] = '';
        return next;
      });
      return;
    }
    if (i > 0) {
      refs.current[i - 1]?.focus();
      setFocused(i - 1);
      setOtp((prev) => {
        const next = [...prev];
        next[i - 1] = '';
        return next;
      });
    }
  };

  const verify = async () => {
    if (verifying || success) return;
    setVerifying(true);
    setSuccess(true);
    Keyboard.dismiss();
    setTimeout(() => {
      if (needsGeoValidation(user)) {
        go('permission');
      } else {
        go(homeScreenForRole(user));
      }
    }, 1250);
  };

  const resend = () => {
    setOtp(Array(OTP_LENGTH).fill(''));
    setSeconds(OTP_TTL_SEC);
    setFocused(0);
    setTimeout(() => refs.current[0]?.focus(), 50);
  };

  const timerUrgent = seconds > 0 && seconds <= 10;

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(iconFloat.value, [0, 1], [0, -5]) }],
  }));

  const ringAStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ringA.value, [0, 0.15, 1], [0.28, 0.18, 0]),
    transform: [{ scale: interpolate(ringA.value, [0, 1], [1, 1.55]) }],
  }));

  const ringBStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ringB.value, [0, 0.15, 1], [0.22, 0.14, 0]),
    transform: [{ scale: interpolate(ringB.value, [0, 1], [1, 1.75]) }],
  }));

  const timerBarStyle = useAnimatedStyle(() => ({
    width: Math.max(timerProgress.value * timerTrackW.value, 0),
    backgroundColor: interpolateColor(
      timerProgress.value,
      [0, 0.18, 1],
      [COLORS.destructive, COLORS.warning, COLORS.primary]
    ),
  }));

  const btnStyle = useAnimatedStyle(() => ({
    opacity: interpolate(btnReady.value, [0, 1], [0.45, 1]),
    transform: [{ scale: interpolate(btnReady.value, [0, 1], [0.97, 1]) }],
  }));

  const successStyle = useAnimatedStyle(() => ({
    opacity: successPop.value,
    transform: [
      { scale: interpolate(successPop.value, [0, 1], [0.72, 1]) },
      { translateY: interpolate(successPop.value, [0, 1], [18, 0]) },
    ],
  }));

  return (
    <ScreenShell>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ flexGrow: 1 }}
        bounces={false}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flexGrow: 1 }}>
            <AppHeader
              title="Verify OTP"
              subtitle="Enter the 6-digit code"
              onBack={() => go('login')}
              showLogout={false}
            />

            <Box className="flex-1 -mt-6 px-5 pb-8">
              <Animated.View
                entering={FadeInUp.duration(520).springify().damping(15).stiffness(140)}
              >
                <AppCard className="pt-6">
                  <VStack className="items-center">
                    <Animated.View style={[{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center' }, iconWrapStyle]}>
                      <Animated.View
                        style={[
                          {
                            position: 'absolute',
                            width: 72,
                            height: 72,
                            borderRadius: 999,
                            borderWidth: 1.5,
                            borderColor: COLORS.primaryGlow,
                          },
                          ringAStyle,
                        ]}
                      />
                      <Animated.View
                        style={[
                          {
                            position: 'absolute',
                            width: 72,
                            height: 72,
                            borderRadius: 999,
                            borderWidth: 1.5,
                            borderColor: COLORS.primary,
                          },
                          ringBStyle,
                        ]}
                      />
                      <LinearGradient
                        colors={['#EFF6FF', '#DBEAFE', '#BFDBFE']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 22,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: 'rgba(29,78,216,0.25)',
                        }}
                      >
                        <Lock size={26} color={COLORS.primaryDeep} strokeWidth={2.3} />
                      </LinearGradient>
                    </Animated.View>

                    <Animated.View entering={FadeIn.delay(180).duration(400)}>
                      <Text className="mt-4 font-extrabold text-[17px] text-foreground text-center tracking-tight">
                        OTP sent to +91 98765 43210
                      </Text>
                      <Text className="mt-1.5 text-sm text-muted-foreground text-center px-3 leading-5">
                        Enter the code to unlock your field session.
                      </Text>
                    </Animated.View>
                  </VStack>

                  <HStack className="mt-7 justify-between">
                    {otp.map((d, i) => (
                      <OtpDigitBox
                        key={i}
                        index={i}
                        value={d}
                        focused={focused === i && !success}
                        success={success}
                        onChangeText={(v) => setDigit(i, v)}
                        onKeyPress={(key) => onKeyPress(i, key)}
                        onFocus={() => setFocused(i)}
                        inputRef={(el) => {
                          refs.current[i] = el;
                        }}
                      />
                    ))}
                  </HStack>

                  <Box
                    className="mt-6 overflow-hidden rounded-full"
                    style={{ height: 5, backgroundColor: '#EFF6FF' }}
                    onLayout={(e) => {
                      timerTrackW.value = e.nativeEvent.layout.width;
                    }}
                  >
                    <Animated.View
                      style={[
                        {
                          height: '100%',
                          borderRadius: 999,
                        },
                        timerBarStyle,
                      ]}
                    />
                  </Box>

                  <HStack className="mt-4 items-center justify-between">
                    <HStack className="items-center gap-2">
                      <Box
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: timerUrgent
                            ? COLORS.warning
                            : seconds <= 0
                              ? COLORS.destructive
                              : COLORS.success,
                        }}
                      />
                      {seconds > 0 ? (
                        <Text className="text-sm text-muted-foreground">
                          Expires in{' '}
                          <Text
                            className="font-extrabold"
                            style={{ color: timerUrgent ? COLORS.warning : '#0F172A' }}
                          >
                            0:{seconds.toString().padStart(2, '0')}
                          </Text>
                        </Text>
                      ) : (
                        <Text className="text-sm font-semibold" style={{ color: COLORS.destructive }}>
                          Code expired
                        </Text>
                      )}
                    </HStack>
                    <Pressable
                      disabled={seconds > 0 || success}
                      onPress={resend}
                      className={`flex-row items-center gap-1.5 px-2 py-1 rounded-lg ${seconds > 0 || success ? 'opacity-35' : 'active:opacity-70'}`}
                    >
                      <RefreshCw size={13} color={COLORS.primary} />
                      <Text className="text-sm text-primary font-bold">Resend</Text>
                    </Pressable>
                  </HStack>
                </AppCard>
              </Animated.View>

              <Box style={{ marginTop: 18, minHeight: 120 }}>
                {success ? (
                  <Animated.View style={successStyle}>
                    <AppCard className="items-center py-8">
                      <Animated.View entering={ZoomIn.springify().damping(12).stiffness(180)}>
                        <LinearGradient
                          colors={['#D1FAE5', '#A7F3D0']}
                          style={{
                            width: 76,
                            height: 76,
                            borderRadius: 999,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={36} color={COLORS.success} strokeWidth={3} />
                        </LinearGradient>
                      </Animated.View>
                      <Text className="mt-4 font-extrabold text-lg text-foreground">
                        Verified Successfully
                      </Text>
                      <Text className="mt-1 text-sm text-muted-foreground">
                        Opening secure session…
                      </Text>
                    </AppCard>
                  </Animated.View>
                ) : (
                  <Animated.View
                    entering={FadeInUp.delay(160).duration(420)}
                    exiting={FadeOut.duration(180)}
                  >
                    <Animated.View style={btnStyle}>
                      <AppBtn disabled={!filled || verifying} onPress={verify} icon={ShieldCheck}>
                        Verify & Continue
                      </AppBtn>
                    </Animated.View>
                  </Animated.View>
                )}
              </Box>

              <Animated.View entering={FadeIn.delay(500).duration(500)}>
                <Text className="text-center text-[11px] text-muted-foreground mt-6">
                  Never share this code · Government secure channel
                </Text>
              </Animated.View>
            </Box>
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </ScreenShell>
  );
}

/** Gradient chevron end + white-bordered tick/arrow — matches ref screenshot 2. */
function PermissionChevronEnd({
  colorFrom,
  colorTo,
  trailing,
}: {
  colorFrom: string;
  colorTo: string;
  trailing: 'check' | 'arrow';
}) {
  // Wider left-arrow / chevron end — matches ref
  const w = 72;
  const h = 76;
  const gradId = `permChevron_${colorTo.replace('#', '')}`;
  return (
    <View style={{ width: w, height: h, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={w} height={h} style={{ position: 'absolute', top: 0, right: 0 }}>
        <Defs>
          <SvgGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colorFrom} />
            <Stop offset="1" stopColor={colorTo} />
          </SvgGradient>
        </Defs>
        <Path
          d={`M18 0 L${w} 0 L${w} ${h} L18 ${h} L0 ${h / 2} Z`}
          fill={`url(#${gradId})`}
        />
        {Array.from({ length: 7 }).map((_, row) =>
          Array.from({ length: 5 }).map((__, col) => (
            <Circle
              key={`${row}-${col}`}
              cx={24 + col * 9}
              cy={10 + row * 10}
              r={1.15}
              fill="rgba(255,255,255,0.4)"
            />
          )),
        )}
      </Svg>
      <View style={{ marginLeft: 10, alignItems: 'center', justifyContent: 'center' }}>
        {/* Soft frosted shade ring (ref) */}
        <View
          style={{
            position: 'absolute',
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: 'rgba(255,255,255,0.18)',
          }}
        />
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.32)',
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.95)',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#FFFFFF',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.55,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          {trailing === 'check' ? (
            <Check size={15} color="#FFFFFF" strokeWidth={3.2} />
          ) : (
            <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.8} />
          )}
        </View>
      </View>
    </View>
  );
}

export function PermissionScreen({ go }: { go: Go }) {
  const { themeId } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [alreadyGranted, setAlreadyGranted] = useState(false);

  const iconFloat = useSharedValue(0);
  const ringA = useSharedValue(0);
  const ringB = useSharedValue(0);
  const btnPulse = useSharedValue(0);

  const items = [
    {
      image: PERM_ICON_GPS,
      title: TERMS.permissions.gpsTitle,
      desc: 'Required for accurate survey geo-tagging',
      accent: '#14B8A6',
      ring: '#99F6E4',
      soft: '#F0FDFA',
      cardBg: '#F0FDFA',
      chevronFrom: '#2DD4BF',
      chevronTo: '#0D9488',
      trailing: 'check' as const,
    },
    {
      image: PERM_ICON_CAMERA,
      title: TERMS.permissions.cameraTitle,
      desc: TERMS.permissions.cameraDesc,
      accent: '#8B5CF6',
      ring: '#DDD6FE',
      soft: '#FAF5FF',
      cardBg: '#F5F3FF',
      chevronFrom: '#A78BFA',
      chevronTo: '#7C3AED',
      trailing: 'check' as const,
    },
    {
      image: PERM_ICON_MIC,
      title: TERMS.permissions.microphoneTitle,
      desc: TERMS.permissions.microphoneDesc,
      accent: '#F97316',
      ring: '#FED7AA',
      soft: '#FFF7ED',
      cardBg: '#FFF7ED',
      chevronFrom: '#FB923C',
      chevronTo: '#EA580C',
      trailing: 'check' as const,
    },
    {
      image: PERM_ICON_FOREGROUND,
      title: TERMS.permissions.foregroundTitle,
      desc: TERMS.permissions.foregroundDesc,
      accent: '#3B82F6',
      ring: '#BFDBFE',
      soft: '#EFF6FF',
      cardBg: '#EFF6FF',
      chevronFrom: '#60A5FA',
      chevronTo: '#2563EB',
      trailing: 'check' as const,
    },
    {
      image: PERM_ICON_PRIVACY,
      title: 'Your data is safe with us',
      desc: 'Used only for survey verification · Encrypted',
      accent: '#38BDF8',
      ring: '#BAE6FD',
      soft: '#F0F9FF',
      cardBg: '#F0F9FF',
      chevronFrom: '#38BDF8',
      chevronTo: '#0284C7',
      trailing: 'arrow' as const,
    },
  ] as const;

  useEffect(() => {
    iconFloat.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    ringA.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.out(Easing.cubic) }),
      -1,
      false
    );
    ringB.value = withDelay(
      800,
      withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.cubic) }), -1, false)
    );
    btnPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [btnPulse, iconFloat, ringA, ringB]);

  useEffect(() => {
    // ZC / CAO never need geo validation — send them home if they land here.
    // Wait until user is loaded; null briefly would skip engineer and bounce away.
    if (!user) return;
    if (!needsGeoValidation(user)) {
      go(homeScreenForRole(user));
    }
  }, [user, go]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const allowed = await hasForegroundLocationPermission();
      if (alive) setAlreadyGranted(allowed);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const enableGps = useCallback(async () => {
    if (busy) return;
    if (user && !needsGeoValidation(user)) {
      go(homeScreenForRole(user));
      return;
    }
    setBusy(true);
    try {
      // Ask camera + mic early so selfie / video work on Media step.
      await ensureCameraPermission(true);
      await ensureMicrophonePermission(true);

      const granted = await ensureForegroundLocationPermission();
      if (!granted) {
        return;
      }
      setAlreadyGranted(true);
      go('geo');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not enable GPS';
      showAppDialog({
        variant: 'error',
        title: 'GPS error',
        message,
        hideCancel: true,
        confirmLabel: 'OK',
      });
    } finally {
      setBusy(false);
    }
  }, [busy, go, user]);

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(iconFloat.value, [0, 1], [0, -8]) }],
  }));

  const ringAStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ringA.value, [0, 0.15, 1], [0.4, 0.22, 0]),
    transform: [{ scale: interpolate(ringA.value, [0, 1], [1, 1.7]) }],
  }));

  const ringBStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ringB.value, [0, 0.15, 1], [0.28, 0.14, 0]),
    transform: [{ scale: interpolate(ringB.value, [0, 1], [1, 2.05]) }],
  }));

  const btnGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(btnPulse.value, [0, 1], [0.22, 0.42]),
    transform: [{ scale: interpolate(btnPulse.value, [0, 1], [1, 1.015]) }],
  }));

  return (
    <ScreenShell>
      <Box style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        {/* Soft decorative curves — mock style */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -80,
            right: -60,
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: 'rgba(37, 99, 235, 0.06)',
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 40,
            left: -90,
            width: 240,
            height: 240,
            borderRadius: 120,
            backgroundColor: 'rgba(37, 99, 235, 0.05)',
          }}
        />

        <ScrollView
          key={themeId}
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: Math.max(insets.top, 12) + 8,
            paddingBottom: Math.max(insets.bottom, 12) + 8,
          }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <HStack style={{ paddingHorizontal: 16, alignItems: 'center', marginBottom: 8 }}>
            <Pressable
              onPress={() => go('login')}
              className="active:opacity-70"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#E2E8F0',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 6,
                elevation: 2,
              }}
              accessibilityLabel="Back"
            >
              <ArrowLeft size={20} color="#0F172A" strokeWidth={2.4} />
            </Pressable>
          </HStack>

          <VStack style={{ paddingHorizontal: 24, alignItems: 'center' }}>
            <Animated.View entering={FadeInDown.duration(420)}>
              <Box
                className="px-3.5 py-1.5 rounded-full flex-row items-center gap-1.5"
                style={{
                  backgroundColor: '#E8F1FF',
                  borderWidth: 1,
                  borderColor: '#BFDBFE',
                }}
              >
                <ShieldCheck size={13} color="#1D4ED8" strokeWidth={2.4} />
                <Text
                  style={{
                    fontFamily: FONTS.bold,
                    fontSize: 11,
                    letterSpacing: 0.7,
                    color: '#1D4ED8',
                  }}
                >
                  REQUIRED FOR FIELD WORK
                </Text>
              </Box>
            </Animated.View>

            <Animated.View
              entering={ZoomIn.delay(60).duration(480).springify().damping(14)}
              style={[{ marginTop: 8 }, iconWrapStyle]}
            >
              {/* Transparent PNG hero — no square image frame */}
              <Image
                source={PERM_HERO}
                style={{ width: 118, height: 118 }}
                resizeMode="contain"
                accessibilityLabel="Location access"
              />
            </Animated.View>

            <Animated.View
              entering={FadeInUp.delay(120).duration(420)}
              style={{ marginTop: 10, width: '100%', alignItems: 'center' }}
            >
              <Text
                style={{
                  fontFamily: FONTS.bold,
                  fontSize: 26,
                  color: '#0F172A',
                  textAlign: 'center',
                }}
              >
                Enable The Location Access
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.medium,
                  fontSize: 12,
                  color: '#64748B',
                  textAlign: 'center',
                  marginTop: 8,
                  lineHeight: 20,
                  paddingHorizontal: 4,
                }}
              >
                {TERMS.app.shortName} needs GPS to verify field surveys and geo-tag dimension reports
                inside your assigned jurisdiction.
              </Text>
            </Animated.View>
          </VStack>

          <VStack style={{ paddingHorizontal: 16, marginTop: 16, gap: 12 }}>
            {items.map((it, i) => (
              <Animated.View
                key={it.title}
                entering={FadeInRight.delay(160 + i * 70).duration(380).springify().damping(16)}
              >
                <Box
                  className="overflow-hidden"
                  style={{
                    borderRadius: 16,
                    backgroundColor: it.cardBg,
                    borderWidth: 1,
                    borderColor: it.accent,
                    height: 76,
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                    elevation: 1,
                  }}
                >
                  <HStack className="items-stretch" style={{ flex: 1 }}>
                    <HStack
                      className="items-center flex-1"
                      style={{ paddingLeft: 12, paddingRight: 4 }}
                    >
                      {/* Soft curved icon tile + accent color border (ref) */}
                      <View
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 16,
                          backgroundColor: it.soft,
                          borderWidth: 2,
                          borderColor: it.accent,
                          padding: 3,
                          alignItems: 'center',
                          justifyContent: 'center',
                          shadowColor: it.accent,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.14,
                          shadowRadius: 4,
                          elevation: 2,
                        }}
                      >
                        <View
                          style={{
                            flex: 1,
                            alignSelf: 'stretch',
                            borderRadius: 11,
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1,
                            borderColor: it.ring,
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          <Image
                            source={it.image}
                            style={{ width: 30, height: 30 }}
                            resizeMode="contain"
                          />
                        </View>
                      </View>
                      <VStack className="flex-1 min-w-0 ml-3">
                        <Text
                          style={{
                            fontFamily: FONTS.bold,
                            fontSize: 14,
                            color: '#0F172A',
                          }}
                          numberOfLines={1}
                        >
                          {it.title}
                        </Text>
                        <Text
                          style={{
                            fontFamily: FONTS.medium,
                            fontSize: 12,
                            color: '#64748B',
                            marginTop: 2,
                            lineHeight: 16,
                          }}
                          numberOfLines={2}
                        >
                          {it.desc}
                        </Text>
                      </VStack>
                    </HStack>
                    <PermissionChevronEnd
                      colorFrom={it.chevronFrom}
                      colorTo={it.chevronTo}
                      trailing={it.trailing}
                    />
                  </HStack>
                </Box>
              </Animated.View>
            ))}
          </VStack>

          <Animated.View
            entering={FadeInUp.delay(480).duration(400)}
            style={{ paddingHorizontal: 18, marginTop: 20 }}
          >
            <Animated.View style={btnGlowStyle}>
              <Pressable
                onPress={() => void enableGps()}
                disabled={busy}
                className="active:opacity-90 overflow-hidden"
                style={{
                  borderRadius: 14,
                  shadowColor: '#2563EB',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.22,
                  shadowRadius: 10,
                  elevation: 4,
                }}
              >
                <LinearGradient
                  colors={['#1D4ED8', '#2563EB', '#3B82F6']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{
                    height: 52,
                    borderRadius: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Navigation size={17} color="#FFFFFF" strokeWidth={2.4} />
                      <Text style={{ fontFamily: FONTS.bold, fontSize: 16, color: '#FFFFFF' }}>
                        Continue
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <Pressable
              onPress={() => go('login')}
              className="active:opacity-70"
              style={{ marginTop: 14, alignItems: 'center', paddingVertical: 6 }}
            >
              
            </Pressable>
          </Animated.View>
        </ScrollView>
      </Box>
    </ScreenShell>
  );
}

const GEO_MAP_MIN_DELTA = 0.0015;
const GEO_MAP_MAX_DELTA = 0.35;
/** Allowed distance from assigned site pin (feet). Soft check — Continue still works. */
const FENCE_RADIUS_FT = GEO_FENCE_RADIUS_FT;

export function GeoScreen({ go }: { go: Go }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { refresh, loading: geoBusy } = useDeviceLocation();
  /** Short / narrow phones: tighter type so the map keeps ~40% of the view. */
  const compact = winH < 760 || winW < 400;
  const webWrap =
    Platform.OS === 'web' ? ({ wordBreak: 'break-word' as const } as object) : null;

  const [scanning, setScanning] = useState(true);
  const [locationResult, setLocationResult] = useState<LocationResult | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapDelta, setMapDelta] = useState(0.008);
  const [mapRecenterKey, setMapRecenterKey] = useState(0);
  const [mapHeight, setMapHeight] = useState(320);
  const [sheetH, setSheetH] = useState(300);
  /** 10 ft fence is measured from the locked live GPS — not a far demo pin. */
  const [fenceAnchor, setFenceAnchor] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    // Wait until user is loaded; null briefly would skip engineer and bounce away.
    if (!user) return;
    if (!needsGeoValidation(user)) {
      go(homeScreenForRole(user));
    }
  }, [user, go]);

  const performFetchLocation = useCallback(async () => {
    setScanning(true);
    setLocationError(null);
    try {
      const res = await refresh({ silent: true });
      if (res) {
        setLocationResult(res);
        setFenceAnchor({
          latitude: res.gps.latitude,
          longitude: res.gps.longitude,
        });
      } else {
        setLocationError('Could not read GPS. Allow location and try again.');
      }
    } catch (e) {
      setLocationError(e instanceof Error ? e.message : 'Could not read GPS');
    } finally {
      setScanning(false);
    }
  }, [refresh]);

  useEffect(() => {
    void performFetchLocation();
  }, [performFetchLocation]);

  const isBusy = scanning || geoBusy;
  const hasLocation = Boolean(locationResult?.gps);

  const currentLat = locationResult?.gps.latitude ?? 0;
  const currentLng = locationResult?.gps.longitude ?? 0;
  const currentAccuracy = locationResult?.gps.accuracy;

  const anchorLat = fenceAnchor?.latitude ?? currentLat;
  const anchorLng = fenceAnchor?.longitude ?? currentLng;

  const realDistFt =
    hasLocation && fenceAnchor
      ? distanceFeet(currentLat, currentLng, anchorLat, anchorLng)
      : 0;

  const outside =
    hasLocation && fenceAnchor ? realDistFt > FENCE_RADIUS_FT : false;

  const leaveGeo = useCallback(() => {
    go('permission', { replace: true });
  }, [go]);

  // Wait for real GPS — never show hardcoded Devanahalli / demo zone placeholders.
  if (!hasLocation || !locationResult) {
    return (
      <ScreenShell>
        <AppHeader
          title={TERMS.permissions.geoValidation}
          subtitle={
            locationError
              ? 'Location unavailable'
              : 'Acquiring GPS — please wait…'
          }
          onBack={leaveGeo}
          go={go}
          gradient={false}
          showNotifications={false}
        />
        <Box className="flex-1 items-center justify-center px-8" style={{ marginTop: 8 }}>
          {isBusy || !locationError ? (
            <ScreenLoader color={COLORS.primary} />
          ) : (
            <VStack className="items-center w-full" style={{ gap: 14 }}>
              <IconBox size="lg" className="bg-destructive/15">
                <AlertTriangle size={22} color={COLORS.destructive} />
              </IconBox>
              <Text className="text-base font-extrabold text-foreground text-center">
                Location not available
              </Text>
              <Text className="text-sm text-muted-foreground text-center leading-5">
                {locationError}
              </Text>
              <Box className="w-full mt-2">
                <AppBtn
                  onPress={() => void performFetchLocation()}
                  icon={RefreshCw}
                  disabled={isBusy}
                >
                  {isBusy ? 'Retrying…' : 'Retry GPS'}
                </AppBtn>
              </Box>
            </VStack>
          )}
        </Box>
      </ScreenShell>
    );
  }

  const villageName =
    locationResult.address.village ||
    locationResult.address.taluk ||
    locationResult.address.displayName ||
    `${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}`;
  const stateName = locationResult.address.state || '—';
  const districtName = locationResult.address.district || stateName;
  const zoneLabel =
    [locationResult.address.district, locationResult.address.state]
      .filter(Boolean)
      .join(' · ') || 'Live GPS zone';

  const sheetBottom = Math.max(insets.bottom, 10) + 6;
  /** Card ≤ 60% of the map pane so the map keeps at least 40%. */
  const sheetMaxH = Math.round(Math.max(mapHeight, 1) * 0.6);
  /** Place tag + zoom sit just above the modal (ref) */
  const aboveModal = sheetBottom + sheetH + 12;

  return (
    <ScreenShell>
      <Box style={{ flex: 1, backgroundColor: '#F0F4F8' }}>
        <AppHeader
          title={TERMS.permissions.geoValidation}
          subtitle={isBusy ? 'Scanning jurisdiction…' : TERMS.permissions.geoValidationSubtitle}
          onBack={leaveGeo}
          go={go}
          gradient={false}
          showNotifications={false}
        />

        <Box style={{ flex: 1 }}>
          {/* Full-bleed map behind the sheet — pan/zoom must reach LiveGeoMap */}
          <Box
            className="relative overflow-hidden"
            style={{ flex: 1 }}
            onLayout={(e) => {
              const h = Math.round(e.nativeEvent.layout.height);
              if (h > 0 && Math.abs(h - mapHeight) > 2) setMapHeight(h);
            }}
          >
              <LiveGeoMap
                height={Math.max(mapHeight, 200)}
                rounded={0}
                latitude={currentLat}
                longitude={currentLng}
                outside={outside}
                latitudeDelta={mapDelta}
                zoom={zoomFromLatitudeDelta(mapDelta)}
                accuracyMeters={currentAccuracy}
                zoneRadiusFeet={FENCE_RADIUS_FT}
                // Keep GPS pin visible above compact bottom sheet
                bottomPadding={aboveModal + 24}
                recenterKey={mapRecenterKey}
                interactive
                showBrandBadge={false}
                showInnerBadge={false}
              />

              {/* GPS Locked — top left (ref) */}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  zIndex: 25,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: '#FFFFFF',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  shadowColor: '#0F172A',
                  shadowOpacity: 0.1,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 3,
                }}
              >
                <Box
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: outside
                      ? COLORS.destructive
                      : isBusy
                        ? COLORS.warning
                        : '#22C55E',
                  }}
                />
                <Text
                  style={{ fontFamily: FONTS.bold, fontSize: 11, color: '#0F172A' }}
                  numberOfLines={1}
                >
                  {outside
                    ? `Outside fence`
                    : isBusy
                      ? `Acquiring GPS…`
                      : `GPS Locked ${
                          currentAccuracy ? `±${Math.round(currentAccuracy)}m` : ''
                        }`}
                </Text>
              </View>

              {/* Locate circle — top right (not above +/-) */}
              <Pressable
                onPress={() => {
                  setMapDelta(0.008);
                  setMapRecenterKey((k) => k + 1);
                }}
                className="active:opacity-70"
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  zIndex: 25,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#0F172A',
                  shadowOpacity: 0.1,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 3,
                }}
                accessibilityLabel="Recenter map"
              >
                <LocateFixed size={16} color={COLORS.primary} strokeWidth={2.4} />
              </Pressable>
          </Box>

          {/* Place tag — just ABOVE modal, left (ref) */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 24,
              bottom: aboveModal,
              zIndex: 25,
              maxWidth: '52%',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: '#FFFFFF',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              shadowColor: '#0F172A',
              shadowOpacity: 0.12,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 8,
            }}
          >
            <MapPin size={12} color="#EA4335" strokeWidth={2.6} />
            <Text
              style={{
                fontFamily: FONTS.semibold,
                fontSize: 12,
                color: '#334155',
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {villageName}
            </Text>
          </View>

          {/* Zoom +/- only — just ABOVE modal, right (ref) */}
          <Box
            style={{
              position: 'absolute',
              right: 24,
              bottom: aboveModal,
              zIndex: 25,
              borderRadius: 14,
              overflow: 'hidden',
              backgroundColor: '#FFFFFF',
              shadowColor: '#0F172A',
              shadowOpacity: 0.12,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 8,
            }}
          >
            <Pressable
              onPress={() =>
                setMapDelta((d) => Math.max(GEO_MAP_MIN_DELTA, d * 0.45))
              }
              className="h-10 w-10 items-center justify-center active:opacity-70"
              accessibilityLabel="Zoom in"
            >
              <Plus size={16} color="#334155" strokeWidth={2.4} />
            </Pressable>
            <Box style={{ height: 1, backgroundColor: '#E2E8F0' }} />
            <Pressable
              onPress={() =>
                setMapDelta((d) => Math.min(GEO_MAP_MAX_DELTA, d * 2.2))
              }
              className="h-10 w-10 items-center justify-center active:opacity-70"
              accessibilityLabel="Zoom out"
            >
              <Minus size={16} color="#334155" strokeWidth={2.4} />
            </Pressable>
          </Box>

          {/* Bottom sheet — capped at 60% height so the map stays visible */}
          <Animated.View
            entering={FadeInUp.duration(420).springify().damping(16)}
            onLayout={(e) => {
              const h = Math.round(e.nativeEvent.layout.height);
              if (h > 0 && Math.abs(h - sheetH) > 2) setSheetH(h);
            }}
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: sheetBottom,
              maxHeight: sheetMaxH,
              backgroundColor: '#FFFFFF',
              borderRadius: compact ? 18 : 24,
              overflow: 'hidden',
              shadowColor: '#0F172A',
              shadowOpacity: 0.14,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 14,
              zIndex: 20,
            }}
          >
            <ScrollView
              nestedScrollEnabled
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: compact ? 12 : 16,
                paddingTop: compact ? 10 : 14,
                paddingBottom: compact ? 10 : 12,
              }}
            >
            <Box
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}
            >
              <Box
                style={{
                  flex: 1,
                  paddingRight: 10,
                  minWidth: 0,
                }}
              >
                <HStack style={{ alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <Navigation size={13} color="#2563EB" strokeWidth={2.4} />
                  <Text
                    style={{
                      fontFamily: FONTS.bold,
                      fontSize: 10,
                      letterSpacing: 0.4,
                      color: '#2563EB',
                      textTransform: 'uppercase',
                      flexShrink: 1,
                    }}
                  >
                    Current Location
                  </Text>
                </HStack>
                <Text
                  style={{
                    fontFamily: FONTS.bold,
                    fontSize: compact ? 13 : 15,
                    color: '#0F172A',
                    lineHeight: compact ? 17 : 20,
                    ...webWrap,
                  }}
                >
                  {villageName}
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.medium,
                    fontSize: compact ? 11 : 12,
                    color: '#64748B',
                    marginTop: 2,
                    lineHeight: compact ? 15 : 17,
                    ...webWrap,
                  }}
                >
                  {districtName}, {stateName}
                </Text>
              </Box>

              <View
                style={{
                  width: 1,
                  alignSelf: 'stretch',
                  backgroundColor: '#E2E8F0',
                  marginVertical: 2,
                }}
              />

              <Box
                style={{
                  flex: 1,
                  paddingLeft: 10,
                  minWidth: 0,
                }}
              >
                <HStack style={{ alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <ShieldCheck size={13} color="#7C3AED" strokeWidth={2.4} />
                  <Text
                    style={{
                      fontFamily: FONTS.bold,
                      fontSize: 10,
                      letterSpacing: 0.4,
                      color: '#7C3AED',
                      textTransform: 'uppercase',
                      flexShrink: 1,
                    }}
                  >
                    Assigned Zone
                  </Text>
                </HStack>
                <Text
                  style={{
                    fontFamily: FONTS.bold,
                    fontSize: compact ? 13 : 15,
                    color: '#0F172A',
                    lineHeight: compact ? 17 : 20,
                    ...webWrap,
                  }}
                >
                  {zoneLabel.replace(' · ', ' • ')}
                </Text>
                <View
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: '#F3E8FF',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.bold,
                      fontSize: 10,
                      color: '#7C3AED',
                    }}
                  >
                    Radius {FENCE_RADIUS_FT} ft
                  </Text>
                </View>
              </Box>
            </Box>

            <HStack
              style={{
                alignItems: 'center',
                gap: 8,
                marginTop: compact ? 8 : 14,
                paddingTop: compact ? 8 : 12,
                borderTopWidth: 1,
                borderTopColor: '#EEF2F7',
              }}
            >
              <Globe2 size={15} color="#64748B" strokeWidth={2.2} />
              <Text
                style={{
                  fontFamily: FONTS.medium,
                  fontSize: 13,
                  color: '#475569',
                }}
                numberOfLines={1}
              >
                {Math.abs(currentLat).toFixed(5)}° {currentLat >= 0 ? 'N' : 'S'} ·{' '}
                {Math.abs(currentLng).toFixed(5)}° {currentLng >= 0 ? 'E' : 'W'}
              </Text>
            </HStack>

            <Text
              style={{
                fontFamily: FONTS.bold,
                fontSize: 10,
                letterSpacing: 0.5,
                color: '#64748B',
                textTransform: 'uppercase',
                marginTop: compact ? 8 : 16,
                marginBottom: compact ? 6 : 8,
              }}
            >
              Geo Status
            </Text>

            {outside ? (
              <Animated.View entering={FadeInDown.duration(320)}>
                <Box
                  style={{
                    borderRadius: 16,
                    backgroundColor: '#FEF2F2',
                    borderWidth: 1.5,
                    borderColor: '#FECACA',
                    padding: compact ? 10 : 14,
                  }}
                >
                  <HStack style={{ alignItems: 'flex-start', gap: 12 }}>
                    <IconBox size="lg" className="bg-destructive/15">
                      <AlertTriangle size={20} color={COLORS.destructive} />
                    </IconBox>
                    <VStack style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontFamily: FONTS.bold, fontSize: 15, color: COLORS.destructive }}>
                        Outside Assigned Location
                      </Text>
                      <Text
                        style={{
                          fontFamily: FONTS.medium,
                          fontSize: 13,
                          color: '#64748B',
                          marginTop: 4,
                          lineHeight: 18,
                        }}
                      >
                        You drifted beyond the {FENCE_RADIUS_FT} ft geo-fence. Refresh GPS to
                        re-lock, or continue anyway.
                      </Text>
                    </VStack>
                  </HStack>
                  <HStack style={{ marginTop: 12, gap: 8 }}>
                    <Box style={{ flex: 1 }}>
                      <AppBtn
                        variant="outline"
                        onPress={() => void performFetchLocation()}
                        icon={RefreshCw}
                        disabled={isBusy}
                      >
                        {isBusy ? 'Checking…' : 'Retry'}
                      </AppBtn>
                    </Box>
                    <Box style={{ flex: 1 }}>
                      <AppBtn
                        onPress={() => go(homeScreenForRole(user))}
                        icon={ArrowRight}
                        disabled={isBusy}
                      >
                        Continue anyway
                      </AppBtn>
                    </Box>
                  </HStack>
                </Box>
              </Animated.View>
            ) : (
              <HStack style={{ alignItems: 'center', gap: 8 }}>
                {/* Status card — shield badge stays OUTSIDE (ref) */}
                <Box
                  style={{
                    flex: 1,
                    borderRadius: 14,
                    backgroundColor: '#ECFDF5',
                    borderWidth: 1,
                    borderColor: '#BBF7D0',
                    paddingVertical: compact ? 8 : 12,
                    paddingHorizontal: compact ? 10 : 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  {/* <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: '#DCFCE7',
                      borderWidth: 1.5,
                      borderColor: '#86EFAC',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <ShieldCheck size={15} color="#16A34A" strokeWidth={2.4} />
                  </View> */}
                  <VStack style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: FONTS.bold, fontSize: compact ? 13 : 15, color: '#15803D' }}>
                      Verified
                    </Text>
                    <Text
                      style={{
                        fontFamily: FONTS.medium,
                        fontSize: compact ? 12 : 13,
                        color: '#16A34A',
                        marginTop: 2,
                        lineHeight: compact ? 16 : 18,
                        ...webWrap,
                      }}
                    >
                      You are within the assigned jurisdiction
                    </Text>
                  </VStack>
                </Box>
                <Image
                  source={GEO_VERIFIED_BADGE}
                  style={{
                    width: compact ? 44 : 58,
                    height: compact ? 44 : 58,
                    marginRight: -2,
                  }}
                  resizeMode="contain"
                  accessibilityLabel="Verified"
                />
              </HStack>
            )}

            {!outside ? (
              <Pressable
                onPress={() => go(homeScreenForRole(user))}
                disabled={isBusy}
                className="active:opacity-90 overflow-hidden"
                style={{
                  marginTop: compact ? 8 : 12,
                  borderRadius: 999,
                  shadowColor: '#2563EB',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.32,
                  shadowRadius: 14,
                  elevation: 6,
                }}
              >
                <LinearGradient
                  colors={['#1E3A8A', '#1D4ED8', '#3B82F6']}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{
                    height: compact ? 44 : 54,
                    borderRadius: 999,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {isBusy ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.6} />
                      <Text style={{ fontFamily: FONTS.bold, fontSize: 16, color: '#FFFFFF' }}>
                        Continue
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            ) : null}
            </ScrollView>
          </Animated.View>
        </Box>
      </Box>
    </ScreenShell>
  );
}

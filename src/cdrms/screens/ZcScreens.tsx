import {
  Box as BoxIcon,
  Building2,
  ChevronDown,
  ClipboardList,
  Compass,
  FilePlus2,
  FilePenLine,
  Hash,
  Hourglass,
  Layers,
  Link2,
  Map as MapIcon,
  MapPin,
  Plus,
  RefreshCw,
  Send,
  UserCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView as RNNativeScrollView,
  TextInput,
  useWindowDimensions,
  View,
  type ScrollView as RNScrollView,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/src/auth/AuthContext';
import { ApiError } from '@/src/api/client';
import {
  firstZcFieldError,
  sanitizeAddressLineInput,
  sanitizeBlockInput,
  sanitizeCommentInput,
  sanitizeEOfficeInput,
  sanitizeSiteDimensionInput,
  sanitizeSiteNoInput,
  ZC_FORM_LIMITS,
  validateSiteDimension,
  validateZcApplicationForm,
  type ZcApplicationFieldKey,
} from '@/src/cdrms/lib/zcApplicationFormValidation';
import {
  applicationCardDateLine,
  countZcBuckets,
  createApplication,
  createSiteDimension,
  fetchAddressDefaults,
  fetchApplication,
  fetchMyZoneMeta,
  fetchSiteDimensions,
  fetchZcApplications,
  applicationStatusTone,
  normalizeApplicationStatus,
  submitZcDraftApplication,
  updateZcDraftApplication,
  type AddressDefaults,
  type CreateApplicationInput,
  type MobileApplication,
  type MyZoneMeta,
  type SiteDimensionOption,
} from '@/src/api/applications';
import { ApplicationRecordDetails } from '@/src/cdrms/components/ApplicationRecordDetails';
import { showAppDialog } from '@/src/cdrms/components/AppDialog';
import { SearchField } from '@/src/cdrms/components/SearchField';
import {
  CompactCreateApplicationHeader,
  CreateApplicationHeader,
} from '@/src/cdrms/components/CreateApplicationHeader';
import { ViewApplicationScroll } from '@/src/cdrms/components/ViewApplicationHeader';
import {
  BottomNav,
  ScreenShell,
  ScreenLoader,
  ListLoader,
  ButtonLoader,
} from '@/src/cdrms/components/primitives';
import {
  OfficeAppRow,
  StatusCountGrid,
  type StatusCountItem,
} from '@/src/cdrms/components/StatusCountGrid';
import {
  BdaPageWatermark,
  WelcomeHomeHeader,
  welcomeFilterGap,
  welcomeOverlayScrollPad,
  welcomeSolidCollapseDistance,
} from '@/src/cdrms/components/WelcomeHomeChrome';
import {
  setSelectedOfficeAppId,
  getSelectedOfficeAppId,
  setZcEditApplicationId,
  consumeZcEditApplicationId,
} from '@/src/cdrms/officeSelection';
import {
  COLORS,
  FONTS,
  GLASS,
  GRADIENT_PRIMARY,
  SPACE,
  themeStatColors,
  gradientStops,
  DESIGN,
  usesLightHeader,
  hexAlpha,
} from '@/src/cdrms/theme';
import { cardSurfaceStyle } from '@/src/cdrms/lib/cardSurface';
import { useTheme } from '@/src/theme/ThemeContext';
import type { Go } from '@/src/cdrms/types';

type ZcTab =
  | 'all'
  | 'draft'
  | 'assigned'
  | 'in_progress'
  | 'submitted';

const ZC_STATUS_FILTERS: { key: ZcTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'submitted', label: 'Submitted' },
];

function applicationToZcForm(app: MobileApplication): CreateApplicationInput {
  return {
    eOfficeNumber: app.eOfficeNumber?.trim() || '',
    siteNo: app.siteNo?.trim() || '',
    addressLine1: app.addressLine1?.trim() || '',
    addressLine2: app.addressLine2?.trim() || '',
    addressBlock: app.addressBlock?.trim() || '',
    addressCity: app.addressCity?.trim() || '',
    addressState: app.addressState?.trim() || '',
    addressPincode: app.addressPincode?.trim() || '',
    siteDimensionType: app.siteDimensionType === 'Odd' ? 'Odd' : 'Even',
    siteDimension: app.siteDimension?.trim() || '',
    siteDimensionComment: app.siteDimensionComment?.trim() || '',
    scheduleNorth: app.scheduleNorth?.trim() || '',
    scheduleSouth: app.scheduleSouth?.trim() || '',
    scheduleWest: app.scheduleWest?.trim() || '',
    scheduleEast: app.scheduleEast?.trim() || '',
    assignedEngineerUserId: String(app.assignedEngineerUserId || '').trim(),
  };
}

function trimZcPayload(form: CreateApplicationInput): Omit<CreateApplicationInput, 'saveAsDraft'> {
  return {
    eOfficeNumber: form.eOfficeNumber.trim(),
    siteNo: form.siteNo.trim(),
    addressLine1: form.addressLine1.trim(),
    addressLine2: form.addressLine2?.trim() || undefined,
    addressBlock: form.addressBlock.trim(),
    addressPincode: form.addressPincode.trim(),
    siteDimensionType: form.siteDimensionType,
    siteDimension: form.siteDimension.trim(),
    siteDimensionComment: form.siteDimensionComment?.trim() || undefined,
    scheduleNorth: form.scheduleNorth?.trim() || undefined,
    scheduleSouth: form.scheduleSouth?.trim() || undefined,
    scheduleWest: form.scheduleWest?.trim() || undefined,
    scheduleEast: form.scheduleEast?.trim() || undefined,
    assignedEngineerUserId: form.assignedEngineerUserId,
  };
}

function villageLine(app: MobileApplication) {
  return (
    [
      app.addressLine1,
      app.addressLine2,
      app.addressBlock,
      app.addressCity,
      app.addressState,
      app.addressPincode,
    ]
      .map((p) => (p || '').trim())
      .filter(Boolean)
      .join(', ') || '—'
  );
}

export function ZcHomeScreen({ go }: { go: Go }) {
  const { themeId } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const { accessToken, user, logout } = useAuth();
  const [apps, setApps] = useState<MobileApplication[]>([]);
  const [zoneLabel, setZoneLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ZcTab>('all');
  const [q, setQ] = useState('');
  const headerScrollY = useSharedValue(0);
  const onHeaderScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      headerScrollY.value = e.contentOffset.y;
    },
  });
  const overlayPad = welcomeOverlayScrollPad(insets.top);
  const collapseDist = welcomeSolidCollapseDistance(insets.top);
  const scrollMinH = windowH + (overlayPad > 0 ? collapseDist : 0);

  const reload = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const fallbackZone = user?.activePost?.zoneCode?.trim() || null;
    try {
      const [list, meta] = await Promise.all([
        fetchZcApplications(accessToken),
        fetchMyZoneMeta(accessToken).catch(() => null),
      ]);
      setApps(list);
      // Assigned zone from officer meta only — do not infer from an application
      // (that caused Welcome EAST vs Profile SOUTH mismatches).
      setZoneLabel(meta?.zoneCode?.trim() || fallbackZone);
    } catch (e) {
      setApps([]);
      setZoneLabel(fallbackZone);
    } finally {
      setLoading(false);
    }
  }, [accessToken, user?.activePost?.zoneCode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const counts = useMemo(() => countZcBuckets(apps), [apps]);

  const draftTone = applicationStatusTone('draft');
  const assignedTone = applicationStatusTone('assigned');
  const inProgressTone = applicationStatusTone('in_progress');
  const submittedTone = applicationStatusTone('submitted');

  const filterCards: Array<{
    id: ZcTab;
    label: string;
    value: number;
    bg: string;
    fg: string;
    icon: LucideIcon;
  }> = [
    {
      id: 'all',
      label: 'All',
      value: counts.total,
      bg: GLASS.tintBlue,
      fg: COLORS.primary,
      icon: Layers,
    },
    {
      id: 'draft',
      label: 'Draft',
      value: counts.draft,
      bg: draftTone.bg,
      fg: draftTone.fg,
      icon: FilePenLine,
    },
    {
      id: 'assigned',
      label: 'Assigned',
      value: counts.assigned,
      bg: assignedTone.bg,
      fg: assignedTone.fg,
      icon: UserCheck,
    },
    {
      id: 'in_progress',
      label: 'In progress',
      value: counts.in_progress,
      bg: inProgressTone.bg,
      fg: inProgressTone.fg,
      icon: Hourglass,
    },
    {
      id: 'submitted',
      label: 'Submitted',
      value: counts.submitted,
      bg: submittedTone.bg,
      fg: submittedTone.fg,
      icon: Send,
    },
  ];

  const filtered = useMemo(() => {
    let items = apps;
    if (tab !== 'all') {
      items = items.filter((a) => normalizeApplicationStatus(a.status) === tab);
    }
    if (!q.trim()) return items;
    const needle = q.trim().toLowerCase();
    return items.filter(
      (a) =>
        a.applicationNumber.toLowerCase().includes(needle) ||
        a.siteNo.toLowerCase().includes(needle) ||
        (a.assignedEngineerName || '').toLowerCase().includes(needle) ||
        (a.assignedEngineerLoginId || '').toLowerCase().includes(needle) ||
        (a.zoneCode || '').toLowerCase().includes(needle) ||
        villageLine(a).toLowerCase().includes(needle),
    );
  }, [apps, tab, q]);

  const sectionLabel =
    tab === 'all' ? 'Recent Activity' : ZC_STATUS_FILTERS.find((f) => f.key === tab)?.label;

  const openDetail = (id: string) => {
    setSelectedOfficeAppId(id);
    go('zc_detail');
  };

  const openEditDraft = (id: string) => {
    setZcEditApplicationId(id);
    go('zc_create');
  };

  return (
    <ScreenShell className="bg-background">
      <BdaPageWatermark />
      {/* Header outside ScrollView so profile menu stays tappable when collapsed */}
      <WelcomeHomeHeader
        user={user}
        zoneLabel={zoneLabel}
        go={go}
        scrollY={headerScrollY}
        tagline="Manage zone applications"
        onLogout={() => {
          void (async () => {
            await logout();
            go('login');
          })();
        }}
      />
      <Animated.ScrollView
        key={themeId}
        className="flex-1"
        style={{ flex: 1, minHeight: 0, zIndex: 1 }}
        contentContainerStyle={{
          paddingTop: overlayPad,
          paddingBottom: 120,
          minHeight: scrollMinH,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        overScrollMode="never"
        onScroll={onHeaderScroll}
        scrollEventThrottle={16}
      >
        <Box className="px-3" style={{ marginTop: welcomeFilterGap() }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}
          >
            {filterCards.map((s) => {
              const Icon = s.icon;
              const selected = tab === s.id;
              const plainLite = usesLightHeader();
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setTab(s.id)}
                  className="active:opacity-90"
                  style={{
                    width: 92,
                    backgroundColor: selected
                      ? COLORS.primary
                      : plainLite
                        ? s.bg
                        : COLORS.white,
                    borderRadius: DESIGN.cardRadius,
                    paddingVertical: 8,
                    paddingHorizontal: 2,
                    alignItems: 'center',
                    minHeight: 66,
                    justifyContent: 'center',
                    shadowColor: selected ? COLORS.primaryDeep : GLASS.shadow,
                    shadowOffset: { width: 0, height: plainLite ? 2 : 4 },
                    shadowOpacity: selected ? 0.2 : plainLite ? 0.03 : 0.06,
                    shadowRadius: plainLite ? 6 : 8,
                    elevation: selected ? 3 : plainLite ? 1 : 2,
                    borderWidth: 1.5,
                    borderColor: selected ? COLORS.primary : hexAlpha(COLORS.primary, 0.55),
                  }}
                >
                  <Box
                    className="items-center justify-center mb-1"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      backgroundColor: selected
                        ? 'rgba(255,255,255,0.22)'
                        : plainLite
                          ? 'rgba(255,255,255,0.55)'
                          : s.bg,
                    }}
                  >
                    <Icon size={14} color={selected ? COLORS.white : s.fg} strokeWidth={2.3} />
                  </Box>
                  <Text
                    style={{
                      fontFamily: FONTS.bold,
                      fontSize: 15,
                      color: selected ? COLORS.white : COLORS.ink,
                    }}
                  >
                    {loading ? '—' : s.value}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: FONTS.semibold,
                      fontSize: 12,
                      color: selected ? 'rgba(255,255,255,0.9)' : COLORS.slate,
                      textAlign: 'center',
                      paddingHorizontal: 2,
                    }}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Box>

        <Box className="px-4 mt-3">
          <HStack className="items-center justify-between mb-2">
            <Text className="text-[15px] font-bold flex-1" style={{ color: COLORS.ink }}>
              {sectionLabel}
            </Text>
            <HStack className="items-center" style={{ gap: 10 }}>
              <Pressable onPress={() => void reload()} className="active:opacity-70">
                <HStack className="items-center" style={{ gap: 4 }}>
                  <RefreshCw size={13} color={COLORS.primary} strokeWidth={2.4} />
                  <Text className="text-[12px] font-semibold" style={{ color: COLORS.primary }}>
                    Refresh
                  </Text>
                </HStack>
              </Pressable>
              <Pressable
                onPress={() => {
                  setZcEditApplicationId(null);
                  go('zc_create');
                }}
                className="flex-row items-center gap-1.5 active:opacity-90"
                style={{
                  backgroundColor: COLORS.primary,
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <FilePlus2 size={14} color={COLORS.white} />
                <Text className="text-[12px] font-bold text-white">Create</Text>
              </Pressable>
            </HStack>
          </HStack>

          <SearchField
            value={q}
            onChangeText={setQ}
            placeholder="Search by application no, site, engineer…"
            height={48}
            iconColor={COLORS.ink}
            placeholderTextColor={COLORS.ink}
            inputStyle={{ fontSize: 15, color: COLORS.ink }}
            style={{
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: hexAlpha(COLORS.primary, 0.35),
              backgroundColor: COLORS.white,
              marginTop: 4,
            }}
          />

          {loading ? (
            <ListLoader minHeight={200} />
          ) : filtered.length === 0 ? (
            <Box
              className="rounded-2xl border border-dashed px-4 py-8 mt-3"
              style={{
                borderColor: COLORS.border,
                backgroundColor: 'rgba(255,255,255,0.42)',
              }}
            >
              <Text className="text-center text-sm" style={{ color: COLORS.slate }}>
                No applications found matching your criteria.
              </Text>
            </Box>
          ) : (
            <VStack style={{ gap: 0, marginTop: 10 }}>
              {filtered.map((app) => (
                <OfficeAppRow
                  key={app.id}
                  title={app.applicationNumber}
                  siteNo={app.siteNo}
                  zoneCode={app.zoneCode}
                  engineerName={app.assignedEngineerName}
                  status={app.status}
                  dateLine={applicationCardDateLine(app)}
                  zoneBesideDate
                  compactDateZone
                  onPress={() => openDetail(app.id)}
                  onEdit={
                    normalizeApplicationStatus(app.status) === 'draft'
                      ? () => openEditDraft(app.id)
                      : undefined
                  }
                />
              ))}
            </VStack>
          )}
        </Box>
      </Animated.ScrollView>

      <BottomNav
        active="home"
        onNav={go}
        homeTarget="zc_home"
        hideAlerts
        onPlus={() => {
          setZcEditApplicationId(null);
          go('zc_create');
        }}
      />
    </ScreenShell>
  );
}

const emptyForm: CreateApplicationInput = {
  eOfficeNumber: '',
  siteNo: '',
  addressLine1: '',
  addressLine2: '',
  addressBlock: '',
  addressCity: '',
  addressState: '',
  addressPincode: '',
  siteDimensionType: 'Even',
  siteDimension: '',
  siteDimensionComment: '',
  scheduleNorth: '',
  scheduleSouth: '',
  scheduleWest: '',
  scheduleEast: '',
  assignedEngineerUserId: '',
};

const FIELD_RADIUS = 14;
const ACCENT = {
  blue: { fg: '#1A368E', bg: '#E8F0FE', soft: '#F3F7FF' },
  green: { fg: '#15803D', bg: '#DCFCE7', soft: '#F0FDF4' },
  purple: { fg: '#6D28D9', bg: '#EDE9FE', soft: '#F5F3FF' },
  sky: { fg: '#1D4ED8', bg: '#DBEAFE', soft: '#EFF6FF' },
} as const;

function Field({
  label,
  value,
  onChange,
  placeholder,
  onFocus,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
  style,
  required,
  error,
  multiline,
  numberOfLines,
  keyboardType,
  maxLength,
  leftIcon: LeftIcon,
  accent = 'blue',
  fontSize = 15,
  labelFontSize = 14,
  labelStyle,
  editable = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onFocus?: (info: { y: number; height: number }) => void;
  returnKeyType?: 'next' | 'done' | 'go' | 'default';
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
  style?: object;
  required?: boolean;
  error?: string;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: 'default' | 'number-pad' | 'numeric' | 'phone-pad';
  maxLength?: number;
  leftIcon?: LucideIcon;
  accent?: keyof typeof ACCENT;
  /** Input + placeholder text size (default 15). */
  fontSize?: number;
  /** Label font size (default 14). */
  labelFontSize?: number;
  labelStyle?: object;
  /** When false, field is frozen (no cursor / keyboard). */
  editable?: boolean;
}) {
  const inputRef = useRef<TextInput>(null);
  const inputHeight = multiline ? Math.max(88, (numberOfLines ?? 3) * 26) : 48;
  const tone = ACCENT[accent];
  const locked = editable === false;

  return (
    <VStack style={[{ marginBottom: 0 }, style]}>
      {label.trim() ? (
        <Text
          numberOfLines={1}
          style={[
            {
              fontFamily: FONTS.bold,
              fontSize: labelFontSize,
              color: '#1A368E',
              marginBottom: 7,
              letterSpacing: -0.2,
            },
            labelStyle,
          ]}
        >
          {label}
          {required ? <Text style={{ color: COLORS.destructive, fontFamily: FONTS.bold }}> *</Text> : null}
        </Text>
      ) : null}
      <HStack
        style={{
          minHeight: inputHeight,
          borderRadius: FIELD_RADIUS,
          borderWidth: 1.5,
          borderColor: error ? COLORS.destructive : hexAlpha(tone.fg, locked ? 0.22 : 0.42),
          backgroundColor: locked ? '#F1F5F9' : COLORS.white,
          paddingHorizontal: 12,
          alignItems: multiline ? 'flex-start' : 'center',
          gap: 8,
        }}
      >
        {LeftIcon ? (
          <Box style={{ marginTop: multiline ? 13 : 0 }}>
            <LeftIcon size={17} color={tone.fg} strokeWidth={2.3} />
          </Box>
        ) : null}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#64748B"
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines ?? 3 : 1}
          textAlignVertical={multiline ? 'top' : 'center'}
          scrollEnabled={multiline ? true : undefined}
          keyboardType={keyboardType}
          maxLength={maxLength}
          editable={!locked}
          showSoftInputOnFocus={!locked}
          caretHidden={locked}
          onFocus={() => {
            if (locked) return;
            // Web: delayed measure + scrollTo unfocuses the field (keyboard flicker).
            if (Platform.OS === 'web') return;
            const report = () => {
              inputRef.current?.measureInWindow((_x, y, _w, h) => {
                onFocus?.({ y, height: h || inputHeight });
              });
            };
            setTimeout(report, Platform.OS === 'ios' ? 50 : 80);
            setTimeout(report, Platform.OS === 'ios' ? 320 : 400);
          }}
          returnKeyType={returnKeyType ?? (multiline ? 'default' : 'next')}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit ?? !multiline}
          style={{
            flex: 1,
            height: inputHeight,
            minHeight: inputHeight,
            maxHeight: inputHeight,
            paddingTop: multiline ? 12 : 0,
            paddingBottom: multiline ? 12 : 0,
            fontSize,
            color: locked ? '#475569' : COLORS.ink,
            fontFamily: FONTS.medium,
            ...(Platform.OS === 'web'
              ? ({ outlineStyle: 'none', outlineWidth: 0 } as object)
              : null),
          }}
        />
      </HStack>
      {error ? (
        <Text
          style={{
            marginTop: 4,
            fontSize: 12,
            color: COLORS.destructive,
            fontFamily: FONTS.medium,
          }}
        >
          {error}
        </Text>
      ) : null}
    </VStack>
  );
}

function PlainSectionCard({
  title,
  subtitle,
  icon: Icon,
  required,
  children,
  accent = 'blue',
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  required?: boolean;
  children: ReactNode;
  accent?: keyof typeof ACCENT;
}) {
  const tone = ACCENT[accent];

  return (
    <Box
      style={{
        marginHorizontal: SPACE.gutter,
        borderRadius: 20,
        backgroundColor: COLORS.white,
        borderWidth: 1.75,
        borderColor: hexAlpha(tone.fg, 0.38),
        shadowColor: tone.fg,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0.07,
        shadowRadius: 12,
        elevation: 3,
        overflow: 'hidden',
      }}
    >
      <HStack
        className="items-center"
        style={{ gap: 11, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: COLORS.white }}
      >
        <Box
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tone.bg,
          }}
        >
          <Icon size={17} color={tone.fg} strokeWidth={2.4} />
        </Box>
        <VStack style={{ flex: 1, gap: 3 }}>
          <Text
            style={{
              fontFamily: FONTS.bold,
              fontSize: 17,
              color: '#0F172A',
              letterSpacing: -0.2,
            }}
            numberOfLines={1}
          >
            {title}
            {required ? (
              <Text style={{ color: COLORS.destructive, fontFamily: FONTS.bold }}> *</Text>
            ) : null}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontFamily: FONTS.semibold,
                fontSize: 14,
                color: '#475569',
                lineHeight: 18,
              }}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </VStack>
      </HStack>
      <Box style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2, backgroundColor: COLORS.white }}>
        {children}
      </Box>
    </Box>
  );
}

export function ZcCreateScreen({ go }: { go: Go }) {
  const { themeId } = useTheme();
  const { accessToken } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  /** iPhone SE / 320px web: stack paired fields so Save/Cancel stay on-screen. */
  const compactForm = winW < 400;
  const scrollRef = useRef<RNScrollView>(null);
  const scrollYRef = useRef(0);
  const keyboardHeightRef = useRef(0);
  const focusedFieldRef = useRef<{ y: number; height: number } | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [headerCompact, setHeaderCompact] = useState(false);
  const applyHeaderCompact = useCallback((y: number) => {
    scrollYRef.current = y;
    const next = y > 48;
    setHeaderCompact((prev) => (prev === next ? prev : next));
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const bind = () => {
      const sv = scrollRef.current as unknown as {
        getScrollableNode?: () => unknown;
      } | null;
      const node = sv?.getScrollableNode?.() as
        | { scrollTop?: number; addEventListener?: Function; removeEventListener?: Function }
        | undefined;
      if (!node?.addEventListener) return undefined;
      const onDomScroll = () => applyHeaderCompact(Number(node.scrollTop) || 0);
      node.addEventListener('scroll', onDomScroll, { passive: true });
      return () => node.removeEventListener?.('scroll', onDomScroll);
    };
    let unbind = bind();
    const t = setTimeout(() => {
      unbind?.();
      unbind = bind();
    }, 80);
    return () => {
      clearTimeout(t);
      unbind?.();
    };
  }, [applyHeaderCompact]);
  const [editApplicationId] = useState(() => consumeZcEditApplicationId());
  const isEditing = Boolean(editApplicationId);
  const [zone, setZone] = useState<MyZoneMeta | null>(null);
  const [addressDefaults, setAddressDefaults] = useState<AddressDefaults | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<'save' | 'submit' | null>(null);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<SiteDimensionOption[]>([]);
  const [dimOpen, setDimOpen] = useState(false);
  const [addingDim, setAddingDim] = useState(false);
  const [newDimValue, setNewDimValue] = useState('');
  const [savingDim, setSavingDim] = useState(false);
  const [engOpen, setEngOpen] = useState(false);
  const dimTriggerRef = useRef<View>(null);
  const engTriggerRef = useRef<View>(null);
  const fieldAnchorRefs = useRef<Partial<Record<ZcApplicationFieldKey, View | null>>>({});

  const setFieldAnchorRef = useCallback(
    (key: ZcApplicationFieldKey) => (node: View | null) => {
      fieldAnchorRefs.current[key] = node;
    },
    [],
  );

  const scrollToField = useCallback((key: ZcApplicationFieldKey) => {
    const node = fieldAnchorRefs.current[key];
    const scroll = scrollRef.current as unknown as {
      measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
      scrollTo: (opts: { y: number; animated?: boolean }) => void;
    } | null;
    if (!node || !scroll?.measureInWindow) return;

    node.measureInWindow((_x, y, _w, h) => {
      scroll.measureInWindow?.((_sx, sy, _sw, _sh) => {
        const topPad = 88; // sticky compact header + breathing room
        const targetY = Math.max(0, scrollYRef.current + (y - sy) - topPad);
        scroll.scrollTo({ y: targetY, animated: true });
        // Re-nudge once layout settles after dialog close.
        setTimeout(() => {
          node.measureInWindow((_x2, y2) => {
            scroll.measureInWindow?.((_sx2, sy2) => {
              const yAgain = Math.max(0, scrollYRef.current + (y2 - sy2) - topPad);
              scroll.scrollTo({ y: yAgain, animated: true });
            });
          });
        }, 180);
        void h;
      });
    });
  }, []);
  const [dimAnchor, setDimAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [engAnchor, setEngAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const DROPDOWN_ITEM_H = 41;
  const DROPDOWN_MAX_ITEMS = 5;
  const dropdownListHeight = (count: number) => {
    if (count <= 0) return 44;
    return Math.min(count, DROPDOWN_MAX_ITEMS) * DROPDOWN_ITEM_H;
  };

  const openDimDropdown = () => {
    if (dimOpen) {
      setDimOpen(false);
      return;
    }
    dimTriggerRef.current?.measureInWindow((x, y, width, height) => {
      setDimAnchor({ x, y, width, height });
      setDimOpen(true);
      setAddingDim(false);
      setEngOpen(false);
    });
  };

  const openEngDropdown = () => {
    if (engOpen) {
      setEngOpen(false);
      return;
    }
    engTriggerRef.current?.measureInWindow((x, y, width, height) => {
      setEngAnchor({ x, y, width, height });
      setEngOpen(true);
      setDimOpen(false);
      setAddingDim(false);
    });
  };

  /**
   * Nudge scroll so the focused field sits just above the keyboard.
   * Prefer keyboard height when known; otherwise estimate so Comments
   * (bottom of form) still scrolls up before keyboardDidShow fires.
   */
  const ensureVisible = useCallback((anchorYInWindow?: number, fieldHeight = 44) => {
    // Scrolling on web blurs the focused input (keyboard open/close loop).
    if (Platform.OS === 'web') return;
    if (anchorYInWindow == null) return;
    const scroll = scrollRef.current as unknown as {
      measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
      scrollTo: (opts: { y: number; animated?: boolean }) => void;
    } | null;
    if (!scroll?.measureInWindow) return;

    scroll.measureInWindow((_sx, sy, _sw, sh) => {
      const screenH = Dimensions.get('window').height;
      const kb =
        keyboardHeightRef.current > 0
          ? keyboardHeightRef.current
          : Math.round(screenH * 0.42);
      const keyboardTop = screenH - kb;
      const fieldBottom = anchorYInWindow + fieldHeight + 24;
      const visibleBottom = Math.min(sy + sh, keyboardTop) - 16;
      if (fieldBottom <= visibleBottom) return;
      const delta = fieldBottom - visibleBottom;
      scroll.scrollTo({
        y: Math.max(0, scrollYRef.current + delta),
        animated: true,
      });
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        const h = e.endCoordinates?.height ?? 0;
        keyboardHeightRef.current = h;
        setKeyboardHeight(h);
        // Re-measure after keyboard is up — focus often runs before height is known.
        // Fresh window coords come from Field's delayed onFocus; nudge with last known.
        const focused = focusedFieldRef.current;
        if (focused) {
          requestAnimationFrame(() => {
            setTimeout(() => ensureVisible(focused.y, focused.height), 80);
            setTimeout(() => ensureVisible(focused.y, focused.height), 280);
          });
        }
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        keyboardHeightRef.current = 0;
        setKeyboardHeight(0);
        focusedFieldRef.current = null;
      },
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [ensureVisible]);

  const onFieldFocus = useCallback(
    (info: { y: number; height: number }) => {
      focusedFieldRef.current = info;
      ensureVisible(info.y, info.height);
    },
    [ensureVisible],
  );

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [meta, dims, defaults, existing] = await Promise.all([
          fetchMyZoneMeta(accessToken),
          fetchSiteDimensions(accessToken).catch(() => [] as SiteDimensionOption[]),
          fetchAddressDefaults(accessToken).catch(
            (): AddressDefaults => ({
              city: '',
              state: '',
              cityLocked: true,
              stateLocked: true,
            }),
          ),
          editApplicationId
            ? fetchApplication(accessToken, editApplicationId).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setZone(meta);
        setZoneError(null);
        setDimensions(dims);
        setAddressDefaults(defaults);
        if (existing) {
          if (normalizeApplicationStatus(existing.status) !== 'draft') {
            setZoneError('Only draft applications can be edited.');
          } else {
            setForm({
              ...applicationToZcForm(existing),
              addressCity: existing.addressCity || defaults.city,
              addressState: existing.addressState || defaults.state,
            });
          }
        } else {
          setForm((f) => ({
            ...f,
            addressCity: defaults.city,
            addressState: defaults.state,
          }));
        }
      } catch (e) {
        if (cancelled) return;
        setZone(null);
        setZoneError(
          e instanceof ApiError
            ? e.message
            : 'Your post must have a master zone before creating applications.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, editApplicationId]);

  const engineers = useMemo(
    () =>
      (zone?.engineers ?? [])
        .map((e) => ({
          ...e,
          userId: String(e.userId ?? '').trim(),
        }))
        .filter((e) => Boolean(e.userId)),
    [zone?.engineers],
  );

  const saveNewDimension = async () => {
    if (!accessToken) return;
    const normalized = newDimValue.trim().replace(/\s+/g, '');
    const dimErr = validateSiteDimension(normalized);
    if (dimErr) {
      showAppDialog({
        variant: 'warning',
        title: 'Validation',
        message: dimErr,
        hideCancel: true,
        confirmLabel: 'OK',
      });
      return;
    }
    const exists = dimensions.some(
      (d) => d.label.toLowerCase() === normalized.toLowerCase(),
    );
    if (exists) {
      setForm((f) => ({ ...f, siteDimension: normalized }));
      setAddingDim(false);
      setNewDimValue('');
      setDimOpen(false);
      return;
    }
    setSavingDim(true);
    try {
      const row = await createSiteDimension(accessToken, normalized);
      setDimensions((prev) => {
        if (prev.some((d) => d.label.toLowerCase() === row.label.toLowerCase())) {
          return prev;
        }
        return [...prev, row].sort((a, b) => a.label.localeCompare(b.label));
      });
      setForm((f) => ({ ...f, siteDimension: row.label }));
      setAddingDim(false);
      setNewDimValue('');
      setDimOpen(false);
      setFieldErrors((prev) => {
        if (!prev.siteDimension) return prev;
        const next = { ...prev };
        delete next.siteDimension;
        return next;
      });
      showAppDialog({
        variant: 'success',
        title: 'Dimension saved',
        message: `${row.label} was added to the dropdown.`,
        hideCancel: true,
        confirmLabel: 'OK',
      });
    } catch (e) {
      const forbidden =
      e instanceof ApiError &&
      (e.status === 403 || /insufficient permissions/i.test(e.message));
    if (forbidden) {
      setForm((f) => ({ ...f, siteDimension: normalized }));
      setAddingDim(false);
      setNewDimValue('');
      setDimOpen(false);
      setFieldErrors((prev) => {
        if (!prev.siteDimension) return prev;
        const next = { ...prev };
        delete next.siteDimension;
        return next;
      });
      showAppDialog({
        variant: 'warning',
        title: 'Dimension applied',
        message: `${normalized} will be used for this application. It could not be saved to the shared list (permission required).`,
        hideCancel: true,
        confirmLabel: 'OK',
      });
      return;
    }
      showAppDialog({
        variant: 'error',
        title: 'Could not save',
        message: e instanceof ApiError ? e.message : 'Failed to save dimension',
        hideCancel: true,
        confirmLabel: 'OK',
      });
    } finally {
      setSavingDim(false);
    }
  };

  const selectedEngineer = engineers.find((e) => e.userId === form.assignedEngineerUserId);

  const clearFieldError = useCallback((key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const validateForm = useCallback((): boolean => {
    const next = validateZcApplicationForm(form);
    setFieldErrors(next);
    const first = firstZcFieldError(next);
    if (first) {
      showAppDialog({
        variant: 'warning',
        title: 'Validation',
        message: `${first.label}: ${first.message}`,
        hideCancel: true,
        confirmLabel: 'OK',
        onConfirm: () => {
          requestAnimationFrame(() => {
            setTimeout(() => scrollToField(first.key), 80);
          });
        },
      });
      return false;
    }
    return true;
  }, [form, scrollToField]);

  const onSaveDraft = async () => {
    if (!accessToken) return;
    if (!validateForm()) return;

    setSaving(true);
    setSavingAction('save');
    const payload = trimZcPayload(form);
    try {
      if (isEditing && editApplicationId) {
        const updated = await updateZcDraftApplication(accessToken, editApplicationId, payload);
        showAppDialog({
          variant: 'success',
          title: 'Draft saved',
          message: 'Your changes were saved. You can edit and submit when ready.',
          highlightLabel: 'Application number',
          highlight: updated.applicationNumber,
          hideCancel: true,
          confirmLabel: 'Done',
          onConfirm: () => go('zc_home'),
        });
      } else {
        const created = await createApplication(accessToken, {
          ...payload,
          saveAsDraft: true,
        });
        setForm(emptyForm);
        setFieldErrors({});
        showAppDialog({
          variant: 'success',
          title: 'Draft saved',
          message: 'Application saved as draft. Edit and submit when ready.',
          highlightLabel: 'Application number',
          highlight: created.applicationNumber,
          hideCancel: true,
          confirmLabel: 'Done',
          onConfirm: () => go('zc_home'),
        });
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to save draft';
      if (/e-office/i.test(msg) || /already used/i.test(msg)) {
        setFieldErrors((prev) => ({ ...prev, eOfficeNumber: msg }));
      }
      showAppDialog({
        variant: 'error',
        title: 'Could not save',
        message: msg,
        hideCancel: true,
        confirmLabel: 'OK',
      });
    } finally {
      setSaving(false);
      setSavingAction(null);
    }
  };

  const onSubmitApplication = async () => {
    if (!accessToken) return;
    if (!validateForm()) return;

    setSaving(true);
    setSavingAction('submit');
    const payload = trimZcPayload(form);
    try {
      if (isEditing && editApplicationId) {
        const submitted = await submitZcDraftApplication(
          accessToken,
          editApplicationId,
          payload,
        );
        setForm(emptyForm);
        setFieldErrors({});
        showAppDialog({
          variant: 'success',
          title: 'Application submitted',
          message: 'The application is assigned to the engineer successfully.',
          highlightLabel: 'Application number',
          highlight: submitted.applicationNumber,
          hideCancel: true,
          confirmLabel: 'Done',
          onConfirm: () => go('zc_home'),
        });
      } else {
        const created = await createApplication(accessToken, {
          ...payload,
          saveAsDraft: false,
        });
        setForm(emptyForm);
        setFieldErrors({});
        showAppDialog({
          variant: 'success',
          title: 'Application submitted',
          message: 'The application is assigned to the engineer successfully.',
          highlightLabel: 'Application number',
          highlight: created.applicationNumber,
          hideCancel: true,
          confirmLabel: 'Done',
          onConfirm: () => go('zc_home'),
        });
      }
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : 'Failed to submit application';
      if (/e-office/i.test(msg) || /already used/i.test(msg)) {
        setFieldErrors((prev) => ({ ...prev, eOfficeNumber: msg }));
      }
      showAppDialog({
        variant: 'error',
        title: 'Could not submit',
        message: msg,
        hideCancel: true,
        confirmLabel: 'OK',
      });
    } finally {
      setSaving(false);
      setSavingAction(null);
    }
  };

  const createTitle = isEditing ? 'Edit Draft' : 'Create Application';

  return (
    <ScreenShell className="bg-background">
      <BdaPageWatermark />
      <Box style={{ flex: 1, backgroundColor: 'transparent' }}>
      {/* Sticky compact header — always mounted; shown after the hero scrolls away. */}
      <Box
        pointerEvents={headerCompact ? 'box-none' : 'none'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          elevation: 20,
          opacity: headerCompact ? 1 : 0,
        }}
      >
        <CompactCreateApplicationHeader
          onBack={() => go('zc_home')}
          zone={zone?.zoneCode}
          title={createTitle}
        />
      </Box>
      {/*
        Bottom padding grows with keyboard so Comments (last field) can scroll
        above it. ensureVisible re-runs after keyboardDidShow to fix timing.
      */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        enabled={Platform.OS !== 'web'}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          key={themeId}
          ref={scrollRef}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          contentContainerStyle={{
            // Native: extra inset only while the keyboard is open.
            // Web: the visual viewport already shrinks — a fixed 220px spacer
            // left a large empty gap under Save / Submit.
            paddingBottom:
              24 +
              insets.bottom +
              (Platform.OS === 'web' || keyboardHeight <= 0
                ? 0
                : Platform.OS === 'android'
                  ? Math.min(Math.max(keyboardHeight * 0.55, 160), 240)
                  : keyboardHeight),
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps={Platform.OS === 'web' ? 'always' : 'handled'}
          keyboardDismissMode={
            Platform.OS === 'web' ? 'none' : Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          nestedScrollEnabled
          scrollEnabled={!dimOpen && !engOpen}
          showsVerticalScrollIndicator
          scrollEventThrottle={16}
          bounces
          overScrollMode="always"
          onScroll={(e) => {
            applyHeaderCompact(e.nativeEvent.contentOffset?.y ?? 0);
          }}
        >
          <CreateApplicationHeader
            onBack={() => go('zc_home')}
            zone={zone?.zoneCode}
            title={createTitle}
          />
          <Box style={{ gap: 12, paddingTop: 4 }}>
          {loading || saving ? (
            <Box style={{ flex: 1, minHeight: 380, justifyContent: 'center', alignItems: 'center' }}>
              <ScreenLoader minHeight={340} />
            </Box>
          ) : zoneError ? (
            <Box
              className="mx-4 rounded-2xl border px-4 py-4"
              style={{
                backgroundColor: `${COLORS.destructive}0D`,
                borderColor: `${COLORS.destructive}40`,
              }}
            >
              <Text style={{ color: COLORS.destructive, fontSize: 13, fontFamily: FONTS.medium }}>
                {zoneError}
              </Text>
            </Box>
          ) : (
            <VStack style={{ gap: 12 }}>
              <PlainSectionCard
                title="Site Details"
                subtitle="Provide basic information about the site."
                icon={Link2}
                accent="blue"
              >
                <View ref={setFieldAnchorRef('eOfficeNumber')} collapsable={false}>
                  <Field
                    label="E-office number"
                    required
                    placeholder="Enter e-office number"
                    leftIcon={Building2}
                    accent="blue"
                    value={form.eOfficeNumber}
                    error={fieldErrors.eOfficeNumber}
                    maxLength={100}
                    onChange={(v) => {
                      setForm((f) => ({ ...f, eOfficeNumber: sanitizeEOfficeInput(v) }));
                      clearFieldError('eOfficeNumber');
                    }}
                    style={{ marginBottom: 12 }}
                  />
                </View>
                <Box
                  style={{
                    flexDirection: compactForm ? 'column' : 'row',
                    gap: compactForm ? 12 : 10,
                    marginBottom: 12,
                  }}
                >
                  <View
                    ref={setFieldAnchorRef('siteNo')}
                    collapsable={false}
                    style={{ flex: compactForm ? undefined : 1, minWidth: 0 }}
                  >
                    <Field
                      label="Site no"
                      required
                      placeholder="Enter site no"
                      leftIcon={Hash}
                      accent="blue"
                      value={form.siteNo}
                      error={fieldErrors.siteNo}
                      keyboardType="number-pad"
                      maxLength={10}
                      onChange={(v) => {
                        const siteNo = sanitizeSiteNoInput(v);
                        setForm((f) => ({ ...f, siteNo }));
                        clearFieldError('siteNo');
                      }}
                    />
                  </View>
                  <View
                    ref={setFieldAnchorRef('siteDimensionType')}
                    collapsable={false}
                    style={{ flex: compactForm ? undefined : 1, minWidth: 0 }}
                  >
                    <VStack style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: FONTS.bold,
                          fontSize: 15,
                          color: '#1A368E',
                          marginBottom: 7,
                        }}
                      >
                        Site type
                        <Text style={{ color: COLORS.destructive, fontFamily: FONTS.bold }}> *</Text>
                      </Text>
                      <HStack
                        style={{
                          gap: compactForm ? 8 : 10,
                          minHeight: 48,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          borderRadius: FIELD_RADIUS,
                          borderWidth: 1.5,
                          borderColor: fieldErrors.siteDimensionType
                            ? COLORS.destructive
                            : 'transparent',
                          paddingHorizontal: fieldErrors.siteDimensionType ? 6 : 0,
                          backgroundColor: fieldErrors.siteDimensionType
                            ? `${COLORS.destructive}08`
                            : 'transparent',
                        }}
                      >
                        {(['Even', 'Odd'] as const).map((opt) => {
                          const on = form.siteDimensionType === opt;
                          return (
                            <Pressable
                              key={opt}
                              onPress={() => {
                                setForm((f) => ({ ...f, siteDimensionType: opt }));
                                clearFieldError('siteDimensionType');
                                if (opt !== 'Odd') clearFieldError('siteDimensionComment');
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingHorizontal: compactForm ? 8 : 10,
                                paddingVertical: 8,
                                borderRadius: 999,
                                backgroundColor: on ? '#E8F0FE' : 'transparent',
                                flexShrink: 0,
                              }}
                            >
                              <View
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: 999,
                                  borderWidth: 2,
                                  borderColor: on ? '#2563EB' : '#CBD5E1',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {on ? (
                                  <View
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: 4,
                                      backgroundColor: '#2563EB',
                                    }}
                                  />
                                ) : null}
                              </View>
                              <Text
                                style={{
                                  fontFamily: FONTS.semibold,
                                  fontSize: 14,
                                  color: on ? '#1A368E' : '#64748B',
                                }}
                              >
                                {opt}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </HStack>
                      {fieldErrors.siteDimensionType ? (
                        <Text
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: COLORS.destructive,
                            fontFamily: FONTS.medium,
                          }}
                        >
                          {fieldErrors.siteDimensionType}
                        </Text>
                      ) : null}
                    </VStack>
                  </View>
                </Box>

                <View ref={setFieldAnchorRef('siteDimension')} collapsable={false}>
                <Text
                  style={{
                    fontFamily: FONTS.bold,
                    fontSize: 15,
                    color: '#1A368E',
                    marginBottom: 7,
                  }}
                >
                  Site dimension
                  <Text style={{ color: COLORS.destructive, fontFamily: FONTS.bold }}> *</Text>
                </Text>
                <HStack style={{ gap: 8, marginBottom: addingDim ? 6 : 0, alignItems: 'center' }}>
                  <Pressable
                    ref={dimTriggerRef as any}
                    onPress={openDimDropdown}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 48,
                      borderRadius: FIELD_RADIUS,
                      borderWidth: 1.5,
                      borderColor: fieldErrors.siteDimension
                        ? COLORS.destructive
                        : hexAlpha('#1A368E', 0.42),
                      backgroundColor: COLORS.white,
                      paddingHorizontal: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <BoxIcon size={17} color="#1A368E" strokeWidth={2.3} />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontFamily: FONTS.medium,
                        color: form.siteDimension ? COLORS.ink : '#64748B',
                      }}
                      numberOfLines={1}
                    >
                      {form.siteDimension || 'Select dimension'}
                    </Text>
                    <ChevronDown size={17} color="#64748B" />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setAddingDim(true);
                      setDimOpen(false);
                      setNewDimValue('');
                    }}
                    style={{
                      height: 48,
                      paddingHorizontal: compactForm ? 10 : 14,
                      flexShrink: 0,
                      borderRadius: 999,
                      backgroundColor: '#2563EB',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Plus size={16} color={COLORS.white} strokeWidth={2.5} />
                    <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: COLORS.white }}>Add</Text>
                  </Pressable>
                </HStack>
                {fieldErrors.siteDimension ? (
                  <Text
                    style={{
                      marginTop: 4,
                      marginBottom: 2,
                      fontSize: 11,
                      color: COLORS.destructive,
                      fontFamily: FONTS.medium,
                    }}
                  >
                    {fieldErrors.siteDimension}
                  </Text>
                ) : null}

                {addingDim ? (
                  <Box
                    style={{
                      flexDirection: compactForm ? 'column' : 'row',
                      gap: 8,
                      alignItems: compactForm ? 'stretch' : 'center',
                    }}
                  >
                    <TextInput
                      value={newDimValue}
                      onChangeText={(v) => setNewDimValue(sanitizeSiteDimensionInput(v))}
                      placeholder="e.g. 20*40"
                      placeholderTextColor="#94A3B8"
                      autoFocus
                      style={{
                        flex: compactForm ? undefined : 1,
                        minWidth: 0,
                        height: 46,
                        borderRadius: FIELD_RADIUS,
                        borderWidth: 1.5,
                        borderColor: hexAlpha('#1A368E', 0.42),
                        backgroundColor: COLORS.white,
                        paddingHorizontal: 12,
                        fontSize: 13,
                        color: COLORS.ink,
                        fontFamily: FONTS.medium,
                        ...(Platform.OS === 'web'
                          ? ({ outlineStyle: 'none', outlineWidth: 0 } as object)
                          : null),
                      }}
                    />
                    <HStack style={{ gap: 8, flexShrink: 0 }}>
                    <Pressable
                      onPress={() => void saveNewDimension()}
                      disabled={savingDim}
                      style={{
                        flex: compactForm ? 1 : undefined,
                        height: 46,
                        paddingHorizontal: 14,
                        borderRadius: 999,
                        backgroundColor: '#2563EB',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: savingDim ? 0.7 : 1,
                      }}
                    >
                      {savingDim ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <Text style={{ fontFamily: FONTS.bold, fontSize: 12, color: COLORS.white }}>
                          Save
                        </Text>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setAddingDim(false);
                        setNewDimValue('');
                      }}
                      style={{
                        flex: compactForm ? 1 : undefined,
                        height: 46,
                        paddingHorizontal: 12,
                        borderRadius: FIELD_RADIUS,
                        borderWidth: 1,
                        borderColor: '#D5DEE8',
                        backgroundColor: COLORS.white,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.slate }}>
                        Cancel
                      </Text>
                    </Pressable>
                    </HStack>
                  </Box>
                ) : null}
                </View>
              </PlainSectionCard>

              <PlainSectionCard
                title="Address"
                subtitle="Enter the address details of the site."
                icon={MapPin}
                accent="green"
              >
                <View ref={setFieldAnchorRef('addressLine1')} collapsable={false}>
                  <Field
                    label="Address line 1"
                    required
                    placeholder="Enter address line 1"
                    leftIcon={MapIcon}
                    accent="green"
                    multiline
                    numberOfLines={3}
                    value={form.addressLine1}
                    error={fieldErrors.addressLine1}
                    maxLength={ZC_FORM_LIMITS.addressLine1}
                    onChange={(v) => {
                      setForm((f) => ({
                        ...f,
                        addressLine1: sanitizeAddressLineInput(v, ZC_FORM_LIMITS.addressLine1),
                      }));
                      clearFieldError('addressLine1');
                    }}
                    onFocus={onFieldFocus}
                    style={{ marginBottom: 12 }}
                  />
                </View>
                <View ref={setFieldAnchorRef('addressLine2')} collapsable={false}>
                  <Field
                    label="Address line 2"
                    placeholder="Enter address line 2 (optional)"
                    leftIcon={MapIcon}
                    accent="green"
                    multiline
                    numberOfLines={3}
                    value={form.addressLine2 || ''}
                    error={fieldErrors.addressLine2}
                    maxLength={ZC_FORM_LIMITS.addressLine2}
                    onChange={(v) => {
                      setForm((f) => ({
                        ...f,
                        addressLine2: sanitizeAddressLineInput(v, ZC_FORM_LIMITS.addressLine2),
                      }));
                      clearFieldError('addressLine2');
                    }}
                    onFocus={onFieldFocus}
                    style={{ marginBottom: 12 }}
                  />
                </View>
                <Box
                  style={{
                    flexDirection: compactForm ? 'column' : 'row',
                    gap: compactForm ? 12 : 10,
                    marginBottom: 12,
                  }}
                >
                  <View
                    ref={setFieldAnchorRef('addressBlock')}
                    collapsable={false}
                    style={{ flex: compactForm ? undefined : 1, minWidth: 0 }}
                  >
                    <Field
                      label="Block/Stage/Phase"
                      required
                      placeholder="e.g. Block 1"
                      labelFontSize={14}
                      leftIcon={Building2}
                      accent="green"
                      value={form.addressBlock}
                      error={fieldErrors.addressBlock}
                      maxLength={150}
                      onChange={(v) => {
                        setForm((f) => ({ ...f, addressBlock: sanitizeBlockInput(v) }));
                        clearFieldError('addressBlock');
                      }}
                      onFocus={onFieldFocus}
                    />
                  </View>
                  <View style={{ flex: compactForm ? undefined : 1, minWidth: 0 }}>
                    <Field
                      label="City"
                      labelFontSize={14}
                      leftIcon={Building2}
                      accent="green"
                      value={form.addressCity || addressDefaults?.city || ''}
                      editable={!(addressDefaults?.cityLocked ?? true)}
                      onChange={() => {}}
                    />
                  </View>
                </Box>
                <Box
                  style={{
                    flexDirection: compactForm ? 'column' : 'row',
                    gap: compactForm ? 12 : 10,
                  }}
                >
                  <View style={{ flex: compactForm ? undefined : 1, minWidth: 0 }}>
                    <Field
                      label="State"
                      leftIcon={MapIcon}
                      accent="green"
                      value={form.addressState || addressDefaults?.state || ''}
                      editable={!(addressDefaults?.stateLocked ?? true)}
                      onChange={() => {}}
                    />
                  </View>
                  <View
                    ref={setFieldAnchorRef('addressPincode')}
                    collapsable={false}
                    style={{ flex: compactForm ? undefined : 1, minWidth: 0 }}
                  >
                    <Field
                      label="Pincode"
                      required
                      placeholder="e.g. 560001"
                      leftIcon={BoxIcon}
                      accent="green"
                      value={form.addressPincode}
                      error={fieldErrors.addressPincode}
                      keyboardType="number-pad"
                      maxLength={6}
                      onChange={(v) => {
                        const digits = v.replace(/\D/g, '').slice(0, 6);
                        setForm((f) => ({ ...f, addressPincode: digits }));
                        clearFieldError('addressPincode');
                      }}
                      onFocus={onFieldFocus}
                      returnKeyType="next"
                    />
                  </View>
                </Box>
              </PlainSectionCard>

              <PlainSectionCard
                title="Site Schedules"
                subtitle="Add site schedule information."
                icon={Compass}
                accent="purple"
              >
                <HStack style={{ gap: 10, marginBottom: 12 }}>
                  <Field
                    label="North"
                    placeholder=""
                    leftIcon={Compass}
                    accent="purple"
                    value={form.scheduleNorth || ''}
                    onChange={(v) => setForm((f) => ({ ...f, scheduleNorth: v }))}
                    onFocus={onFieldFocus}
                    style={{ flex: 1 }}
                  />
                  <Field
                    label="South"
                    placeholder=""
                    leftIcon={Compass}
                    accent="purple"
                    value={form.scheduleSouth || ''}
                    onChange={(v) => setForm((f) => ({ ...f, scheduleSouth: v }))}
                    onFocus={onFieldFocus}
                    style={{ flex: 1 }}
                  />
                </HStack>
                <HStack style={{ gap: 10 }}>
                  <Field
                    label="West"
                    placeholder=""
                    leftIcon={Compass}
                    accent="purple"
                    value={form.scheduleWest || ''}
                    onChange={(v) => setForm((f) => ({ ...f, scheduleWest: v }))}
                    onFocus={onFieldFocus}
                    style={{ flex: 1 }}
                  />
                  <Field
                    label="East"
                    placeholder=""
                    leftIcon={Compass}
                    accent="purple"
                    value={form.scheduleEast || ''}
                    onChange={(v) => setForm((f) => ({ ...f, scheduleEast: v }))}
                    onFocus={onFieldFocus}
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={() => Keyboard.dismiss()}
                    style={{ flex: 1 }}
                  />
                </HStack>
              </PlainSectionCard>

              <PlainSectionCard
                title="Assign engineer"
                subtitle="Choose an engineer for this application."
                icon={UserCheck}
                accent="sky"
                required
              >
                <View ref={setFieldAnchorRef('assignedEngineerUserId')} collapsable={false}>
                <Pressable
                  ref={engTriggerRef as any}
                  onPress={() => {
                    if (engineers.length === 0) return;
                    openEngDropdown();
                  }}
                  style={{
                    height: 48,
                    borderRadius: FIELD_RADIUS,
                    borderWidth: 1.5,
                    borderColor: fieldErrors.assignedEngineerUserId
                      ? COLORS.destructive
                      : hexAlpha('#1D4ED8', 0.42),
                    backgroundColor: COLORS.white,
                    paddingHorizontal: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <UserCheck size={17} color="#1D4ED8" strokeWidth={2.3} />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 15,
                      fontFamily: FONTS.medium,
                      color: selectedEngineer ? COLORS.ink : '#64748B',
                    }}
                    numberOfLines={1}
                  >
                    {selectedEngineer
                      ? `${selectedEngineer.name}${selectedEngineer.postName ? ` · ${selectedEngineer.postName}` : ''}`
                      : engineers.length === 0
                        ? 'No engineers in this zone'
                        : 'Select engineer'}
                  </Text>
                  <ChevronDown size={16} color="#94A3B8" />
                </Pressable>
                {fieldErrors.assignedEngineerUserId ? (
                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: COLORS.destructive,
                      fontFamily: FONTS.medium,
                    }}
                  >
                    {fieldErrors.assignedEngineerUserId}
                  </Text>
                ) : null}
                {engineers.length === 0 ? (
                  <Text style={{ marginTop: 6, color: COLORS.warning, fontSize: 11, fontFamily: FONTS.medium }}>
                    No engineers with an active post mapping in this zone.
                  </Text>
                ) : null}
                </View>
              </PlainSectionCard>

              <PlainSectionCard
                title="Comments"
                subtitle="Add any extra notes for this application."
                icon={ClipboardList}
                accent="blue"
                required={form.siteDimensionType === 'Odd'}
              >
                <View ref={setFieldAnchorRef('siteDimensionComment')} collapsable={false}>
                <Field
                  label=""
                  required={form.siteDimensionType === 'Odd'}
                  placeholder={
                    form.siteDimensionType === 'Odd'
                      ? 'Required for Odd site type'
                      : 'Optional comments'
                  }
                  value={form.siteDimensionComment || ''}
                  error={fieldErrors.siteDimensionComment}
                  multiline
                  numberOfLines={5}
                  maxLength={500}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, siteDimensionComment: sanitizeCommentInput(v) }));
                    clearFieldError('siteDimensionComment');
                  }}
                  onFocus={onFieldFocus}
                />
                </View>
              </PlainSectionCard>

              <HStack style={{ gap: 10, marginHorizontal: SPACE.gutter, marginTop: 4, marginBottom: 8 }}>
                <Pressable
                  onPress={() => void onSaveDraft()}
                  disabled={saving}
                  className="flex-1 active:opacity-90"
                  style={{
                    height: 50,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.5,
                    borderColor: '#2563EB',
                    backgroundColor: COLORS.white,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving && savingAction === 'save' ? (
                    <ButtonLoader color="#2563EB" />
                  ) : (
                    <Text style={{ fontFamily: FONTS.bold, color: '#2563EB' }}>Save</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => void onSubmitApplication()}
                  disabled={saving}
                  className="flex-1 active:opacity-90"
                  style={{
                    height: 50,
                    borderRadius: 999,
                    backgroundColor: '#1E3A8A',
                    overflow: 'hidden',
                    opacity: saving ? 0.7 : 1,
                    shadowColor: '#2563EB',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.22,
                    shadowRadius: 10,
                    elevation: 4,
                  }}
                >
                  <LinearGradient
                    colors={gradientStops(GRADIENT_PRIMARY)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      height: 50,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {saving && savingAction === 'submit' ? (
                      <ButtonLoader color={COLORS.white} />
                    ) : (
                      <Text style={{ fontFamily: FONTS.bold, color: COLORS.white }}>Submit</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </HStack>
            </VStack>
          )}
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        animationType="fade"
        visible={dimOpen}
        onRequestClose={() => setDimOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.2)' }}
          onPress={() => setDimOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close site dimension menu"
        />
        {dimAnchor ? (
          <View
            style={{
              position: 'absolute',
              top: (() => {
                const screenH = Dimensions.get('window').height;
                const h = dropdownListHeight(dimensions.length);
                const below = dimAnchor.y + dimAnchor.height + 4;
                if (below + h > screenH - 12) {
                  return Math.max(12, dimAnchor.y - h - 4);
                }
                return below;
              })(),
              left: dimAnchor.x,
              width: dimAnchor.width,
              height: dropdownListHeight(dimensions.length),
              borderRadius: DESIGN.cardRadius,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.white,
              overflow: 'hidden',
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.16,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
            <RNNativeScrollView
              keyboardShouldPersistTaps="handled"
              bounces={dimensions.length > DROPDOWN_MAX_ITEMS}
              showsVerticalScrollIndicator={dimensions.length > DROPDOWN_MAX_ITEMS}
              nestedScrollEnabled
            >
              {dimensions.length === 0 ? (
                <Text style={{ padding: 12, color: COLORS.slate, fontSize: 12, fontFamily: FONTS.medium }}>
                  No dimensions yet. Tap Add to create one.
                </Text>
              ) : (
                dimensions.map((d, index) => (
                  <Pressable
                    key={d.id || d.label}
                    onPress={() => {
                      setForm((f) => ({ ...f, siteDimension: d.label }));
                      clearFieldError('siteDimension');
                      setDimOpen(false);
                    }}
                    style={{
                      height: DROPDOWN_ITEM_H,
                      paddingHorizontal: 12,
                      justifyContent: 'center',
                      borderBottomWidth: index === dimensions.length - 1 ? 0 : 1,
                      borderBottomColor: GLASS.divider,
                      backgroundColor:
                        form.siteDimension === d.label ? GLASS.tintBlue : COLORS.white,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: COLORS.ink, fontFamily: FONTS.semibold }}>
                      {d.label}
                    </Text>
                  </Pressable>
                ))
              )}
            </RNNativeScrollView>
          </View>
        ) : null}
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={engOpen}
        onRequestClose={() => setEngOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.2)' }}
          onPress={() => setEngOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close engineer menu"
        />
        {engAnchor ? (
          <View
            style={{
              position: 'absolute',
              top: (() => {
                const screenH = Dimensions.get('window').height;
                const h = dropdownListHeight(engineers.length);
                const below = engAnchor.y + engAnchor.height + 4;
                if (below + h > screenH - 12) {
                  return Math.max(12, engAnchor.y - h - 4);
                }
                return below;
              })(),
              left: engAnchor.x,
              width: engAnchor.width,
              height: dropdownListHeight(engineers.length),
              borderRadius: 8,
              borderWidth: 1.5,
              borderColor: '#94A3B8',
              backgroundColor: COLORS.white,
              overflow: 'hidden',
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.16,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
            <RNNativeScrollView
              keyboardShouldPersistTaps="handled"
              bounces={engineers.length > DROPDOWN_MAX_ITEMS}
              showsVerticalScrollIndicator={engineers.length > DROPDOWN_MAX_ITEMS}
              nestedScrollEnabled
            >
              {engineers.map((eng, index) => {
                const on = form.assignedEngineerUserId === eng.userId;
                return (
                  <Pressable
                    key={eng.userId}
                    onPress={() => {
                      setForm((f) => ({
                        ...f,
                        assignedEngineerUserId: eng.userId,
                      }));
                      clearFieldError('assignedEngineerUserId');
                      setEngOpen(false);
                    }}
                    style={{
                      height: DROPDOWN_ITEM_H,
                      paddingHorizontal: 12,
                      justifyContent: 'center',
                      borderBottomWidth: index === engineers.length - 1 ? 0 : 1,
                      borderBottomColor: GLASS.divider,
                      backgroundColor: on ? GLASS.tintBlue : COLORS.white,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: FONTS.semibold,
                        color: on ? COLORS.primary : COLORS.ink,
                      }}
                      numberOfLines={1}
                    >
                      {eng.name}
                      {eng.postName ? ` · ${eng.postName}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </RNNativeScrollView>
          </View>
        ) : null}
      </Modal>
      </Box>
    </ScreenShell>
  );
}

export function ZcDetailScreen({ go }: { go: Go }) {
  const { themeId } = useTheme();
  const { accessToken } = useAuth();
  const appId = getSelectedOfficeAppId();
  const [app, setApp] = useState<MobileApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isDraft = app ? normalizeApplicationStatus(app.status) === 'draft' : false;

  useEffect(() => {
    if (!accessToken || !appId) {
      setError('No application selected');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchApplication(accessToken, appId)
      .then(setApp)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Not found'))
      .finally(() => setLoading(false));
  }, [accessToken, appId]);

  return (
    <ScreenShell className="bg-background">
      <ViewApplicationScroll
        scrollKey={themeId}
        onBack={() => go('zc_home')}
        zone={app?.zoneCode}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
          <Box
            style={{
              flexGrow: 1,
              backgroundColor: 'transparent',
              paddingTop: 16,
              gap: 12,
            }}
          >
        {loading ? (
          <Box style={{ flex: 1, minHeight: 380, justifyContent: 'center', alignItems: 'center' }}>
            <ScreenLoader minHeight={340} />
          </Box>
        ) : error || !app ? (
          <Box className="mx-4 rounded-2xl border px-4 py-6" style={{ borderColor: `${COLORS.destructive}40`, backgroundColor: `${COLORS.destructive}0D` }}>
            <Text style={{ color: COLORS.destructive, fontFamily: FONTS.medium, fontSize: 13, textAlign: 'center' }}>
              {error || 'Not found'}
            </Text>
          </Box>
        ) : (
          <>
            {isDraft ? (
              <Box className="mx-4">
                <Pressable
                  onPress={() => {
                    if (!app) return;
                    setZcEditApplicationId(app.id);
                    go('zc_create');
                  }}
                  className="overflow-hidden active:opacity-90"
                  style={{ borderRadius: DESIGN.cardRadius }}
                >
                  <LinearGradient
                    colors={gradientStops(GRADIENT_PRIMARY)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      height: 44,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <FilePenLine size={16} color={COLORS.white} strokeWidth={2.4} />
                    <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: COLORS.white }}>
                      Edit Application
                    </Text>
                  </LinearGradient>
                </Pressable>
              </Box>
            ) : null}
            <ApplicationRecordDetails app={app} showEmptyEngineer={false} />
          </>
        )}
          </Box>
      </ViewApplicationScroll>
    </ScreenShell>
  );
}

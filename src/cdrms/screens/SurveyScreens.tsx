import { LinearGradient } from 'expo-linear-gradient';
import {
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Compass,
  Crosshair,
  Edit3,
  Image as ImageIcon,
  Info,
  Lock,
  MapPin,
  MessageSquareText,
  Navigation,
  Plus,
  RefreshCw,
  Route,
  Ruler,
  ShieldCheck,
  Sprout,
  Trash2,
  TreePine,
  Upload,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, TextInput } from 'react-native';

import { Box } from '@/components/ui/box';
import { Checkbox, CheckboxIcon, CheckboxIndicator, CheckboxLabel } from '@/components/ui/checkbox';
import { CheckIcon } from '@/components/ui/icon';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Progress, ProgressFilledTrack } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { ApiMediaImage } from '@/src/cdrms/components/ApiMediaImage';
import { ImagePreviewModal } from '@/src/cdrms/components/ImagePreviewModal';
import { LiveCompassDial } from '@/src/cdrms/components/LiveCompassDial';
import { LiveGpsPanel } from '@/src/cdrms/components/LiveGpsPanel';
import { SchedulesEditorCard } from '@/src/cdrms/components/SchedulesEditorCard';
import { SiteVideoCaptureCard } from '@/src/cdrms/components/SiteVideoCaptureCard';
import { SiteVideoPlayer } from '@/src/cdrms/components/SiteVideoPlayer';
import { showAppDialog } from '@/src/cdrms/components/AppDialog';
import { AppBtn, AppSheet, ButtonLoader, Field, useMinimumLoading } from '@/src/cdrms/components/primitives';
import {
  SectionTitle,
  SurveyCard,
  SurveyScaffold,
  WorkspaceHeader,
  FooterContinueBtn,
  PremiumStepCard,
} from '@/src/cdrms/components/SurveyLayout';
import { parseCompassReading, formatLiveReading, SIMULATOR_COMPASS_HEADING, isSimulatorOrEmulator } from '@/src/cdrms/hooks/useCompass';
import Constants from 'expo-constants';
import { useLiveLocation } from '@/src/cdrms/hooks/useDeviceLocation';
import {
  captureSitePhoto,
  captureSelfie,
  captureVideo,
  useDummyCapture,
} from '@/src/cdrms/hooks/useMediaCapture';
import { createDummyVideoAsset } from '@/src/cdrms/hooks/dummyMedia';
import {
  OCCUPANCY_REASON_MAX,
  sanitizeOccupancyReason,
  validateOccupancyReason,
} from '@/src/cdrms/lib/occupancyValidation';
import { useProject } from '@/src/cdrms/project/ProjectContext';
import { alertDraftError } from '@/src/cdrms/project/draft-api';
import {
  DIRECTION_META,
  formatCoords,
  type Cardinal,
} from '@/src/cdrms/project/types';
import {
  COLORS,
  FONTS,
  GLASS,
  GRADIENT_PRIMARY,
  GRADIENT_VIDEO,
  SPACE,
  TYPE,
  gradientStops,
  DESIGN,
} from '@/src/cdrms/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { TERMS } from '@/src/cdrms/terminology';
import type { Go } from '@/src/cdrms/types';

export { ProjectScreen } from '@/src/cdrms/screens/ProjectScreen';

const DIR_ICONS = {
  N: Building2,
  S: Route,
  E: Sprout,
  W: TreePine,
} as const;

const CARDINALS: Cardinal[] = ['N', 'S', 'E', 'W'];

const BLUE_SOFT = '#EEF4FF';
const BLUE_BORDER = 'rgba(26,86,219,0.22)';

export function BandiScreen({ go }: { go: Go }) {
  const { themeId } = useTheme();
  const {
    draft,
    setBandiVerified,
    setBandiRemarks,
    setDirection,
    setSurroundingPhoto,
    setApproachNotes,
    updateField,
    setGps,
    setCompassReading,
    persistBackendStep,
    reloadBackendDraft,
  } = useProject();
  const isBackendTask = Boolean(draft.backendApplicationId);
  const nextAfterBandi = isBackendTask ? 'dimensions' : 'surroundings';
  const {
    gps: liveGps,
    address: liveAddress,
    loading: geoBusy,
    error: geoError,
    refresh: refreshLiveGps,
  } = useLiveLocation({ silent: true, timeInterval: 1500, distanceInterval: 2 });
  const [stepSaving, setStepSaving] = useState(false);
  const [occupancyReasonTouched, setOccupancyReasonTouched] = useState(false);
  const schedulePhotosReady = (['N', 'S', 'E', 'W'] as const).every(
    (k) => Boolean(draft.surroundingPhotos[k]),
  );
  const occupancyReasonError = validateOccupancyReason(
    draft.occupancy,
    draft.occupancyReason,
  );
  /** Show red field only after Continue (not while typing). */
  const showOccupancyReasonError =
    draft.occupancy === 'Occupied' &&
    Boolean(occupancyReasonError) &&
    occupancyReasonTouched;
  const compassOk = Boolean(String(draft.compassReading || '').trim());
  /** Simulator QA: photos optional so Continue can unlock after hardcoded compass/GPS. */
  const schedulesOk = isSimulatorOrEmulator() ? true : schedulePhotosReady;
  /** Occupancy reason is validated on Continue — do not disable the button for it. */
  const canContinueBandi = isBackendTask
    ? schedulesOk && Boolean(draft.gps) && compassOk
    : draft.bandiVerified;
  const [editing, setEditing] = useState<Cardinal | null>(null);
  const pageLoading = useMinimumLoading(true, 300);
  const [draftNote, setDraftNote] = useState('');
  const [approachOpen, setApproachOpen] = useState(false);
  const [schedulesEditing, setSchedulesEditing] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState({ N: '', S: '', E: '', W: '' });
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('Photo preview');

  // Native simulator only: seed 0° N so Continue can unlock without sensors.
  // Web phones use DeviceOrientation — do not lock facing to North.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!isSimulatorOrEmulator()) return;
    if (String(draft.compassReading || '').trim()) return;
    setCompassReading(formatLiveReading(SIMULATOR_COMPASS_HEADING));
  }, [draft.compassReading, setCompassReading]);

  // Simulator: seed GPS if location APIs stall (common on iOS Simulator).
  useEffect(() => {
    if (!isSimulatorOrEmulator() && Constants.isDevice !== false) return;
    if (draft.gps) return;
    setGps({
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 5,
      altitude: null,
      timestamp: Date.now(),
    });
  }, [draft.gps, setGps]);

  const mapGps = liveGps || draft.gps;
  const coords = mapGps
    ? formatCoords(mapGps.latitude, mapGps.longitude)
    : null;
  const isLiveFix = Boolean(liveGps);

  const adminArea =
    [draft.taluk, draft.district, draft.state].filter(Boolean).join(' · ') || '—';

  const compassFace = parseCompassReading(draft.compassReading)?.face ?? null;

  const approachSummary =
    [draft.approachRoadWidth, draft.approachRoadName].filter(Boolean).join(' · ') ||
    draft.approachNotes ||
    'Tap to add approach / access notes';

  const recaptureGps = async () => {
    await refreshLiveGps(false);
  };

  // Keep draft GPS + reverse-geocode place in sync with live step-2 location
  useEffect(() => {
    if (!liveGps) return;
    setGps(
      liveGps,
      liveAddress
        ? {
            displayName: liveAddress.displayName,
            village: liveAddress.village,
            taluk: liveAddress.taluk,
            district: liveAddress.district,
            state: liveAddress.state,
            street: liveAddress.street,
            name: liveAddress.name,
            layoutName: liveAddress.layoutName,
            area: liveAddress.area,
            block: liveAddress.block,
            postalCode: liveAddress.postalCode,
            country: liveAddress.country,
          }
        : undefined,
    );
  }, [liveGps, liveAddress, setGps]);

  const openEdit = (k: Cardinal) => {
    setEditing(k);
    setDraftNote(draft.directions[k]);
  };

  const saveEdit = () => {
    if (editing) setDirection(editing, draftNote.trim());
    setEditing(null);
    setDraftNote('');
  };

  const beginScheduleEdit = () => {
    setScheduleDraft({
      N: draft.directions.N,
      S: draft.directions.S,
      E: draft.directions.E,
      W: draft.directions.W,
    });
    setSchedulesEditing(true);
  };

  const saveScheduleEdit = () => {
    ;(['N', 'S', 'E', 'W'] as const).forEach((k) => {
      setDirection(k, scheduleDraft[k].trim());
    });
    setSchedulesEditing(false);
  };

  const rows: Array<{
    label: string;
    val: string;
    ok: boolean;
    icon: LucideIcon;
    iconColor: string;
    iconBg: string;
  }> = [
    {
      label: TERMS.fields.assignedSurvey,
      val: `${draft.surveyNo || '—'} · ${draft.village || 'Pending GPS'}`,
      ok: Boolean(draft.surveyNo || draft.village),
      icon: ClipboardList,
      iconColor: COLORS.primary,
      iconBg: GLASS.tintBlue,
    },
    {
      label: TERMS.fields.gpsCoordinates,
      val: coords ? `${coords.lat}, ${coords.lng}` : 'Capture on Site Particulars',
      ok: Boolean(draft.gps),
      icon: MapPin,
      iconColor: COLORS.primary,
      iconBg: GLASS.tintCyan,
    },
    {
      label: TERMS.fields.administrativeArea,
      val: adminArea,
      ok: Boolean(draft.taluk || draft.district),
      icon: Building2,
      iconColor: COLORS.primary,
      iconBg: GLASS.tintBlue,
    },
  ];

  const badge = compassFace
    ? `Facing ${compassFace}`
    : draft.gps
      ? 'KA GPS Active'
      : 'Pick direction';

  return (
    <SurveyScaffold
      key={themeId}
      title={
        isBackendTask ? 'Site facing direction' : TERMS.workflow.checkBandi
      }
      subtitle={
        isBackendTask
          ? 'Compass, GPS, occupancy & site schedules'
          : TERMS.workflow.checkBandiSubtitle
      }
      surface={isBackendTask ? 'premium' : 'default'}
      loading={pageLoading}
      onBack={() => {
        go('project', { replace: true });
        if (isBackendTask) {
          void reloadBackendDraft().catch(() => undefined);
        }
      }}
      onStepNav={
        isBackendTask
          ? () => {
              void reloadBackendDraft().catch(() => undefined);
            }
          : undefined
      }
      step={2}
      total={isBackendTask ? 4 : 5}
      badge={badge}
      watermark="compass"
      footer={
        <FooterContinueBtn
          disabled={!canContinueBandi || stepSaving}
          loading={stepSaving}
          label={
            isBackendTask
              ? !draft.gps
                ? 'Capture GPS first'
                : !compassOk
                  ? 'Pick facing direction'
                  : !schedulesOk
                    ? 'Add all 4 schedule photos'
                    : 'Continue'
              : TERMS.workflow.continueToSurroundings
          }
          onPress={() => {
            void (async () => {
              if (isBackendTask && !schedulesOk) return;
              if (isBackendTask) {
                const reasonErr = validateOccupancyReason(
                  draft.occupancy,
                  draft.occupancyReason,
                );
                if (reasonErr) {
                  setOccupancyReasonTouched(true);
                  showAppDialog({
                    variant: 'warning',
                    title: 'Validation',
                    message: `Occupancy reason: ${reasonErr}`,
                    hideCancel: true,
                    confirmLabel: 'OK',
                  });
                  return;
                }
                setStepSaving(true);
                try {
                  if (!draft.bandiVerified) setBandiVerified(true);
                  await persistBackendStep('compass');
                  go('dimensions');
                } catch (err) {
                  alertDraftError(err);
                  setStepSaving(false);
                }
                return;
              }
              go(nextAfterBandi);
            })();
          }}
        />
      }
          go={go}
    >
      {isBackendTask ? (
        <PremiumStepCard
          icon={Compass}
          title="Site facing direction *"
          subtitle={
            compassFace
              ? `Live ${draft.compassReading} · turn phone to update`
              : 'Hold phone flat — live sensor on real device'
          }
          badge={
            compassFace ? (
              <Box
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: BLUE_SOFT,
                  borderWidth: 1,
                  borderColor: BLUE_BORDER,
                }}
              >
                <Text style={{ fontFamily: FONTS.bold, fontSize: 11, color: COLORS.primary }}>
                  {compassFace}
                </Text>
              </Box>
            ) : undefined
          }
        >
          <Box
            style={{
              borderRadius: 16,
              backgroundColor: BLUE_SOFT,
              borderWidth: 1,
              borderColor: BLUE_BORDER,
              paddingHorizontal: 8,
              paddingTop: 8,
              paddingBottom: 8,
              alignItems: 'center',
              width: '100%',
            }}
          >
            <LiveCompassDial compact />
          </Box>
        </PremiumStepCard>
      ) : (
        <SurveyCard>
          <WorkspaceHeader
            icon={Compass}
            title={TERMS.sections.boundaryCompass}
            subtitle={
              compassFace
                ? `Live ${draft.compassReading} · turn phone to update`
                : 'Hold phone flat — live sensor on real device'
            }
            iconBg={COLORS.primary}
          />

          <VStack style={{ paddingHorizontal: SPACE[4], paddingBottom: SPACE[4], alignItems: 'center' }}>
            <LiveCompassDial />
          </VStack>
        </SurveyCard>
      )}

      {isBackendTask ? (
        <>
          <PremiumStepCard
            icon={MapPin}
            title="Live GPS & coordinates *"
            badge={
              mapGps ? (
                <Box
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: '#ECFDF5',
                    borderWidth: 1,
                    borderColor: '#A7F3D0',
                  }}
                >
                  <Box
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: '#047857',
                    }}
                  />
                  <Text style={{ fontFamily: FONTS.bold, fontSize: 11, color: '#047857' }}>
                    {`±${Math.round(mapGps.accuracy ?? 6)}m`}
                  </Text>
                </Box>
              ) : geoBusy ? (
                <ButtonLoader size="small" color={COLORS.primary} />
              ) : undefined
            }
          >
            <VStack style={{ gap: 8 }}>
              <Box
                style={{
                  borderRadius: 16,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: BLUE_BORDER,
                }}
              >
                <LiveGpsPanel
                  gps={mapGps}
                  address={liveAddress}
                  loading={geoBusy}
                  error={geoError}
                  onRefresh={() => void recaptureGps()}
                  syNo={draft.surveyNo || draft.siteNo || undefined}
                  title={null}
                  hideTitleHeader
                  variant="premium"
                />
              </Box>

              <Box
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: COLORS.white,
                  borderWidth: 1.5,
                  borderColor: BLUE_BORDER,
                  shadowColor: COLORS.primaryDeep,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 5,
                  elevation: 2,
                }}
              >
                <HStack className="items-center" style={{ gap: 8 }}>
                  <Box
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      backgroundColor: BLUE_SOFT,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Crosshair size={14} color={COLORS.primary} strokeWidth={2.4} />
                  </Box>
                  <VStack className="flex-1 min-w-0" style={{ gap: 0 }}>
                    <Text
                      style={{
                        fontFamily: FONTS.bold,
                        fontSize: 13,
                        letterSpacing: 0.3,
                        color: COLORS.ink,
                        textTransform: 'uppercase',
                      }}
                    >
                      {mapGps
                        ? 'Live coordinates'
                        : geoBusy
                          ? 'Finding location…'
                          : 'Waiting for location'}
                    </Text>
                    <Text
                      style={{
                        fontFamily: FONTS.semibold,
                        fontSize: 12,
                        lineHeight: 16,
                        color: '#475569',
                      }}
                    >
                      Lat {mapGps ? mapGps.latitude.toFixed(6) : '—'}
                      {'  ·  '}
                      Lng {mapGps ? mapGps.longitude.toFixed(6) : '—'}
                    </Text>
                  </VStack>
                  <Pressable
                    onPress={() => void recaptureGps()}
                    accessibilityLabel="Refresh live coordinates"
                    className="active:opacity-80"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      backgroundColor: BLUE_SOFT,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: BLUE_BORDER,
                    }}
                  >
                    {geoBusy ? (
                      <ButtonLoader size="small" color={COLORS.primary} />
                    ) : (
                      <RefreshCw size={14} color={COLORS.primary} strokeWidth={2.4} />
                    )}
                  </Pressable>
                </HStack>
              </Box>
            </VStack>
          </PremiumStepCard>

          <PremiumStepCard
            icon={Building2}
            title="Occupancy *"
            subtitle={
              draft.occupancy === 'Occupied'
                ? String(draft.occupancyReason || '').trim()
                  ? 'Occupied · reason captured'
                  : 'Occupied · Add reason below'
                : draft.occupancy === 'Empty'
                  ? 'Site is currently empty'
                  : 'Required before continuing'
            }
            badge={
              draft.occupancy ? (
                <Box
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: BLUE_SOFT,
                    borderWidth: 1,
                    borderColor: BLUE_BORDER,
                  }}
                >
                  <Text style={{ fontFamily: FONTS.bold, fontSize: 11, color: COLORS.primary }}>
                    {draft.occupancy}
                  </Text>
                </Box>
              ) : undefined
            }
          >
            <HStack style={{ gap: 8, alignItems: 'center' }}>
              {(['Empty', 'Occupied'] as const).map((opt) => {
                const on = draft.occupancy === opt;
                const empty = opt === 'Empty';
                const activeBg = empty ? '#ECFDF5' : '#FFF7ED';
                const activeBorder = empty ? '#6EE7B7' : '#FDBA74';
                const activeFg = empty ? '#047857' : '#C2410C';
                return (
                  <Pressable
                    key={opt}
                    onPress={() => {
                      updateField('occupancy', opt);
                      if (opt === 'Empty') {
                        updateField('occupancyReason', '');
                      }
                      setOccupancyReasonTouched(false);
                    }}
                    className="active:opacity-80"
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      borderRadius: 999,
                      backgroundColor: on ? activeBg : COLORS.white,
                      borderWidth: 1.5,
                      borderColor: on ? activeBorder : BLUE_BORDER,
                      shadowColor: COLORS.primaryDeep,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: on ? 0.1 : 0.05,
                      shadowRadius: 5,
                      elevation: on ? 2 : 1,
                    }}
                  >
                    <Box
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 999,
                        borderWidth: 2,
                        borderColor: on ? activeFg : '#94A3B8',
                        backgroundColor: COLORS.white,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {on ? (
                        <Box
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: activeFg,
                          }}
                        />
                      ) : null}
                    </Box>
                    <Text
                      style={{
                        fontFamily: FONTS.bold,
                        fontSize: 13,
                        color: on ? activeFg : COLORS.ink,
                      }}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
            {draft.occupancy === 'Occupied' ? (
              <Box style={{ marginTop: 8 }}>
                <Field
                  compact
                  label="Occupied reason *"
                  value={draft.occupancyReason}
                  onChangeText={(t) => {
                    updateField('occupancyReason', sanitizeOccupancyReason(t));
                    if (occupancyReasonTouched) setOccupancyReasonTouched(false);
                  }}
                  placeholder="Why is the site occupied?"
                  maxLength={OCCUPANCY_REASON_MAX}
                  error={
                    showOccupancyReasonError ? occupancyReasonError : undefined
                  }
                />
              </Box>
            ) : null}
          </PremiumStepCard>
        </>
      ) : (
        <SurveyCard>
          <VStack className="px-4 py-5" space="sm">
            <SectionTitle
              title={TERMS.sections.siteMatchDetails}
              subtitle="Matched from site particulars and live GPS"
              accent={COLORS.primary}
            />
            {rows.map((r, i) => {
              const Icon = r.icon;
              return (
                <HStack
                  key={r.label}
                  className={`items-center gap-3 ${
                    i > 0 ? 'pt-3.5 mt-0.5 border-t border-border' : 'pt-1'
                  }`}
                >
                  <Box
                    className="items-center justify-center"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: DESIGN.cardRadius,
                      backgroundColor: r.iconBg,
                    }}
                  >
                    <Icon size={18} color={r.iconColor} strokeWidth={2.3} />
                  </Box>
                  <VStack className="flex-1 min-w-0">
                    <Text
                      className="text-[10px] uppercase font-extrabold tracking-wider"
                      style={{ color: '#94A3B8' }}
                    >
                      {r.label}
                    </Text>
                    <Text
                      className="font-bold text-[13px] text-foreground mt-0.5"
                      numberOfLines={2}
                    >
                      {r.val}
                    </Text>
                  </VStack>
                  {r.ok ? (
                    <Box
                      className="h-9 w-9 rounded-full items-center justify-center"
                      style={{ backgroundColor: '#D1FAE5' }}
                    >
                      <CheckCircle2 size={18} color="#059669" strokeWidth={2.2} />
                    </Box>
                  ) : (
                    <Box className="h-9 w-9" />
                  )}
                </HStack>
              );
            })}
          </VStack>
        </SurveyCard>
      )}

      {!isBackendTask ? (
        <SurveyCard>
          <VStack className="px-4 py-4" space="sm">
            <HStack className="items-center justify-between">
              <VStack className="flex-1 min-w-0 pr-2">
                <Text className="text-[15px] font-extrabold" style={{ color: '#0F172A' }}>
                  Site Schedules
                </Text>
                <Text className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>
                  Prefills from ZC — tap Edit to update
                </Text>
              </VStack>
              <Pressable
                onPress={() => (schedulesEditing ? saveScheduleEdit() : beginScheduleEdit())}
                className="active:opacity-80"
                style={{
                  height: 34,
                  paddingHorizontal: 12,
                  borderRadius: DESIGN.stepRadius,
                  borderWidth: 1,
                  borderColor: `${COLORS.primary}40`,
                  backgroundColor: schedulesEditing ? COLORS.primary : GLASS.tintBlue,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {schedulesEditing ? (
                  <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                ) : (
                  <Edit3 size={14} color={COLORS.primary} strokeWidth={2.5} />
                )}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '800',
                    color: schedulesEditing ? '#FFFFFF' : COLORS.primary,
                  }}
                >
                  {schedulesEditing ? 'Done' : 'Edit'}
                </Text>
              </Pressable>
            </HStack>

            {CARDINALS.map((k) => {
              const meta = DIRECTION_META[k];
              const value = schedulesEditing ? scheduleDraft[k] : draft.directions[k];
              return (
                <VStack key={`sched-${k}`} space="xs">
                  <Text
                    className="text-[10px] font-extrabold uppercase tracking-wider"
                    style={{ color: meta.color }}
                  >
                    Schedule {k} · {meta.label}
                  </Text>
                  {schedulesEditing ? (
                    <TextInput
                      value={value}
                      onChangeText={(t) => setScheduleDraft((d) => ({ ...d, [k]: t }))}
                      placeholder={`What is on the ${meta.label.toLowerCase()} side?`}
                      placeholderTextColor="#94A3B8"
                      style={{
                        borderRadius: DESIGN.cardRadius,
                        borderWidth: 1,
                        borderColor: `${COLORS.primary}40`,
                        backgroundColor: '#FFFFFF',
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        fontSize: 13,
                        fontWeight: '700',
                        color: '#0F172A',
                        ...(Platform.OS === 'web'
                          ? ({ outlineStyle: 'none', outlineWidth: 0 } as object)
                          : null),
                      }}
                    />
                  ) : (
                    <Box
                      style={{
                        borderRadius: DESIGN.cardRadius,
                        borderWidth: 1,
                        borderColor: `${COLORS.primary}59`,
                        backgroundColor: '#F8FAFC',
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '700',
                          color: value ? '#0F172A' : '#94A3B8',
                        }}
                      >
                        {value || '—'}
                      </Text>
                    </Box>
                  )}
                </VStack>
              );
            })}
          </VStack>
        </SurveyCard>
      ) : null}

      {isBackendTask ? (
        <SchedulesEditorCard />
      ) : (
        <>
          <Box className="mx-4 mb-1">
            <Text className="text-[15px] font-extrabold" style={{ color: '#0F172A' }}>
              Schedule photos <Text style={{ color: '#DC2626', fontWeight: 'bold' }}>*</Text>
            </Text>
            <Text className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>
              All four sides (North, South, East, West) are mandatory
            </Text>
          </Box>
          <Box className="mx-4 flex-row flex-wrap justify-between" style={{ gap: 12 }}>
            {CARDINALS.map((k) => {
              const meta = DIRECTION_META[k];
              const TypeIcon = DIR_ICONS[k];
              const val = draft.directions[k];
              const photo = draft.surroundingPhotos[k];
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    if (photo) {
                      setPreviewTitle(`${meta.label} photo`);
                      setPreviewUri(photo.uri);
                      return;
                    }
                    openEdit(k);
                  }}
                  onLongPress={() => openEdit(k)}
                  className="active:opacity-90 overflow-hidden"
                  style={{
                    width: '48%',
                    backgroundColor: '#FFFFFF',
                    borderRadius: DESIGN.cardRadius,
                    padding: 14,
                    shadowColor: '#3A4424',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.08,
                    shadowRadius: 14,
                    elevation: 3,
                  }}
                >
                  {photo ? (
                    <VStack space="xs">
                      <HStack className="items-center justify-between mb-1.5">
                        <Box
                          className="items-center justify-center rounded-full"
                          style={{ width: 28, height: 28, backgroundColor: meta.color }}
                        >
                          <Text className="font-black text-white text-[11px]">{k}</Text>
                        </Box>
                        <Box
                          className="h-6 w-6 rounded-full items-center justify-center"
                          style={{ backgroundColor: '#10B981' }}
                        >
                          <Check size={12} color="#fff" strokeWidth={3} />
                        </Box>
                      </HStack>
                      <Box className="relative" style={{ height: 80, borderRadius: DESIGN.cardRadius, overflow: 'hidden' }}>
                        <ApiMediaImage uri={photo.uri} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        <Box
                          className="absolute bottom-1 left-1 px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
                        >
                          <Text className="text-[9px] font-bold text-white">{meta.label} Photo</Text>
                        </Box>
                      </Box>
                    </VStack>
                  ) : (
                    <HStack className="items-start justify-between">
                      <VStack className="flex-1 min-w-0 pr-2">
                        <Box
                          className="items-center justify-center rounded-full"
                          style={{ width: 36, height: 36, backgroundColor: meta.color }}
                        >
                          <Text className="font-black text-white text-[13px]">{k}</Text>
                        </Box>
                        <Text
                          className="mt-2.5 text-[11px] uppercase font-extrabold tracking-wider"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </Text>
                        <Text
                          className="text-[12px] font-bold mt-1"
                          style={{ color: val ? '#0F172A' : COLORS.primary }}
                        >
                          {val || 'Tap to upload photo'}
                        </Text>
                      </VStack>

                      <VStack className="items-center justify-between" style={{ minHeight: 88 }}>
                        <Box
                          className="items-center justify-center rounded-full"
                          style={{ width: 30, height: 30, backgroundColor: GLASS.tintBlue }}
                        >
                          <Camera size={14} color={COLORS.primary} strokeWidth={2.2} />
                        </Box>
                        <Box
                          className="items-center justify-center rounded-full"
                          style={{ width: 34, height: 34, backgroundColor: meta.soft }}
                        >
                          <TypeIcon size={16} color={meta.typeColor} strokeWidth={2.2} />
                        </Box>
                      </VStack>
                    </HStack>
                  )}
                </Pressable>
              );
            })}
          </Box>

          <Pressable
            onPress={() => setApproachOpen(true)}
            className="mx-4 active:opacity-90"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: DESIGN.radiusLg,
              paddingVertical: 14,
              paddingHorizontal: 14,
              shadowColor: '#3A4424',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 2,
            }}
          >
            <HStack className="items-center gap-3">
              <Box
                style={{
                  width: 4,
                  alignSelf: 'stretch',
                  borderRadius: 999,
                  backgroundColor: COLORS.primary,
                }}
              />
              <Box
                className="items-center justify-center rounded-full"
                style={{ width: 32, height: 32, backgroundColor: GLASS.tintBlue }}
              >
                <Info size={16} color={COLORS.primary} strokeWidth={2.4} />
              </Box>
              <VStack className="flex-1 min-w-0">
                <Text className="text-[14px] font-bold" style={{ color: '#0F172A' }}>
                  {TERMS.sections.approachDetails}
                </Text>
                <Text className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }} numberOfLines={1}>
                  {approachSummary}
                </Text>
              </VStack>
              <ChevronRight size={18} color="#94A3B8" />
            </HStack>
          </Pressable>

          <SurveyCard>
            <VStack className="px-4 py-5" space="xs">
              <SectionTitle
                title={TERMS.workflow.checkBandi}
                subtitle={TERMS.workflow.checkBandiRemarksSubtitle}
                accent={COLORS.primary}
              />
              <Textarea
                className="min-h-[110px] rounded-[16px] border-0 mt-1"
                style={{ backgroundColor: '#F3F4F6' }}
              >
                <TextareaInput
                  value={draft.bandiRemarks}
                  onChangeText={setBandiRemarks}
                  placeholder={TERMS.workflow.checkBandiPlaceholder}
                  multiline
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#1E293B',
                    minHeight: 96,
                  }}
                />
              </Textarea>
            </VStack>
          </SurveyCard>

          <Box
            className="mx-4"
            style={{
              borderRadius: DESIGN.cardRadius,
              backgroundColor: '#ECFDF5',
              borderWidth: 1.5,
              borderColor: '#A7F3D0',
              paddingHorizontal: 14,
              paddingVertical: 14,
              shadowColor: '#059669',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 2,
            }}
          >
            <HStack className="items-center gap-3">
              <Box
                className="items-center justify-center"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: DESIGN.cardRadius,
                  backgroundColor: '#D1FAE5',
                }}
              >
                <ShieldCheck size={20} color="#059669" strokeWidth={2.3} />
              </Box>
              <Checkbox
                value="verified"
                isChecked={draft.bandiVerified}
                onChange={(checked) => {
                  setBandiVerified(checked);
                }}
                className="flex-1 items-start gap-3"
              >
                <CheckboxIndicator
                  className="mt-0.5"
                  style={{
                    borderRadius: DESIGN.stepRadius,
                    width: 22,
                    height: 22,
                    borderColor: draft.bandiVerified ? COLORS.primary : `${COLORS.primary}66`,
                    backgroundColor: draft.bandiVerified ? COLORS.primary : '#FFFFFF',
                  }}
                >
                  <CheckboxIcon as={CheckIcon} />
                </CheckboxIndicator>
                <CheckboxLabel className="text-[13px] font-semibold flex-1 leading-5 text-foreground">
                  {TERMS.workflow.physicalVerification}
                </CheckboxLabel>
              </Checkbox>
            </HStack>
          </Box>
        </>
      )}

      <AppSheet
        open={editing != null}
        onClose={() => setEditing(null)}
        title={editing ? `${DIRECTION_META[editing].label} Boundary Photo & Note` : 'Boundary'}
      >
        <VStack space="md" className="pb-2">
          <Text className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
            Take photo ({editing ? DIRECTION_META[editing].label : ''})
          </Text>
          <HStack space="md">
            <Pressable
              onPress={async () => {
                if (!editing) return;
                const k = editing;
                setEditing(null);
                await new Promise((r) => setTimeout(r, 350));
                const asset = await captureSitePhoto({ title: `Take ${DIRECTION_META[k].label} photo` });
                if (asset) void setSurroundingPhoto(k, asset);
              }}
              className="flex-1 h-24 rounded-2xl overflow-hidden active:opacity-90"
            >
              <LinearGradient
                colors={gradientStops(GRADIENT_PRIMARY)}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Camera size={24} color="#fff" />
                <Text className="font-extrabold text-xs text-white">Take Photo</Text>
              </LinearGradient>
            </Pressable>
          </HStack>

          <Text className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mt-2">
            Option 2: Write Text Note
          </Text>
          <Textarea className="min-h-[90px] rounded-2xl border-0" style={{ backgroundColor: '#F3F4F6' }}>
            <TextareaInput
              value={draftNote}
              onChangeText={setDraftNote}
              placeholder={editing ? DIRECTION_META[editing].placeholder : 'Describe boundary...'}
              multiline
            />
          </Textarea>
          <AppBtn onPress={saveEdit}>Save Note</AppBtn>
        </VStack>
      </AppSheet>

      <AppSheet open={approachOpen} onClose={() => setApproachOpen(false)} title={TERMS.sections.approachDetails}>
        <VStack space="md" className="pb-1">
          <Field
            label={TERMS.fields.approachRoadWidth}
            icon={Ruler}
            value={draft.approachRoadWidth}
            onChangeText={(t) => updateField('approachRoadWidth', t)}
            placeholder="e.g. 18 ft"
          />
          <Field
            label={TERMS.fields.approachRoadName}
            value={draft.approachRoadName}
            onChangeText={(t) => updateField('approachRoadName', t)}
            placeholder="e.g. Old Bombay Highway"
          />
          <VStack space="xs">
            <Text className="text-[10px] font-extrabold text-slate-500 uppercase tracking-[1.2px]">
              Additional Notes
            </Text>
            <Textarea
              className="min-h-[110px] rounded-[16px] border-0"
              style={{ backgroundColor: '#F3F4F6' }}
            >
              <TextareaInput
                value={draft.approachNotes}
                onChangeText={setApproachNotes}
                placeholder="Boundary markers, access notes, officer remarks…"
                multiline
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: '#1E293B',
                  minHeight: 96,
                }}
              />
            </Textarea>
          </VStack>
          <AppBtn onPress={() => setApproachOpen(false)}>Done</AppBtn>
        </VStack>
      </AppSheet>

      <ImagePreviewModal
        uri={previewUri}
        title={previewTitle}
        onClose={() => setPreviewUri(null)}
      />
    </SurveyScaffold>
  );
}

/** @deprecated Bounds merged into BandiScreen — kept for existing navigation links. */
export function DirectionsScreen({ go }: { go: Go }) {
  return <BandiScreen go={go} />;
}

export function SurroundingsScreen({ go }: { go: Go }) {
  const { themeId } = useTheme();
  const { draft, setSurroundingPhoto, updateField } = useProject();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('Photo preview');
  const [uploadingSide, setUploadingSide] = useState<Cardinal | null>(null);
  const [clearingSide, setClearingSide] = useState<Cardinal | null>(null);

  const doneCount = CARDINALS.filter((k) => draft.surroundingPhotos[k]).length;

  const takeFor = async (k: Cardinal) => {
    if (uploadingSide) return;
    setUploadingSide(k);
    try {
      const asset = await captureSitePhoto({ title: `Take ${DIRECTION_META[k].label} photo` });
      if (asset) void setSurroundingPhoto(k, asset);
    } finally {
      setUploadingSide(null);
    }
  };

  const handleClearPhoto = async (k: Cardinal) => {
    if (clearingSide) return;
    setClearingSide(k);
    try {
      await setSurroundingPhoto(k, null);
    } finally {
      setClearingSide(null);
    }
  };

  return (
    <SurveyScaffold
      key={themeId}
      title={TERMS.sections.surroundings}
      subtitle={TERMS.workflow.surroundingsSubtitle}
      onBack={() => go('bandi')}
      step={3}
      badge={`${doneCount} of 4 done`}
      footer={
        <FooterContinueBtn
          label="Continue"
          onPress={() => go('photos')}
        />
      }
          go={go}
    >
      <SurveyCard>
        <WorkspaceHeader
          icon={Camera}
          title={TERMS.sections.directionalPhotos}
          subtitle="North · South · East · West"
          iconBg={COLORS.primary}
        />
        <Box className="px-4 pb-5 flex-row flex-wrap justify-between" style={{ gap: 12 }}>
          {CARDINALS.map((k) => {
            const label = DIRECTION_META[k].label;
            const photo = draft.surroundingPhotos[k];
            return (
              <Box key={k} className="rounded-3xl overflow-hidden" style={{ width: '48%', aspectRatio: 4 / 3 }}>
                {photo ? (
                  <Box className="flex-1 relative">
                    <Pressable
                      onPress={() => {
                        setPreviewTitle(`${label} photo`);
                        setPreviewUri(photo.uri);
                      }}
                      className="w-full h-full"
                      accessibilityLabel={`Preview ${label} photo`}
                    >
                      <ApiMediaImage
                        uri={photo.uri}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    </Pressable>
                    <Box
                      className="absolute top-2 left-2 px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                    >
                      <Text className="text-[10px] font-bold text-white">{label}</Text>
                    </Box>
                    <Pressable
                      onPress={() => void handleClearPhoto(k)}
                      disabled={clearingSide === k}
                      className="absolute top-2 right-2 h-7 w-7 rounded-full items-center justify-center"
                      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                    >
                      {clearingSide === k ? (
                        <ButtonLoader size="small" color="#fff" />
                      ) : (
                        <X size={12} color="#fff" />
                      )}
                    </Pressable>
                    <Box
                      className="absolute bottom-2 right-2 h-7 w-7 rounded-full items-center justify-center"
                      style={{ backgroundColor: '#10B981' }}
                    >
                      <Check size={14} color="#fff" strokeWidth={3} />
                    </Box>
                  </Box>
                ) : (
                  <Pressable
                    onPress={() => void takeFor(k)}
                    disabled={uploadingSide === k}
                    className="flex-1 items-center justify-center"
                    style={{
                      backgroundColor: GLASS.tintBlue,
                      borderWidth: 2,
                      borderColor: `${COLORS.primary}40`,
                      borderStyle: 'dashed',
                    }}
                  >
                    <Box
                      className="h-12 w-12 rounded-full items-center justify-center mb-2"
                      style={{ backgroundColor: COLORS.primary }}
                    >
                      {uploadingSide === k ? (
                        <ButtonLoader size="small" color="#fff" />
                      ) : (
                        <Camera size={22} color="#fff" />
                      )}
                    </Box>
                    <Text className="text-[12px] font-extrabold" style={{ color: COLORS.primary }}>
                      {uploadingSide === k ? 'Capturing…' : `Capture ${label}`}
                    </Text>
                  </Pressable>
                )}
              </Box>
            );
          })}
        </Box>
      </SurveyCard>

      <SurveyCard>
        <VStack space="md" className="px-4 py-5">
          <SectionTitle
            title={TERMS.sections.nearbyContext}
            subtitle="Record adjacent structures and reference points"
            accent={COLORS.primary}
          />
          <Field
            label={TERMS.fields.nearbyBuildings}
            icon={Building2}
            value={draft.nearbyBuildings}
            onChangeText={(t) => updateField('nearbyBuildings', t)}
            placeholder="School, health centre…"
          />
          <Field
            label={TERMS.fields.nearbyRoads}
            icon={Navigation}
            value={draft.nearbyRoads}
            onChangeText={(t) => updateField('nearbyRoads', t)}
            placeholder="Main road, service road…"
          />
          <Field
            label={TERMS.fields.landmarks}
            icon={MapPin}
            value={draft.landmarks}
            onChangeText={(t) => updateField('landmarks', t)}
            placeholder="Temple, metro pillar…"
          />

          <Box className="mt-1 p-4 rounded-2xl" style={{ backgroundColor: '#F4F6FB' }}>
            <HStack className="items-center justify-between mb-2">
              <Text className="text-xs font-extrabold text-foreground">Section progress</Text>
              <Text className="text-xs font-bold" style={{ color: COLORS.primary }}>
                {Math.round((doneCount / 4) * 100)}%
              </Text>
            </HStack>
            <Progress
              value={(doneCount / 4) * 100}
              className="h-2.5 rounded-full"
              style={{ backgroundColor: '#DBEAFE' }}
            >
              <ProgressFilledTrack style={{ backgroundColor: COLORS.primary }} />
            </Progress>
          </Box>
        </VStack>
      </SurveyCard>

      <ImagePreviewModal
        uri={previewUri}
        title={previewTitle}
        onClose={() => setPreviewUri(null)}
      />
    </SurveyScaffold>
  );
}

export function PhotosScreen({ go }: { go: Go }) {
  const { themeId } = useTheme();
  const {
    draft,
    setSelfie,
    removeSelfie,
    addPhoto,
    removePhoto,
    updateField,
    persistBackendStep,
    reloadBackendDraft,
  } = useProject();
  const [stepSaving, setStepSaving] = useState(false);
  const [selfieLoading, setSelfieLoading] = useState(false);
  const [deletingSelfie, setDeletingSelfie] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const pageLoading = useMinimumLoading(true, 300);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('Photo preview');
  const isBackendTask = Boolean(draft.backendApplicationId);
  const maxPhotos = isBackendTask ? 4 : 10;
  const backScreen = isBackendTask ? 'dimensions' : 'surroundings';

  const takeSelfieMedia = async () => {
    if (selfieLoading) return;
    setSelfieLoading(true);
    try {
      const asset = await captureSelfie();
      if (asset) await setSelfie(asset);
    } catch (err) {
      alertDraftError(err);
    } finally {
      setSelfieLoading(false);
    }
  };

  const handleRemoveSelfie = async () => {
    if (deletingSelfie) return;
    setDeletingSelfie(true);
    try {
      await removeSelfie();
    } catch (err) {
      alertDraftError(err);
    } finally {
      setDeletingSelfie(false);
    }
  };

  const takeSitePhoto = async () => {
    if (photoUploading) return;
    setPhotoUploading(true);
    try {
      const asset = await captureSitePhoto({ title: 'Take site photo' });
      if (asset) await addPhoto(asset);
    } catch (err) {
      alertDraftError(err);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleRemovePhoto = async (id: string) => {
    if (deletingPhotoId) return;
    setDeletingPhotoId(id);
    try {
      await removePhoto(id);
    } catch (err) {
      alertDraftError(err);
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const totalPhotosCount = (draft.selfie ? 1 : 0) + draft.photos.length;

  return (
    <SurveyScaffold
      key={themeId}
      title={isBackendTask ? 'Media & submit' : 'Upload Photographs'}
      subtitle={
        isBackendTask
          ? 'Selfie · site photos · comments · video'
          : TERMS.workflow.photosSubtitle
      }
      surface={isBackendTask ? 'premium' : 'default'}
      loading={pageLoading}
      onBack={() => {
        go(backScreen, { replace: true });
        if (isBackendTask) {
          void reloadBackendDraft().catch(() => undefined);
        }
      }}
      onStepNav={
        isBackendTask
          ? () => {
              void reloadBackendDraft().catch(() => undefined);
            }
          : undefined
      }
      step={4}
      total={isBackendTask ? 4 : 5}
      badge={
        isBackendTask
          ? draft.video
            ? 'Media ready'
            : `${totalPhotosCount} uploaded`
          : `${totalPhotosCount} uploaded`
      }
      footer={
        isBackendTask ? (
          <VStack space="sm">
            <FooterContinueBtn
              loading={stepSaving}
              disabled={
                stepSaving ||
                !draft.selfie ||
                !draft.engineerComments.trim() ||
                !draft.video
              }
              label="Continue"
              onPress={() => {
                void (async () => {
                  setStepSaving(true);
                  try {
                    await persistBackendStep('media');
                  } catch (err) {
                    alertDraftError(err);
                    setStepSaving(false);
                    return;
                  }
                  setStepSaving(false);
                  go('validate');
                })();
              }}
            />
            <HStack className="items-center justify-center gap-1.5 pt-0.5">
              <Lock size={11} color="#94A3B8" strokeWidth={2.2} />
              <Text className="text-[10px] font-medium" style={{ color: '#94A3B8' }}>
                Your data is secure and encrypted
              </Text>
            </HStack>
          </VStack>
        ) : (
          <FooterContinueBtn
            loading={stepSaving}
            disabled={stepSaving || !draft.selfie}
            label="Continue"
            onPress={() => go('video')}
          />
        )
      }
      go={go}
    >
      {isBackendTask ? (
        <>
          <PremiumStepCard
            icon={Camera}
            title="Engineer Selfie *"
            badge={
              draft.selfie ? (
                <Box
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: '#ECFDF5',
                    borderWidth: 1,
                    borderColor: '#A7F3D0',
                  }}
                >
                  <Text style={{ fontFamily: FONTS.bold, fontSize: 11, color: '#047857' }}>
                    Done
                  </Text>
                </Box>
              ) : undefined
            }
          >
            {draft.selfie ? (
              <Box
                style={{
                  borderRadius: 16,
                  backgroundColor: COLORS.white,
                  borderWidth: 1.5,
                  borderColor: BLUE_BORDER,
                  padding: 8,
                  shadowColor: COLORS.primaryDeep,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 5,
                  elevation: 2,
                }}
              >
                <HStack style={{ alignItems: 'center', gap: 10 }}>
                  <Box
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 14,
                      overflow: 'hidden',
                      backgroundColor: '#0F172A',
                      borderWidth: 1,
                      borderColor: BLUE_BORDER,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        setPreviewTitle('Engineer selfie');
                        setPreviewUri(draft.selfie!.uri);
                      }}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <ApiMediaImage
                        uri={draft.selfie.uri}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    </Pressable>
                  </Box>
                  <VStack style={{ flex: 1, minWidth: 0, gap: 0 }}>
                    <Text
                      style={{
                        fontFamily: FONTS.bold,
                        fontSize: 13,
                        letterSpacing: 0.3,
                        color: COLORS.ink,
                     
                      }}
                    >
                      Selfie Captured Successfully
                    </Text>
                    {/* <Text
                      style={{
                        fontFamily: FONTS.semibold,
                        fontSize: 12,
                        lineHeight: 16,
                        color: '#475569',
                      }}
                    >
                     Selfie Captured Successfully
                    </Text> */}
                    <HStack style={{ gap: 8, marginTop: 6 }}>
                      <Pressable
                        onPress={() => void takeSelfieMedia()}
                        disabled={selfieLoading}
                        className="active:opacity-80 flex-row items-center"
                        style={{
                          gap: 5,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: COLORS.primary,
                          opacity: selfieLoading ? 0.7 : 1,
                        }}
                      >
                        {selfieLoading ? (
                          <ButtonLoader size="small" color="#FFFFFF" />
                        ) : null}
                        <Text style={{ fontFamily: FONTS.bold, fontSize: 11, color: '#FFFFFF' }}>
                          {selfieLoading ? 'Loading…' : 'Retake'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void handleRemoveSelfie()}
                        disabled={selfieLoading || deletingSelfie}
                        className="active:opacity-80"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 999,
                          backgroundColor: BLUE_SOFT,
                          borderWidth: 1,
                          borderColor: BLUE_BORDER,
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: deletingSelfie ? 0.7 : 1,
                        }}
                        accessibilityLabel="Remove selfie"
                      >
                        {deletingSelfie ? (
                          <ButtonLoader size="small" color={COLORS.destructive} />
                        ) : (
                          <Trash2 size={15} color={COLORS.destructive} strokeWidth={2.2} />
                        )}
                      </Pressable>
                    </HStack>
                  </VStack>
                </HStack>
              </Box>
            ) : (
              <Box
                style={{
                  borderRadius: 16,
                  backgroundColor: BLUE_SOFT,
                  borderWidth: 1,
                  borderColor: BLUE_BORDER,
                  paddingVertical: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Pressable
                  onPress={() => void takeSelfieMedia()}
                  disabled={selfieLoading}
                  className="active:opacity-80 items-center justify-center"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 999,
                    backgroundColor: COLORS.primary,
                    shadowColor: COLORS.primaryDeep,
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.2,
                    shadowRadius: 6,
                    elevation: 3,
                  }}
                >
                  {selfieLoading ? (
                    <ButtonLoader size="small" color="#FFFFFF" />
                  ) : (
                    <Camera size={26} color="#FFFFFF" strokeWidth={2.2} />
                  )}
                </Pressable>
              </Box>
            )}
          </PremiumStepCard>

          <PremiumStepCard
            icon={ImageIcon}
            title="Site Photograph"
            subtitle={
              draft.photos.length === 0
                ? 'Optional extra site images · rear camera'
                : `${draft.photos.length} of ${maxPhotos} uploaded`
            }
            badge={
              <Box
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: BLUE_SOFT,
                  borderWidth: 1,
                  borderColor: BLUE_BORDER,
                }}
              >
                <Text style={{ fontFamily: FONTS.bold, fontSize: 11, color: COLORS.primary }}>
                  {`${draft.photos.length}/${maxPhotos}`}
                </Text>
              </Box>
            }
          >
            <VStack style={{ gap: 8 }}>
              {draft.photos.length < maxPhotos ? (
                <Pressable
                  onPress={() => void takeSitePhoto()}
                  disabled={photoUploading}
                  className="active:opacity-80 flex-row items-center self-start"
                  style={{
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: BLUE_SOFT,
                    borderWidth: 1,
                    borderColor: BLUE_BORDER,
                    opacity: photoUploading ? 0.7 : 1,
                  }}
                >
                  {photoUploading ? (
                    <ButtonLoader size="small" color={COLORS.primary} />
                  ) : (
                    <Plus size={14} color={COLORS.primary} strokeWidth={2.8} />
                  )}
                  <Text style={{ fontFamily: FONTS.bold, fontSize: 11, color: COLORS.primary }}>
                    {photoUploading ? 'Uploading…' : 'Add Photo'}
                  </Text>
                </Pressable>
              ) : null}

              <Box className="flex-row flex-wrap" style={{ gap: 8 }}>
                {draft.photos.map((p, i) => (
                  <Box
                    key={p.id}
                    className="overflow-hidden relative"
                    style={{
                      width: '31%',
                      aspectRatio: 1,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: BLUE_BORDER,
                      shadowColor: COLORS.primaryDeep,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 5,
                      elevation: 2,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        setPreviewTitle(`Site Photo ${String(i + 1).padStart(2, '0')}`);
                        setPreviewUri(p.uri);
                      }}
                      className="w-full h-full"
                    >
                      <ApiMediaImage
                        uri={p.uri}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => void handleRemovePhoto(p.id)}
                      disabled={deletingPhotoId === p.id}
                      className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full items-center justify-center"
                      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                    >
                      {deletingPhotoId === p.id ? (
                        <ButtonLoader size="small" color="#fff" />
                      ) : (
                        <X size={12} color="#fff" />
                      )}
                    </Pressable>
                  </Box>
                ))}
                {draft.photos.length === 0 ? (
                  <Box
                    className="items-center justify-center"
                    style={{
                      width: '100%',
                      minHeight: 72,
                      borderRadius: 16,
                      backgroundColor: BLUE_SOFT,
                      borderWidth: 1,
                      borderColor: BLUE_BORDER,
                      borderStyle: 'dashed',
                      paddingVertical: 12,
                      paddingHorizontal: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: FONTS.semibold,
                        fontSize: 12,
                        color: '#475569',
                        textAlign: 'center',
                        lineHeight: 16,
                      }}
                    >
                      No extra site photos yet · optional
                    </Text>
                  </Box>
                ) : null}
              </Box>
            </VStack>
          </PremiumStepCard>

          <SiteVideoCaptureCard />

          <PremiumStepCard
            icon={MessageSquareText}
            title="Engineer comments *"
            badge={
              draft.engineerComments.trim() ? (
                <Box
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: '#ECFDF5',
                    borderWidth: 1,
                    borderColor: '#A7F3D0',
                  }}
                >
                  <Text style={{ fontFamily: FONTS.bold, fontSize: 11, color: '#047857' }}>
                    Done
                  </Text>
                </Box>
              ) : undefined
            }
          >
            <Box
              style={{
                borderRadius: 16,
                backgroundColor: COLORS.white,
                borderWidth: 1.5,
                borderColor: BLUE_BORDER,
                padding: 8,
                shadowColor: COLORS.primaryDeep,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 5,
                elevation: 2,
              }}
            >
              <Textarea>
                <TextareaInput
                  value={draft.engineerComments}
                  onChangeText={(t) => updateField('engineerComments', t)}
                  placeholder="Enter field remarks / comments…"
                />
              </Textarea>
            </Box>
          </PremiumStepCard>
        </>
      ) : (
        <>
      {/* ── Card 1: Mandatory Engineer Selfie ── */}
      <SurveyCard>
        <WorkspaceHeader
          icon={Camera}
          title="Engineer selfie *"
          subtitle="Mandatory — live front-camera selfie of engineer on site"
          iconBg={COLORS.primary}
        />
        <VStack style={{ paddingHorizontal: SPACE[4], paddingBottom: SPACE[4], gap: SPACE[3] }}>
          {draft.selfie ? (
            /* Selfie Already Captured */
            <Box
              style={{
                borderRadius: DESIGN.cardRadius,
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: `${COLORS.primary}59`,
                padding: SPACE[3],
              }}
            >
              <HStack style={{ alignItems: 'center', gap: SPACE[3] }}>
                <Box
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: DESIGN.cardRadius,
                    overflow: 'hidden',
                    backgroundColor: '#0F172A',
                  }}
                >
                  <Pressable
                    onPress={() => {
                      setPreviewTitle('Engineer selfie');
                      setPreviewUri(draft.selfie!.uri);
                    }}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <ApiMediaImage
                      uri={draft.selfie.uri}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  </Pressable>
                </Box>

                <VStack style={{ flex: 1, gap: 4 }}>
                  <HStack style={{ alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={16} color="#16A34A" />
                    <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: COLORS.ink }}>
                      Selfie captured
                    </Text>
                  </HStack>
                  <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: '#64748B' }}>
                    Engineer verification photo ready
                  </Text>
                  <HStack style={{ gap: SPACE[2], marginTop: 2 }}>
                    <Pressable
                      onPress={() => void takeSelfieMedia()}
                      disabled={selfieLoading}
                      className="flex-row items-center"
                      style={{
                        gap: 5,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: DESIGN.stepRadius,
                        backgroundColor: COLORS.primary,
                        opacity: selfieLoading ? 0.7 : 1,
                      }}
                    >
                      {selfieLoading ? (
                        <ButtonLoader size="small" color="#FFFFFF" />
                      ) : null}
                      <Text style={{ fontFamily: FONTS.bold, fontSize: 11, color: '#FFFFFF' }}>
                        {selfieLoading ? 'Loading…' : 'Retake Selfie'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void handleRemoveSelfie()}
                      disabled={selfieLoading || deletingSelfie}
                      className="h-10 w-10 rounded-full items-center justify-center active:opacity-80"
                      style={{
                        backgroundColor: COLORS.white,
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.08,
                        shadowRadius: 6,
                        elevation: 2,
                        opacity: deletingSelfie ? 0.7 : 1,
                      }}
                      accessibilityLabel="Remove selfie"
                    >
                      {deletingSelfie ? (
                        <ButtonLoader size="small" color={COLORS.destructive} />
                      ) : (
                        <Trash2 size={16} color={COLORS.destructive} strokeWidth={2.2} />
                      )}
                    </Pressable>
                  </HStack>
                </VStack>
              </HStack>
            </Box>
          ) : (
            <Box
              style={{
                borderRadius: DESIGN.cardRadius,
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: `${COLORS.primary}59`,
                padding: SPACE[3],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Pressable
                onPress={() => void takeSelfieMedia()}
                disabled={selfieLoading}
                className="active:opacity-80 items-center justify-center"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: COLORS.primary,
                }}
              >
                {selfieLoading ? (
                  <ButtonLoader size="small" color="#FFFFFF" />
                ) : (
                  <Camera size={26} color="#FFFFFF" strokeWidth={2.2} />
                )}
              </Pressable>
            </Box>
          )}
        </VStack>
      </SurveyCard>

      {/* ── Card 2: Site Photograph ── */}
      <SurveyCard>
        <WorkspaceHeader
          icon={ImageIcon}
          title="Site Photograph"
          subtitle="Rear camera only · optional extra site photos (max 4)"
          iconBg={COLORS.primary}
        />
        <VStack style={{ paddingHorizontal: SPACE[4], paddingBottom: SPACE[4], gap: SPACE[3] }}>
          <HStack style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE[3] }}>
            <VStack style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: COLORS.ink }}>
                Uploaded site photos
              </Text>
              <Text
                style={{ fontFamily: FONTS.semibold, fontSize: 12, color: '#475569', lineHeight: 16 }}
              >
                {draft.photos.length === 0
                  ? 'No extra site photos yet'
                  : `${draft.photos.length} photo${draft.photos.length === 1 ? '' : 's'} ready (max ${maxPhotos})`}
              </Text>
            </VStack>
            {draft.photos.length < maxPhotos ? (
              <Pressable
                onPress={() => void takeSitePhoto()}
                disabled={photoUploading}
                className="active:opacity-80 flex-row items-center"
                style={{
                  flexShrink: 0,
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: DESIGN.stepRadius,
                  backgroundColor: COLORS.primary,
                  opacity: photoUploading ? 0.7 : 1,
                }}
              >
                {photoUploading ? (
                  <ButtonLoader size="small" color="#FFFFFF" />
                ) : (
                  <Plus size={14} color="#FFFFFF" strokeWidth={2.8} />
                )}
                <Text style={{ fontFamily: FONTS.bold, fontSize: 12, color: '#FFFFFF' }}>
                  {photoUploading ? 'Uploading…' : 'Add Photo'}
                </Text>
              </Pressable>
            ) : null}
          </HStack>

          <Box className="flex-row flex-wrap" style={{ gap: 10 }}>
            {draft.photos.map((p, i) => (
              <Box
                key={p.id}
                className="rounded-2xl overflow-hidden relative"
                style={{
                  width: '31%',
                  aspectRatio: 1,
                  shadowColor: '#0F172A',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <Pressable
                  onPress={() => {
                    setPreviewTitle(`Site Photo ${String(i + 1).padStart(2, '0')}`);
                    setPreviewUri(p.uri);
                  }}
                  className="w-full h-full"
                  accessibilityLabel={`Preview photo ${i + 1}`}
                >
                  <ApiMediaImage
                    uri={p.uri}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                </Pressable>
                <Pressable
                  onPress={() => void handleRemovePhoto(p.id)}
                  disabled={deletingPhotoId === p.id}
                  className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full items-center justify-center"
                  style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                  accessibilityLabel={`Remove photo ${i + 1}`}
                >
                  {deletingPhotoId === p.id ? (
                    <ButtonLoader size="small" color="#fff" />
                  ) : (
                    <X size={12} color="#fff" />
                  )}
                </Pressable>
                <Box
                  className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                >
                  <Text className="text-[9px] text-white font-bold">
                    IMG_{String(i + 1).padStart(2, '0')}
                  </Text>
                </Box>
              </Box>
            ))}
            {draft.photos.length === 0 ? (
              <Box
                className="items-center justify-center rounded-2xl"
                style={{
                  width: '100%',
                  minHeight: 88,
                  backgroundColor: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: `${COLORS.primary}59`,
                  borderStyle: 'dashed',
                  paddingVertical: SPACE[4],
                  paddingHorizontal: SPACE[3],
                }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.medium,
                    fontSize: 12,
                    color: '#64748B',
                    textAlign: 'center',
                    lineHeight: 18,
                  }}
                >
                  Tap Add Photo to upload optional site images
                </Text>
              </Box>
            ) : null}
          </Box>
        </VStack>
      </SurveyCard>

      {draft.photos.length > 0 ? (
        <SurveyCard>
          <HStack
            className="items-center"
            style={{
              paddingHorizontal: SPACE[4],
              paddingVertical: SPACE[4],
              gap: SPACE[3],
            }}
          >
            <Box
              className="h-12 w-12 rounded-2xl items-center justify-center"
              style={{
                backgroundColor: COLORS.white,
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Upload size={22} color={COLORS.ink} />
            </Box>
            <VStack className="flex-1" style={{ gap: 2 }}>
              <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: COLORS.ink }}>
                Ready on device
              </Text>
              <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.ink }}>
                {draft.photos.length} photo{draft.photos.length === 1 ? '' : 's'} stored locally
              </Text>
            </VStack>
          </HStack>
        </SurveyCard>
      ) : null}
        </>
      )}

      <ImagePreviewModal
        uri={previewUri}
        title={previewTitle}
        onClose={() => setPreviewUri(null)}
      />
    </SurveyScaffold>
  );
}

function formatDuration(ms?: number | null) {
  if (ms == null || ms <= 0) return 'Video';
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function VideoScreen({ go }: { go: Go }) {
  const { themeId } = useTheme();
  const { draft, setVideo } = useProject();
  const [busy, setBusy] = useState(false);
  const [deletingVideo, setDeletingVideo] = useState(false);
  const isBackendTask = Boolean(draft.backendApplicationId);
  const simDummy = useDummyCapture();

  useEffect(() => {
    if (isBackendTask) go('photos');
  }, [go, isBackendTask]);

  const record = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const asset = await captureVideo();
      if (asset) await setVideo(asset);
    } catch (err) {
      alertDraftError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveVideo = async () => {
    if (deletingVideo) return;
    setDeletingVideo(true);
    try {
      await setVideo(null);
    } catch (err) {
      alertDraftError(err);
    } finally {
      setDeletingVideo(false);
    }
  };

  const useDummy = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const asset = await createDummyVideoAsset();
      await setVideo(asset);
    } catch (err) {
      alertDraftError(err);
    } finally {
      setBusy(false);
    }
  };

  if (isBackendTask) return null;

  const recordedLabel = draft.video
    ? new Date(draft.video.createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  return (
    <SurveyScaffold
      key={themeId}
      title="Upload Inspection Video"
      subtitle={TERMS.workflow.videoSubtitle}
      surface="default"
      onBack={() => go('photos')}
      step={5}
      total={5}
      badge="Final step"
      footer={
        <VStack space="sm">
          <FooterContinueBtn
            disabled={!draft.video}
            label="Continue"
            onPress={() => go('validate')}
          />
          <HStack className="items-center justify-center gap-1.5 pt-0.5">
            <Lock size={11} color="#94A3B8" strokeWidth={2.2} />
            <Text className="text-[10px] font-medium" style={{ color: '#94A3B8' }}>
              Your data is secure and encrypted
            </Text>
          </HStack>
        </VStack>
      }
      go={go}
    >
      <>
      <SurveyCard>
        <WorkspaceHeader
          icon={Camera}
          title={TERMS.sections.walkthroughVideo}
          subtitle="HD recording · on device"
          iconBg={COLORS.primary}
        />
        <VStack style={{ paddingHorizontal: SPACE[4], paddingBottom: SPACE[4], gap: SPACE[3] }}>
          <Box
            className="rounded-3xl overflow-hidden"
            style={{
              aspectRatio: 16 / 9,
              backgroundColor: '#0F172A',
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.12,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            {draft.video ? (
              <SiteVideoPlayer
                key={draft.video.uri}
                uri={draft.video.uri}
                durationLabel={formatDuration(draft.video.durationMs)}
              />
            ) : (
              <LinearGradient
                colors={gradientStops(GRADIENT_VIDEO)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}
              >
                <Box
                  className="items-center justify-center rounded-full"
                  style={{
                    height: 64,
                    width: 64,
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    borderWidth: 2,
                    borderColor: 'rgba(255,255,255,0.4)',
                  }}
                >
                  {busy ? (
                    <ButtonLoader size="small" color="#fff" />
                  ) : (
                    <Video size={26} color="#fff" strokeWidth={2.2} />
                  )}
                </Box>
                <Text className="text-white font-extrabold text-sm">
                  {busy ? 'Processing video…' : 'No video yet'}
                </Text>
                <Text className="text-white/70 text-xs font-medium">
                  {busy ? 'Please wait while processing…' : 'Record video below'}
                </Text>
              </LinearGradient>
            )}
          </Box>

          {draft.video ? (
            <HStack className="items-center" style={{ gap: SPACE[3] }}>
              <Box
                className="items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: DESIGN.cardRadius,
                  backgroundColor: COLORS.white,
                  shadowColor: '#0F172A',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <MapPin size={18} color={COLORS.ink} strokeWidth={2.3} />
              </Box>
              <VStack className="flex-1 min-w-0" style={{ gap: 2 }}>
                <Text
                  style={{ fontFamily: FONTS.bold, fontSize: 14, color: COLORS.ink }}
                  numberOfLines={1}
                >
                  Site Walk-through
                </Text>
                <Text
                  style={{ fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.ink }}
                  numberOfLines={1}
                >
                  Recorded {recordedLabel}
                </Text>
              </VStack>
              <Pressable
                onPress={() => void handleRemoveVideo()}
                disabled={busy || deletingVideo}
                className="h-10 w-10 rounded-full items-center justify-center active:opacity-80"
                style={{
                  backgroundColor: COLORS.white,
                  shadowColor: '#0F172A',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 6,
                  elevation: 2,
                  opacity: deletingVideo ? 0.7 : 1,
                }}
              >
                {deletingVideo ? (
                  <ButtonLoader size="small" color={COLORS.destructive} />
                ) : (
                  <Trash2 size={16} color={COLORS.destructive} strokeWidth={2.2} />
                )}
              </Pressable>
            </HStack>
          ) : null}
        </VStack>
      </SurveyCard>

      <Pressable
        onPress={simDummy ? () => void useDummy() : record}
        disabled={busy}
        className="mx-4 min-h-[68px] rounded-2xl overflow-hidden active:opacity-90"
        style={{
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.28,
          shadowRadius: 14,
          elevation: 5,
          opacity: busy ? 0.65 : 1,
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
            paddingHorizontal: 12,
            paddingVertical: 12,
            gap: 8,
          }}
        >
          <Box
            className="items-center justify-center shrink-0"
            style={{
              width: 38,
              height: 38,
              borderRadius: DESIGN.cardRadius,
              backgroundColor: 'rgba(255,255,255,0.22)',
            }}
          >
            {busy ? (
              <ButtonLoader size="small" color="#fff" />
            ) : (
              <Camera size={18} color="#fff" strokeWidth={2.3} />
            )}
          </Box>
          <Text
            className="flex-1 font-extrabold text-white text-[12px] shrink"
            style={{ lineHeight: 16, flexShrink: 1 }}
          >
            {busy
              ? 'Processing video…'
              : simDummy
                ? 'Use dummy sample video'
                : 'Record Video'}
          </Text>
          {busy ? (
            <ButtonLoader size="small" color="#fff" />
          ) : (
            <ChevronRight size={18} color="rgba(255,255,255,0.9)" strokeWidth={2.4} />
          )}
        </LinearGradient>
      </Pressable>

      {draft.video ? (
        <Box
          className="mx-4"
          style={{
            borderRadius: DESIGN.cardRadius,
            backgroundColor: '#ECFDF5',
            borderWidth: 1.5,
            borderColor: '#6EE7B7',
            borderStyle: 'dashed',
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          <HStack className="items-center gap-3">
            <Box
              className="items-center justify-center"
              style={{
                width: 44,
                height: 44,
                borderRadius: DESIGN.cardRadius,
                backgroundColor: '#059669',
              }}
            >
              <Check size={22} color="#fff" strokeWidth={3} />
            </Box>
            <VStack className="flex-1 min-w-0">
              <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: COLORS.ink }}>
                Video ready
              </Text>
              <Text
                style={{ fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.ink, marginTop: 2 }}
              >
                Max size 50 MB · stored on this device
              </Text>
            </VStack>
            <Box
              className="px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: COLORS.white,
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <Text style={{ fontFamily: FONTS.bold, fontSize: 10, color: COLORS.ink }}>Valid</Text>
            </Box>
          </HStack>
        </Box>
      ) : null}
      </>
    </SurveyScaffold>
  );
}

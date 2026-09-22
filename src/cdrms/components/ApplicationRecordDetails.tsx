import { useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import {
  Building2,
  Compass,
  Link2,
  MapPin,
  Ruler,
  UserCheck,
  type LucideIcon,
} from 'lucide-react-native';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type MobileApplication, engineerApplicationListStatus } from '@/src/api/applications';
import { ApiMediaImage } from '@/src/cdrms/components/ApiMediaImage';
import { ApplicationStatusBadge } from '@/src/cdrms/components/ApplicationStatusBadge';
import { BoundariesDiagram } from '@/src/cdrms/components/BoundariesDiagram';
import { EngineerSchedulesReadOnly } from '@/src/cdrms/components/EngineerSchedulesReadOnly';
import { GpsSiteCard } from '@/src/cdrms/components/GpsSiteCard';
import { ImagePreviewModal } from '@/src/cdrms/components/ImagePreviewModal';
import { SiteVideoPlayer } from '@/src/cdrms/components/SiteVideoPlayer';
import { StatusChip } from '@/src/cdrms/components/primitives';
import { resolveBoundaryDims, deriveSiteTypeFromDims } from '@/src/cdrms/lib/resolveBoundaryDims';
import { COLORS, DESIGN, FONTS, GLASS, SPACE, hexAlpha } from '@/src/cdrms/theme';
import { useTheme } from '@/src/theme/ThemeContext';

function scheduleViewValue(
  app: MobileApplication,
  side: 'N' | 'S' | 'E' | 'W',
): string {
  const zc =
    side === 'N'
      ? app.scheduleNorth
      : side === 'S'
        ? app.scheduleSouth
        : side === 'E'
          ? app.scheduleEast
          : app.scheduleWest;
  if (zc?.trim()) return zc.trim();
  const notes = app.engineerScheduleNotes || {};
  const eng = notes[side]?.trim() || notes[side.toLowerCase()]?.trim() || '';
  return eng || '—';
}

function dimViewValue(
  app: MobileApplication,
  side: 'N' | 'S' | 'E' | 'W',
  boundary?: { north: number; south: number; east: number; west: number } | null,
): string {
  const flat =
    side === 'N'
      ? app.dimNorth
      : side === 'S'
        ? app.dimSouth
        : side === 'E'
          ? app.dimEast
          : app.dimWest;
  if (flat != null && String(flat).trim()) return String(flat).trim();
  const eng = app.engineerDimensions;
  const fromMap = eng?.[side]?.trim() || eng?.[side.toLowerCase()]?.trim();
  if (fromMap) return fromMap;
  const n =
    side === 'N'
      ? boundary?.north
      : side === 'S'
        ? boundary?.south
        : side === 'E'
          ? boundary?.east
          : boundary?.west;
  return n && n > 0 ? String(n) : '—';
}

const FIELD_RADIUS = 14;
const ACCENT = {
  blue: { fg: '#1A368E', bg: '#E8F0FE' },
  green: { fg: '#15803D', bg: '#DCFCE7' },
  purple: { fg: '#6D28D9', bg: '#EDE9FE' },
  sky: { fg: '#1D4ED8', bg: '#DBEAFE' },
} as const;

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  badge,
  children,
  accent = 'blue',
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  badge?: ReactNode;
  children: ReactNode;
  accent?: keyof typeof ACCENT;
}) {
  const tone = ACCENT[accent];

  return (
    <Box style={{ paddingHorizontal: SPACE.gutter }}>
      <Box
        style={{
          backgroundColor: COLORS.white,
          borderRadius: 20,
          borderWidth: 1.75,
          borderColor: hexAlpha(tone.fg, 0.38),
          overflow: 'hidden',
          shadowColor: tone.fg,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0.07,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <HStack
          className="items-center"
          style={{
            gap: 10,
            paddingHorizontal: 12,
            paddingVertical: 12,
            alignItems: 'center',
          }}
        >
          <Box
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              backgroundColor: tone.bg,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={16} color={tone.fg} strokeWidth={2.4} />
          </Box>
          <VStack style={{ flex: 1, minWidth: 0, flexShrink: 1, gap: 2, justifyContent: 'center' }}>
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: FONTS.bold,
                fontSize: 15,
                lineHeight: 18,
                color: '#0F172A',
                letterSpacing: -0.2,
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: FONTS.semibold,
                  fontSize: 12,
                  lineHeight: 15,
                  color: '#64748B',
                }}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {subtitle}
              </Text>
            ) : null}
          </VStack>
          {badge ? <Box style={{ flexShrink: 0, marginLeft: 4 }}>{badge}</Box> : null}
        </HStack>
        <VStack style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2, gap: 12 }}>
          {children}
        </VStack>
      </Box>
    </Box>
  );
}

const FIELD_LABEL_STYLE = {
  fontFamily: FONTS.bold,
  fontSize: 14,
  color: '#1A368E',
  letterSpacing: 0.1,
  marginBottom: 6,
};

const EMPHASIS_FIELD_LABEL_STYLE = {
  ...FIELD_LABEL_STYLE,
};

function ReadValue({
  value,
  accent = 'blue',
}: {
  value: ReactNode;
  accent?: keyof typeof ACCENT;
}) {
  const tone = ACCENT[accent];
  const text = typeof value === 'string' || typeof value === 'number' ? String(value || '—') : null;
  const long = Boolean(text && text.length > 42);
  return (
    <Box
      style={{
        minHeight: 46,
        borderRadius: FIELD_RADIUS,
        borderWidth: 1.5,
        borderColor: hexAlpha(tone.fg, 0.42),
        backgroundColor: COLORS.white,
        paddingHorizontal: 12,
        paddingVertical: long ? 10 : 0,
        justifyContent: 'center',
        alignSelf: 'stretch',
        overflow: 'hidden',
      }}
    >
      {text != null ? (
        <Text
          style={{
            fontFamily: FONTS.medium,
            fontSize: 14,
            color: COLORS.ink,
            lineHeight: 19,
            flexShrink: 1,
            width: '100%',
            ...(Platform.OS === 'web'
              ? ({ wordBreak: 'break-word' as const } as object)
              : null),
          }}
        >
          {text}
        </Text>
      ) : (
        value ?? (
          <Text style={{ fontFamily: FONTS.medium, fontSize: 14, color: COLORS.ink }}>—</Text>
        )
      )}
    </Box>
  );
}

function InfoRow({
  label,
  value,
  last: _last,
  accent = 'blue',
}: {
  label: string;
  value: ReactNode;
  last?: boolean;
  accent?: keyof typeof ACCENT;
}) {
  return (
    <VStack>
      <Text style={FIELD_LABEL_STYLE}>{label}</Text>
      <ReadValue value={value} accent={accent} />
    </VStack>
  );
}

function InfoPairRow({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  last: _last,
  emphasisLabels = false,
  accent = 'blue',
}: {
  leftLabel: string;
  leftValue: ReactNode;
  rightLabel: string;
  rightValue: ReactNode;
  last?: boolean;
  emphasisLabels?: boolean;
  accent?: keyof typeof ACCENT;
}) {
  const labelStyle = emphasisLabels ? EMPHASIS_FIELD_LABEL_STYLE : FIELD_LABEL_STYLE;
  return (
    <HStack style={{ gap: 10 }}>
      <VStack style={{ flex: 1, minWidth: 0 }}>
        <Text style={labelStyle}>{leftLabel}</Text>
        <ReadValue value={leftValue} accent={accent} />
      </VStack>
      <VStack style={{ flex: 1, minWidth: 0 }}>
        <Text style={labelStyle}>{rightLabel}</Text>
        <ReadValue value={rightValue} accent={accent} />
      </VStack>
    </HStack>
  );
}

function MediaThumb({
  label,
  uri,
  onView,
  showLabel = true,
}: {
  label: string;
  uri: string;
  onView: () => void;
  showLabel?: boolean;
}) {
  return (
    <Box style={{ width: '23%', minWidth: 72, alignItems: 'center' }}>
      {showLabel ? (
        <Text
          style={{
            fontFamily: FONTS.bold,
            fontSize: 13,
            color: '#1A368E',
            marginBottom: 6,
            textAlign: 'center',
            letterSpacing: 0.1,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={onView}
        className="active:opacity-80"
        accessibilityLabel={`View ${label}`}
        style={{
          width: '100%',
          borderRadius: 999,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: hexAlpha(COLORS.primary, 0.45),
          backgroundColor: COLORS.muted,
        }}
      >
        <ApiMediaImage
          uri={uri}
          style={{ width: '100%', aspectRatio: 1, backgroundColor: GLASS.divider, borderRadius: 999 }}
          resizeMode="cover"
        />
      </Pressable>
    </Box>
  );
}

function formatSubmittedDateTime(iso?: string | null): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function SectionLabel({ children, accent = false }: { children: string; accent?: boolean }) {
  return (
    <Text
      style={{
        fontFamily: FONTS.bold,
        fontSize: 14,
        color: accent ? COLORS.primary : COLORS.ink,
        letterSpacing: 0.2,
        marginTop: 4,
        marginBottom: 2,
      }}
    >
      {children}
    </Text>
  );
}

function MediaSectionHeading({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: FONTS.bold,
        fontSize: 15,
        color: '#1A368E',
        marginBottom: 8,
        letterSpacing: 0.15,
      }}
    >
      {children}
    </Text>
  );
}

function ZcDetailsCard({
  app,
  siteType,
  diagram,
  badge,
  schedulesTitle = 'Site Schedules',
}: {
  app: MobileApplication;
  siteType: string;
  diagram?: ReactNode;
  badge?: ReactNode;
  /** Avoid clashing with engineer “Site Schedules” on the same page. */
  schedulesTitle?: string;
}) {
  return (
    <VStack style={{ gap: 12 }}>
      <SectionCard
        title="Application Details"
        subtitle="Basic information about the site."
        icon={Link2}
        accent="blue"
        badge={badge}
      >
        <InfoRow
          label="E-office number"
          value={app.eOfficeNumber?.trim() || '—'}
          accent="blue"
        />
        <InfoPairRow
          leftLabel="Site no"
          leftValue={app.siteNo || '—'}
          rightLabel="Site type"
          rightValue={siteType}
          accent="blue"
        />
        <InfoPairRow
          leftLabel="Site dimension"
          leftValue={app.siteDimension || '—'}
          rightLabel="Zone"
          rightValue={app.zoneCode || '—'}
          accent="blue"
        />
        <InfoPairRow
          leftLabel="Created by ZC"
          leftValue={app.createdByZcName || '—'}
          rightLabel="Assigned on"
          rightValue={formatSubmittedDateTime(app.createdAt)}
          accent="blue"
        />
      </SectionCard>

      <SectionCard
        title="Address"
        subtitle="Address details of the site."
        icon={MapPin}
        accent="green"
      >
        <InfoRow label="Address line 1" value={app.addressLine1?.trim() || '—'} accent="green" />
        <InfoRow label="Address line 2" value={app.addressLine2?.trim() || '—'} accent="green" />
        <InfoPairRow
          leftLabel="Block"
          leftValue={app.addressBlock?.trim() || '—'}
          rightLabel="City"
          rightValue={app.addressCity?.trim() || '—'}
          accent="green"
        />
        <InfoPairRow
          leftLabel="State"
          leftValue={app.addressState?.trim() || '—'}
          rightLabel="Pincode"
          rightValue={app.addressPincode?.trim() || '—'}
          accent="green"
        />
      </SectionCard>

      <SectionCard
        title={schedulesTitle}
        subtitle="Site schedule information."
        icon={Compass}
        accent="purple"
      >
        <InfoPairRow
          leftLabel="North"
          leftValue={scheduleViewValue(app, 'N')}
          rightLabel="South"
          rightValue={scheduleViewValue(app, 'S')}
          accent="purple"
        />
        <InfoPairRow
          leftLabel="West"
          leftValue={scheduleViewValue(app, 'W')}
          rightLabel="East"
          rightValue={scheduleViewValue(app, 'E')}
          accent="purple"
        />
        {diagram ? <Box style={{ marginTop: 2 }}>{diagram}</Box> : null}
      </SectionCard>

      <SectionCard
        title="Assign engineer"
        subtitle="Engineer assigned to this application."
        icon={UserCheck}
        accent="sky"
      >
        <ReadValue value={app.assignedEngineerName || '—'} accent="sky" />
      </SectionCard>

      {app.siteDimensionComment?.trim() ? (
        <SectionCard
          title="ZC comments"
          subtitle="Notes added for this application."
          icon={Building2}
          accent="blue"
        >
          <ReadValue value={app.siteDimensionComment} accent="blue" />
        </SectionCard>
      ) : null}
    </VStack>
  );
}

/**
 * Shared read-only application body — mirrors web ApplicationRecordDetails.
 */
export function ApplicationRecordDetails({
  app,
  showEmptyEngineer = true,
  viewerRole,
}: {
  app: MobileApplication;
  showEmptyEngineer?: boolean;
  /** When engineer, never show ZC draft badge — use workflow status only. */
  viewerRole?: 'engineer' | 'zc' | 'cao';
}) {
  const { themeId } = useTheme();
  const [preview, setPreview] = useState<{ uri: string; title: string } | null>(null);

  const zcSiteType = app.siteDimensionType || '—';
  const engDims = app.engineerDimensions;
  const measuredType = deriveSiteTypeFromDims(
    app.dimNorth || engDims?.N,
    app.dimSouth || engDims?.S,
    app.dimEast || engDims?.E,
    app.dimWest || engDims?.W,
  );
  const hasGps = Boolean(app.latitude && app.longitude);
  const boundary = resolveBoundaryDims(app);
  const diagramOdd =
    boundary.source === 'engineer'
      ? measuredType === 'Odd' || measuredType === null
      : zcSiteType === 'Odd';

  const photos = (app.photoUrls || []).filter((u) => Boolean(u?.trim()));
  const rawSchedule = app.schedulePhotoUrls || {};
  const schedulePhotos: Record<string, string> = {
    N: rawSchedule.N || rawSchedule.n || '',
    S: rawSchedule.S || rawSchedule.s || '',
    E: rawSchedule.E || rawSchedule.e || '',
    W: rawSchedule.W || rawSchedule.w || '',
  };

  const hasEngineerCapture = Boolean(
    app.engineerSubmittedAt ||
      app.engineerSiteDetails ||
      app.selfieUrl ||
      photos.length > 0 ||
      app.videoUrl ||
      app.dimNorth ||
      app.compass ||
      hasGps ||
      app.engineerScheduleNotes?.N ||
      app.engineerScheduleNotes?.S ||
      app.engineerScheduleNotes?.E ||
      app.engineerScheduleNotes?.W ||
      schedulePhotos.N ||
      schedulePhotos.S ||
      schedulePhotos.E ||
      schedulePhotos.W,
  );

  const geo = app.engineerGeoAddress || null;
  const geoPlace =
    geo?.displayName?.trim() ||
    geo?.village?.trim() ||
    geo?.area?.trim() ||
    '';
  const geoAreaLine = [geo?.area, geo?.block, geo?.district, geo?.state]
    .filter(Boolean)
    .join(' · ');
  const gpsFix = hasGps
    ? {
        latitude: Number(app.latitude),
        longitude: Number(app.longitude),
        accuracy: typeof geo?.accuracy === 'number' ? geo.accuracy : null,
        altitude: null,
        timestamp: 0,
      }
    : null;

  const engNotes = app.engineerScheduleNotes || {};
  const roadFlags = app.scheduleRoadFlags || {};
  const isRoadSide = (k: 'N' | 'S' | 'E' | 'W') =>
    Boolean(roadFlags[k] ?? roadFlags[k.toLowerCase()]);
  /** Engineer diagram labels: engineer notes + Road checkbox only — never ZC text. */
  const diagramSchedule = (k: 'N' | 'S' | 'E' | 'W') => {
    const eng =
      engNotes[k]?.trim() || engNotes[k.toLowerCase()]?.trim() || '';
    const road = isRoadSide(k);
    if (road && eng) return `Road · ${eng}`;
    if (road) return 'Road';
    return eng || null;
  };

  const diagramNode = boundary.dims ? (
    <BoundariesDiagram
      north={boundary.dims.north}
      south={boundary.dims.south}
      east={boundary.dims.east}
      west={boundary.dims.west}
      odd={diagramOdd}
      siteNo={app.siteNo}
      totalArea={boundary.total}
      scheduleNorth={
        boundary.source === 'engineer' ? diagramSchedule('N') : app.scheduleNorth
      }
      scheduleSouth={
        boundary.source === 'engineer' ? diagramSchedule('S') : app.scheduleSouth
      }
      scheduleEast={
        boundary.source === 'engineer' ? diagramSchedule('E') : app.scheduleEast
      }
      scheduleWest={
        boundary.source === 'engineer' ? diagramSchedule('W') : app.scheduleWest
      }
      roadNorth={boundary.source === 'engineer' ? isRoadSide('N') : undefined}
      roadSouth={boundary.source === 'engineer' ? isRoadSide('S') : undefined}
      roadEast={boundary.source === 'engineer' ? isRoadSide('E') : undefined}
      roadWest={boundary.source === 'engineer' ? isRoadSide('W') : undefined}
    />
  ) : null;

  const zcDiagram = boundary.source !== 'engineer' ? diagramNode : null;
  const engineerDiagram = boundary.source === 'engineer' ? diagramNode : null;

  const hasGalleryMedia = Boolean(app.selfieUrl || photos.length > 0);

  const zcCard = (
    <ZcDetailsCard
      app={app}
      siteType={zcSiteType}
      diagram={zcDiagram}
      schedulesTitle={viewerRole === 'engineer' ? 'ZC Site Schedules' : 'Site Schedules'}
      badge={
        viewerRole === 'engineer' ? undefined : (
          <ApplicationStatusBadge status={app.status} size="sm" />
        )
      }
    />
  );

  const engineerStatusBadge =
    viewerRole === 'engineer' ? (
      <StatusChip status={engineerApplicationListStatus(app)} />
    ) : (
      <ApplicationStatusBadge status={app.status} size="sm" />
    );

  const measuredSiteTypeValue = measuredType ? (
    <Box
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 1,
        borderRadius: 6,
        backgroundColor: measuredType === 'Odd' ? '#FEE2E2' : '#DCFCE7',
      }}
    >
      <Text
        style={{
          fontFamily: FONTS.medium,
          fontSize: 14,
          lineHeight: 19,
          color: measuredType === 'Odd' ? '#B91C1C' : '#15803D',
        }}
      >
        {measuredType === 'Odd' ? 'Odd' : measuredType === 'Even' ? 'Even' : measuredType}
      </Text>
    </Box>
  ) : (
    '—'
  );

  if (!showEmptyEngineer && !hasEngineerCapture) {
    return (
      <VStack key={themeId} style={{ gap: 12 }}>
        {zcCard}
        <ImagePreviewModal
          uri={preview?.uri ?? null}
          title={preview?.title}
          onClose={() => setPreview(null)}
        />
      </VStack>
    );
  }

  return (
    <VStack key={themeId} style={{ gap: 12 }}>
      {zcCard}

      <SectionCard
        title="Engineer details"
        subtitle="Submitted by field engineer"
        icon={Ruler}
        accent="sky"
        badge={engineerStatusBadge}
      >
        <InfoPairRow
          leftLabel="Assigned on"
          leftValue={formatSubmittedDateTime(app.createdAt)}
          rightLabel="Submitted on"
          rightValue={formatSubmittedDateTime(app.engineerSubmittedAt)}
          accent="sky"
        />

        {/* Order matches engineer capture: Facing → Schedules → Dimensions → Media */}
        <SectionLabel accent>Compass & GPS</SectionLabel>
        <InfoPairRow
          leftLabel="Compass"
          leftValue={app.compass || '—'}
          rightLabel="Occupancy"
          rightValue={app.occupancy || '—'}
          accent="sky"
        />
        {app.occupancy === 'Occupied' ? (
          <InfoRow label="Occupancy reason" value={app.occupancyReason || '—'} accent="sky" />
        ) : null}
        <InfoRow label="Location" value={geoPlace || '—'} accent="green" />
        {geoAreaLine || geo?.postalCode ? (
          <InfoRow
            label="Area"
            value={[geoAreaLine, geo?.postalCode?.trim()].filter(Boolean).join(' · ') || '—'}
            accent="green"
          />
        ) : null}
        <InfoPairRow
          leftLabel="Latitude"
          leftValue={app.latitude?.trim() || '—'}
          rightLabel="Longitude"
          rightValue={app.longitude?.trim() || '—'}
          last={!hasGps}
          accent="sky"
        />
        {hasGps && gpsFix ? (
          <Box style={{ borderRadius: DESIGN.cardRadius, overflow: 'hidden', marginTop: 6 }}>
            <GpsSiteCard
              height={200}
              variant="inset"
              gps={gpsFix}
              liveMap
              allowMapGestures
              source="captured"
            />
          </Box>
        ) : null}

        <SectionLabel accent>Site Schedules</SectionLabel>
        <EngineerSchedulesReadOnly app={app} />

        {engineerDiagram ? (
          <>
            <SectionLabel accent>Dimensions</SectionLabel>
            <InfoPairRow
              leftLabel="Measured site type"
              leftValue={measuredSiteTypeValue}
              rightLabel="Total area"
              rightValue={app.totalSiteArea ? String(app.totalSiteArea) : boundary.total != null ? String(boundary.total) : '—'}
              emphasisLabels
            />
            <InfoPairRow
              leftLabel="Dim N"
              leftValue={dimViewValue(app, 'N', boundary.dims)}
              rightLabel="Dim S"
              rightValue={dimViewValue(app, 'S', boundary.dims)}
            />
            <InfoPairRow
              leftLabel="Dim E"
              leftValue={dimViewValue(app, 'E', boundary.dims)}
              rightLabel="Dim W"
              rightValue={dimViewValue(app, 'W', boundary.dims)}
              last
            />
            <Box style={{ marginTop: 4 }}>{engineerDiagram}</Box>
          </>
        ) : null}

        {!engineerDiagram && boundary.source === 'engineer' ? (
          <>
            <SectionLabel accent>Dimensions</SectionLabel>
            <InfoPairRow
              leftLabel="Measured site type"
              leftValue={measuredSiteTypeValue}
              rightLabel="Total area"
              rightValue={app.totalSiteArea ? String(app.totalSiteArea) : '—'}
              emphasisLabels
            />
            <InfoPairRow
              leftLabel="Dim N"
              leftValue={app.dimNorth != null && app.dimNorth !== '' ? String(app.dimNorth) : '—'}
              rightLabel="Dim S"
              rightValue={app.dimSouth != null && app.dimSouth !== '' ? String(app.dimSouth) : '—'}
            />
            <InfoPairRow
              leftLabel="Dim E"
              leftValue={app.dimEast != null && app.dimEast !== '' ? String(app.dimEast) : '—'}
              rightLabel="Dim W"
              rightValue={app.dimWest != null && app.dimWest !== '' ? String(app.dimWest) : '—'}
              last
            />
          </>
        ) : null}

        {hasGalleryMedia || app.videoUrl ? (
          <>
            <SectionLabel accent>Photos & Media</SectionLabel>
            <Box
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(26,86,219,0.16)',
                backgroundColor: '#F7FAFF',
                padding: 12,
                marginTop: 4,
                gap: 12,
              }}
            >
              <VStack style={{ gap: 12 }}>
                {app.selfieUrl ? (
                  <Box>
                    <MediaSectionHeading>Selfie</MediaSectionHeading>
                    <HStack className="flex-wrap" style={{ gap: 6 }}>
                      <MediaThumb
                        label="Selfie"
                        showLabel={false}
                        uri={app.selfieUrl}
                        onView={() => setPreview({ uri: app.selfieUrl!, title: 'Selfie' })}
                      />
                    </HStack>
                  </Box>
                ) : null}

                {photos.length > 0 ? (
                  <Box>
                    <MediaSectionHeading>Site photos</MediaSectionHeading>
                    <HStack className="flex-wrap" style={{ gap: 6 }}>
                      {photos.map((url, i) => (
                        <MediaThumb
                          key={`photo-${i}-${url}`}
                          label={`Photo ${i + 1}`}
                          uri={url}
                          onView={() => setPreview({ uri: url, title: `Site photo ${i + 1}` })}
                        />
                      ))}
                    </HStack>
                  </Box>
                ) : null}

                {app.videoUrl ? (
                  <Box>
                    <MediaSectionHeading>Site video</MediaSectionHeading>
                    <Box
                      style={{
                        borderRadius: DESIGN.cardRadius,
                        overflow: 'hidden',
                        aspectRatio: 16 / 9,
                        backgroundColor: COLORS.ink,
                      }}
                    >
                      <SiteVideoPlayer uri={app.videoUrl} />
                    </Box>
                  </Box>
                ) : null}
              </VStack>
            </Box>
          </>
        ) : null}

        {app.engineerComments ? (
          <>
            <SectionLabel accent>Comments</SectionLabel>
            <ReadValue value={app.engineerComments} accent="sky" />
          </>
        ) : null}
      </SectionCard>

      <ImagePreviewModal
        uri={preview?.uri ?? null}
        title={preview?.title}
        onClose={() => setPreview(null)}
      />
    </VStack>
  );
}

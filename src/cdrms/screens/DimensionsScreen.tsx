import { useMemo, useState } from 'react';
import { Platform, TextInput } from 'react-native';
import { Ruler } from 'lucide-react-native';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { BoundariesDiagram } from '@/src/cdrms/components/BoundariesDiagram';
import {
  SurveyScaffold,
  FooterContinueBtn,
  PremiumStepCard,
} from '@/src/cdrms/components/SurveyLayout';
import { deriveSiteTypeFromDims } from '@/src/cdrms/lib/resolveBoundaryDims';
import { useProject } from '@/src/cdrms/project/ProjectContext';
import { alertDraftError } from '@/src/cdrms/project/draft-api';
import { type Cardinal } from '@/src/cdrms/project/types';
import { CARDINAL_ACCENT, COLORS, FONTS, hexAlpha } from '@/src/cdrms/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import type { Go } from '@/src/cdrms/types';

const CARDINALS: Cardinal[] = ['N', 'S', 'E', 'W'];

const BLUE_SOFT = '#EEF4FF';
const BLUE_BORDER = 'rgba(26,86,219,0.22)';
const BLUE_CARD = '#F5F8FF';

const DIM_FIELDS: Array<{
  side: Cardinal;
  label: string;
  key: 'dimNorth' | 'dimSouth' | 'dimEast' | 'dimWest';
}> = [
  { side: 'N', label: 'North', key: 'dimNorth' },
  { side: 'S', label: 'South', key: 'dimSouth' },
  { side: 'E', label: 'East', key: 'dimEast' },
  { side: 'W', label: 'West', key: 'dimWest' },
];

function scheduleLabel(note: string | undefined, isRoad: boolean): string {
  // Engineer plot: only Step-2 notes + Road checkbox — never ZC schedule text.
  const base = (note || '').trim();
  if (isRoad && base) return `Road · ${base}`;
  if (isRoad) return 'Road';
  return base;
}

function PremiumPillBadge({
  label,
  tone = 'blue',
}: {
  label: string;
  tone?: 'blue' | 'green' | 'orange';
}) {
  const styles =
    tone === 'green'
      ? { bg: '#ECFDF5', border: '#A7F3D0', fg: '#047857' }
      : tone === 'orange'
        ? { bg: '#FFF7ED', border: '#FDBA74', fg: '#C2410C' }
        : { bg: BLUE_SOFT, border: BLUE_BORDER, fg: COLORS.primary };
  return (
    <Box
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: styles.bg,
        borderWidth: 1,
        borderColor: styles.border,
      }}
    >
      <Text style={{ fontFamily: FONTS.bold, fontSize: 11, color: styles.fg }}>{label}</Text>
    </Box>
  );
}

function DimSideField({
  side,
  label,
  value,
  onChangeText,
}: {
  side: Cardinal;
  label: string;
  value: string;
  onChangeText: (t: string) => void;
}) {
  const accent = CARDINAL_ACCENT[side];

  return (
    <Box style={{ flex: 1 }}>
      <Box
        style={{
          borderRadius: 16,
          padding: 8,
          backgroundColor: COLORS.white,
          borderWidth: 1.5,
          borderColor: hexAlpha(accent, 0.35),
          shadowColor: COLORS.primaryDeep,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 5,
          elevation: 2,
        }}
      >
        <HStack className="items-center" style={{ gap: 6, marginBottom: 6 }}>
          <Box
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              backgroundColor: accent,
            }}
          />
          <Text
            style={{
              fontFamily: FONTS.bold,
              fontSize: 13,
              color: accent,
              textTransform: 'uppercase',
              letterSpacing: 0.3,
            }}
          >
            {label}
          </Text>
        </HStack>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={side === 'N' || side === 'S' ? 'e.g. 60' : 'e.g. 50'}
          placeholderTextColor="#94A3B8"
          keyboardType="decimal-pad"
          underlineColorAndroid="transparent"
          autoCorrect={false}
          style={{
            height: 36,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: BLUE_BORDER,
            backgroundColor: BLUE_SOFT,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'android' ? 0 : 6,
            fontSize: 14,
            fontFamily: FONTS.semibold,
            color: '#0F172A',
            ...(Platform.OS === 'android'
              ? { textAlignVertical: 'center', includeFontPadding: false }
              : null),
            ...(Platform.OS === 'web'
              ? ({ outlineStyle: 'none', outlineWidth: 0 } as object)
              : null),
          }}
        />
      </Box>
    </Box>
  );
}

/** Step 3 — Dimensions (web parity) for ZC-assigned engineer tasks. */
export function DimensionsScreen({ go }: { go: Go }) {
  const { themeId } = useTheme();
  const { draft, setDimSide, persistBackendStep, reloadBackendDraft } = useProject();
  const isBackendTask = Boolean(draft.backendApplicationId);
  const measuredType = deriveSiteTypeFromDims(
    draft.dimNorth,
    draft.dimSouth,
    draft.dimEast,
    draft.dimWest,
  );
  /** Live plot: Odd (or incomplete) uses irregular sketch; Even only when opposite sides match. */
  const isOdd = measuredType !== 'Even';
  const [stepSaving, setStepSaving] = useState(false);

  const liveSiteDimension = (() => {
    const n = String(draft.dimNorth ?? '').trim();
    const s = String(draft.dimSouth ?? '').trim();
    const e = String(draft.dimEast ?? '').trim();
    const w = String(draft.dimWest ?? '').trim();
    if (!n && !s && !e && !w) return '—';
    if (!isOdd && n && e && n === s && e === w) return `${n}*${e}`;
    if (n && s && e && w) return `${n}*${e}*${s}*${w}`;
    return [n || '—', e || '—', s || '—', w || '—'].join('*');
  })();

  const siteNoLabel = `${draft.siteNo || ''}`.trim() || `${draft.surveyNo || ''}`.trim();

  const dimsReady = [draft.dimNorth, draft.dimSouth, draft.dimEast, draft.dimWest].every(
    (v) => Number(v) > 0,
  );

  const filledCount = [draft.dimNorth, draft.dimSouth, draft.dimEast, draft.dimWest].filter(
    (v) => Number(v) > 0,
  ).length;

  const sketchSubtitle = (() => {
    if (!dimsReady) {
      return siteNoLabel
        ? `Site No ${siteNoLabel} · ${filledCount}/4 sides · plot updates as you type`
        : `${filledCount}/4 sides · plot updates as you type`;
    }
    if (siteNoLabel) return `Site No ${siteNoLabel} · ${liveSiteDimension}`;
    return `Plot dimensions: ${liveSiteDimension}`;
  })();

  const schedulesAround = useMemo(() => {
    const out: Record<Cardinal, string> = { N: '', S: '', E: '', W: '' };
    for (const k of CARDINALS) {
      out[k] = scheduleLabel(draft.directions[k], Boolean(draft.roadFlags?.[k]));
    }
    return out;
  }, [draft.directions, draft.roadFlags]);

  if (!isBackendTask) {
    return (
      <SurveyScaffold
        key={themeId}
        title="Dimensions"
        subtitle=""
        onBack={() => go('bandi')}
        step={3}
        total={4}
        go={go}
      >
        <Text className="px-4 py-8 text-center text-slate-500">
          Dimensions step is for assigned ZC tasks.
        </Text>
      </SurveyScaffold>
    );
  }

  const typeTone =
    measuredType === 'Even' ? 'green' : measuredType === 'Odd' ? 'orange' : 'blue';
  const typeLabel =
    !measuredType ? 'Enter dims' : measuredType === 'Odd' ? 'Odd' : 'Even';

  return (
    <SurveyScaffold
      key={themeId}
      title="Site Dimension Sketch"
      subtitle="N / S / E / W · live plot updates"
      surface="premium"
      onBack={() => {
        go('bandi', { replace: true });
        void reloadBackendDraft().catch(() => undefined);
      }}
      onStepNav={() => {
        void reloadBackendDraft().catch(() => undefined);
      }}
      step={3}
      total={4}
      badge={liveSiteDimension !== '—' ? liveSiteDimension : undefined}
      footer={
        <FooterContinueBtn
          disabled={!dimsReady || stepSaving}
          loading={stepSaving}
          label={dimsReady ? 'Continue' : 'Enter all 4 dimensions'}
          onPress={() => {
            void (async () => {
              setStepSaving(true);
              try {
                await persistBackendStep('dimensions');
                go('photos');
              } catch (err) {
                alertDraftError(err);
              } finally {
                setStepSaving(false);
              }
            })();
          }}
        />
      }
      go={go}
    >
      <PremiumStepCard
        icon={Ruler}
        title="Site Dimension Sketch *"
        subtitle={sketchSubtitle}
        badge={<PremiumPillBadge label={typeLabel} tone={typeTone} />}
      >
        <VStack style={{ gap: 8 }}>
          <HStack style={{ gap: 8 }}>
            {DIM_FIELDS.filter(({ side }) => side === 'N' || side === 'S').map(
              ({ side, label, key }) => (
                <DimSideField
                  key={side}
                  side={side}
                  label={label}
                  value={String(draft[key] ?? '')}
                  onChangeText={(t) => setDimSide(side, t)}
                />
              ),
            )}
          </HStack>
          <HStack style={{ gap: 8 }}>
            {DIM_FIELDS.filter(({ side }) => side === 'E' || side === 'W').map(
              ({ side, label, key }) => (
                <DimSideField
                  key={side}
                  side={side}
                  label={label}
                  value={String(draft[key] ?? '')}
                  onChangeText={(t) => setDimSide(side, t)}
                />
              ),
            )}
          </HStack>

          <Box
            style={{
              borderRadius: 14,
              overflow: 'hidden',
              backgroundColor: BLUE_CARD,
              borderWidth: 1,
              borderColor: BLUE_BORDER,
            }}
          >
            <BoundariesDiagram
              embedded
              north={Number(draft.dimNorth) || 0}
              south={Number(draft.dimSouth) || 0}
              east={Number(draft.dimEast) || 0}
              west={Number(draft.dimWest) || 0}
              odd={isOdd}
              siteNo={siteNoLabel || null}
              scheduleNorth={schedulesAround.N || null}
              scheduleSouth={schedulesAround.S || null}
              scheduleEast={schedulesAround.E || null}
              scheduleWest={schedulesAround.W || null}
              roadNorth={Boolean(draft.roadFlags?.N)}
              roadSouth={Boolean(draft.roadFlags?.S)}
              roadEast={Boolean(draft.roadFlags?.E)}
              roadWest={Boolean(draft.roadFlags?.W)}
            />
          </Box>
        </VStack>
      </PremiumStepCard>
    </SurveyScaffold>
  );
}

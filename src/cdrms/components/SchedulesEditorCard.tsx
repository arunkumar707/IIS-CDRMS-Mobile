import { Camera, Check, MapPinned, X } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, TextInput } from 'react-native';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { ImagePreviewModal } from '@/src/cdrms/components/ImagePreviewModal';
import { ApiMediaImage } from '@/src/cdrms/components/ApiMediaImage';
import { captureSitePhoto } from '@/src/cdrms/hooks/useMediaCapture';
import { useProject } from '@/src/cdrms/project/ProjectContext';
import { showAppDialog } from '@/src/cdrms/components/AppDialog';
import { alertDraftError } from '@/src/cdrms/project/draft-api';
import { DIRECTION_META, type Cardinal } from '@/src/cdrms/project/types';
import { PremiumStepCard } from '@/src/cdrms/components/SurveyLayout';
import { ButtonLoader } from '@/src/cdrms/components/loaders';
import { CARDINAL_ACCENT, COLORS, FONTS, DESIGN, hexAlpha } from '@/src/cdrms/theme';

const BLUE_SOFT = '#EEF4FF';
const BLUE_BORDER = 'rgba(26,86,219,0.22)';

const CARDINALS: Cardinal[] = ['N', 'S', 'E', 'W'];

/**
 * Engineer schedules — premium glass card with per-direction accent lines.
 */
export function SchedulesEditorCard() {
  const { draft, setDirection, setRoadFlag, setSurroundingPhoto, clearSurroundingPhoto } =
    useProject();
  const [clearing, setClearing] = useState<Cardinal | null>(null);
  const [uploadingSide, setUploadingSide] = useState<Cardinal | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('Photo preview');

  const pickForSide = (k: Cardinal) => {
    void (async () => {
      if (uploadingSide) return;
      setUploadingSide(k);
      try {
        const asset = await captureSitePhoto({
          title: `Take ${DIRECTION_META[k].label} photo`,
        });
        if (asset) await setSurroundingPhoto(k, asset);
      } catch (err) {
        alertDraftError(err);
      } finally {
        setUploadingSide(null);
      }
    })();
  };

  const removePhoto = (k: Cardinal) => {
    showAppDialog({
      variant: 'error',
      title: `Remove ${DIRECTION_META[k].label} photo?`,
      message: 'This clears the uploaded image.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Remove',
      onConfirm: () => {
        void (async () => {
          setClearing(k);
          try {
            await clearSurroundingPhoto(k);
          } catch (err) {
            alertDraftError(err);
          } finally {
            setClearing(null);
          }
        })();
      },
    });
  };

  const photoCount = CARDINALS.filter((k) => Boolean(draft.surroundingPhotos[k])).length;

  return (
    <PremiumStepCard
      title="Site Schedules *"
      subtitle="Check the box if road exists and upload image"
      icon={MapPinned}
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
            {photoCount}/4
          </Text>
        </Box>
      }
    >
      <VStack style={{ gap: 8 }}>
        {CARDINALS.map((k) => {
          const accent = CARDINAL_ACCENT[k];
          const isRoad = Boolean(draft.roadFlags?.[k]);
          const note = draft.directions[k] || '';
          const photo = draft.surroundingPhotos[k];
          const isClearing = clearing === k;

          return (
            <Box
              key={`eng-sched-${k}`}
              style={{
                borderRadius: 16,
                padding: 8,
                backgroundColor: COLORS.white,
                borderWidth: 1.5,
                borderColor: hexAlpha(accent, 0.35),
                opacity: isClearing ? 0.55 : 1,
                shadowColor: COLORS.primaryDeep,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 5,
                elevation: 2,
              }}
            >
              <HStack className="items-center" style={{ gap: 8, minHeight: 40 }}>
                <Box style={{ width: 40, justifyContent: 'center', flexShrink: 0 }}>
                  <HStack className="items-center" style={{ gap: 4, marginBottom: 2 }}>
                    <Box
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        backgroundColor: accent,
                      }}
                    />
                    <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: accent }}>
                      {DIRECTION_META[k].label}
                    </Text>
                  </HStack>
                </Box>

                <Pressable
                  onPress={() => setRoadFlag(k, !isRoad)}
                  className="active:opacity-80 shrink-0"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    height: 30,
                    paddingHorizontal: 8,
                    borderRadius: 999,
                    backgroundColor: isRoad ? BLUE_SOFT : COLORS.white,
                    borderWidth: 1,
                    borderColor: isRoad ? accent : BLUE_BORDER,
                  }}
                >
                  <Box
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      borderWidth: 1.5,
                      borderColor: isRoad ? accent : COLORS.ink,
                      backgroundColor: isRoad ? accent : COLORS.white,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isRoad ? <Check size={9} color="#FFFFFF" strokeWidth={3} /> : null}
                  </Box>
                  <Text
                    style={{
                      fontFamily: FONTS.bold,
                      fontSize: 11,
                      color: isRoad ? accent : COLORS.ink,
                    }}
                  >
                    Road
                  </Text>
                </Pressable>

                <TextInput
                  value={note}
                  onChangeText={(t) => setDirection(k, t)}
                  placeholder={isRoad ? 'Width (eg:30ft)' : `${DIRECTION_META[k].label} by`}
                  placeholderTextColor="#94A3B8"
                  underlineColorAndroid="transparent"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    minWidth: 88,
                    height: 32,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: BLUE_BORDER,
                    backgroundColor: BLUE_SOFT,
                    paddingHorizontal: 8,
                    paddingVertical: Platform.OS === 'android' ? 0 : 5,
                    fontSize: 11,
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

                <Box style={{ position: 'relative', marginLeft: 'auto', flexShrink: 0 }}>
                  <Pressable
                    onPress={() => {
                      if (photo) {
                        setPreviewTitle(`${DIRECTION_META[k].label} photo`);
                        setPreviewUri(photo.uri);
                        return;
                      }
                      pickForSide(k);
                    }}
                    onLongPress={() => {
                      if (photo) pickForSide(k);
                    }}
                    disabled={isClearing || uploadingSide === k}
                    className="active:opacity-85 overflow-hidden"
                    style={{
                      width: 48,
                      height: 36,
                      borderRadius: 12,
                      backgroundColor: COLORS.white,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: photo ? accent : BLUE_BORDER,
                    }}
                    accessibilityLabel={
                      photo
                        ? `Preview ${DIRECTION_META[k].label} photo`
                        : `Upload ${DIRECTION_META[k].label} photo`
                    }
                  >
                    {uploadingSide === k || clearing === k ? (
                      <ButtonLoader size="small" color={accent} />
                    ) : photo ? (
                      <Box className="w-full h-full relative">
                        <ApiMediaImage
                          uri={photo.uri}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                        <Box
                          className="absolute"
                          style={{
                            right: 2,
                            bottom: 2,
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: COLORS.success,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={8} color="#fff" strokeWidth={3} />
                        </Box>
                      </Box>
                    ) : (
                      <Camera size={18} color={accent} />
                    )}
                  </Pressable>
                  {photo && clearing !== k ? (
                    <Pressable
                      onPress={() => removePhoto(k)}
                      disabled={isClearing}
                      hitSlop={8}
                      className="active:opacity-85"
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 20,
                        height: 20,
                        borderRadius: DESIGN.stepRadius,
                        backgroundColor: '#DC2626',
                        borderWidth: 1.5,
                        borderColor: '#FFFFFF',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                      }}
                      accessibilityLabel={`Remove ${DIRECTION_META[k].label} photo`}
                    >
                      <X size={11} color="#FFFFFF" strokeWidth={3} />
                    </Pressable>
                  ) : null}
                </Box>
              </HStack>
            </Box>
          );
        })}
      </VStack>

      <ImagePreviewModal
        uri={previewUri}
        title={previewTitle}
        onClose={() => setPreviewUri(null)}
      />
    </PremiumStepCard>
  );
}

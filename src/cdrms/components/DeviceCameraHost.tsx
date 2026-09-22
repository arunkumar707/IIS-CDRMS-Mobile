import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Camera,
  FlipHorizontal,
  Circle,
  Film,
  Image as ImageIcon,
  Square,
  Video,
  X,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import {
  closeDeviceCamera,
  getPendingCameraCapture,
  isSimulatorVideoBlocked,
  markSimulatorVideoBlocked,
  subscribeCameraCapture,
  type CameraCaptureRequest,
  type CameraFacing,
} from '@/src/cdrms/camera/cameraCaptureGate';
import { showAppDialog } from '@/src/cdrms/components/AppDialog';
import { WebLiveVideoPreview } from '@/src/cdrms/components/WebLiveVideoPreview';
import type { WebLiveVideoHandle } from '@/src/cdrms/components/WebLiveVideoPreview.types';
import {
  ensureCameraPermission,
  ensureMicrophonePermission,
} from '@/src/cdrms/mediaPermission';
import type { MediaAsset } from '@/src/cdrms/project/types';

function isSimulatorRecordError(message: string) {
  return /not supported on the simulator/i.test(message);
}

function toAsset(
  uri: string,
  type: 'image' | 'video',
  extra?: { width?: number; height?: number; durationMs?: number | null }
): MediaAsset {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    uri,
    type,
    width: extra?.width ?? 0,
    height: extra?.height ?? 0,
    durationMs: extra?.durationMs ?? null,
    createdAt: Date.now(),
  };
}

function isAndroidEmulator() {
  if (Platform.OS !== 'android') return false;
  const c = Platform.constants as { Brand?: string; Model?: string; Fingerprint?: string };
  return /sdk|emulator|gphone|generic/i.test(
    `${c.Brand ?? ''} ${c.Model ?? ''} ${c.Fingerprint ?? ''}`
  );
}

function liveRecordAllowed() {
  if (isSimulatorVideoBlocked()) return false;
  return true;
}

export function DeviceCameraHost() {
  const [request, setRequest] = useState<CameraCaptureRequest | null>(
    getPendingCameraCapture()
  );

  useEffect(() => {
    return subscribeCameraCapture(() => setRequest(getPendingCameraCapture()));
  }, []);

  if (!request) return null;
  return (
    <DeviceCameraModal
      key={`${request.mode}-${request.title}-${request.facing}`}
      request={request}
    />
  );
}

function DeviceCameraModal({ request }: { request: CameraCaptureRequest }) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const webVideoRef = useRef<WebLiveVideoHandle>(null);
  const isWebCamera = Platform.OS === 'web';
  const isWebVideo = isWebCamera && request.mode === 'video';
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraFacing>(
    liveRecordAllowed() ? request.facing : 'back'
  );
  const facingLocked = request.lockFacing === true;
  const activeFacing: CameraFacing = facingLocked ? request.facing : facing;
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mountKey, setMountKey] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [webPreviewReady, setWebPreviewReady] = useState(false);
  const [canLiveRecord, setCanLiveRecord] = useState(liveRecordAllowed);
  const startedAt = useRef<number | null>(null);
  const autoStopLock = useRef(false);

  const videoNeedsPickerOnly = request.mode === 'video' && !canLiveRecord;

  useEffect(() => {
    const t = setTimeout(() => setShowCamera(!videoNeedsPickerOnly), 350);
    return () => clearTimeout(t);
  }, [videoNeedsPickerOnly]);

  useEffect(() => {
    setWebPreviewReady(false);
  }, [mountKey, activeFacing]);

  useEffect(() => {
    if (isWebCamera) return;
    void (async () => {
      if (!cameraPermission?.granted) {
        await ensureCameraPermission(true);
        await requestCameraPermission();
      }
      if (request.mode === 'video' && !micPermission?.granted) {
        await ensureMicrophonePermission(true);
        await requestMicPermission();
      }
    })();
  }, [
    isWebCamera,
    cameraPermission,
    micPermission,
    request.mode,
    requestCameraPermission,
    requestMicPermission,
  ]);

  useEffect(() => {
    if (!recording) {
      setElapsed(0);
      startedAt.current = null;
      return;
    }
    startedAt.current = Date.now();
    const id = setInterval(() => {
      if (startedAt.current) {
        setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      }
    }, 250);
    return () => clearInterval(id);
  }, [recording]);

  useEffect(() => {
    if (!recording || autoStopLock.current) return;
    const max = request.maxDurationSec ?? 120;
    if (elapsed < max) return;
    autoStopLock.current = true;
    if (isWebVideo) {
      void (async () => {
        setBusy(true);
        try {
          const video = await webVideoRef.current?.stopRecording();
          setRecording(false);
          if (!video?.uri) return;
          const durationMs = startedAt.current
            ? Date.now() - startedAt.current
            : elapsed * 1000;
          closeDeviceCamera(
            toAsset(video.uri, 'video', {
              durationMs: durationMs > 0 ? durationMs : null,
            })
          );
        } catch {
          setRecording(false);
        } finally {
          setBusy(false);
          autoStopLock.current = false;
        }
      })();
      return;
    }
    try {
      cameraRef.current?.stopRecording();
    } catch {
      autoStopLock.current = false;
    }
  }, [elapsed, recording, request.maxDurationSec, isWebVideo]);

  const cancel = () => {
    if (isWebCamera) {
      try {
        webVideoRef.current?.abort();
      } catch {
        // ignore
      }
    } else if (recording) {
      try {
        cameraRef.current?.stopRecording();
      } catch {
        // ignore
      }
    }
    closeDeviceCamera(null);
  };

  const flip = () => {
    if (facingLocked || recording || busy) return;
    setFacing((f) => (f === 'front' ? 'back' : 'front'));
    setMountKey((k) => k + 1);
  };

  const resolveFromLibrary = async () => {
    setBusy(true);
    try {
      if (request.mode === 'photo') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.75,
          allowsMultipleSelection: false,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        const a = result.assets[0];
        closeDeviceCamera(
          toAsset(a.uri, 'image', { width: a.width, height: a.height })
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: false,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const a = result.assets[0];
      const durationMs =
        typeof a.duration === 'number' && a.duration > 0
          ? a.duration < 1000
            ? Math.round(a.duration * 1000)
            : Math.round(a.duration)
          : null;
      closeDeviceCamera(toAsset(a.uri, 'video', { durationMs }));
    } catch (e) {
      showAppDialog({
        variant: 'error',
        title: 'Library',
        message: e instanceof Error ? e.message : 'Could not open photo library',
        hideCancel: true,
        confirmLabel: 'OK',
      });
    } finally {
      setBusy(false);
    }
  };

  const resolveFromFiles = async () => {
    if (request.mode !== 'video') return;
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      closeDeviceCamera(toAsset(result.assets[0].uri, 'video'));
    } catch (e) {
      showAppDialog({
        variant: 'error',
        title: 'Files',
        message: e instanceof Error ? e.message : 'Could not open file picker',
        hideCancel: true,
        confirmLabel: 'OK',
      });
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    if (busy) return;
    const cameraFacing = activeFacing;

    if (isWebCamera) {
      setBusy(true);
      try {
        const still = webVideoRef.current?.captureStill();
        if (!still?.uri) {
          showAppDialog({
            variant: 'error',
            title: 'Camera',
            message: 'Camera is not ready. Wait a moment and try again.',
            hideCancel: true,
            confirmLabel: 'OK',
          });
          return;
        }
        closeDeviceCamera(
          toAsset(still.uri, 'image', { width: still.width, height: still.height }),
        );
      } catch (e) {
        showAppDialog({
          variant: 'error',
          title: 'Camera',
          message: e instanceof Error ? e.message : 'Could not take photo',
          hideCancel: true,
          confirmLabel: 'OK',
        });
      } finally {
        setBusy(false);
      }
      return;
    }

    if (isAndroidEmulator()) {
      setBusy(true);
      try {
        const result = await ImagePicker.launchCameraAsync({
          cameraType:
            cameraFacing === 'front'
              ? ImagePicker.CameraType.front
              : ImagePicker.CameraType.back,
          quality: 0.75,
          allowsEditing: false,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        const a = result.assets[0];
        closeDeviceCamera(
          toAsset(a.uri, 'image', { width: a.width, height: a.height })
        );
        return;
      } catch {
        if (!facingLocked) await resolveFromLibrary();
        return;
      } finally {
        setBusy(false);
      }
    }

    if (!cameraRef.current) {
      if (!facingLocked) await resolveFromLibrary();
      return;
    }
    setBusy(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.75,
        shutterSound: false,
      });
      if (!picture?.uri) {
        if (!facingLocked) await resolveFromLibrary();
        return;
      }
      closeDeviceCamera(
        toAsset(picture.uri, 'image', {
          width: picture.width,
          height: picture.height,
        })
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (isSimulatorRecordError(message) || /simulator|camera/i.test(message)) {
        if (!facingLocked) await resolveFromLibrary();
        return;
      }
      if (facingLocked) {
        showAppDialog({
          variant: 'error',
          title: 'Camera',
          message: message || 'Could not take photo',
          hideCancel: true,
          confirmLabel: 'OK',
        });
      } else {
        showAppDialog({
          variant: 'error',
          title: 'Camera',
          message: message || 'Could not take photo',
          cancelLabel: 'Cancel',
          confirmLabel: 'Use Gallery',
          onConfirm: () => void resolveFromLibrary(),
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const finishWebRecording = async () => {
    setBusy(true);
    try {
      const video = await webVideoRef.current?.stopRecording();
      setRecording(false);
      if (!video?.uri) {
        showAppDialog({
          variant: 'error',
          title: 'Video',
          message: 'Recording did not produce a file. Tap Record and try again.',
          hideCancel: true,
          confirmLabel: 'OK',
        });
        return;
      }
      const durationMs = startedAt.current
        ? Date.now() - startedAt.current
        : elapsed * 1000;
      closeDeviceCamera(
        toAsset(video.uri, 'video', {
          durationMs: durationMs > 0 ? durationMs : null,
        })
      );
    } catch (e) {
      setRecording(false);
      showAppDialog({
        variant: 'error',
        title: 'Video',
        message:
          e instanceof Error
            ? e.message
            : 'Recording did not produce a file. Tap Record and try again.',
        hideCancel: true,
        confirmLabel: 'OK',
      });
    } finally {
      setBusy(false);
      autoStopLock.current = false;
    }
  };

  const toggleRecord = async () => {
    if (!canLiveRecord) {
      showAppDialog({
        variant: 'error',
        title: 'Video',
        message:
          'Live video recording is not available on this device. Use a real phone with Camera + Microphone enabled.',
        hideCancel: true,
        confirmLabel: 'OK',
      });
      return;
    }
    if (busy && !recording) return;

    if (isWebVideo) {
      if (recording) {
        await finishWebRecording();
        return;
      }
      if (!webPreviewReady || !webVideoRef.current) {
        showAppDialog({
          variant: 'error',
          title: 'Video',
          message: 'Camera is not ready. Wait a moment and tap Record again.',
          hideCancel: true,
          confirmLabel: 'OK',
        });
        return;
      }
      setBusy(true);
      setRecording(true);
      try {
        webVideoRef.current.startRecording();
      } catch (e) {
        setRecording(false);
        showAppDialog({
          variant: 'error',
          title: 'Video',
          message:
            e instanceof Error
              ? e.message
              : 'Could not start recording. Allow Camera + Microphone and try again.',
          hideCancel: true,
          confirmLabel: 'OK',
        });
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!cameraRef.current) {
      showAppDialog({
        variant: 'error',
        title: 'Video',
        message: 'Camera is not ready. Wait a moment and tap Record again.',
        hideCancel: true,
        confirmLabel: 'OK',
      });
      return;
    }

    if (recording) {
      setBusy(true);
      try {
        cameraRef.current.stopRecording();
      } catch {
        setRecording(false);
        setBusy(false);
      }
      return;
    }

    if (!micPermission?.granted) {
      const micOk = await ensureMicrophonePermission(false);
      if (!micOk) return;
    }

    setBusy(true);
    setRecording(true);
    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: request.maxDurationSec ?? 120,
      });
      setRecording(false);
      if (!video?.uri) {
        showAppDialog({
          variant: 'error',
          title: 'Video',
          message: 'Recording did not produce a file. Tap Record and try again.',
          hideCancel: true,
          confirmLabel: 'OK',
        });
        return;
      }
      const durationMs = startedAt.current
        ? Date.now() - startedAt.current
        : elapsed * 1000;
      closeDeviceCamera(
        toAsset(video.uri, 'video', {
          durationMs: durationMs > 0 ? durationMs : null,
        })
      );
    } catch (e) {
      setRecording(false);
      const message = e instanceof Error ? e.message : String(e);
      if (isSimulatorRecordError(message)) {
        markSimulatorVideoBlocked();
        setCanLiveRecord(false);
        return;
      }
      showAppDialog({
        variant: 'error',
        title: 'Video',
        message:
          message ||
          'Video recording failed. Tap Record again. Gallery / file upload is not allowed — live recording is mandatory.',
        hideCancel: true,
        confirmLabel: 'OK',
      });
    } finally {
      setBusy(false);
    }
  };

  const permissionDenied =
    cameraPermission && !cameraPermission.granted && !cameraPermission.canAskAgain;

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  // Video on Simulator: skip black camera UI, go straight to pickers.
  if (videoNeedsPickerOnly) {
    return (
      <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={cancel}>
        <View style={[styles.root, { paddingTop: insets.top + 12, backgroundColor: '#0F172A' }]}>
          <HStack className="items-center justify-between px-4 mb-6">
            <Pressable
              onPress={cancel}
              className="h-11 w-11 rounded-full items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
            >
              <X size={20} color="#fff" />
            </Pressable>
            <Text className="text-white font-extrabold text-base">Add inspection video</Text>
            <Box style={{ width: 44 }} />
          </HStack>

          <VStack className="flex-1 px-5" style={{ gap: 14 }}>
            <Box
              className="rounded-3xl px-4 py-4"
              style={{ backgroundColor: 'rgba(29,78,216,0.2)', borderWidth: 1, borderColor: '#3B82F6' }}
            >
              <Text className="text-white font-extrabold text-sm">Simulator limitation</Text>
              <Text className="text-white/75 text-[12px] mt-1.5 leading-5">
                iOS Simulator cannot record live video. Pick a video from Gallery or Files.
                Live recording works on a real iPhone.
              </Text>
            </Box>

            <Pressable
              onPress={() => void resolveFromLibrary()}
              disabled={busy}
              className="rounded-3xl overflow-hidden active:opacity-90"
              style={{ height: 120 }}
            >
              <LinearGradient
                colors={['#1D4ED8', '#3B82F6']}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  gap: 14,
                }}
              >
                <Box
                  className="items-center justify-center rounded-2xl"
                  style={{ width: 52, height: 52, backgroundColor: 'rgba(255,255,255,0.2)' }}
                >
                  <ImageIcon size={24} color="#fff" />
                </Box>
                <VStack className="flex-1">
                  <Text className="text-white font-extrabold text-[16px]">Photo library</Text>
                  <Text className="text-white/80 text-[12px] mt-0.5">
                    Choose an existing video
                  </Text>
                </VStack>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => void resolveFromFiles()}
              disabled={busy}
              className="rounded-3xl flex-row items-center px-5 active:opacity-90"
              style={{
                height: 120,
                backgroundColor: '#1E293B',
                borderWidth: 1,
                borderColor: '#334155',
                gap: 14,
              }}
            >
              <Box
                className="items-center justify-center rounded-2xl"
                style={{ width: 52, height: 52, backgroundColor: '#334155' }}
              >
                <Film size={24} color="#93C5FD" />
              </Box>
              <VStack className="flex-1">
                <Text className="text-white font-extrabold text-[16px]">Device files</Text>
                <Text className="text-white/60 text-[12px] mt-0.5">
                  Pick from Files / Downloads
                </Text>
              </VStack>
            </Pressable>
          </VStack>

          <Text
            className="text-center text-white/45 text-[11px] px-6"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
          >
            Drag a .mp4 into Simulator first if your library is empty
          </Text>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={cancel}>
      <View style={styles.root}>
        {(isWebCamera || cameraPermission?.granted) && showCamera ? (
          isWebCamera ? (
            <WebLiveVideoPreview
              key={`web-cam-${mountKey}-${activeFacing}`}
              ref={webVideoRef}
              facing={activeFacing}
              audio={request.mode === 'video'}
              onReady={() => setWebPreviewReady(true)}
              onError={(message) => {
                setWebPreviewReady(false);
                showAppDialog({
                  variant: 'error',
                  title: 'Camera unavailable',
                  message,
                  hideCancel: true,
                  confirmLabel: 'OK',
                });
              }}
            />
          ) : (
          <CameraView
            key={`cam-${mountKey}-${activeFacing}-${request.mode}`}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={activeFacing}
            mode={request.mode === 'video' ? 'video' : 'picture'}
            mute={false}
            active
            animateShutter={false}
            onCameraReady={() => {
              // ready
            }}
            onMountError={(err) => {
              if (request.mode === 'video' && isSimulatorRecordError(err.message)) {
                markSimulatorVideoBlocked();
                setCanLiveRecord(false);
                return;
              }
              if (facingLocked) {
                showAppDialog({
                  variant: 'error',
                  title: 'Camera unavailable',
                  message: `${err.message || `Could not start ${request.facing === 'front' ? 'front' : 'rear'} camera.`}\n\nAllow Camera in Settings and try again.`,
                  hideCancel: true,
                  confirmLabel: 'OK',
                });
              } else {
                showAppDialog({
                  variant: 'error',
                  title: 'Camera unavailable',
                  message: `${err.message || 'Could not start camera.'}\n\nOn Simulator: I/O → Camera → select your MacBook camera, then try again. Or use Gallery.`,
                  cancelLabel: 'Cancel',
                  confirmLabel: 'Use Gallery',
                  onConfirm: () => void resolveFromLibrary(),
                });
              }
            }}
          />
          )
        ) : (
          <Box
            className="flex-1 items-center justify-center px-8"
            style={{ backgroundColor: '#0F172A' }}
          >
            <Camera size={40} color="#94A3B8" />
            <Text className="text-white font-extrabold text-base mt-4 text-center">
              {!isWebCamera && !cameraPermission?.granted
                ? 'Camera permission required'
                : 'Starting camera…'}
            </Text>
            <Text className="text-white/65 text-xs mt-2 text-center px-4">
              {isWebCamera
                ? 'Allow Camera when the browser asks, then wait for the preview.'
                : 'Grant permission when asked. On Simulator also set I/O → Camera → MacBook camera.'}
            </Text>
            {!isWebCamera && !cameraPermission?.granted ? (
              <Pressable
                onPress={() =>
                  void (async () => {
                    const ok = await ensureCameraPermission(true);
                    if (!ok || permissionDenied) {
                      showAppDialog({
                        variant: 'warning',
                        title: 'Enable Camera',
                        message:
                          'Open Settings → CDRMS → turn on Camera (and Microphone for video).',
                        cancelLabel: 'Cancel',
                        confirmLabel: 'Open Settings',
                        onConfirm: () => void Linking.openSettings(),
                      });
                      return;
                    }
                    await requestCameraPermission();
                  })()
                }
                className="mt-6 h-12 px-6 rounded-2xl items-center justify-center"
                style={{ backgroundColor: '#1D4ED8' }}
              >
                <Text className="text-white font-extrabold">
                  {permissionDenied ? 'Open Settings' : 'Allow camera'}
                </Text>
              </Pressable>
            ) : null}
            {permissionDenied ? (
              <Text className="text-white/50 text-xs mt-3 text-center">
                Enable Camera (and Microphone for video) in Settings → CDRMS.
              </Text>
            ) : null}
          </Box>
        )}

        <LinearGradient
          colors={['rgba(15,23,42,0.85)', 'transparent']}
          style={[styles.topFade, { paddingTop: insets.top + 8 }]}
        >
          <HStack className="items-center justify-between px-4">
            <Pressable
              onPress={cancel}
              className="h-11 w-11 rounded-full items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
            >
              <X size={20} color="#fff" strokeWidth={2.4} />
            </Pressable>
            <VStack className="items-center flex-1 px-3">
              <Text className="text-white font-extrabold text-sm">{request.title}</Text>
              <Text className="text-white/75 text-[10px] mt-0.5 text-center">
                {facingLocked
                  ? request.facing === 'front'
                    ? 'Front camera only'
                    : 'Rear camera only · Live record required'
                  : `${facing === 'front' ? 'Front camera' : 'Rear camera'}`}
              </Text>
            </VStack>
            {facingLocked ? (
              <Box style={{ width: 44 }} />
            ) : (
              <Pressable
                onPress={flip}
                disabled={recording || busy}
                className="h-11 w-11 rounded-full items-center justify-center"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  opacity: recording || busy ? 0.4 : 1,
                }}
              >
                <FlipHorizontal size={18} color="#fff" strokeWidth={2.3} />
              </Pressable>
            )}
          </HStack>
          {recording ? (
            <HStack className="items-center justify-center gap-2 mt-3">
              <Box
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: '#EF4444',
                }}
              />
              <Text className="text-white font-bold text-sm tabular-nums">
                REC {mm}:{ss}
              </Text>
            </HStack>
          ) : null}
        </LinearGradient>

        <LinearGradient
          colors={['transparent', 'rgba(15,23,42,0.92)']}
          style={[styles.bottomFade, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
        >
          <HStack className="justify-center px-5 mb-4" style={{ gap: 10 }}>
            {/* Photos may use gallery when facing is not locked. Video = live record only. */}
            {request.mode === 'photo' && !facingLocked ? (
              <Pressable
                onPress={() => void resolveFromLibrary()}
                disabled={busy || recording}
                className="flex-row items-center gap-2 px-3.5 h-10 rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}
              >
                <ImageIcon size={15} color="#fff" />
                <Text className="text-white text-[12px] font-bold">Gallery</Text>
              </Pressable>
            ) : null}
          </HStack>

          <HStack className="items-center justify-center px-8" style={{ gap: 28 }}>
            <Box style={{ width: 44 }} />
            {request.mode === 'photo' ? (
              <Pressable
                onPress={() => void takePhoto()}
                disabled={busy || (isWebCamera && !webPreviewReady)}
                className="items-center justify-center"
                style={{
                  width: 78,
                  height: 78,
                  borderRadius: 999,
                  borderWidth: 4,
                  borderColor: '#fff',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <Box
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 999,
                    backgroundColor: '#fff',
                  }}
                />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => void toggleRecord()}
                disabled={busy && !recording}
                className="items-center justify-center"
                style={{
                  width: 78,
                  height: 78,
                  borderRadius: 999,
                  borderWidth: 4,
                  borderColor: '#fff',
                  backgroundColor: recording ? '#FEE2E2' : 'transparent',
                }}
              >
                {recording ? (
                  <Square size={28} color="#DC2626" fill="#DC2626" />
                ) : (
                  <Circle size={54} color="#EF4444" fill="#EF4444" />
                )}
              </Pressable>
            )}
            <Box className="items-center justify-center" style={{ width: 44 }}>
              {request.mode === 'video' ? (
                <Video size={22} color="rgba(255,255,255,0.85)" />
              ) : (
                <Camera size={22} color="rgba(255,255,255,0.85)" />
              )}
            </Box>
          </HStack>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  topFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingBottom: 24,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 36,
  },
});

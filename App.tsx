import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { RootNavigator } from '@/src/navigation/RootNavigator';
import { AuthProvider } from '@/src/auth/AuthContext';
import { DeviceCameraHost } from '@/src/cdrms/components/DeviceCameraHost';
import { PdfDownloadBannerHost } from '@/src/cdrms/components/PdfDownloadBannerHost';
import { initPdfDownloadNotifications } from '@/src/cdrms/lib/pdfDownloadNotification';
import { useCdrmsFonts } from '@/src/cdrms/fonts';
import { COLORS } from '@/src/cdrms/theme';
import { ThemeProvider } from '@/src/theme/ThemeContext';
import '@/global.css';
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Platform, View, type ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaListener,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';

const WEB_PHONE_MAX_WIDTH = 430;

const webOuterStyle: ViewStyle = {
  flex: 1,
  width: '100%',
  height: '100%',
  backgroundColor: '#E8EEF5',
};

const webInnerStyle: ViewStyle = {
  width: '100%',
  maxWidth: WEB_PHONE_MAX_WIDTH,
  height: '100%',
  flex: 1,
  alignSelf: 'center',
  marginLeft: 'auto',
  marginRight: 'auto',
  overflow: 'hidden',
  backgroundColor: COLORS.soft,
};

function wrapForWeb(node: ReactNode) {
  if (Platform.OS !== 'web') return node;
  return (
    <View style={webOuterStyle}>
      <View style={webInnerStyle}>{node}</View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useCdrmsFonts();
  // Keyboard open/close changes bottom inset. Pushing that into Uniwind
  // restyles the tree and remounts TextInputs → keyboard blinks shut on Expo Go.
  const lastInsets = useRef({ top: -1, left: -1, right: -1, bottom: -1 });

  useEffect(() => {
    void initPdfDownloadNotifications();
  }, []);

  if (!fontsLoaded) {
    return wrapForWeb(
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: COLORS.soft,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return wrapForWeb(
    <SafeAreaProvider style={{ flex: 1 }}>
      <SafeAreaListener
        onChange={({ insets }) => {
          const prev = lastInsets.current;
          const frameChanged =
            insets.top !== prev.top ||
            insets.left !== prev.left ||
            insets.right !== prev.right;
          // Ignore bottom-only changes (keyboard).
          if (!frameChanged && prev.top !== -1) return;
          lastInsets.current = {
            top: insets.top,
            left: insets.left,
            right: insets.right,
            bottom: insets.bottom,
          };
          Uniwind.updateInsets(insets);
        }}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <GluestackUIProvider mode="light">
            <AuthProvider>
              <ThemeProvider>
                <RootNavigator />
                <PdfDownloadBannerHost />
                <DeviceCameraHost />
              </ThemeProvider>
            </AuthProvider>
          </GluestackUIProvider>
        </GestureHandlerRootView>
      </SafeAreaListener>
    </SafeAreaProvider>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Box } from '@/components/ui/box';
import { ProjectProvider } from '@/src/cdrms/project/ProjectContext';
import { useAuth } from '@/src/auth/AuthContext';
import { homeScreenForRole } from '@/src/auth/roles';
import {
  GeoScreen,
  LoginScreen,
  OtpScreen,
  PermissionScreen,
  SplashScreen,
} from '@/src/cdrms/screens/AuthScreens';
import { ApplicationDetailsScreen } from '@/src/cdrms/screens/ApplicationDetailsScreen';
import {
  Dashboard,
  EngineerDetailScreen,
  HistoryScreen,
  NotificationsScreen,
  ProfileScreen,
} from '@/src/cdrms/screens/MainScreens';
import {
  BandiScreen,
  DirectionsScreen,
  PhotosScreen,
  ProjectScreen,
  SurroundingsScreen,
  VideoScreen,
} from '@/src/cdrms/screens/SurveyScreens';
import { DimensionsScreen } from '@/src/cdrms/screens/DimensionsScreen';
import {
  DraftScreen,
  ReturnedScreen,
  ReviewScreen,
  SuccessScreen,
  ValidateScreen,
} from '@/src/cdrms/screens/StateScreens';
import { ErrorBoundary, ErrorScreen, navigateToApiError } from '@/src/errors';
import { configureApiErrorPage } from '@/src/api/client';
import {
  CaoApplicationsScreen,
  CaoApprovalScreen,
  CaoDetailScreen,
  CaoHomeScreen,
} from '@/src/cdrms/screens/CaoScreens';
import {
  ZcCreateScreen,
  ZcDetailScreen,
  ZcHomeScreen,
} from '@/src/cdrms/screens/ZcScreens';
import type { ErrorNavState, Go, Screen } from '@/src/cdrms/types';
import { AppDialogHost } from '@/src/cdrms/components/AppDialog';
import { useHardwareBackFallback } from '@/src/cdrms/hooks/useHardwareBack';

/** Role homes / auth entry — don't keep prior screens behind these. */
const STACK_RESET_SCREENS: ReadonlySet<Screen> = new Set([
  'splash',
  'login',
  'dashboard',
  'zc_home',
  'cao_home',
  'history',
  'cao_apps',
]);

const AUTH_SCREENS: ReadonlySet<Screen> = new Set([
  'splash',
  'login',
  'otp',
  'permission',
  'geo',
]);

export function CdrmsApp() {
  const { isAuthenticated, touchSession, user } = useAuth();
  const [screen, setScreen] = useState<Screen>('splash');
  const [errorNav, setErrorNav] = useState<ErrorNavState>({
    kind: 'network',
    status: null,
    variant: 'global',
  });
  const historyRef = useRef<Screen[]>([]);
  const authedRef = useRef(isAuthenticated);
  authedRef.current = isAuthenticated;

  const go: Go = useCallback((next, opts) => {
    touchSession();
    if (next === 'error') {
      setErrorNav({
        kind: opts?.errorKind ?? 'network',
        status: opts?.errorStatus ?? null,
        onRetry: opts?.onRetry,
        variant: opts?.errorVariant ?? (authedRef.current ? 'shell' : 'global'),
      });
    }
    setScreen((current) => {
      if (current === next) return current;

      const replace = Boolean(opts?.replace);

      // Landing on role home from auth — clear back stack so device back exits.
      if (
        STACK_RESET_SCREENS.has(next) &&
        (AUTH_SCREENS.has(current) || STACK_RESET_SCREENS.has(current))
      ) {
        historyRef.current = [];
      } else if (STACK_RESET_SCREENS.has(next) && next !== 'login' && next !== 'splash') {
        // Switching bottom-nav homes / leaving a flow for home — reset stack.
        historyRef.current = [];
      } else if (replace) {
        // In-app / hardware back within a flow — do not grow the stack.
      } else {
        historyRef.current.push(current);
        if (historyRef.current.length > 40) {
          historyRef.current = historyRef.current.slice(-40);
        }
      }
      return next;
    });
  }, [touchSession]);

  const screenRef = useRef(screen);
  const goRef = useRef(go);
  screenRef.current = screen;
  goRef.current = go;

  // Global API ErrorScreen for 404 / network / 5xx (and 403) from any apiRequest.
  useEffect(() => {
    configureApiErrorPage((error) => {
      const current = screenRef.current;
      if (
        current === 'error' ||
        current === 'login' ||
        current === 'splash' ||
        current === 'otp'
      ) {
        return;
      }
      navigateToApiError(goRef.current, error, {
        returnScreen: current,
        variant: authedRef.current ? 'shell' : 'global',
      });
    });
    return () => configureApiErrorPage(null);
  }, []);

  // Screens without an in-app back (profile / notifications tabs): pop history.
  useHardwareBackFallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return false;
    // Avoid bouncing back into auth from an authenticated session.
    if (!authedRef.current && !AUTH_SCREENS.has(prev) && prev !== 'login') {
      setScreen('login');
      historyRef.current = [];
      return true;
    }
    setScreen(prev);
    return true;
  });

  // If session is cleared while on an app / gate screen, return to login.
  // Never keep the user on permission/geo without an active login.
  useEffect(() => {
    if (isAuthenticated) return;
    if (screen === 'splash' || screen === 'login' || screen === 'otp') return;
    historyRef.current = [];
    setScreen('login');
  }, [isAuthenticated, screen]);

  const rendered = useMemo(() => {
    switch (screen) {
      case 'splash':
        return <SplashScreen go={go} />;
      case 'login':
        return <LoginScreen go={go} />;
      case 'otp':
        return <OtpScreen go={go} />;
      case 'permission':
        return <PermissionScreen go={go} />;
      case 'geo':
        return <GeoScreen go={go} />;
      case 'dashboard':
        return <Dashboard go={go} />;
      case 'zc_home':
        return <ZcHomeScreen go={go} />;
      case 'zc_create':
        return <ZcCreateScreen go={go} />;
      case 'zc_detail':
        return <ZcDetailScreen go={go} />;
      case 'cao_home':
        return <CaoHomeScreen go={go} />;
      case 'cao_apps':
        return <CaoApplicationsScreen go={go} />;
      case 'cao_detail':
        return <CaoDetailScreen go={go} />;
      case 'cao_approve':
        return <CaoApprovalScreen go={go} />;
      case 'project':
        return <ProjectScreen go={go} />;
      case 'bandi':
        return <BandiScreen go={go} />;
      case 'dimensions':
        return <DimensionsScreen go={go} />;
      case 'directions':
        return <DirectionsScreen go={go} />;
      case 'surroundings':
        return <SurroundingsScreen go={go} />;
      case 'photos':
        return <PhotosScreen go={go} />;
      case 'video':
        return <VideoScreen go={go} />;
      case 'draft':
        return <DraftScreen go={go} />;
      case 'validate':
        return <ValidateScreen go={go} />;
      case 'review':
        return <ReviewScreen go={go} />;
      case 'success':
        return <SuccessScreen go={go} />;
      case 'notifications':
        return <NotificationsScreen go={go} />;
      case 'history':
        return <HistoryScreen go={go} />;
      case 'engineer_detail':
        return <EngineerDetailScreen go={go} />;
      case 'details':
        return <ApplicationDetailsScreen go={go} />;
      case 'returned':
        return <ReturnedScreen go={go} />;
      case 'profile':
        return <ProfileScreen go={go} />;
      case 'error':
        return (
          <ErrorScreen
            go={go}
            kind={errorNav.kind}
            status={errorNav.status}
            variant={errorNav.variant}
            onRetry={
              errorNav.onRetry ??
              (() =>
                go(isAuthenticated ? homeScreenForRole(user) : 'login', {
                  replace: true,
                }))
            }
          />
        );
      default:
        return (
          <ErrorScreen
            go={go}
            kind="page_not_found"
            variant={isAuthenticated ? 'shell' : 'global'}
          />
        );
    }
  }, [screen, go, errorNav, isAuthenticated]);

  return (
    <ProjectProvider>
      <Box className="flex-1 bg-background" style={{ minHeight: 0 }}>
        <ErrorBoundary go={go}>
          <Box className="flex-1" style={{ minHeight: 0 }}>
            {rendered}
          </Box>
        </ErrorBoundary>
        <AppDialogHost />
      </Box>
    </ProjectProvider>
  );
}

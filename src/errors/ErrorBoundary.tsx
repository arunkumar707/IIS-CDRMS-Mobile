import { Component, type ErrorInfo, type ReactNode } from "react";
import { View } from "react-native";
import { ErrorScreen } from "./ErrorScreen";
import { resolveErrorKind, resolveErrorStatus } from "./resolve-error-kind";
import type { ErrorKind } from "./types";
import type { Go } from "@/src/cdrms/types";

type Props = {
  children: ReactNode;
  go: Go;
  onReset?: () => void;
  fallbackKind?: ErrorKind;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught error inside ErrorBoundary:", error, info);
  }

  private handleReset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return (
        <View style={{ flex: 1, minHeight: 0 }}>{this.props.children}</View>
      );
    }

    const kind =
      this.props.fallbackKind ?? resolveErrorKind(this.state.error);
    const status = resolveErrorStatus(this.state.error);

    return (
      <View style={{ flex: 1, minHeight: 0, backgroundColor: '#FFF7ED' }}>
        <ErrorScreen
          go={this.props.go}
          kind={kind}
          status={status}
          variant="global"
          onRetry={this.handleReset}
        />
      </View>
    );
  }
}

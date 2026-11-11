import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../../telemetry/crash';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, { componentStack: info.componentStack ?? '' });
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center gap-7 bg-paper-100 px-6 text-center"
        style={{
          paddingTop: 'calc(24px + var(--safe-top))',
          paddingBottom: 'calc(24px + var(--bottom-reserve))',
        }}
      >
        <div>
          <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500">
            Something broke
          </div>
          <h1 className="mt-2 font-serif text-[30px] font-semibold leading-[1.1] tracking-[-0.015em] text-ink-900">
            The grid slipped.
          </h1>
          <p className="mt-3 max-w-xs mx-auto font-sans text-[14px] leading-[1.55] text-ink-500">
            An unexpected error stopped the puzzle. Your progress is saved — try again.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            type="button"
            onClick={this.reset}
            className="h-11 rounded-[12px] bg-fill-800 text-paper-50 font-sans text-[14px] font-semibold active:scale-[0.98] transition-transform duration-nudge"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-11 rounded-[12px] border border-rule-200 bg-paper-50 text-ink-700 font-sans text-[13px] active:scale-[0.97] transition-transform duration-nudge"
          >
            Reload
          </button>
        </div>
      </main>
    );
  }
}

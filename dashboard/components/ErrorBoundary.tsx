"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  err: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error) {
    console.error("[Echo] crashed:", err);
  }

  reset = () => this.setState({ err: null });

  render() {
    if (this.state.err) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-full w-full items-center justify-center bg-charcoal-900 p-6">
          <div className="max-w-md rounded-lg border border-red-400/40 bg-charcoal-800/80 p-5 text-center">
            <div className="mb-2 text-sm font-semibold text-red-300">
              Brain hit a snag
            </div>
            <div className="mb-3 text-xs text-amber-glow/70">
              {this.state.err.message || "Render error"}
            </div>
            <button
              onClick={this.reset}
              className="rounded-full border border-amber-core/60 px-3 py-1.5 text-xs uppercase tracking-wide text-amber-core transition hover:bg-amber-core/15"
            >
              Reload brain
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

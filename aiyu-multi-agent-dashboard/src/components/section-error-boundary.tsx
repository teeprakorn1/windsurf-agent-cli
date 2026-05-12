"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.title ?? "Section";

    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
        <div className="h-12 w-12 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">{title} Error</p>
          <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 max-w-xs break-words">
            {this.state.error?.message ?? "An unexpected error occurred"}
          </p>
        </div>
        <button
          onClick={this.handleReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 transition-colors"
        >
          <RotateCcw className="h-3 w-3" /> Retry
        </button>
      </div>
    );
  }
}

"use client";

import React from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Error boundary for the evaluation form.
 * Catches errors and displays a user-friendly fallback UI.
 */
export class EvaluationFormErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("Evaluation form error:", error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8 dark:border-red-800 dark:bg-red-950">
          <AlertTriangle className="mb-4 h-12 w-12 text-red-500" />
          <h2 className="mb-2 text-xl font-semibold text-red-700 dark:text-red-300">
            Something went wrong
          </h2>
          <p className="mb-6 text-center text-red-600 dark:text-red-400">
            We encountered an error while loading the evaluation form. Please
            try again.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleReset}>
              Try Again
            </Button>
            <Button onClick={this.handleReload}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Page
            </Button>
          </div>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre className="mt-6 max-w-full overflow-auto rounded bg-red-100 p-4 text-xs text-red-800 dark:bg-red-900 dark:text-red-200">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

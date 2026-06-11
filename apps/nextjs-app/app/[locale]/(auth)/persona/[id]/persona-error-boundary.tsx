"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";

interface PersonaErrorBoundaryProps {
  children: ReactNode;
}

interface PersonaErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for persona page.
 * Catches render errors and displays a fallback UI.
 */
export class PersonaErrorBoundary extends Component<
  PersonaErrorBoundaryProps,
  PersonaErrorBoundaryState
> {
  constructor(props: PersonaErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PersonaErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("PersonaErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground max-w-md text-sm">
            We encountered an error while loading this persona. Please try
            refreshing the page.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.handleRetry}>
              Try again
            </Button>
            <Button onClick={() => window.location.reload()}>
              Refresh page
            </Button>
          </div>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre className="mt-4 max-w-2xl overflow-auto rounded border bg-zinc-100 p-4 text-left text-xs dark:bg-zinc-900">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

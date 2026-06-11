"use client";

import { Component, ReactNode, ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";
import { useTranslations } from "next-intl";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

interface InnerProps extends Props {
  t: (key: string) => string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class BalanceErrorBoundaryInner extends Component<InnerProps, State> {
  constructor(props: InnerProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Credit component error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { t } = this.props;
    if (this.state.hasError) {
      return (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {this.props.fallbackTitle || t("somethingWentWrong")}
            </CardTitle>
            <CardDescription>
              {this.props.fallbackDescription || t("loadingError")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                {this.state.error?.message || t("unknownError")}
              </p>
              <Button
                variant="outline"
                onClick={this.handleRetry}
                className="w-fit"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("tryAgain")}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export function BalanceErrorBoundary(props: Props) {
  const t = useTranslations("FundsSettings.errors");
  return <BalanceErrorBoundaryInner t={t} {...props} />;
}

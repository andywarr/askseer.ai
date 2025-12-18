import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/apps/nextjs-app/components/ui/alert";
import { LONG_FLOW_WARNING_THRESHOLD } from "@/apps/nextjs-app/lib/constants";

export function LongFlowWarning() {
  return (
    <Alert
      variant="destructive"
      className="mt-4 flex items-center gap-2 border-amber-200 bg-amber-50 text-amber-800 [&>svg]:static [&>svg+div]:translate-y-0 [&>svg~*]:pl-0"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
      <AlertDescription className="text-amber-800">
        <strong>Long flow warning.</strong> Flows with more than{" "}
        {LONG_FLOW_WARNING_THRESHOLD} screens can generate a large number of
        issues. Consider breaking your flow into smaller sub-flows for more
        focused and actionable insights.
      </AlertDescription>
    </Alert>
  );
}

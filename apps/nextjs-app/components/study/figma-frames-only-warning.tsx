import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/apps/nextjs-app/components/ui/alert";

export function FigmaFramesOnlyWarning() {
  return (
    <Alert
      variant="destructive"
      className="mt-4 flex items-center gap-2 border-amber-200 bg-amber-50 text-amber-800 [&>svg]:static [&>svg+div]:translate-y-0 [&>svg~*]:pl-0"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
      <AlertDescription className="text-amber-800">
        <strong>Frames only.</strong> Only parent frames were imported. Other
        elements such as components, groups, or images at the page level were
        not included.
      </AlertDescription>
    </Alert>
  );
}

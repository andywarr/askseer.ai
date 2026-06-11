import * as React from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";

interface InlineActionButtonProps extends Omit<React.ComponentPropsWithoutRef<typeof Button>, "size"> {
  action: "edit" | "delete";
  showOnHoverClass?: string;
  size?: "default" | "sm" | "xs";
}

export const InlineActionButton = React.forwardRef<HTMLSpanElement, InlineActionButtonProps>(
  ({ action, showOnHoverClass, className, size = "sm", children, ...props }, ref) => {
    const isDelete = action === "delete";
    const Icon = isDelete ? Trash2 : Pencil;

    // Sizing mapping for button containers
    const sizeClasses = {
      default: "h-8 w-8",
      sm: "h-7 w-7",
      xs: "h-6 w-6",
    }[size];

    // Sizing mapping for the inside Lucide icons
    const iconSizeClasses = {
      default: "h-4 w-4",
      sm: "h-3.5 w-3.5",
      xs: "h-3 w-3",
    }[size];

    return (
      <Button
        asChild
        variant="ghost"
        className={cn(
          "shrink-0 p-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
          sizeClasses,
          isDelete && "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400",
          showOnHoverClass && cn("opacity-0 transition-opacity duration-200", showOnHoverClass),
          className
        )}
      >
        <span
          ref={ref}
          role="button"
          tabIndex={0}
          onClick={props.onClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              (props.onClick as any)?.(e);
            }
          }}
          className="focus:outline-none"
        >
          {children || <Icon className={iconSizeClasses} />}
        </span>
      </Button>
    );
  }
);
InlineActionButton.displayName = "InlineActionButton";

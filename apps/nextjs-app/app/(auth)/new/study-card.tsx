import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/apps/nextjs-app/components/ui/card";

export interface StudyCardData {
  href: string;
  title: string;
  description: string;
  badge?: string;
  disabled?: boolean;
  disabledMessage?: string;
}

interface StudyCardProps {
  study: StudyCardData;
}

export function StudyCard({ study }: StudyCardProps) {
  const { href, title, description, disabled, disabledMessage } = study;

  const card = (
    <Card
      className={`h-full w-full ${
        disabled ? "cursor-not-allowed opacity-60" : "hover:border-black"
      }`}
      aria-disabled={disabled}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {study.badge && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                study.badge === "Preview"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {study.badge}
            </span>
          )}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        {disabled && disabledMessage && (
          <p className="text-muted-foreground pt-2 text-sm">
            {disabledMessage}
          </p>
        )}
      </CardHeader>
    </Card>
  );

  if (disabled) {
    return (
      <div aria-disabled className="pointer-events-none">
        {card}
      </div>
    );
  }

  return <Link href={href}>{card}</Link>;
}

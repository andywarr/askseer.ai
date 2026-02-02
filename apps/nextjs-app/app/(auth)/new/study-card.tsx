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
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {disabled && disabledMessage && (
          <p className="text-muted-foreground pt-2 text-sm">{disabledMessage}</p>
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

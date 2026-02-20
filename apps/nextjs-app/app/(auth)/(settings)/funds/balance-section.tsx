import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";
import { ReactNode } from "react";

interface BalanceSectionProps {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

export function BalanceSection({
  title,
  description,
  children,
  className = "",
}: BalanceSectionProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

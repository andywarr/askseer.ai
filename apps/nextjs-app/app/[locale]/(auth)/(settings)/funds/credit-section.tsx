import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";
import { ReactNode } from "react";

interface CreditSectionProps {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

export function CreditSection({
  title,
  description,
  children,
  className = "",
}: CreditSectionProps) {
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

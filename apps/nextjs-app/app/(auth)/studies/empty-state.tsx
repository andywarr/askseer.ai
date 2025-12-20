"use client";

import Link from "next/link";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";
import { Users, Plus, Sparkles } from "lucide-react";

interface EmptyStateProps {
  isCompanyUser: boolean;
  hasJoinedCompanyTeams: boolean;
  companyName?: string | null;
}

export function EmptyState({
  isCompanyUser,
  hasJoinedCompanyTeams,
  companyName,
}: EmptyStateProps) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <Sparkles className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
        </div>
        <CardTitle>Ready to unlock insights?</CardTitle>
        <CardDescription>
          {isCompanyUser && !hasJoinedCompanyTeams
            ? `Join a team at ${companyName || "your company"} to collaborate and improve your product's user experience.`
            : "Evaluate your designs, test user flows, and discover how to improve your product's user experience.."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        {isCompanyUser && !hasJoinedCompanyTeams ? (
          <>
            <Button asChild>
              <Link href="/team">
                <Users className="mr-2 h-4 w-4" />
                Browse teams to join
              </Link>
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              Or{" "}
              <Link href="/new" className="hover:text-foreground underline">
                start exploring on your own
              </Link>
            </p>
          </>
        ) : (
          <>
            <Button asChild>
              <Link href="/new">
                <Plus className="mr-2 h-4 w-4" />
                Create
              </Link>
            </Button>
            {isCompanyUser && (
              <p className="text-muted-foreground text-center text-sm">
                Want to collaborate?{" "}
                <Link href="/team" className="hover:text-foreground underline">
                  Browse teams
                </Link>{" "}
                at {companyName || "your company"}.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

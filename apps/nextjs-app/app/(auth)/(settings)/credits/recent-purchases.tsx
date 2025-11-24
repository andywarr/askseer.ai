"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";
import { Loader2 } from "lucide-react";

type CreditTransaction = {
  id: string;
  delta: number;
  reason: string | null;
  createdAt: string;
  teamName?: string;
};

export function RecentPurchases({ teamId }: { teamId?: string }) {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This would fetch recent credit purchases from the API
    // For now, it's a placeholder
    setLoading(false);
  }, [teamId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest credit transactions</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your latest credit transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {transaction.reason?.startsWith("stripe_purchase:")
                    ? "Credit Purchase"
                    : transaction.reason || "Credit adjustment"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(transaction.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span
                className={`text-lg font-semibold ${
                  transaction.delta > 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {transaction.delta > 0 ? "+" : ""}
                {transaction.delta}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

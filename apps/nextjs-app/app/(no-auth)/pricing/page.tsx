"use client";

// Nextjs imports
import Link from "next/link";
import { useRouter } from "next/navigation";

// Shadcn UI components
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";

// Custom components
import { GlobalHeader } from "@/apps/nextjs-app/components/global-header";

// React and hooks
import { useState, useEffect } from "react";

// Client-side logging utility
import { clientLogger, logPageView } from "@/apps/nextjs-app/lib/client-logger";

// Pricing constants
import { PERSONAL_CREDIT_PRICE } from "@/apps/shared/constants";

export default function Page() {
  const router = useRouter();
  const [creditCount, setCreditCount] = useState<number>(1);
  const [inputValue, setInputValue] = useState<string>("1");

  // Log pricing page view on mount
  useEffect(() => {
    logPageView("/pricing");
  }, []);

  // Use personal credit price for public pricing page (non-company users)
  const CREDIT_PRICE = PERSONAL_CREDIT_PRICE;

  const calculateTotalCost = (credits: number): number => {
    if (credits <= 0) return 0;
    return credits * CREDIT_PRICE;
  };

  const handleBuyCredits = () => {
    // Log when user clicks "Buy Credits" button
    clientLogger.info("Buy credits button clicked", {
      page: "/pricing",
      action: "buy_credits_click",
      currentCreditCount: creditCount,
      estimatedValue: calculateTotalCost(creditCount),
    });

    // Redirect to /credits page with callbackUrl for authentication
    router.push("/credits");
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center p-8">
      <GlobalHeader activePage="pricing" onBuyCreditsClick={handleBuyCredits} />
      <h1 className="font-parisienne scroll-m-20 text-center text-7xl tracking-tight text-balance">
        Pricing
      </h1>
      <h3 className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight">
        Start for free and then pay as you go
      </h3>
      <p className="mt-8 leading-7 not-first:mt-6">
        Each new user gets 3 free credits—that&apos;s $
        {(3 * CREDIT_PRICE).toFixed(0)} of credits to run up to 3 studies for
        free. After that you can buy credits to run more studies as needed.
      </p>
      <div className="mt-8 flex justify-center">
        <Button asChild variant="outline">
          <Link href="/">Sign in</Link>
        </Button>
      </div>
      <h3 className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight">
        Simple, transparent pricing
      </h3>
      <p className="mt-8 leading-7 not-first:mt-6">
        Seer uses a flexible, usage-based pricing model. Buy credits and spend
        them when you&apos;re ready — no minimums, no expiration.
      </p>
      <div className="mt-16 flex flex-col items-center">
        <span className="text-muted-foreground text-lg">From as low as</span>
        <span className="text-5xl font-bold">${CREDIT_PRICE}</span>
        <span className="text-muted-foreground text-lg">per study</span>
      </div>
      <div className="mt-16 flex justify-center">
        <Button onClick={handleBuyCredits} size="lg">
          Buy Credits
        </Button>
      </div>
      <div className="mt-16 flex flex-col items-center">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          How many credits do you need?
        </h3>
        <Input
          type="number"
          className="mt-4 h-16 max-w-full text-center text-xl"
          style={{ width: `${Math.max(inputValue.length + 7, 8)}ch` }}
          min="1"
          max="1000"
          value={inputValue}
          onChange={(e) => {
            const value = e.target.value;
            const numValue = Number(value);

            if (numValue > 1000) {
              setInputValue("1000");
              setCreditCount(1000);
            } else {
              setInputValue(value);
              setCreditCount(numValue || 1);
            }
          }}
        />
        {creditCount >= 1000 ? (
          <p className="text-muted-foreground mt-4 text-center">
            To purchase more than 1000 credits, please email
            payments@askseer.ai.
          </p>
        ) : (
          <p className="text-muted-foreground mt-4 text-center">
            You can run up to {creditCount.toLocaleString("en-US")} studies for
            the cost of $
            {calculateTotalCost(creditCount).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        )}
      </div>
      <div className="mt-16 mb-16 flex justify-center">
        <Button onClick={handleBuyCredits} size="lg">
          Buy Credits
        </Button>
      </div>
    </div>
  );
}

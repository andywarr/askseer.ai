"use client";

// Nextjs imports
import Link from "next/link";

// Shadcn UI components
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/apps/nextjs-app/components/ui/table";

// Custom components
import { GlobalHeader } from "@/apps/nextjs-app/components/global-header";
import { CreditRequestForm } from "@/apps/nextjs-app/components/credit-request-form";

// React and hooks
import { useState, useRef } from "react";

export default function Page() {
  const [creditCount, setCreditCount] = useState<number>(1);
  const [inputValue, setInputValue] = useState<string>("1");
  const creditFormRef = useRef<HTMLDivElement>(null);

  const pricingTiers = [
    { credits: "1-9 credits", price: "$19.99" },
    { credits: "10-19 credits", price: "$14.99" },
    { credits: "20-49 credits", price: "$9.99" },
    { credits: "50+ credits", price: "$4.99" },
  ];

  const calculateTotalCost = (credits: number): number => {
    let total = 0;

    if (credits <= 0) return 0;

    // First tier: 1-9 credits at $19.99 each
    const tier1Credits = Math.min(credits, 9);
    total += tier1Credits * 19.99;
    credits -= tier1Credits;

    if (credits <= 0) return total;

    // Second tier: 10-19 credits at $14.99 each
    const tier2Credits = Math.min(credits, 10);
    total += tier2Credits * 14.99;
    credits -= tier2Credits;

    if (credits <= 0) return total;

    // Third tier: 20-49 credits at $9.99 each
    const tier3Credits = Math.min(credits, 30);
    total += tier3Credits * 9.99;
    credits -= tier3Credits;

    if (credits <= 0) return total;

    // Fourth tier: 50+ credits at $4.99 each
    total += credits * 4.99;

    return total;
  };

  const handleFormCreditsChange = (credits: number) => {
    setCreditCount(credits);
    setInputValue(credits.toString());
  };

  const scrollToCreditForm = () => {
    creditFormRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center p-8">
      <GlobalHeader
        activePage="pricing"
        onBuyCreditsClick={scrollToCreditForm}
      />
      <h1 className="font-parisienne scroll-m-20 text-balance text-center text-7xl tracking-tight">
        Pricing
      </h1>
      <h3 className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight">
        Start for free and then pay as you go
      </h3>
      <p className="mt-8 leading-7 [&:not(:first-child)]:mt-6">
        Each new user gets 3 free credits—that&apos;s $60 of credits to run up
        to 3 studies for free. After that you can buy credits to run more
        studies as needed.
      </p>
      <div className="mt-8 flex justify-center">
        <Button asChild variant="outline">
          <Link href="/">Sign in</Link>
        </Button>
      </div>
      <h3 className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight">
        Run a study for as low as $4.99
      </h3>
      <p className="mt-8 leading-7 [&:not(:first-child)]:mt-6">
        Seer uses a flexible, usage-based pricing model. Buy credits and spend
        them when you&apos;re ready — no minimums, no expiration. The more
        credits you purchase, the lower the cost per credit.
      </p>
      <div className="mt-16 w-full max-w-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Credits</TableHead>
              <TableHead className="text-right">Price per credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pricingTiers.map((tier, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{tier.credits}</TableCell>
                <TableCell className="text-right">{tier.price}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-16 flex justify-center">
        <Button onClick={scrollToCreditForm}>Buy Credits</Button>
      </div>
      <div className="mt-16 flex flex-col items-center">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          How many credits do you need?
        </h3>
        <Input
          type="number"
          className="mt-4 h-16 max-w-full text-center text-xl"
          style={{ width: `${Math.max(inputValue.length + 5, 6)}ch` }}
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
      <div className="mt-16 flex justify-center">
        <Button onClick={scrollToCreditForm}>Buy Credits</Button>
      </div>

      {/* Credit Request Form Section */}
      <div ref={creditFormRef} className="mb-16 mt-16 w-full">
        <h3 className="scroll-m-20 text-center text-2xl font-semibold tracking-tight">
          Ready to purchase credits?
        </h3>
        <p className="text-muted-foreground mt-4 text-center leading-7">
          Fill out the form below and we&apos;ll contact you within 2 business
          days to process your credit purchase.
        </p>
        <div className="mt-8">
          <CreditRequestForm
            credits={creditCount}
            onCreditsChange={handleFormCreditsChange}
          />
        </div>
      </div>
    </div>
  );
}

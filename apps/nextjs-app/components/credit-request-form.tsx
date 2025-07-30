"use client";

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { creditRequestSchema } from "@/apps/nextjs-app/lib/schema";
import { submitCreditRequest } from "@/apps/nextjs-app/lib/action";
import {
  clientLogger,
  getEmailDomain,
} from "@/apps/nextjs-app/lib/client-logger";

// UI Component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/apps/nextjs-app/components/ui/form";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";

interface CreditRequestFormProps {
  credits: number;
  onCreditsChange?: (credits: number) => void;
}

export function CreditRequestForm({
  credits,
  onCreditsChange,
}: CreditRequestFormProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof creditRequestSchema>>({
    resolver: zodResolver(creditRequestSchema),
    defaultValues: {
      name: "",
      email: "",
      credits: credits,
    },
  });

  // Update form when credits prop changes
  useEffect(() => {
    form.setValue("credits", credits);
  }, [credits, form]);

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

  const onSubmit = async (data: z.infer<typeof creditRequestSchema>) => {
    setError(null);

    // Log credit request attempt
    clientLogger.debug("Credit request form submitted", {
      page: "/pricing",
      action: "credit_request_submit",
      creditsRequested: data.credits,
      estimatedValue: calculateTotalCost(data.credits),
      emailDomain: getEmailDomain(data.email),
    });

    startTransition(async () => {
      try {
        // Create FormData for server action
        const formData = new FormData();
        formData.append("name", data.name);
        formData.append("email", data.email);
        formData.append("credits", data.credits.toString());

        const result = await submitCreditRequest(formData);

        if (result.success) {
          setIsSubmitted(true);

          // Log successful credit request
          clientLogger.info("Credit request submitted successfully", {
            page: "/pricing",
            action: "credit_request_success",
            creditsRequested: data.credits,
            estimatedValue: calculateTotalCost(data.credits),
            emailDomain: getEmailDomain(data.email),
          });
        } else {
          setError(result.error || "Failed to submit request");

          // Log failed credit request
          clientLogger.error("Credit request submission failed", {
            page: "/pricing",
            action: "credit_request_error",
            creditsRequested: data.credits,
            error: result.error || "Failed to submit request",
            emailDomain: getEmailDomain(data.email),
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);

        // Log credit request exception
        clientLogger.error("Credit request submission exception", {
          page: "/pricing",
          action: "credit_request_exception",
          creditsRequested: data.credits,
          error: errorMessage,
        });
      }
    });
  };

  const totalCost = calculateTotalCost(credits || 0);

  if (isSubmitted) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-green-600">
            Request Submitted!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            Thank you for your credit request. We&apos;ll contact you within 2
            business days to process your purchase.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="text-center">Credit Request Form</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What is your full name?</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your full name." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What is your email address?</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email address."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="credits"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    How many credits would you like to purchase?
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="1000"
                      placeholder="Enter number of credits."
                      value={credits === 0 ? "" : credits}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        let newValue =
                          inputValue === "" ? 0 : parseInt(inputValue, 10);

                        // Cap the value at 1000
                        if (newValue > 1000) {
                          newValue = 1000;
                        }

                        field.onChange(newValue);
                        if (onCreditsChange) {
                          onCreditsChange(newValue);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {credits > 0 && (
              <div className="text-center">
                {credits >= 1000 ? (
                  <p className="text-muted-foreground">
                    To purchase more than 1000 credits, please email
                    payments@askseer.ai.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Total cost:{" "}
                    <span className="text-foreground break-words font-semibold">
                      $
                      {totalCost.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="text-center text-sm text-red-600">{error}</div>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Submitting..." : "Request Credits"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

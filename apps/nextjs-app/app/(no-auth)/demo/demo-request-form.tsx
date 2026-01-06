"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { demoRequestSchema } from "@/apps/nextjs-app/lib/schema";
import { submitDemoRequest } from "@/apps/nextjs-app/lib/actions/email-actions";
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
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/apps/nextjs-app/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/apps/nextjs-app/components/ui/card";

// Icon imports
import { CheckCircle2 } from "lucide-react";

const JOB_ROLE_OPTIONS = [
  { value: "data_science", label: "Data Science" },
  { value: "design", label: "Design" },
  { value: "engineering", label: "Engineering" },
  { value: "market_research", label: "Market Research" },
  { value: "marketing", label: "Marketing" },
  { value: "operations", label: "Operations" },
  { value: "product_management", label: "Product Management" },
  { value: "ux_research", label: "UX Research" },
  { value: "other", label: "Other" },
];

const HOW_DID_YOU_HEAR_OPTIONS = [
  { value: "search", label: "Search engine" },
  { value: "social", label: "Social media" },
  { value: "referral", label: "Referral from a colleague" },
  { value: "conference", label: "Conference or event" },
  { value: "article", label: "Blog or article" },
  { value: "other", label: "Other" },
];

export function DemoRequestForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof demoRequestSchema>>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      jobRole: "",
      howDidYouHear: "",
      useCase: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof demoRequestSchema>) => {
    setError(null);

    // Log demo request attempt
    clientLogger.debug("Demo request form submitted", {
      page: "/demo",
      action: "demo_request_submit",
      company: data.company,
      jobRole: data.jobRole,
      howDidYouHear: data.howDidYouHear,
      emailDomain: getEmailDomain(data.email),
    });

    startTransition(async () => {
      try {
        // Create FormData for server action
        const formData = new FormData();
        formData.append("name", data.name);
        formData.append("email", data.email);
        formData.append("phone", data.phone);
        formData.append("company", data.company);
        formData.append("jobRole", data.jobRole);
        formData.append("howDidYouHear", data.howDidYouHear);
        formData.append("useCase", data.useCase);

        const result = await submitDemoRequest(formData);

        if (result.success) {
          setIsSubmitted(true);

          // Log successful demo request
          clientLogger.info("Demo request submitted successfully", {
            page: "/demo",
            action: "demo_request_success",
            company: data.company,
            jobRole: data.jobRole,
            emailDomain: getEmailDomain(data.email),
          });
        } else {
          setError(result.error || "Failed to submit request");

          // Log failed demo request
          clientLogger.error("Demo request submission failed", {
            page: "/demo",
            action: "demo_request_error",
            error: result.error || "Failed to submit request",
            emailDomain: getEmailDomain(data.email),
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);

        // Log demo request exception
        clientLogger.error("Demo request submission exception", {
          page: "/demo",
          action: "demo_request_exception",
          error: errorMessage,
        });
      }
    });
  };

  if (isSubmitted) {
    return (
      <Card className="mx-auto w-full max-w-2xl shadow-lg">
        <CardHeader className="space-y-4 p-8 text-center md:p-10">
          <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100">
            <CheckCircle2 className="h-10 w-10 text-zinc-600" />
          </div>
          <CardTitle className="text-3xl text-zinc-800">
            Request Submitted!
          </CardTitle>
          <CardDescription className="text-lg">
            Thank you for your interest in Seer.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-10 text-center md:px-10">
          <p className="text-muted-foreground text-lg">
            A member of our team will be in touch within 1 business day to
            schedule your personalized demo. We&apos;ve also sent a confirmation
            email to your inbox.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-3xl min-w-0 shadow-lg sm:min-w-[640px]">
      <CardHeader className="space-y-3 p-8 md:p-10">
        <CardTitle className="text-center text-3xl md:text-4xl">
          Seeing is believing
        </CardTitle>
        <CardDescription className="text-center text-lg">
          Get a personalized walkthrough and discover how AI-powered insights
          can transform your product development.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 pb-10 md:px-10">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-6"
          >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">
                      What is your name?
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-12"
                        placeholder="Enter your full name."
                        {...field}
                      />
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
                    <FormLabel className="text-base">
                      What is your work email?
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-12"
                        type="email"
                        placeholder="Enter your work email address."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">
                      What is your phone number?
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-12"
                        type="tel"
                        placeholder="Enter your phone number."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">
                      What company do you work for?
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-12"
                        placeholder="Enter your company name."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="jobRole"
                render={({ field }) => (
                  <FormItem className="overflow-hidden">
                    <FormLabel className="text-base">
                      What is your job role?
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="!h-12 !w-full !text-sm [&>span:first-child]:truncate">
                          <SelectValue placeholder="Select your job role." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {JOB_ROLE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="howDidYouHear"
                render={({ field }) => (
                  <FormItem className="overflow-hidden">
                    <FormLabel className="text-base">
                      How did you hear about us?
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="!h-12 !w-full !text-sm [&>span:first-child]:truncate">
                          <SelectValue placeholder="Select how you heard about us." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {HOW_DID_YOU_HEAR_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="useCase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">
                    What would you like to use Seer for?
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us about the challenges you're facing and how you hope Seer can help."
                      className="min-h-[140px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <div className="text-center text-sm text-red-600">{error}</div>
            )}

            <Button
              type="submit"
              size="lg"
              className="mt-2 h-12 w-full text-base"
              disabled={isPending}
            >
              {isPending ? "Submitting..." : "Request Demo"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

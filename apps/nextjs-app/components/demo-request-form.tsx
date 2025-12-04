"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { demoRequestSchema } from "@/apps/nextjs-app/lib/schema";
import { submitDemoRequest } from "@/apps/nextjs-app/lib/action";
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
  { value: "search", label: "Search engine (Google, Bing, etc.)" },
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
      <Card className="mx-auto w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-600">
            Request Submitted!
          </CardTitle>
          <CardDescription className="text-base">
            Thank you for your interest in Seer.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            A member of our team will be in touch within 1 business day to
            schedule your personalized demo. We&apos;ve also sent a confirmation
            email to your inbox.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-center text-2xl">Request a Demo</CardTitle>
        <CardDescription className="text-center">
          Fill out the form below and we&apos;ll get in touch within two
          business days to schedule a personalized demo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What is your name?</FormLabel>
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
                  <FormLabel>What is your work email?</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your work email address."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What is your phone number?</FormLabel>
                  <FormControl>
                    <Input
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
                  <FormLabel>What company do you work for?</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your company name." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jobRole"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What is your job role?</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
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
                <FormItem>
                  <FormLabel>How did you hear about us?</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
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

            <FormField
              control={form.control}
              name="useCase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What would you like to use Seer for?</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us about the challenges you're facing and how you hope Seer can help."
                      className="min-h-[120px] resize-none"
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

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Submitting..." : "Request Demo"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

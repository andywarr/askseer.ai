"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { demoRequestSchema } from "@/apps/nextjs-app/lib/db/schema";
import { submitDemoRequest } from "@/apps/nextjs-app/lib/actions/email-actions";
import {
  clientLogger,
  getEmailDomain,
} from "@/apps/nextjs-app/lib/utils/client-logger";

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

export function DemoRequestForm() {
  const t = useTranslations("DemoPage");
  const tContact = useTranslations("ContactPage");
  const tCommon = useTranslations("Common");

  const jobRoleOptions = [
    { value: "data_science", label: tCommon("jobRoles.data_science") },
    { value: "design", label: tCommon("jobRoles.design") },
    { value: "engineering", label: tCommon("jobRoles.engineering") },
    { value: "market_research", label: tCommon("jobRoles.market_research") },
    { value: "marketing", label: tCommon("jobRoles.marketing") },
    { value: "operations", label: tCommon("jobRoles.operations") },
    { value: "product_management", label: tCommon("jobRoles.product_management") },
    { value: "ux_research", label: tCommon("jobRoles.ux_research") },
    { value: "other", label: tCommon("jobRoles.other") },
  ];

  const howDidYouHearOptions = [
    { value: "search", label: tCommon("howDidYouHear.search") },
    { value: "social", label: tCommon("howDidYouHear.social") },
    { value: "referral", label: tCommon("howDidYouHear.referral") },
    { value: "conference", label: tCommon("howDidYouHear.conference") },
    { value: "article", label: tCommon("howDidYouHear.article") },
    { value: "other", label: tCommon("howDidYouHear.other") },
  ];

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
            {t("success.title")}
          </CardTitle>
          <CardDescription className="text-lg">
            {t("success.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-10 text-center md:px-10">
          <p className="text-muted-foreground text-lg">
            {t("success.message")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-3xl min-w-0 shadow-lg sm:min-w-[640px]">
      <CardHeader className="space-y-3 p-8 md:p-10">
        <CardTitle className="text-center text-3xl md:text-4xl">
          {t("title")}
        </CardTitle>
        <CardDescription className="text-center text-lg">
          {t("subtitle")}
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
                      {tContact("form.nameLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-12"
                        placeholder={tContact("form.namePlaceholder")}
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
                      {tContact("form.emailLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-12"
                        type="email"
                        placeholder={tContact("form.emailPlaceholder")}
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
                      {tContact("form.phoneLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-12"
                        type="tel"
                        placeholder={tContact("form.phonePlaceholder")}
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
                      {tContact("form.companyLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-12"
                        placeholder={tContact("form.companyPlaceholder")}
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
                      {tContact("form.roleLabel")}
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="!h-12 !w-full !text-sm [&>span:first-child]:truncate">
                          <SelectValue placeholder={tContact("form.rolePlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {jobRoleOptions.map((option) => (
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
                      {tContact("form.hearLabel")}
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="!h-12 !w-full !text-sm [&>span:first-child]:truncate">
                          <SelectValue placeholder={tContact("form.hearPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {howDidYouHearOptions.map((option) => (
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
                    {t("form.useCaseLabel")}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("form.useCasePlaceholder")}
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
              {isPending ? t("form.submitting") : t("form.submit")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { personaSchema } from "@/apps/nextjs-app/lib/schema";
import { createPersona } from "@/apps/nextjs-app/lib/action";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/apps/nextjs-app/components/ui/form";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/apps/nextjs-app/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/apps/nextjs-app/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/apps/nextjs-app/components/ui/accordion";
import { LocationAutocomplete } from "@/apps/nextjs-app/components/location/location-autocomplete";
import { ListEditor } from "@/apps/nextjs-app/components/list-editor";
import { MultilineListEditor } from "@/apps/nextjs-app/components/multiline-list-editor";
import { GoalsEditor } from "@/apps/nextjs-app/components/goals-editor";
import { Plus, X } from "lucide-react";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";

type PersonaFormValues = z.infer<typeof personaSchema>;

// Missing options reintroduced
const techProficiencyOptions = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
];

const companySizeOptions = [
  "1-9",
  "10-49",
  "50-199",
  "200-499",
  "500-999",
  "1000+",
];

const roleSeniorityOptions = [
  "Individual Contributor",
  "Manager",
  "Director",
  "VP",
  "C-Suite",
  "Owner",
];

// Demographics preset options
const ageOptions = [
  "Under 18",
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
];

const genderOptions = ["Female", "Male", "Non-binary", "Other"];

const educationOptions = [
  "High school",
  "Associate's degree",
  "Bachelor's degree",
  "Master's degree",
  "Doctorate",
  "Professional degree",
  "Bootcamp/Certification",
  "None of the above",
];

const incomeOptions = [
  "Under $24,999",
  "$25,000–$49,999",
  "$50,000–$74,999",
  "$75,000–$99,999",
  "$100,000–$149,999",
  "$150,000–$199,999",
  "$200,000+",
];

const maritalStatusOptions = [
  "Single",
  "Married",
  "Domestic partnership",
  "Divorced",
  "Widowed",
];

const householdSizeOptions = ["1", "2", "3", "4", "5", "6+"];

// Devices and channels presets
const deviceOptions = [
  "iPhone",
  "Android phone",
  "iPad / Tablet",
  "MacBook / Mac",
  "Windows laptop / PC",
  "Linux laptop / PC",
  "Smartwatch",
  "Other",
];

const channelOptions = [
  "Email",
  "SMS",
  "Phone call",
  "In-app notifications",
  "Push notifications",
  "YouTube",
  "TikTok",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Reddit",
  "Twitter / X",
  "Blogs",
  "Podcasts",
  "Search (Google/Bing)",
  "Communities / Forums",
  "Events / Webinars",
  "Other",
];

// Industry presets
const industryOptions = [
  "Technology",
  "Healthcare",
  "Finance",
  "Education",
  "Retail",
  "Manufacturing",
  "Media & Entertainment",
  "Government",
  "Nonprofit",
  "Transportation & Logistics",
  "Real Estate",
  "Energy",
  "Telecommunications",
  "Travel & Hospitality",
  "Other",
];

const departmentOptions = [
  "Engineering",
  "Product",
  "Design",
  "Marketing",
  "Sales",
  "Customer Support",
  "Operations",
  "Finance",
  "Human Resources",
  "IT",
  "Legal",
  "Procurement",
  "Data / Analytics",
  "Security",
  "Executive / Strategy",
  "Other",
];

// Purchase triggers presets
const purchaseTriggersOptions = [
  "Budget cycle",
  "Compliance requirement",
  "Contract end / renewal",
  "Cost reduction initiative",
  "Deadline / time pressure",
  "Leadership change",
  "New requirement",
  "Pain point emerges",
  "Performance issue",
  "Recommendation",
  "Other",
];

// Consumer purchase triggers presets
const consumerPurchaseTriggersOptions = [
  "Advertisement",
  "Back-to-school",
  "Discount or coupon",
  "Emergency",
  "Free shipping threshold",
  "Friend or family recommendation",
  "Gift occasion",
  "Influencer recommendation",
  "Life event (moving, marriage, new job)",
  "Limited-time offer",
  "New product release",
  "Product goes viral",
  "Running out / replenishment",
  "Seasonal/holiday sale",
  "Social media",
  "Seasonal",
  "Other",
];

// New presets for decision power and budget
const decisionPowerOptions = [
  "No influence",
  "Influencer",
  "Recommender",
  "Shared decision-maker",
  "Final decision maker",
];

const budgetRangeOptions = [
  "Under $10,000",
  "$10,000–$24,999",
  "$25,000–$49,999",
  "$50,000–$99,999",
  "$100,000–$249,999",
  "$250,000–$499,999",
  "$500,000–$999,999",
  "$1,000,000+",
];

const sortedIndustryOptions = (() => {
  const rest = industryOptions
    .filter((o) => o !== "Other")
    .sort((a, b) => a.localeCompare(b));
  return [...rest, "Other"];
})();
const sortedDepartmentOptions = (() => {
  const rest = departmentOptions
    .filter((o) => o !== "Other")
    .sort((a, b) => a.localeCompare(b));
  return [...rest, "Other"];
})();
const sortedDeviceOptions = (() => {
  const rest = deviceOptions
    .filter((o) => o !== "Other")
    .sort((a, b) => a.localeCompare(b));
  return [...rest, "Other"];
})();
const sortedChannelOptions = (() => {
  const rest = channelOptions
    .filter((o) => o !== "Other")
    .sort((a, b) => a.localeCompare(b));
  return [...rest, "Other"];
})();
const sortedPurchaseTriggersOptions = (() => {
  const rest = purchaseTriggersOptions
    .filter((o) => o !== "Other")
    .sort((a, b) => a.localeCompare(b));
  return [...rest, "Other"];
})();
const sortedConsumerPurchaseTriggersOptions = (() => {
  const rest = consumerPurchaseTriggersOptions
    .filter((o) => o !== "Other")
    .sort((a, b) => a.localeCompare(b));
  return [...rest, "Other"];
})();

// type defined once above

export function PersonaForm() {
  const [submitting, setSubmitting] = useState(false);
  // removed country/state and toggle state; we always use Places
  const [customFields, setCustomFields] = useState<{ [k: string]: boolean }>({
    techProficiency: false,
    companySize: false,
    roleSeniority: false,
    primaryDevices: false,
    preferredChannels: false,
    age: false,
    gender: false,
    education: false,
    income: false,
    maritalStatus: false,
    householdSize: false,
    industry: false,
    department: false,
    decisionPower: false,
    budgetRange: false,
    personality: false,
    goals: false,
    purchaseTriggers: false,
  });
  const [purchaseContext, setPurchaseContext] = useState<"b2b" | "consumer">(
    "b2b",
  );
  // Local draft for the custom goals input so we don't clobber form state
  const [customGoalDraft, setCustomGoalDraft] = useState("");

  const form = useForm<PersonaFormValues>({
    resolver: zodResolver(personaSchema),
    defaultValues: {
      demographics: {
        age: "",
        gender: "",
        location: "",
        education: "",
        income: "",
        maritalStatus: "",
        householdSize: "",
      },
      psychographics: {
        personality: "",
        interests: "",
        values: "",
        motivations: "",
        painPoints: "",
      },
      behaviors: {
        techProficiency: "",
        primaryDevices: [],
        preferredChannels: [],
  purchaseTriggers: [],
      },
      firmographics: {
        companySize: "",
        industry: "",
        roleSeniority: "",
        department: "",
        decisionPower: "",
        budgetRange: "",
      },
      goals: "",
      quotes: "",
    },
  });

  const onSubmit = async (data: PersonaFormValues) => {
    setSubmitting(true);
    try {
      const resp = await createPersona(data);
      if (!resp?.success) {
        console.error("Failed to create persona", resp?.error);
        return;
      }
      // For now just log; later redirect to a persona details page
      console.log("Persona created", resp.persona);
    } finally {
      setSubmitting(false);
    }
  };

  // Removed Section header; we render only the content grid inside a bordered container

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        autoComplete="off"
        className="flex flex-col gap-6"
      >
        {/* Basics intentionally removed; generated on submit */}

        {/* Optional sections in accordion for compactness */}
        <Accordion
          type="multiple"
          className="w-full"
          defaultValue={["demographics"]}
        >
          <AccordionItem value="demographics">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex w-full items-center justify-between gap-4">
                <div className="font-medium">
                  <span className="font-semibold">Demographics</span>
                  <span></span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
                  <FormField
                    control={form.control}
                    name="demographics.age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Age</FormLabel>
                        {!customFields.age ? (
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(v) => field.onChange(v)}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select range" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ageOptions.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({ ...s, age: true }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                placeholder="Enter custom age or range"
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({ ...s, age: false }))
                              }
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="demographics.gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        {!customFields.gender ? (
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(v) => field.onChange(v)}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {genderOptions.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({ ...s, gender: true }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                placeholder="Enter custom value"
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  gender: false,
                                }))
                              }
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="demographics.location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <div className="flex flex-col gap-3">
                          <LocationAutocomplete
                            value={field.value || ""}
                            onChange={(val) => field.onChange(val)}
                          />
                          <input
                            type="hidden"
                            value={field.value || ""}
                            readOnly
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="demographics.education"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Education</FormLabel>
                        {!customFields.education ? (
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(v) => field.onChange(v)}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select education" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {educationOptions.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  education: true,
                                }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                placeholder="Enter custom education"
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  education: false,
                                }))
                              }
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="demographics.income"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Income</FormLabel>
                        {!customFields.income ? (
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(v) => field.onChange(v)}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select range" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {incomeOptions.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({ ...s, income: true }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                placeholder="Enter custom income"
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  income: false,
                                }))
                              }
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="demographics.maritalStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marital status</FormLabel>
                        {!customFields.maritalStatus ? (
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(v) => field.onChange(v)}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {maritalStatusOptions.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  maritalStatus: true,
                                }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                placeholder="Enter custom status"
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  maritalStatus: false,
                                }))
                              }
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="demographics.householdSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Household size</FormLabel>
                        {!customFields.householdSize ? (
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(v) => field.onChange(v)}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {householdSizeOptions.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  householdSize: true,
                                }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                placeholder="Enter custom size"
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  householdSize: false,
                                }))
                              }
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="psychographics">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex w-full items-center justify-between gap-4">
                <div className="font-medium">
                  <span className="font-semibold">Psychographics</span>
                  <span></span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
                  <FormField
                    control={form.control}
                    name="psychographics.personality"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Personality</FormLabel>
                        {!customFields.personality ? (
                          <div className="flex flex-col gap-2">
                            <div className="text-xs text-zinc-500">
                              Type:{" "}
                              <span className="font-medium text-zinc-700">
                                {(field.value || "").toUpperCase() || "—"}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                              {/* E / I */}
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-zinc-500">
                                  Energy
                                </span>
                                <Select
                                  onValueChange={(v) => {
                                    const code = (
                                      field.value || ""
                                    ).toUpperCase();
                                    const e = v;
                                    const s =
                                      code[1] && ["S", "N"].includes(code[1])
                                        ? code[1]
                                        : "";
                                    const t =
                                      code[2] && ["T", "F"].includes(code[2])
                                        ? code[2]
                                        : "";
                                    const j =
                                      code[3] && ["J", "P"].includes(code[3])
                                        ? code[3]
                                        : "";
                                    field.onChange(
                                      [e, s, t, j].filter(Boolean).join(""),
                                    );
                                  }}
                                  value={
                                    (field.value || "").toUpperCase()[0] &&
                                    ["E", "I"].includes(
                                      (field.value || "").toUpperCase()[0],
                                    )
                                      ? (field.value as string).toUpperCase()[0]
                                      : undefined
                                  }
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="E / I" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="E">
                                      Extraversion (E)
                                    </SelectItem>
                                    <SelectItem value="I">
                                      Introversion (I)
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {/* S / N */}
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-zinc-500">
                                  Information
                                </span>
                                <Select
                                  onValueChange={(v) => {
                                    const code = (
                                      field.value || ""
                                    ).toUpperCase();
                                    const e =
                                      code[0] && ["E", "I"].includes(code[0])
                                        ? code[0]
                                        : "";
                                    const s = v;
                                    const t =
                                      code[2] && ["T", "F"].includes(code[2])
                                        ? code[2]
                                        : "";
                                    const j =
                                      code[3] && ["J", "P"].includes(code[3])
                                        ? code[3]
                                        : "";
                                    field.onChange(
                                      [e, s, t, j].filter(Boolean).join(""),
                                    );
                                  }}
                                  value={
                                    (field.value || "").toUpperCase()[1] &&
                                    ["S", "N"].includes(
                                      (field.value || "").toUpperCase()[1],
                                    )
                                      ? (field.value as string).toUpperCase()[1]
                                      : undefined
                                  }
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="S / N" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="S">
                                      Sensing (S)
                                    </SelectItem>
                                    <SelectItem value="N">
                                      Intuition (N)
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {/* T / F */}
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-zinc-500">
                                  Decisions
                                </span>
                                <Select
                                  onValueChange={(v) => {
                                    const code = (
                                      field.value || ""
                                    ).toUpperCase();
                                    const e =
                                      code[0] && ["E", "I"].includes(code[0])
                                        ? code[0]
                                        : "";
                                    const s =
                                      code[1] && ["S", "N"].includes(code[1])
                                        ? code[1]
                                        : "";
                                    const t = v;
                                    const j =
                                      code[3] && ["J", "P"].includes(code[3])
                                        ? code[3]
                                        : "";
                                    field.onChange(
                                      [e, s, t, j].filter(Boolean).join(""),
                                    );
                                  }}
                                  value={
                                    (field.value || "").toUpperCase()[2] &&
                                    ["T", "F"].includes(
                                      (field.value || "").toUpperCase()[2],
                                    )
                                      ? (field.value as string).toUpperCase()[2]
                                      : undefined
                                  }
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="T / F" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="T">
                                      Thinking (T)
                                    </SelectItem>
                                    <SelectItem value="F">
                                      Feeling (F)
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {/* J / P */}
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-zinc-500">
                                  Lifestyle
                                </span>
                                <Select
                                  onValueChange={(v) => {
                                    const code = (
                                      field.value || ""
                                    ).toUpperCase();
                                    const e =
                                      code[0] && ["E", "I"].includes(code[0])
                                        ? code[0]
                                        : "";
                                    const s =
                                      code[1] && ["S", "N"].includes(code[1])
                                        ? code[1]
                                        : "";
                                    const t =
                                      code[2] && ["T", "F"].includes(code[2])
                                        ? code[2]
                                        : "";
                                    const j = v;
                                    field.onChange(
                                      [e, s, t, j].filter(Boolean).join(""),
                                    );
                                  }}
                                  value={
                                    (field.value || "").toUpperCase()[3] &&
                                    ["J", "P"].includes(
                                      (field.value || "").toUpperCase()[3],
                                    )
                                      ? (field.value as string).toUpperCase()[3]
                                      : undefined
                                  }
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="J / P" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="J">
                                      Judging (J)
                                    </SelectItem>
                                    <SelectItem value="P">
                                      Perceiving (P)
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="text-zinc-500"
                                onClick={() =>
                                  setCustomFields((s) => ({
                                    ...s,
                                    personality: true,
                                  }))
                                }
                              >
                                Enter custom value
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                placeholder="e.g., Analytical, detail-oriented or MBTI type (e.g., ENTP)"
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  personality: false,
                                }))
                              }
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="psychographics.interests"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Interests</FormLabel>
                        <ListEditor
                          values={
                            Array.isArray(field.value)
                              ? (field.value as string[])
                              : field.value
                                ? String(field.value)
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                : []
                          }
                          onChange={(next) => field.onChange(next)}
                          placeholder="Add an interest and press Enter"
                          addLabel="Add"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="psychographics.values"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Values</FormLabel>
                        <ListEditor
                          values={
                            Array.isArray(field.value)
                              ? (field.value as string[])
                              : field.value
                                ? String(field.value)
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                : []
                          }
                          onChange={(next) => field.onChange(next)}
                          placeholder="Add a value and press Enter"
                          addLabel="Add"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="psychographics.motivations"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Motivations</FormLabel>
                        <ListEditor
                          values={
                            Array.isArray(field.value)
                              ? (field.value as string[])
                              : field.value
                                ? String(field.value)
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                : []
                          }
                          onChange={(next) => field.onChange(next)}
                          placeholder="Add a motivation and press Enter"
                          addLabel="Add"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="psychographics.painPoints"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Pain points</FormLabel>
                        <ListEditor
                          values={
                            Array.isArray(field.value)
                              ? (field.value as string[])
                              : field.value
                                ? String(field.value)
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                : []
                          }
                          onChange={(next) => field.onChange(next)}
                          placeholder="Add a pain point and press Enter"
                          addLabel="Add"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="behaviors">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex w-full items-center justify-between gap-4">
                <div className="font-medium">
                  <span className="font-semibold">Behaviors</span>
                  <span></span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
                  {/* Tech proficiency: presets with custom override link */}
                  <FormField
                    control={form.control}
                    name="behaviors.techProficiency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tech proficiency</FormLabel>
                        {!customFields.techProficiency ? (
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(v) => field.onChange(v)}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select level" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {techProficiencyOptions.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  techProficiency: true,
                                }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                placeholder="Enter a custom level"
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  techProficiency: false,
                                }))
                              }
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="behaviors.primaryDevices"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary devices</FormLabel>
                        {!customFields.primaryDevices ? (
                          <div className="flex items-center gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" type="button">
                                  {Array.isArray(field.value) &&
                                  field.value.length > 0
                                    ? `${field.value.length} selected`
                                    : "Select devices"}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="start"
                                className="w-64"
                              >
                                {sortedDeviceOptions.map((dev) => {
                                  const current: string[] = Array.isArray(
                                    field.value,
                                  )
                                    ? field.value
                                    : [];
                                  const checked = current.includes(dev);
                                  return (
                                    <DropdownMenuCheckboxItem
                                      key={dev}
                                      checked={checked}
                                      onSelect={(e) => e.preventDefault()}
                                      onCheckedChange={(isChecked) => {
                                        const next = isChecked
                                          ? [...current, dev]
                                          : current.filter((d) => d !== dev);
                                        field.onChange(next);
                                      }}
                                    >
                                      {dev}
                                    </DropdownMenuCheckboxItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  primaryDevices: true,
                                }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 md:col-span-2">
                            <FormControl>
                              <Input
                                placeholder="e.g., iPhone, MacBook"
                                value={
                                  (Array.isArray(field.value)
                                    ? (field.value as string[]).join(", ")
                                    : (field.value as string)) || ""
                                }
                                onChange={(e) => field.onChange(e.target.value)}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() => {
                                // When switching back to presets, normalize string to array tokens
                                const v = field.value;
                                const arr = Array.isArray(v)
                                  ? v
                                  : (v || "")
                                      .split(",")
                                      .map((s) => s.trim())
                                      .filter(Boolean);
                                field.onChange(arr);
                                setCustomFields((s) => ({
                                  ...s,
                                  primaryDevices: false,
                                }));
                              }}
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="behaviors.preferredChannels"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Preferred channels</FormLabel>
                        {!customFields.preferredChannels ? (
                          <div className="flex items-center gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" type="button">
                                  {Array.isArray(field.value) &&
                                  field.value.length > 0
                                    ? `${field.value.length} selected`
                                    : "Select channels"}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="start"
                                className="w-72"
                              >
                                {sortedChannelOptions.map((ch) => {
                                  const current: string[] = Array.isArray(
                                    field.value,
                                  )
                                    ? field.value
                                    : [];
                                  const checked = current.includes(ch);
                                  return (
                                    <DropdownMenuCheckboxItem
                                      key={ch}
                                      checked={checked}
                                      onSelect={(e) => e.preventDefault()}
                                      onCheckedChange={(isChecked) => {
                                        const next = isChecked
                                          ? [...current, ch]
                                          : current.filter((d) => d !== ch);
                                        field.onChange(next);
                                      }}
                                    >
                                      {ch}
                                    </DropdownMenuCheckboxItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  preferredChannels: true,
                                }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 md:col-span-2">
                            <FormControl>
                              <Input
                                placeholder="e.g., Email, YouTube, Reddit"
                                value={
                                  (Array.isArray(field.value)
                                    ? (field.value as string[]).join(", ")
                                    : (field.value as string)) || ""
                                }
                                onChange={(e) => field.onChange(e.target.value)}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() => {
                                const v = field.value;
                                const arr = Array.isArray(v)
                                  ? v
                                  : (v || "")
                                      .split(",")
                                      .map((s) => s.trim())
                                      .filter(Boolean);
                                field.onChange(arr);
                                setCustomFields((s) => ({
                                  ...s,
                                  preferredChannels: false,
                                }));
                              }}
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="behaviors.purchaseTriggers"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Purchase triggers</FormLabel>
                        {!customFields.purchaseTriggers ? (
                          <div className="mt-1 flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  "text-xs " +
                                  (purchaseContext === "b2b"
                                    ? "font-medium text-zinc-900"
                                    : "text-zinc-500")
                                }
                              >
                                B2B
                              </span>
                              <Switch
                                checked={purchaseContext === "consumer"}
                                onCheckedChange={(checked) => {
                                  const nextCtx = checked ? "consumer" : "b2b";
                                  setPurchaseContext(nextCtx);
                                  const opts =
                                    nextCtx === "b2b"
                                      ? sortedPurchaseTriggersOptions
                                      : sortedConsumerPurchaseTriggersOptions;
                                  const current: string[] = Array.isArray(field.value)
                                    ? (field.value as string[])
                                    : field.value
                                      ? [String(field.value)]
                                      : [];
                                  const filtered = current.filter((v) => opts.includes(v));
                                  if (filtered.length !== current.length) {
                                    field.onChange(filtered);
                                  }
                                }}
                                aria-label="Toggle B2C/B2B presets"
                                className="data-[state=checked]:bg-zinc-200 data-[state=unchecked]:bg-zinc-200 dark:data-[state=checked]:bg-zinc-800 dark:data-[state=unchecked]:bg-zinc-800"
                              />
                              <span
                                className={
                                  "text-xs " +
                                  (purchaseContext === "consumer"
                                    ? "font-medium text-zinc-900"
                                    : "text-zinc-500")
                                }
                              >
                                B2C
                              </span>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" type="button">
                                  {Array.isArray(field.value) && (field.value as string[]).length > 0
                                    ? `${(field.value as string[]).length} selected`
                                    : "Select triggers"}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-72">
                                {(purchaseContext === "b2b"
                                  ? sortedPurchaseTriggersOptions
                                  : sortedConsumerPurchaseTriggersOptions
                                ).map((opt) => {
                                  const current: string[] = Array.isArray(field.value)
                                    ? (field.value as string[])
                                    : [];
                                  const checked = current.includes(opt);
                                  return (
                                    <DropdownMenuCheckboxItem
                                      key={opt}
                                      checked={checked}
                                      onSelect={(e) => e.preventDefault()}
                                      onCheckedChange={(isChecked) => {
                                        const next = isChecked
                                          ? [...current, opt]
                                          : current.filter((v) => v !== opt);
                                        field.onChange(next);
                                      }}
                                    >
                                      {opt}
                                    </DropdownMenuCheckboxItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  purchaseTriggers: true,
                                }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 md:col-span-2">
                            <FormControl className="flex-1">
                              <Input
                                placeholder="e.g., Contract renewal in Q4, Seasonal promo"
                                value={
                                  Array.isArray(field.value)
                                    ? (field.value as string[]).join(", ")
                                    : (field.value as string) || ""
                                }
                                onChange={(e) => field.onChange(e.target.value)}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() => {
                                const v = field.value as string | string[] | undefined;
                                const arr = Array.isArray(v)
                                  ? v
                                  : (v || "")
                                      .split(",")
                                      .map((s) => s.trim())
                                      .filter(Boolean);
                                field.onChange(arr);
                                setCustomFields((s) => ({
                                  ...s,
                                  purchaseTriggers: false,
                                }));
                              }}
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="firmographics">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex w-full items-center justify-between gap-4">
                <div className="font-medium">
                  <span className="font-semibold">Firmographics</span>
                  <span></span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
                  {/* Company size with custom override link */}
                  <FormField
                    control={form.control}
                    name="firmographics.companySize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company size</FormLabel>
                        {!customFields.companySize ? (
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(v) => field.onChange(v)}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {companySizeOptions.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  companySize: true,
                                }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                placeholder="Enter a custom range"
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  companySize: false,
                                }))
                              }
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="firmographics.industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry</FormLabel>
                        {!customFields.industry ? (
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(v) => field.onChange(v)}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select industry" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {sortedIndustryOptions.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  industry: true,
                                }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                placeholder="Enter custom industry"
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  industry: false,
                                }))
                              }
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Role seniority with custom override link */}
                  <FormField
                    control={form.control}
                    name="firmographics.roleSeniority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role seniority</FormLabel>
                        {!customFields.roleSeniority ? (
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(v) => field.onChange(v)}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select seniority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {roleSeniorityOptions.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  roleSeniority: true,
                                }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                placeholder="Enter a custom seniority"
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  roleSeniority: false,
                                }))
                              }
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="firmographics.department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        {!customFields.department ? (
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(v) => field.onChange(v)}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {sortedDepartmentOptions.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  department: true,
                                }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                placeholder="Enter custom department"
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  department: false,
                                }))
                              }
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="firmographics.decisionPower"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Decision power</FormLabel>
                        {!customFields.decisionPower ? (
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(v) => field.onChange(v)}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select level" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {decisionPowerOptions.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  decisionPower: true,
                                }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                placeholder="e.g., Final decision maker"
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  decisionPower: false,
                                }))
                              }
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="firmographics.budgetRange"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget range</FormLabel>
                        {!customFields.budgetRange ? (
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(v) => field.onChange(v)}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select range" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {budgetRangeOptions.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  budgetRange: true,
                                }))
                              }
                            >
                              Enter custom value
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                placeholder="e.g., $10k–$50k annually"
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="text-zinc-500"
                              onClick={() =>
                                setCustomFields((s) => ({
                                  ...s,
                                  budgetRange: false,
                                }))
                              }
                            >
                              Use presets
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="goals">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex w-full items-center justify-between gap-4">
                <div className="font-medium">
                  <span className="font-semibold">Goals</span>
                  <span></span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
                  <FormField
                    control={form.control}
                    name="goals"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        {!customFields.goals ? (
                          <div className="flex w-full flex-col gap-2">
                            <FormLabel>Goals</FormLabel>
                            <GoalsEditor
                              value={field.value}
                              onChange={(next) => field.onChange(next)}
                              placeholderWant="reduce onboarding time"
                              placeholderSoThat="launch projects faster"
                              rightAction={
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  className="text-zinc-500"
                                  onClick={() =>
                                    setCustomFields((s) => ({
                                      ...s,
                                      goals: true,
                                    }))
                                  }
                                >
                                  Enter custom value
                                </Button>
                              }
                            />
                          </div>
                        ) : (
                          <div className="flex w-full flex-col gap-2">
                            <FormLabel>Goals</FormLabel>
                            <div className="flex items-center gap-2">
                              <FormControl className="flex-1">
                                <Input
                                  placeholder="Describe the goal in your own words"
                                  value={customGoalDraft}
                                  onChange={(e) =>
                                    setCustomGoalDraft(e.target.value)
                                  }
                                  onBlur={field.onBlur}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const val = customGoalDraft.trim();
                                      if (!val) return;
                                      let next: unknown;
                                      if (Array.isArray(field.value)) {
                                        const arr = field.value as any[];
                                        if (
                                          arr.every(
                                            (v) => typeof v === "string",
                                          )
                                        ) {
                                          next = [...(arr as string[]), val];
                                        } else {
                                          // Structured goals array
                                          next = [
                                            ...(arr as {
                                              want: string;
                                              soThat: string;
                                            }[]),
                                            { want: val, soThat: "" },
                                          ];
                                        }
                                      } else {
                                        next = [val];
                                      }
                                      field.onChange(next);
                                      setCustomGoalDraft("");
                                    }
                                  }}
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                className="shrink-0"
                                disabled={!customGoalDraft.trim()}
                                onClick={() => {
                                  const val = customGoalDraft.trim();
                                  if (!val) return;
                                  let next: unknown;
                                  if (Array.isArray(field.value)) {
                                    const arr = field.value as any[];
                                    if (
                                      arr.every((v) => typeof v === "string")
                                    ) {
                                      next = [...(arr as string[]), val];
                                    } else {
                                      next = [
                                        ...(arr as {
                                          want: string;
                                          soThat: string;
                                        }[]),
                                        { want: val, soThat: "" },
                                      ];
                                    }
                                  } else {
                                    next = [val];
                                  }
                                  field.onChange(next);
                                  setCustomGoalDraft("");
                                }}
                                aria-label="Add goal"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="shrink-0 text-zinc-500"
                                onClick={() =>
                                  setCustomFields((s) => ({
                                    ...s,
                                    goals: false,
                                  }))
                                }
                              >
                                Use editor
                              </Button>
                            </div>
                            {Array.isArray(field.value) &&
                              (field.value as any[]).every(
                                (v) => typeof v === "string",
                              ) &&
                              (field.value as string[]).length > 0 && (
                                <ul className="mt-2 flex flex-wrap gap-2">
                                  {(field.value as string[]).map((g, idx) => (
                                    <li
                                      key={`${g}-${idx}`}
                                      className="group flex w-fit items-center gap-2 rounded-md border border-zinc-200 bg-zinc-100 px-3 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800/60"
                                    >
                                      <span className="truncate">{g}</span>
                                      <button
                                        type="button"
                                        aria-label="Remove goal"
                                        className="pointer-events-none ml-2 rounded p-1 text-zinc-500 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 hover:text-zinc-900"
                                        onClick={() => {
                                          const next = (
                                            field.value as string[]
                                          ).filter((_, i) => i !== idx);
                                          field.onChange(next);
                                        }}
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            {Array.isArray(field.value) &&
                              (field.value as any[]).every(
                                (v) =>
                                  typeof v === "object" && v && "want" in v,
                              ) &&
                              (field.value as any[]).length > 0 && (
                                <ul className="mt-2 flex flex-wrap gap-2">
                                  {(
                                    field.value as {
                                      want: string;
                                      soThat: string;
                                    }[]
                                  ).map((it, idx) => (
                                    <li
                                      key={`g-${idx}`}
                                      className="group flex w-fit items-center gap-2 rounded-md border border-zinc-200 bg-zinc-100 px-3 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800/60"
                                    >
                                      <span className="truncate">
                                        {[it.want, it.soThat]
                                          .filter(Boolean)
                                          .join(" → ") || "—"}
                                      </span>
                                      <button
                                        type="button"
                                        aria-label="Remove goal"
                                        className="pointer-events-none ml-2 rounded p-1 text-zinc-500 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 hover:text-zinc-900"
                                        onClick={() => {
                                          const next = (
                                            field.value as {
                                              want: string;
                                              soThat: string;
                                            }[]
                                          ).filter((_, i) => i !== idx);
                                          field.onChange(next);
                                        }}
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="quotes">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex w-full items-center justify-between gap-4">
                <div className="font-medium">
                  <span className="font-semibold">Quotes</span>
                  <span></span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
                  <FormField
                    control={form.control}
                    name="quotes"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Representative quotes</FormLabel>
                        <MultilineListEditor
                          values={
                            Array.isArray(field.value)
                              ? (field.value as string[])
                              : field.value
                                ? [String(field.value)]
                                : []
                          }
                          onChange={(next) => field.onChange(next)}
                          placeholder="Add a quote and click +"
                          chipWidthClass="w-96"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex items-center gap-3">
          <Button className="w-32" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
          <p className="text-muted-foreground text-xs">
            All fields are optional. Add as much detail as you need.
          </p>
        </div>
      </form>
    </Form>
  );
}

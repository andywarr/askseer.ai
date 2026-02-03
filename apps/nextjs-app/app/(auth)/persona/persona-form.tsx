"use client";

// React imports
import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

// Zod imports
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Lib imports
import { PersonaSchema } from "@/apps/shared/jobSchema";
import {
  initStudy,
  finalizeAndQueueStudy,
  putPresignedUrls,
  cleanupOrphanedStudy,
} from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import { toast } from "sonner";
import {
  isOffline,
  uploadFileWithRetry,
  getUploadErrorMessage,
} from "@/apps/nextjs-app/utils/upload";

// Component imports
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
import { ListEditor } from "./list-editor";
import { MultilineListEditor } from "./multiline-list-editor";
import { GoalsEditor } from "./goals-editor";
import { Plus, X, Loader2 } from "lucide-react";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";

// Extracted memoized section components
import {
  DemographicsSection,
  PsychographicsSection,
  BehaviorsSection,
  FirmographicsSection,
} from "./sections";


// Form options - extracted to separate file to avoid re-creation on every render
import {
  techProficiencyOptions,
  companySizeOptions,
  roleSeniorityOptions,
  ageOptions,
  genderOptions,
  ethnicityOptions,
  educationOptions,
  incomeOptions,
  maritalStatusOptions,
  deviceOptions,
  channelOptions,
  industryOptions,
  departmentOptions,
  purchaseTriggersOptions,
  consumerPurchaseTriggersOptions,
  decisionPowerOptions,
  budgetRangeOptions,
  employmentStatusOptions,
  annualRecurringRevenueOptions,
  sortedIndustryOptions,
  sortedDepartmentOptions,
  sortedDeviceOptions,
  sortedChannelOptions,
  sortedPurchaseTriggersOptions,
  sortedConsumerPurchaseTriggersOptions,
  nonEmployedStatuses,
} from "./persona-form-options";

type PersonaFormValues = z.infer<typeof PersonaSchema>;

export function PersonaForm(props: {
  credits: number;
  canPurchaseCredits?: boolean;
  initialData?: PersonaFormValues;
  studyId?: string;
  mode?: "create" | "edit";
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [connectivityError, setConnectivityError] = useState<string | null>(
    null,
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
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
    employmentStatus: false,
    annualRecurringRevenue: false,
    personality: false,
    goals: false,
    purchaseTriggers: false,
    ethnicity: false,
  });
  const [purchaseContext, setPurchaseContext] = useState<"b2b" | "consumer">(
    "b2b",
  );
  // Local draft for the custom goals input so we don't clobber form state
  const [customGoalDraft, setCustomGoalDraft] = useState("");
  // State for the tools input row
  const [currentTool, setCurrentTool] = useState("");
  const [currentExpertise, setCurrentExpertise] = useState("");
  const [currentFrequency, setCurrentFrequency] = useState("");
  const [currentSatisfaction, setCurrentSatisfaction] = useState("");

  // Memoized handler for toggling custom field modes - stable reference for memoized children
  const handleToggleCustomField = useCallback(
    (field: string, value: boolean) => {
      setCustomFields((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const form = useForm<PersonaFormValues>({
    resolver: zodResolver(PersonaSchema),
    defaultValues: props.initialData || {
      name: "",
      description: "",
      images: {
        photoKey: undefined,
        coverKey: undefined,
      },
      demographics: {
        age: "",
        ethnicity: "",
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
      tools: [],
      firmographics: {
        companySize: "",
        industry: "",
        roleSeniority: "",
        jobTitle: "",
        department: "",
        decisionPower: "",
        budgetRange: "",
        employmentStatus: "",
        annualRecurringRevenue: "",
      },
      goals: "",
      quotes: "",
    },
  });

  // Helper to determine whether any meaningful value exists in the form data.
  const hasValue = (v: any): boolean => {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0 && v.some(hasValue);
    if (typeof v === "object") return Object.values(v).some(hasValue);
    if (typeof v === "string") return v.trim().length > 0;
    if (typeof v === "number" || typeof v === "boolean") return true;
    return false;
  };

  // Calculate which accordion sections should be expanded based on prefilled data
  const getDefaultExpandedSections = (): string[] => {
    if (props.mode !== "edit" || !props.initialData) {
      return ["information"]; // In create mode, only expand information
    }

    const sections: string[] = ["information"]; // Always include information in edit mode
    const data = props.initialData;

    // Check demographics
    if (data.demographics && hasValue(data.demographics)) {
      sections.push("demographics");
    }

    // Check psychographics
    if (data.psychographics && hasValue(data.psychographics)) {
      sections.push("psychographics");
    }

    // Check behaviors
    if (data.behaviors && hasValue(data.behaviors)) {
      sections.push("behaviors");
    }

    // Check tools
    if (data.tools && hasValue(data.tools)) {
      sections.push("tools");
    }

    // Check firmographics
    if (data.firmographics && hasValue(data.firmographics)) {
      sections.push("firmographics");
    }

    // Check goals
    if (data.goals && hasValue(data.goals)) {
      sections.push("goals");
    }

    // Check quotes
    if (data.quotes && hasValue(data.quotes)) {
      sections.push("quotes");
    }

    return sections;
  };

  // Subscribe to the whole form so we can compute whether it's completely empty.
  const watchedValues = form.watch();
  const isAllEmpty = !hasValue(watchedValues) && !photoFile && !coverFile;

  // Watch employment status and clear other firmographic fields when unemployed/student/retired
  const employmentStatus = form.watch("firmographics.employmentStatus");
  useEffect(() => {
    if (["Unemployed", "Student", "Retired"].includes(employmentStatus || "")) {
      form.setValue("firmographics.companySize", "", {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue("firmographics.industry", "", {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue("firmographics.roleSeniority", "", {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue("firmographics.jobTitle", "", {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue("firmographics.department", "", {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue("firmographics.decisionPower", "", {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue("firmographics.budgetRange", "", {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue("firmographics.annualRecurringRevenue", "", {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [employmentStatus, form]);

  // Watch decision power and clear budget range when "No influence" is selected
  const decisionPower = form.watch("firmographics.decisionPower");
  useEffect(() => {
    if (decisionPower === "No influence") {
      form.setValue("firmographics.budgetRange", "", {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [decisionPower, form]);

  // Load existing image previews in edit mode
  useEffect(() => {
    if (props.mode === "edit" && props.initialData?.images) {
      const loadImagePreviews = async () => {
        const { getPresignedUrls } =
          await import("@/apps/nextjs-app/lib/actions/s3-actions");

        const images = props.initialData?.images;
        if (!images) return;

        // Load photo preview
        if (images.photoKey) {
          try {
            const result = await getPresignedUrls(images.photoKey);
            if (result.success && result.data) {
              setPhotoPreview(result.data);
            }
          } catch (error) {
            console.error("Failed to load photo preview:", error);
          }
        }

        // Load cover preview
        if (images.coverKey) {
          try {
            const result = await getPresignedUrls(images.coverKey);
            if (result.success && result.data) {
              setCoverPreview(result.data);
            }
          } catch (error) {
            console.error("Failed to load cover preview:", error);
          }
        }
      };

      loadImagePreviews();
    }
  }, [props.mode, props.initialData]);

  // Clear connectivity error when user comes back online
  useEffect(() => {
    const handleOnline = () => {
      if (connectivityError) {
        setConnectivityError(null);
        toast.success("You're back online", {
          description: "You can now submit your persona.",
        });
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [connectivityError]);

  const onSubmit = async (data: PersonaFormValues) => {
    setLoading(true);
    setConnectivityError(null);
    let studyId: string | undefined;
    try {
      // Check if user is offline before proceeding
      if (isOffline()) {
        setConnectivityError(
          "You appear to be offline. Please check your internet connection.",
        );
        toast.error("You're offline", {
          description: "Please check your internet connection and try again.",
        });
        setLoading(false);
        return;
      }

      // 1) Validate client-side using the schema (no strict required fields)
      const parsed = PersonaSchema.safeParse(data);
      if (!parsed.success) {
        console.error("Invalid persona data", parsed.error.flatten());
        return;
      }

      // Edit mode: update existing persona
      if (props.mode === "edit" && props.studyId) {
        const { updatePersona } =
          await import("@/apps/nextjs-app/lib/actions/persona-actions");

        // Handle image uploads if new files are selected
        let photoKey: string | undefined = parsed.data.images?.photoKey;
        let coverKey: string | undefined = parsed.data.images?.coverKey;

        const uploadItems: { kind: "photo" | "cover"; file: File }[] = [];
        if (photoFile) uploadItems.push({ kind: "photo", file: photoFile });
        if (coverFile) uploadItems.push({ kind: "cover", file: coverFile });

        if (uploadItems.length > 0) {
          const presigned = await putPresignedUrls(
            uploadItems.map((u) => ({
              name: u.file.name,
              type: u.file.type,
              size: u.file.size,
            })),
            props.studyId,
          );

          for (let i = 0; i < presigned.length; i++) {
            const { uploadURL, key } = presigned[i] as any;
            const item = uploadItems[i];
            await uploadFileWithRetry(item.file, uploadURL);
            if (item.kind === "photo") photoKey = key;
            if (item.kind === "cover") coverKey = key;
          }
        }

        const personaPayload = {
          ...parsed.data,
          images: {
            photoKey: photoKey ?? undefined,
            coverKey: coverKey ?? undefined,
          },
        } as PersonaFormValues;

        const result = await updatePersona(props.studyId, personaPayload);

        if (!result.success) {
          console.error("Failed to update persona", result.error);
          return;
        }

        // Call onSuccess callback if provided
        if (props.onSuccess) {
          props.onSuccess();
        }

        // Redirect to the NEW persona version's study page
        const newStudyId = result.data?.newStudyId || props.studyId;
        router.push(`/persona/${newStudyId}`);
        return;
      }

      // Create mode: initialize a study (type PERSONA) with the persona name if provided
      const study = await initStudy(
        data.name && data.name.trim().length > 0 ? data.name.trim() : null,
        "persona",
      );
      studyId = study.id; // Track studyId for cleanup if needed

      // 3) Upload images if provided and collect S3 keys
      const uploadItems: { kind: "photo" | "cover"; file: File }[] = [];
      if (photoFile) uploadItems.push({ kind: "photo", file: photoFile });
      if (coverFile) uploadItems.push({ kind: "cover", file: coverFile });

      let photoKey: string | undefined;
      let coverKey: string | undefined;
      let uploadedFiles: Array<{
        name: string;
        key: string;
        size: number;
        type: string;
      }> = [];

      if (uploadItems.length > 0) {
        // Request presigned URLs
        const presigned = await putPresignedUrls(
          uploadItems.map((u) => ({
            name: u.file.name,
            type: u.file.type,
            size: u.file.size,
          })),
          study.id,
        );
        // Upload in sequence to keep mapping simple
        for (let i = 0; i < presigned.length; i++) {
          const { uploadURL, key } = presigned[i] as any;
          const item = uploadItems[i];
          await uploadFileWithRetry(item.file, uploadURL);
          if (item.kind === "photo") photoKey = key;
          if (item.kind === "cover") coverKey = key;
          uploadedFiles.push({
            name: item.file.name,
            key,
            size: item.file.size,
            type: item.file.type,
          });
        }
      }

      // 4) Finalize and queue using the persona JSON blob in jobData.extra
      const personaPayload = {
        ...parsed.data,
        // Only include images when keys exist
        images:
          photoKey || coverKey
            ? {
                photoKey: photoKey ?? undefined,
                coverKey: coverKey ?? undefined,
              }
            : parsed.data.images,
      } as PersonaFormValues;

      await finalizeAndQueueStudy("persona", study.id, {
        persona: {
          files: uploadedFiles,
          // Keep full authored form data under `data` per shared schema
          data: personaPayload,
        },
      });
      // finalizeAndQueueStudy will redirect to /studies on success
    } catch (error) {
      // Allow framework redirect errors to propagate so navigation proceeds
      const isNextRedirect =
        (error as any)?.digest?.toString?.().startsWith?.("NEXT_REDIRECT") ||
        (error as any)?.message?.includes?.("NEXT_REDIRECT");
      if (isNextRedirect) {
        throw error;
      }

      // Clean up orphaned study if it was created but not finalized
      if (studyId) {
        await cleanupOrphanedStudy(studyId);
      }

      // Get user-friendly error message
      const message = getUploadErrorMessage(error);

      // Check if this is a connectivity-related error
      const isConnectivityIssue =
        isOffline() ||
        message.toLowerCase().includes("offline") ||
        message.toLowerCase().includes("network") ||
        message.toLowerCase().includes("connection");

      if (isConnectivityIssue) {
        setConnectivityError(message);
      }

      // Show toast notification
      const toastTitle = isOffline()
        ? "You're offline"
        : "Failed to create persona";
      toast.error(toastTitle, {
        description: message,
      });

      setLoading(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          autoComplete="off"
          className="flex flex-col"
        >
          <FormDescription className="mb-2 text-black">
            {props.mode === "edit"
              ? "Update the form below to edit the persona. All fields are optional."
              : "Fill out the form below to create a new persona. All fields are optional. Add as much detail as you need."}
          </FormDescription>
          {/* Sections in accordion */}
          <Accordion
            type="multiple"
            className="mb-6 w-full"
            defaultValue={getDefaultExpandedSections()}
          >
            <AccordionItem value="information">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="font-medium">
                    <span className="font-semibold">Information</span>
                    <span></span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-3 rounded-lg border p-4">
                  <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Persona name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Eric - The Engineer"
                              value={field.value || ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="One-liner about this persona"
                              value={field.value || ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Photo upload */}
                    <FormItem>
                      <FormLabel>Photo</FormLabel>
                      <div className="flex items-center gap-3">
                        <div className="h-16 w-16 overflow-hidden rounded-full border bg-zinc-100 dark:border-zinc-800">
                          {photoPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photoPreview}
                              alt="Preview"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                              No photo
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="persona-photo-input"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              // If user canceled the dialog, keep the existing photo
                              if (!f) return;
                              setPhotoFile(f);
                              setPhotoPreview((prev) => {
                                if (prev) URL.revokeObjectURL(prev);
                                return URL.createObjectURL(f);
                              });
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              document
                                .getElementById("persona-photo-input")
                                ?.click()
                            }
                          >
                            {photoFile ? "Change" : "Upload"}
                          </Button>
                          {photoFile && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setPhotoFile(null);
                                setPhotoPreview(null);
                              }}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </FormItem>

                    {/* Cover upload */}
                    <FormItem>
                      <FormLabel>Cover image</FormLabel>
                      <div className="flex items-center gap-3">
                        <div className="h-16 w-32 overflow-hidden rounded-md border bg-zinc-100 dark:border-zinc-800">
                          {coverPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={coverPreview}
                              alt="Preview"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                              No cover
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="persona-cover-input"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              // If user canceled the dialog, keep the existing cover
                              if (!f) return;
                              setCoverFile(f);
                              setCoverPreview((prev) => {
                                if (prev) URL.revokeObjectURL(prev);
                                return URL.createObjectURL(f);
                              });
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              document
                                .getElementById("persona-cover-input")
                                ?.click()
                            }
                          >
                            {coverFile ? "Change" : "Upload"}
                          </Button>
                          {coverFile && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setCoverFile(null);
                                setCoverPreview(null);
                              }}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </FormItem>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            <DemographicsSection
              customFields={customFields}
              onToggleCustomField={handleToggleCustomField}
            />


            <PsychographicsSection
              customFields={customFields}
              onToggleCustomField={handleToggleCustomField}
            />


            <BehaviorsSection
              customFields={customFields}
              onToggleCustomField={handleToggleCustomField}
              purchaseContext={purchaseContext}
              onPurchaseContextChange={setPurchaseContext}
            />


            <AccordionItem value="tools">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="font-medium">
                    <span className="font-semibold">Tools</span>
                    <span></span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-3 rounded-lg border p-4">
                  <FormField
                    control={form.control}
                    name="tools"
                    render={({ field }) => {
                      // Determine if we have structured tools
                      const hasStructuredTools =
                        Array.isArray(field.value) &&
                        field.value.length > 0 &&
                        typeof field.value[0] === "object" &&
                        field.value[0] !== null &&
                        "tool" in field.value[0];

                      const tools = hasStructuredTools
                        ? (field.value as {
                            tool: string;
                            expertise?: string;
                            frequency?: string;
                            satisfaction?: string;
                          }[])
                        : [];

                      const addNewTool = () => {
                        if (!currentTool.trim()) return;
                        const updatedTools = [
                          ...tools,
                          {
                            tool: currentTool.trim(),
                            expertise: currentExpertise || undefined,
                            frequency: currentFrequency || undefined,
                            satisfaction: currentSatisfaction || undefined,
                          },
                        ];
                        field.onChange(updatedTools);
                        setCurrentTool("");
                        setCurrentExpertise("");
                        setCurrentFrequency("");
                        setCurrentSatisfaction("");
                      };

                      const removeTool = (index: number) => {
                        const updatedTools = tools.filter(
                          (_, i) => i !== index,
                        );
                        field.onChange(
                          updatedTools.length > 0 ? updatedTools : [],
                        );
                      };

                      return (
                        <FormItem className="w-full">
                          <div className="flex flex-col gap-3">
                            {/* Input row */}
                            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end lg:flex-nowrap">
                              <div className="w-full md:w-[calc(50%-0.25rem)] lg:flex-1">
                                <FormLabel className="text-xs text-zinc-500">
                                  Tool
                                </FormLabel>
                                <Input
                                  placeholder="e.g., Figma, Slack, Jira"
                                  value={currentTool}
                                  onChange={(e) =>
                                    setCurrentTool(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      addNewTool();
                                    }
                                  }}
                                />
                              </div>
                              <div className="w-full md:w-[calc(50%-0.25rem)] lg:flex-1">
                                <FormLabel className="text-xs text-zinc-500">
                                  Expertise
                                </FormLabel>
                                <Select
                                  value={currentExpertise}
                                  onValueChange={setCurrentExpertise}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select expertise" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Beginner">
                                      Beginner
                                    </SelectItem>
                                    <SelectItem value="Intermediate">
                                      Intermediate
                                    </SelectItem>
                                    <SelectItem value="Advanced">
                                      Advanced
                                    </SelectItem>
                                    <SelectItem value="Expert">
                                      Expert
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="w-full md:w-[calc(50%-0.25rem)] lg:flex-1">
                                <FormLabel className="text-xs text-zinc-500">
                                  Frequency of use
                                </FormLabel>
                                <Select
                                  value={currentFrequency}
                                  onValueChange={setCurrentFrequency}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select frequency" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Daily">Daily</SelectItem>
                                    <SelectItem value="Weekly">
                                      Weekly
                                    </SelectItem>
                                    <SelectItem value="Monthly">
                                      Monthly
                                    </SelectItem>
                                    <SelectItem value="Rarely">
                                      Rarely
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex w-full items-end gap-2 md:w-[calc(50%-0.25rem)] lg:flex-1">
                                <div className="flex-1">
                                  <FormLabel className="text-xs text-zinc-500">
                                    Satisfaction
                                  </FormLabel>
                                  <Select
                                    value={currentSatisfaction}
                                    onValueChange={setCurrentSatisfaction}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Select satisfaction" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Very satisfied">
                                        Very satisfied
                                      </SelectItem>
                                      <SelectItem value="Satisfied">
                                        Satisfied
                                      </SelectItem>
                                      <SelectItem value="Neutral">
                                        Neutral
                                      </SelectItem>
                                      <SelectItem value="Dissatisfied">
                                        Dissatisfied
                                      </SelectItem>
                                      <SelectItem value="Very dissatisfied">
                                        Very dissatisfied
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="icon"
                                  onClick={addNewTool}
                                  disabled={!currentTool.trim()}
                                  className="h-10 w-10 flex-shrink-0"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Display added tools */}
                            {tools.length > 0 && (
                              <div className="flex flex-col gap-2">
                                {tools.map((toolItem, index) => (
                                  <div
                                    key={index}
                                    className="group flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/60"
                                  >
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                                      <span className="font-medium">
                                        {toolItem.tool}
                                      </span>
                                      {(toolItem.expertise ||
                                        toolItem.frequency ||
                                        toolItem.satisfaction) && (
                                        <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                                          {toolItem.expertise && (
                                            <span className="rounded-full bg-zinc-200 px-2 py-0.5 dark:bg-zinc-700">
                                              {toolItem.expertise}
                                            </span>
                                          )}
                                          {toolItem.frequency && (
                                            <span className="rounded-full bg-zinc-200 px-2 py-0.5 dark:bg-zinc-700">
                                              {toolItem.frequency}
                                            </span>
                                          )}
                                          {toolItem.satisfaction && (
                                            <span className="rounded-full bg-zinc-200 px-2 py-0.5 dark:bg-zinc-700">
                                              {toolItem.satisfaction}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      aria-label="Remove tool"
                                      className="ml-2 rounded p-1 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-900 dark:hover:text-zinc-100"
                                      onClick={() => removeTool(index)}
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <FirmographicsSection
              customFields={customFields}
              onToggleCustomField={handleToggleCustomField}
              employmentStatus={form.watch("firmographics.employmentStatus")}
              decisionPower={form.watch("firmographics.decisionPower")}
            />


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
            {props.mode === "edit" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (props.studyId) {
                    router.push(`/persona/${props.studyId}`);
                  } else {
                    router.back();
                  }
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
            {props.mode === "edit" ? (
              <Button
                type="submit"
                disabled={loading || isAllEmpty}
                className="w-32"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            ) : (
              <Button
                type="submit"
                className="w-32"
                disabled={loading || isAllEmpty || props.credits <= 0}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            )}
          </div>
          {connectivityError && (
            <p className="mt-2 text-sm text-red-500 dark:text-red-900">
              {connectivityError}
            </p>
          )}
        </form>
      </Form>

    </>
  );
}

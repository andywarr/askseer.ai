"use client";

// Lib function imports
import {
  initStudy,
  getStudyUploadUrls,
  finalizeAndQueueStudy,
  cleanupOrphanedStudy,
} from "@/apps/nextjs-app/lib/action";
import { toast } from "sonner";

// React imports
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

// Schema imports
import {
  createHeuristicEvaluationSchema,
  type HeuristicEvaluationFormValues,
} from "@/apps/nextjs-app/lib/schema";
import { zodResolver } from "@hookform/resolvers/zod";

// Component imports
import DndProviderComponent from "@/apps/nextjs-app/components/dnd-provider";
import DraggableFileCard from "@/apps/nextjs-app/components/draggable-file-card";
import { Loading } from "@/apps/nextjs-app/components/loading";
import { AArrowDown, AArrowUp, Loader2 } from "lucide-react";

// UI Component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/apps/nextjs-app/components/ui/form";
import { Input } from "@/apps/nextjs-app/components/ui/input";

// Other imports
import update from "immutability-helper";
import { PersonaSelect } from "@/apps/nextjs-app/components/persona-select";
import { HeuristicSelect } from "@/apps/nextjs-app/components/heuristic-select";
import {
  listMyPersonas,
  listMyHeuristicFamilies,
  getPresignedUrls,
} from "@/apps/nextjs-app/lib/action";
import { clientLogger } from "@/apps/nextjs-app/lib/client-logger";
import { fetchFigmaPrototypeImages } from "@/apps/nextjs-app/lib/figma-prototype";
import type { FigmaFileMetadata } from "@/apps/nextjs-app/types/types";
import FormSubmitWithCredits from "@/apps/nextjs-app/components/form-submit-with-credits";
import { useSessionCheck } from "@/apps/nextjs-app/hooks/use-session-check";

export function HeuristicEvaluationForm(props: {
  credits: number;
  maxFiles: number;
  canPurchaseCredits?: boolean;
}) {
  const { checkSession } = useSessionCheck();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const edgeFadeColor = "255, 255, 255";
  const rightEdgeGradient = `linear-gradient(to right, rgba(${edgeFadeColor}, 1) 0%, rgba(${edgeFadeColor}, 0.6) 60%, rgba(${edgeFadeColor}, 0) 100%)`;
  const leftEdgeGradient = `linear-gradient(to left, rgba(${edgeFadeColor}, 1) 0%, rgba(${edgeFadeColor}, 0.6) 60%, rgba(${edgeFadeColor}, 0) 100%)`;

  const [files, setFiles] = useState<File[]>([]);
  // Track Figma metadata for each file by index (null for non-Figma files)
  const [figmaMetadata, setFigmaMetadata] = useState<
    (FigmaFileMetadata | null)[]
  >([]);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const hasUserInteractedWithFiles = useRef(false);
  const [loading, setLoading] = useState(false);
  const [figmaUrl, setFigmaUrl] = useState<string>("");
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [figmaError, setFigmaError] = useState<string>("");
  const [isCardListLoading, setIsCardListLoading] = useState(false);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  const schema = useMemo(
    () => createHeuristicEvaluationSchema(props.maxFiles),
    [props.maxFiles],
  );

  const form = useForm<HeuristicEvaluationFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      goal: "",
      user: "",
      files: [],
      heuristic: "",
      context: "",
    },
  });

  // Personas state
  const [personas, setPersonas] = useState<any[]>([]);
  const [companyPersonas, setCompanyPersonas] = useState<any[]>([]);
  const [isDefaultTeam, setIsDefaultTeam] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    null,
  );

  // Heuristic families state
  const [heuristicFamilies, setHeuristicFamilies] = useState<any[]>([]);
  const [selectedHeuristicId, setSelectedHeuristicId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    // Load personas for current user using a server action
    (async () => {
      try {
        const data = await listMyPersonas();
        setPersonas(Array.isArray(data?.teamPersonas) ? data.teamPersonas : []);
        setCompanyPersonas(
          Array.isArray(data?.companyPersonas) ? data.companyPersonas : [],
        );
        setIsDefaultTeam(data?.isDefaultTeam || false);
      } catch (error) {
        clientLogger.error("Failed to load personas", {
          error:
            error instanceof Error
              ? { message: error.message }
              : (error ?? "unknown"),
        });
      }
    })();

    // Load heuristic families for current user's company
    (async () => {
      try {
        const data = await listMyHeuristicFamilies();
        clientLogger.info("Loaded heuristic families", {
          count: data?.length || 0,
          families: data?.map((f: any) => ({ key: f.key, name: f.name })),
        });
        setHeuristicFamilies(Array.isArray(data) ? data : []);
      } catch (error) {
        clientLogger.error("Failed to load heuristic families", {
          error:
            error instanceof Error
              ? { message: error.message }
              : (error ?? "unknown"),
        });
      }
    })();
  }, []);

  // Sync files state with form state
  useEffect(() => {
    if (files.length === 0 && !hasUserInteractedWithFiles.current) {
      return;
    }

    hasUserInteractedWithFiles.current = true;

    form.setValue("files", files, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [files, form]);

  useEffect(() => {
    if (isCardListLoading && files.length > 0) {
      setIsCardListLoading(false);
    }
  }, [files, isCardListLoading]);

  const moveCard = useCallback((dragIndex: number, hoverIndex: number) => {
    setFiles((prevFiles) => {
      const updatedFiles = update(prevFiles, {
        $splice: [
          [dragIndex, 1],
          [hoverIndex, 0, prevFiles[dragIndex]],
        ],
      });
      return updatedFiles;
    });
    setFigmaMetadata((prevMetadata) => {
      const updatedMetadata = update(prevMetadata, {
        $splice: [
          [dragIndex, 1],
          [hoverIndex, 0, prevMetadata[dragIndex]],
        ],
      });
      return updatedMetadata;
    });
  }, []);

  const handleDeleteButtonClick = useCallback((index: number) => {
    setFiles((prevFiles) => {
      const updatedFiles = prevFiles.filter((_, i) => i !== index);
      return updatedFiles;
    });
    setFigmaMetadata((prevMetadata) => {
      const updatedMetadata = prevMetadata.filter((_, i) => i !== index);
      return updatedMetadata;
    });
  }, []);

  const renderCard = useCallback(
    (file: any, index: number) => {
      return (
        <DraggableFileCard
          key={index}
          index={index}
          file={file}
          cards={files.length}
          moveCard={moveCard}
          deleteCard={handleDeleteButtonClick}
        />
      );
    },
    [files.length, handleDeleteButtonClick, moveCard],
  );

  const isInteractionDisabled = isCardListLoading || figmaLoading;

  const { isValid } = form.formState;
  const isEvaluateDisabled = loading || props.credits <= 0 || !isValid;

  const updateScrollShadows = useCallback(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      setShowLeftShadow(false);
      setShowRightShadow(false);
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const canScroll = scrollWidth - clientWidth > 1;

    setShowLeftShadow(canScroll && scrollLeft > 0);
    setShowRightShadow(canScroll && scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollShadows();
  }, [files, updateScrollShadows]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        updateScrollShadows();
      }, 100);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, [updateScrollShadows]);

  const handleUploadButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (isInteractionDisabled || !fileInputRef.current) return;

    fileInputRef.current.click();
  };

  const handleDrag = (e: any) => {
    if (isInteractionDisabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: any) => {
    if (isInteractionDisabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles: Array<File> = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) {
      setIsCardListLoading(false);
      return;
    }
    setIsCardListLoading(true);
    setFiles((prevFiles) => [...prevFiles, ...droppedFiles]);
    // Add null metadata for non-Figma files
    setFigmaMetadata((prevMetadata) => [
      ...prevMetadata,
      ...droppedFiles.map(() => null),
    ]);
  };

  const handleFileInputChange = (e: any) => {
    e.preventDefault();
    if (isInteractionDisabled) {
      return;
    }
    const selectedFiles: Array<File> = Array.from(e.target.files);
    if (selectedFiles.length === 0) {
      setIsCardListLoading(false);
      return;
    }
    setIsCardListLoading(true);
    setFiles((prevFiles) => [...prevFiles, ...selectedFiles]);
    // Add null metadata for non-Figma files
    setFigmaMetadata((prevMetadata) => [
      ...prevMetadata,
      ...selectedFiles.map(() => null),
    ]);
    // Reset the input value so the same file can be selected again
    e.target.value = "";
  };

  const handleSortToggle = () => {
    // Create an array of indices to track original positions
    const indexedFiles = files.map((file, index) => ({ file, index }));
    indexedFiles.sort((a, b) => {
      const comparison = a.file.name.localeCompare(b.file.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDirection === "asc" ? comparison : -comparison;
    });

    setFiles(indexedFiles.map(({ file }) => file));
    setFigmaMetadata((prevMetadata) =>
      indexedFiles.map(({ index }) => prevMetadata[index]),
    );
    setSortDirection((prevDirection) =>
      prevDirection === "asc" ? "desc" : "asc",
    );
  };

  const fetchFigmaImages = async (url: string) => {
    try {
      setIsCardListLoading(true);
      setFigmaLoading(true);
      setFigmaError("");

      const {
        files: imageFiles,
        startingNodeId,
        frameIds,
        frameNames,
        figmaFileKey,
        figmaUrl: sourceFigmaUrl,
      } = await fetchFigmaPrototypeImages({
        figmaUrl: url,
      });

      if (startingNodeId) {
        clientLogger.info("Importing frames for Figma prototype", {
          startingNodeId,
          frameCount: imageFiles.length,
        });
      } else {
        clientLogger.info("Importing frames for Figma file", {
          frameCount: imageFiles.length,
        });
      }

      setFiles((prevFiles) => [...prevFiles, ...imageFiles]);

      // Store Figma metadata for each imported file
      const newMetadata: FigmaFileMetadata[] = frameIds.map((nodeId) => ({
        figmaFileKey,
        figmaNodeId: nodeId,
        figmaFrameName: frameNames[nodeId] || "",
        figmaUrl: sourceFigmaUrl,
      }));
      setFigmaMetadata((prevMetadata) => [...prevMetadata, ...newMetadata]);

      setFigmaUrl("");

      clientLogger.info("Successfully imported screens from Figma", {
        frameCount: imageFiles.length,
      });
    } catch (error) {
      clientLogger.error("Error fetching Figma images", {
        error:
          error instanceof Error
            ? { message: error.message }
            : (error ?? "unknown"),
      });
      setFigmaError(
        error instanceof Error
          ? error.message
          : "Failed to import the user journey from Figma.",
      );
      setIsCardListLoading(false);
    } finally {
      setFigmaLoading(false);
    }
  };

  const handleFigmaImport = () => {
    if (isInteractionDisabled) {
      return;
    }
    if (!figmaUrl.trim()) {
      setFigmaError("Enter a valid Figma prototype URL");
      return;
    }
    fetchFigmaImages(figmaUrl);
  };

  const validateData = (data: HeuristicEvaluationFormValues) => {
    const newHeuristicEvaluation = {
      name: data.name,
      goal: data.goal,
      user: data.user,
      files: files,
      heuristic: data.heuristic,
      context: data.context,
    };

    const result = schema.safeParse(newHeuristicEvaluation);

    return result;
  };

  const uploadFiles = async (
    files: File[],
    studyId: string,
    metadata: (FigmaFileMetadata | null)[],
  ) => {
    const fileMetadata = files.map((file: File) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    }));
    const presigned = await getStudyUploadUrls(studyId, fileMetadata);
    await Promise.all(
      presigned.map(async (urlData: any, index: number) => {
        const file: File = files[index];
        const resp = await fetch(urlData.uploadURL, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!resp.ok) throw new Error(`Failed to upload ${file.name}`);
      }),
    );
    return presigned.map((p: any, i: number) => {
      const figmaMeta = metadata[i];
      return {
        name: files[i].name,
        key: p.key,
        size: files[i].size,
        type: files[i].type,
        // Include Figma metadata if available
        ...(figmaMeta && {
          figmaFileKey: figmaMeta.figmaFileKey,
          figmaNodeId: figmaMeta.figmaNodeId,
          figmaFrameName: figmaMeta.figmaFrameName,
          figmaUrl: figmaMeta.figmaUrl,
        }),
      };
    });
  };

  const handleSubmitButtonClick = async (
    data: HeuristicEvaluationFormValues,
  ) => {
    let studyId: string | undefined;
    try {
      // Check session is still valid before proceeding
      const isSessionValid = await checkSession();
      if (!isSessionValid) {
        return;
      }

      form.clearErrors("files");
      setLoading(true);
      const validation = validateData(data);
      if (!validation.success) {
        const firstIssue =
          // zod v3 uses .issues, earlier code elsewhere referenced .errors
          (validation as any)?.error?.issues?.[0] ||
          (validation as any)?.error?.errors?.[0];
        const fieldName =
          (firstIssue?.path?.[0] as keyof HeuristicEvaluationFormValues) ||
          ("files" as keyof HeuristicEvaluationFormValues);
        const message = firstIssue?.message || "Invalid form data.";
        form.setError(fieldName as any, { type: "manual", message });
        return;
      }
      if (files.length === 0) {
        form.setError("files", {
          type: "manual",
          message: "At least one image file must be uploaded.",
        });
        return;
      }
      const study = await initStudy(data.name, "heuristic_evaluation");
      studyId = study.id; // Track studyId for cleanup if needed
      const uploadedFiles = await uploadFiles(files, study.id, figmaMetadata);
      // Include persona data if selected; if a persona is selected, leave `user` empty
      // Search both team and company personas
      const selected =
        personas.find((p) => p.id === selectedPersonaId) ||
        companyPersonas.find((p) => p.id === selectedPersonaId) ||
        null;
      await finalizeAndQueueStudy("heuristic_evaluation", study.id, {
        name: data.name,
        goal: data.goal,
        user: selected ? "" : data.user,
        context: data.context,
        heuristic: data.heuristic,
        files: uploadedFiles,
        persona: selected
          ? {
              studyId: selected.id,
              name: selected?.persona?.name || selected?.name || undefined,
              description: selected?.persona?.description || undefined,
              data: selected?.persona?.data || undefined,
            }
          : undefined,
      });
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

      clientLogger.error("Error submitting heuristic evaluation", {
        error:
          error instanceof Error
            ? { message: error.message }
            : (error ?? "unknown"),
      });
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while submitting the study.";

      // Show toast notification
      toast.error("Failed to submit study", {
        description: message,
      });

      form.setError("files", {
        type: "manual",
        message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overflow-hidden">
      <Form {...form}>
        <form
          // action={heuristicEvaluationFormActionPreProcessing}
          onSubmit={form.handleSubmit(handleSubmitButtonClick)}
          autoComplete="off"
          className="flex flex-col gap-6 overflow-hidden"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What would you like to call this study?</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter a name for the study e.g., Recipe Search"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="goal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What is the user trying to accomplish?</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter the goal the user is trying to achieve e.g., Find a recipe"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="user"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Who is the target user?</FormLabel>
                <FormControl>
                  <PersonaSelect
                    personas={personas}
                    companyPersonas={companyPersonas}
                    selectedId={selectedPersonaId}
                    inputValue={field.value || ""}
                    onChange={({ selectedId, inputValue }) => {
                      setSelectedPersonaId(selectedId);
                      form.setValue("user", inputValue);
                    }}
                    getImageUrl={async (key: string) => {
                      try {
                        return await getPresignedUrls(key);
                      } catch {
                        return "";
                      }
                    }}
                    placeholder="Select a persona or type a description  e.g., A busy working parent"
                    isDefaultTeam={isDefaultTeam}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="files"
            render={({ field: { value, onChange, ...fieldProps } }) => (
              <FormItem>
                <FormLabel>What are the steps in your user journey?</FormLabel>
                <FormDescription>
                  Upload screenshots up to {props.maxFiles} showing each step
                  the user takes to complete their goal. Drag and drop files
                  below, click Upload to select them, or import from a Figma
                  prototype.
                </FormDescription>
                <FormControl className="overflow-hidden">
                  <div className="overflow-hidden">
                    <Input
                      {...fieldProps}
                      accept="image/*"
                      className="hidden"
                      multiple={true}
                      onChange={(e) => {
                        onChange(
                          e.target.files ? Array.from(e.target.files) : [],
                        );
                        handleFileInputChange(e);
                      }}
                      ref={fileInputRef}
                      type="file"
                      disabled={isInteractionDisabled}
                    />
                    <div
                      onDragOver={handleDrag}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      aria-disabled={isInteractionDisabled}
                      className={`border-blue-gray-300 flex w-full max-w-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-4 ${isInteractionDisabled ? "pointer-events-none opacity-50" : ""}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        className="mx-auto h-4 w-4"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                        ></path>
                      </svg>
                      <Button
                        variant="outline"
                        onClick={handleUploadButtonClick}
                        disabled={isInteractionDisabled}
                      >
                        Upload
                      </Button>
                      <p className="text-muted-foreground text-sm">
                        Supported file formats: .png and .jpg
                      </p>
                    </div>

                    {/* Figma URL input with import button */}
                    <div className="mt-4 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="Enter a link to a Figma prototype"
                          className="flex-1"
                          value={figmaUrl}
                          onChange={(e) => setFigmaUrl(e.target.value)}
                          disabled={isInteractionDisabled}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleFigmaImport}
                          disabled={isInteractionDisabled || !figmaUrl.trim()}
                        >
                          Import
                        </Button>
                      </div>
                      {figmaError && (
                        <p className="text-[0.8rem] font-medium text-red-500">
                          {figmaError}
                        </p>
                      )}
                    </div>

                    <DndProviderComponent>
                      <div className="mt-4 space-y-4 overflow-hidden">
                        {files.length > 1 && (
                          <div className="mb-2 flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleSortToggle}
                              disabled={isInteractionDisabled}
                              className="h-8 w-8 p-0"
                              aria-label={
                                sortDirection === "asc"
                                  ? "Sort ascending"
                                  : "Sort descending"
                              }
                            >
                              {sortDirection === "asc" ? (
                                <>
                                  <AArrowUp aria-hidden className="h-4 w-4" />
                                  <span className="sr-only">
                                    Sort ascending
                                  </span>
                                </>
                              ) : (
                                <>
                                  <AArrowDown aria-hidden className="h-4 w-4" />
                                  <span className="sr-only">
                                    Sort descending
                                  </span>
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                        {isCardListLoading && (
                          <div className="flex min-h-[70px] items-center justify-center">
                            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                          </div>
                        )}
                        <div className="relative overflow-hidden">
                          <div
                            ref={scrollContainerRef}
                            onScroll={updateScrollShadows}
                            className="flex gap-4 overflow-x-auto pb-2"
                          >
                            {files.map((file, index) => {
                              return renderCard(file, index);
                            })}
                          </div>
                          {showLeftShadow && (
                            <div
                              className="pointer-events-none absolute inset-y-0 left-0 w-12"
                              style={{ background: rightEdgeGradient }}
                            />
                          )}
                          {showRightShadow && (
                            <div
                              className="pointer-events-none absolute inset-y-0 right-0 w-12"
                              style={{ background: leftEdgeGradient }}
                            />
                          )}
                        </div>
                      </div>
                    </DndProviderComponent>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="heuristic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Which evaluation heuristics would you like to use?
                </FormLabel>
                <FormControl>
                  <HeuristicSelect
                    heuristicFamilies={heuristicFamilies}
                    selectedId={selectedHeuristicId}
                    onChange={({ selectedId, family }) => {
                      setSelectedHeuristicId(selectedId);
                      // Set the heuristic field to the family ID (UUID) which the backend uses to fetch heuristics
                      form.setValue("heuristic", selectedId || "", {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                    }}
                    placeholder="Select a heuristic set"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="context"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  What additional information would be helpful?
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter additional context for the evaluation e.g., the user is browsering a recipe website on their laptop"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormSubmitWithCredits
            label="Evaluate"
            credits={props.credits}
            canPurchaseCredits={props.canPurchaseCredits}
            loading={loading}
            disabledOverride={isEvaluateDisabled}
          />
        </form>
      </Form>
      {loading && <Loading />}
    </div>
  );
}

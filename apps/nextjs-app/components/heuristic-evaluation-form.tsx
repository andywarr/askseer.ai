"use client";

// Lib function imports
import {
  initStudy,
  getStudyUploadUrls,
  finalizeAndQueueStudy,
} from "@/apps/nextjs-app/lib/action";

// React imports
import { useRef, useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";

// Schema imports
import { heuristicEvaluationSchema } from "@/apps/nextjs-app/lib/schema";

// Zod imports
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Component imports
import DndProviderComponent from "@/apps/nextjs-app/components/dnd-provider";
import DraggableFileCard from "@/apps/nextjs-app/components/draggable-file-card";
import { Loading } from "@/apps/nextjs-app/components/loading";

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
import {
  RadioGroup,
  RadioGroupItem,
} from "@/apps/nextjs-app/components/ui/radio-group";

// Other imports
import update from "immutability-helper";

export function HeuristicEvaluationForm(props: { credits: number }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [figmaUrl, setFigmaUrl] = useState<string>("");
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [figmaError, setFigmaError] = useState<string>("");

  const form = useForm<z.infer<typeof heuristicEvaluationSchema>>({
    resolver: zodResolver(heuristicEvaluationSchema),
    defaultValues: {
      name: "",
      goal: "",
      user: "",
      files: [],
      heuristic: "nielsen",
      context: "",
    },
  });

  // Sync files state with form state
  useEffect(() => {
    form.setValue("files", files);
  }, [files, form]);

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
  }, []);

  const handleDeleteButtonClick = useCallback((index: number) => {
    setFiles((prevFiles) => {
      const updatedFiles = prevFiles.filter((_, i) => i !== index);
      return updatedFiles;
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
    [files.length, moveCard, handleDeleteButtonClick],
  );

  const handleUploadButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (!fileInputRef.current) return;

    fileInputRef.current.click();
  };

  const handleDrag = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles: Array<File> = Array.from(e.dataTransfer.files);
    const updatedFiles = [...files, ...droppedFiles];
    setFiles(updatedFiles);
  };

  const handleFileInputChange = (e: any) => {
    e.preventDefault();
    const selectedFiles: Array<File> = Array.from(e.target.files);
    setFiles((prevFiles) => {
      const updatedFiles = [...prevFiles, ...selectedFiles];
      return updatedFiles;
    });
  };

  const extractFigmaFileKey = (url: string): string | null => {
    // Extract file key from Figma URL
    const match = url.match(/figma\.com\/(file|proto|design)\/([a-zA-Z0-9]+)/);
    return match ? match[2] : null;
  };

  const fetchFigmaImages = async (figmaUrl: string) => {
    try {
      setFigmaLoading(true);
      setFigmaError(""); // Clear any previous errors

      const fileKey = extractFigmaFileKey(figmaUrl);
      if (!fileKey) {
        throw new Error("Please provide a valid Figma file or prototype URL.");
      }

      const FIGMA_API_TOKEN = process.env.NEXT_PUBLIC_FIGMA_API_TOKEN;
      if (!FIGMA_API_TOKEN) {
        throw new Error(
          "Figma API token not configured. Please add NEXT_PUBLIC_FIGMA_API_TOKEN to your environment variables.",
        );
      }

      // First, get the file structure to find all frames/pages
      const fileResponse = await fetch(
        `https://api.figma.com/v1/files/${fileKey}`,
        {
          headers: {
            "X-Figma-Token": FIGMA_API_TOKEN,
          },
        },
      );

      if (!fileResponse.ok) {
        throw new Error(`Failed to import the user journey from Figma.`);
      }

      const fileData = await fileResponse.json();

      // Extract frame IDs - only get top-level frames (parent frames)
      const frameIds: string[] = [];
      const frameNames: { [key: string]: string } = {};

      // Process each page and get only top-level frames
      fileData.document.children.forEach((page: any) => {
        console.log(`\n=== Processing page: ${page.name} ===`);

        // Only process direct children of the page (top-level frames)
        if (page.children) {
          page.children.forEach((child: any) => {
            if (child.type === "FRAME") {
              frameIds.push(child.id);
              frameNames[child.id] = child.name;
              console.log(`✓ Added parent frame: ${child.name} (${child.id})`);
            }
          });
        }
      });

      if (frameIds.length === 0) {
        throw new Error("No frames found in the Figma file.");
      }

      // Get image URLs for the frames
      const imagesResponse = await fetch(
        `https://api.figma.com/v1/images/${fileKey}?ids=${frameIds.join(
          ",",
        )}&format=png&scale=1`,
        {
          headers: {
            "X-Figma-Token": FIGMA_API_TOKEN,
          },
        },
      );

      if (!imagesResponse.ok) {
        throw new Error(
          `Failed to fetch Figma images: ${imagesResponse.statusText}`,
        );
      }

      const imagesData = await imagesResponse.json();

      // Download images and convert to File objects
      const imageFiles: File[] = [];
      for (const [nodeId, imageUrl] of Object.entries(imagesData.images)) {
        if (typeof imageUrl === "string") {
          const imageResponse = await fetch(imageUrl);
          if (imageResponse.ok) {
            const blob = await imageResponse.blob();
            // Use the actual frame name if available, otherwise fall back to node ID
            const frameName = frameNames[nodeId] || `frame-${nodeId}`;
            // Clean the frame name for use as filename
            const cleanName = frameName.replace(/[^a-zA-Z0-9\-_]/g, "-");
            const fileName = `figma-${cleanName}.png`;
            const file = new File([blob], fileName, { type: "image/png" });
            imageFiles.push(file);
            console.log(`Downloaded: ${fileName}`);
          }
        }
      }

      if (imageFiles.length === 0) {
        throw new Error("No images could be downloaded from Figma.");
      }

      // Add the downloaded files to the existing files
      setFiles((prevFiles) => {
        const updatedFiles = [...prevFiles, ...imageFiles];
        return updatedFiles;
      });

      // Clear the URL input
      setFigmaUrl("");

      console.log(
        `Successfully imported ${imageFiles.length} screens from Figma`,
      );
    } catch (error) {
      console.error("Error fetching Figma images:", error);
      setFigmaError(
        error instanceof Error
          ? error.message
          : "Failed to import the user journey from Figma.",
      );
    } finally {
      setFigmaLoading(false);
    }
  };

  const handleFigmaImport = () => {
    if (!figmaUrl.trim()) {
      setFigmaError("Enter a valid Figma prototype URL");
      return;
    }
    fetchFigmaImages(figmaUrl);
  };

  const validateData = (data: z.infer<typeof heuristicEvaluationSchema>) => {
    const newHeuristicEvaluation = {
      name: data.name,
      goal: data.goal,
      files: files,
      heuristic: data.heuristic,
      context: data.context,
    };

    const result = heuristicEvaluationSchema.safeParse(newHeuristicEvaluation);

    return result;
  };

  const uploadFiles = async (files: File[], studyId: string) => {
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
    return presigned.map((p: any, i: number) => ({
      name: files[i].name,
      key: p.key,
      size: files[i].size,
      type: files[i].type,
    }));
  };

  const handleSubmitButtonClick = async (
    data: z.infer<typeof heuristicEvaluationSchema>,
  ) => {
    try {
      setLoading(true);
      if (!validateData(data)) throw new Error("Invalid data");
      if (files.length === 0) throw new Error("No files provided");
      const study = await initStudy(data.name, "heuristic_evaluation");
      const uploadedFiles = await uploadFiles(files, study.id);
      await finalizeAndQueueStudy("heuristic_evaluation", study.id, {
        name: data.name,
        goal: data.goal,
        user: data.user,
        context: data.context,
        heuristic: data.heuristic?.toUpperCase?.() as "NIELSEN" | "TENETS",
        files: uploadedFiles,
      });
    } catch (error) {
      console.error("Error submitting evaluation", error);
      setLoading(false);
    }
  };

  return (
    <div>
      <Form {...form}>
        <form
          // action={heuristicEvaluationFormActionPreProcessing}
          onSubmit={form.handleSubmit(handleSubmitButtonClick)}
          autoComplete="off"
          className="flex flex-col gap-6"
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
                  <Input
                    placeholder="Enter the target user e.g., a busy working parent with two young children"
                    {...field}
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
                  Upload screenshots showing each step the user takes to
                  complete their goal. Drag and drop files below, click Upload
                  to select them, or import from a Figma prototype.
                </FormDescription>
                <FormControl>
                  <div>
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
                    />
                    <div
                      onDragOver={handleDrag}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className="border-blue-gray-300 flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-4"
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
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleFigmaImport}
                          disabled={figmaLoading || !figmaUrl.trim()}
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
                      <div
                        className="mt-4 grid gap-4"
                        style={{
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(300px, 1fr))",
                        }}
                      >
                        {files.map((file, index) => {
                          return renderCard(file, index);
                        })}
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
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex flex-col space-y-1"
                  >
                    <FormItem className="flex items-center space-y-0 space-x-3">
                      <FormControl>
                        <RadioGroupItem value="nielsen" />
                      </FormControl>
                      <FormLabel>
                        Nielsen&apos;s 10 Usability Heuristics
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-y-0 space-x-3">
                      <FormControl>
                        <RadioGroupItem value="tenets" />
                      </FormControl>
                      <FormLabel>Tenets & Traps</FormLabel>
                    </FormItem>
                  </RadioGroup>
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

          <div className="flex">
            <Button
              disabled={props.credits > 0 && !loading ? false : true}
              className="w-32"
              type="submit"
            >
              Evaluate
            </Button>
            <p className="ml-3 flex flex-wrap content-end">
              <span className="block text-xs font-light antialiased">
                {props.credits} {props.credits !== 1 ? "tries" : "try"}{" "}
                remaining. Contact payments@askseer.ai to purchase additional
                credits.
              </span>
            </p>
          </div>
        </form>
      </Form>
      {loading && <Loading />}
    </div>
  );
}

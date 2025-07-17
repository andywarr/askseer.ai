"use client";

// Lib function imports
import {
  cognitiveWalkthroughFormAction,
  putPresignedUrls,
} from "@/apps/nextjs-app/lib/action";

// React imports
import { useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";

// Schema imports
import { cognitiveWalkthroughSchema } from "@/apps/nextjs-app/lib/schema";

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

export function CognitiveWalkthroughForm(props: { credits: number }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof cognitiveWalkthroughSchema>>({
    resolver: zodResolver(cognitiveWalkthroughSchema),
    defaultValues: {
      name: "",
      goal: "",
      user: "",
      files: [],
      context: "",
    },
  });

  const handleDeleteButtonClick = useCallback(
    (index: number) => {
      setFiles((prevFiles) => {
        const updatedFiles = prevFiles.filter((_, i) => i !== index);
        form.setValue("files", updatedFiles);
        return updatedFiles;
      });
    },
    [form],
  );

  const moveCard = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      setFiles((prevFiles) => {
        const updatedFiles = update(prevFiles, {
          $splice: [
            [dragIndex, 1],
            [hoverIndex, 0, prevFiles[dragIndex]],
          ],
        });
        form.setValue("files", updatedFiles);
        return updatedFiles;
      });
    },
    [form],
  );

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
    setFiles((prevFiles) => {
      const updatedFiles = [...prevFiles, ...droppedFiles];
      form.setValue("files", updatedFiles);
      return updatedFiles;
    });
  };

  const handleFileInputChange = (e: any) => {
    e.preventDefault();
    const selectedFiles: Array<File> = Array.from(e.target.files);
    setFiles((prevFiles) => {
      const updatedFiles = [...prevFiles, ...selectedFiles];
      form.setValue("files", updatedFiles);
      return updatedFiles;
    });
  };

  const validateData = (data: z.infer<typeof cognitiveWalkthroughSchema>) => {
    const result = cognitiveWalkthroughSchema.safeParse(data);
    return result;
  };

  const uploadFiles = async (files: File[]) => {
    // Prepare file metadata (name and type) to send to the server action
    const fileMetadata = files.map((file: File) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    }));

    // Get pre-signed URLs for each file
    const presignedUrls = await putPresignedUrls(fileMetadata);

    // Upload each file to the corresponding pre-signed URL
    await Promise.all(
      presignedUrls.map(
        async (
          urlData: { uploadURL: string | URL | Request },
          index: number,
        ) => {
          const file: File = files[index];
          const response = await fetch(urlData.uploadURL, {
            method: "PUT",
            headers: {
              "Content-Type": file.type,
            },
            body: file,
          });

          if (!response.ok) {
            throw new Error(`Failed to upload ${file.name}`);
          }
        },
      ),
    );

    // Extract an array of keys
    const keys: string[] = presignedUrls.map(
      (item: { key: string }) => item.key,
    );

    return keys;
  };

  const handleSubmitButtonClick = async (
    data: z.infer<typeof cognitiveWalkthroughSchema>,
  ) => {
    try {
      // Set loading state to true
      setLoading(true);

      // Validate the data
      if (!validateData(data)) {
        throw new Error(`Invalid data ${data}`);
      }

      // Upload files to S3
      const keys = await uploadFiles(files);

      // Check if the files were uploaded successfully
      if (!keys) {
        throw new Error("Failed to upload files");
      }

      // Prepare form data
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("goal", data.goal);
      formData.append("user", data.user);
      files.forEach((file, index) => {
        formData.append(`file`, file);
      });
      formData.append("context", data.context);

      console.log("formData", formData.getAll("file"));
      console.log("files", files);

      // Process the form data
      await cognitiveWalkthroughFormAction(formData, keys);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  return (
    <div>
      <Form {...form}>
        <form
          // action={heuristicEvaluationFormActionPreProcessing}
          onSubmit={form.handleSubmit(handleSubmitButtonClick)}
          autoComplete="off"
          className="space-y-6"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }: { field: any }) => (
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
            render={({ field }: { field: any }) => (
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
            render={({
              field: { value, onChange, ...fieldProps },
            }: {
              field: {
                value: any;
                onChange: (e: any) => void;
                [key: string]: any;
              };
            }) => (
              <FormItem>
                <FormLabel>What are the steps in your user journey?</FormLabel>
                <FormDescription>
                  Upload screenshots showing each step the user takes to
                  complete their goal. Drag and drop files below or click Upload
                  to select them.
                </FormDescription>
                <FormControl>
                  <div>
                    <Input
                      {...fieldProps}
                      accept="images/*"
                      className="hidden"
                      multiple={true}
                      // name="files"
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
            name="context"
            render={({ field }: { field: any }) => (
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

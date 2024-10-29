"use client";

import update from "immutability-helper";

import {
  heuristicEvaluationFormAction,
  putPresignedUrls,
} from "@/app/lib/action";
import { useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import DndProviderComponent from "@/app/components/DndProviderComponent";
import DraggableFileCard from "@/app/components/DraggableFileCard";
import { Loading } from "@/app/components/loading";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const heuristicEvaluationSchema = z.object({
  goal: z
    .string()
    .trim()
    .min(1, {
      message: "A user goal must be included.",
    })
    .max(100, {
      message: "The user goal must be less than 100 characters.",
    }),
  files: z
    .array(
      z
        .instanceof(File)
        .refine(
          (file) => file.size < 20 * 1024 * 1024,
          "Each file must be less than 20MB.",
        ),
    )
    .min(1, {
      message: "At least one image file must be uploaded.",
    })
    .refine(
      (files) => files.every((file) => file.size > 0),
      "At least one image file must be uploaded.",
    ),
  heuristic: z.union([z.literal("nielsen"), z.literal("tenets")]),
});

export function HeuristicEvaluationForm(props: { credits: number }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const moveCard = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      setFiles((prevFiles) =>
        update(prevFiles, {
          $splice: [
            [dragIndex, 1],
            [hoverIndex, 0, prevFiles[dragIndex]],
          ],
        }),
      );
    },
    [setFiles],
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
    [files.length, moveCard],
  );

  const handleDeleteButtonClick = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

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
    setFiles((prevFiles) => [...prevFiles, ...droppedFiles]);
  };

  const handleFileInputChange = (e: any) => {
    e.preventDefault();
    const selectedFiles: Array<File> = Array.from(e.target.files);
    setFiles((prevFiles) => {
      const updatedFiles = [...prevFiles, ...selectedFiles];
      return updatedFiles;
    });
  };

  const heuristicEvaluationFormActionPreProcessing = async (
    data: z.infer<typeof heuristicEvaluationSchema>,
  ) => {
    try {
      setLoading(true);

      const newHeuristicEvaluation = {
        goal: data.goal,
        files: data.files,
        heuristic: data.heuristic,
      };

      const result = heuristicEvaluationSchema.safeParse(
        newHeuristicEvaluation,
      );

      // if (!result.success) {
      //   setErrors(result.error.flatten());
      // }

      // Prepare file metadata (name and type) to send to the server action
      const fileMetadata = files.map((file: File) => ({
        name: file.name,
        type: file.type,
      }));

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

      const formData = new FormData();
      formData.append("goal", data.goal);
      data.files.forEach((file, index) => {
        formData.append(`file`, file);
      });
      formData.append("heuristic", data.heuristic);

      const response = await heuristicEvaluationFormAction(formData, keys);

      // if (response?.errors) {
      //   setErrors(response?.errors);
      // }
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const form = useForm<z.infer<typeof heuristicEvaluationSchema>>({
    resolver: zodResolver(heuristicEvaluationSchema),
    defaultValues: {
      goal: "",
      files: [],
      heuristic: "nielsen",
    },
  });

  return (
    <div>
      <Form {...form}>
        <form
          // action={heuristicEvaluationFormActionPreProcessing}
          onSubmit={form.handleSubmit(
            heuristicEvaluationFormActionPreProcessing,
          )}
          autoComplete="off"
          className="space-y-6"
        >
          <FormField
            control={form.control}
            name="goal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What is the user goal?</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter the goal the user is trying to achieve."
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
                <FormLabel>
                  Upload screenshots of the flow to achieve the user goal.
                </FormLabel>
                <FormDescription>
                  On your computer or mobile device, take screenshots of the
                  steps to complete the user goal. Take a screenshot of the
                  screen before and after each interaction, such as clicking a
                  button. Upload screenshots by dragging and dropping the files
                  below or selecting the Upload button.
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
                      className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-blue-gray-300 p-4"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        className="mx-auto h-6 w-6"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                        ></path>
                      </svg>
                      <Button onClick={handleUploadButtonClick}>Upload</Button>
                      <p className="text-muted-foreground text-sm">
                        Supported file formats: .png and .jpg
                      </p>
                    </div>
                    <DndProviderComponent>
                      <div
                        className="mt-4 grid gap-4"
                        style={{
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(275px, 1fr))",
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
                <FormLabel>Which heuristics would you like to use?</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex flex-col space-y-1"
                  >
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="nielsen" />
                      </FormControl>
                      <FormLabel>Nielsen</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="tenets" />
                      </FormControl>
                      <FormLabel>Tenents & Traps</FormLabel>
                    </FormItem>
                  </RadioGroup>
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

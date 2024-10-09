"use client";

import { Button, Input, Radio, Typography } from "@/MTailwind";
import { Evaluate } from "@/app/components/evaluate-button";
import {
  heuristicEvaluationFormAction,
  putPresignedUrls,
} from "@/app/lib/action";
import { useRef, useState } from "react";
import { z } from "zod";

interface FormErrors {
  fieldErrors: {
    goal?: Array<string> | undefined;
    files?: Array<string> | undefined;
    heuristic?: Array<string> | undefined;
    credits?: string | undefined;
  };
}

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
  const [errors, setErrors] = useState<FormErrors>({
    fieldErrors: {
      goal: [],
      files: [],
      heuristic: [],
      credits: "",
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState([]);

  const handleButtonClick = () => {
    if (!fileInputRef.current) return;

    fileInputRef.current.click();
  };

  const handleFileInputChange = (e: any) => {
    setFiles(Array.from(e.target.files));
  };

  const heuristicEvaluationFormActionPreProcessing = async (
    formData: FormData,
  ) => {
    const newHeuristicEvaluation = {
      goal: formData.get("goal"),
      files: formData.getAll("file"),
      heuristic: formData.get("heuristic"),
    };

    const result = heuristicEvaluationSchema.safeParse(newHeuristicEvaluation);

    if (!result.success) {
      setErrors(result.error.flatten());
    }

    // Prepare file metadata (name and type) to send to the server action
    const fileMetadata = files.map((file: File) => ({
      name: file.name,
      type: file.type,
    }));

    try {
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

      const response = await heuristicEvaluationFormAction(formData, keys);

      if (response?.errors) {
        setErrors(response?.errors);
      }
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  return (
    <form
      action={heuristicEvaluationFormActionPreProcessing}
      autoComplete="off"
    >
      <Input
        label="Goal"
        name="goal"
        placeholder="What is the user goal?"
        size="lg"
        variant="standard"
        crossOrigin={undefined}
        className="!text-base !font-light text-blue-gray-900 antialiased"
      />
      <Typography
        variant="small"
        color="red"
        className="mt-2 flex h-[21px] items-center gap-1 font-normal"
      >
        {errors.fieldErrors.goal && errors.fieldErrors.goal.length > 0
          ? errors.fieldErrors.goal[0]
          : ""}
      </Typography>

      <Typography color="blue-gray">
        On your computer or mobile device, take screenshots of the steps to
        complete the user goal. Take a screenshot of the screen before and after
        each interaction, such as clicking a button. Upload screenshots of the
        flow using the upload button below.
      </Typography>

      <div className="flex">
        <input
          accept="images/*"
          className="hidden"
          multiple={true}
          name="file"
          onChange={handleFileInputChange}
          ref={fileInputRef}
          type="file"
        />

        <Button
          className="mt-6 flex items-center gap-3"
          onClick={handleButtonClick}
          variant="gradient"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
            />
          </svg>
          Upload Flow
        </Button>

        <p className="ml-3 mt-4 flex flex-wrap content-end gap-3">
          <span className="block text-xs font-light antialiased">
            {files.length} {files.length !== 1 ? " files " : " file "} selected.
          </span>
        </p>
      </div>
      <Typography
        variant="small"
        color="red"
        className="mb-6 mt-2 flex h-[21px] items-center gap-1 font-normal"
      >
        {errors.fieldErrors.files && errors.fieldErrors.files.length > 0
          ? errors.fieldErrors.files[0]
          : ""}
      </Typography>

      <Typography color="blue-gray">
        Which set of heuristics would you like to evaluate the flow?
      </Typography>

      <Radio
        defaultChecked
        label="Nielsen"
        name="heuristic"
        value="nielsen"
        crossOrigin={undefined}
      />

      <Radio
        label="Tenents & Traps"
        name="heuristic"
        value="tenets"
        crossOrigin={undefined}
      />
      <Typography
        variant="small"
        color="red"
        className="mt-2 flex h-[21px] items-center gap-1 font-normal"
      >
        {errors.fieldErrors.heuristic && errors.fieldErrors.heuristic.length > 0
          ? errors.fieldErrors.heuristic[0]
          : ""}
      </Typography>

      <div className="flex">
        <Evaluate credits={props.credits} />
        <p className="ml-3 flex flex-wrap content-end">
          <span className="block text-xs font-light antialiased">
            {props.credits} {props.credits !== 1 ? "tries" : "try"} remaining.
            Contact payments@askseer.ai to purchase additional credits.
          </span>
        </p>
      </div>
      <Typography
        variant="small"
        color="red"
        className="mt-2 flex h-[21px] items-center gap-1 font-normal"
      >
        {errors.fieldErrors.credits ? errors.fieldErrors.credits : ""}
      </Typography>
    </form>
  );
}

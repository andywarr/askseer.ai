"use client";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Radio,
  Typography,
} from "@/MTailwind";
import { Evaluate } from "@/app/components/evaluate-button";
import Image from "next/image";
import {
  heuristicEvaluationFormAction,
  putPresignedUrls,
} from "@/app/lib/action";
import { useRef, useState, useCallback } from "react";
import { z } from "zod";
import DndProviderComponent from "./DndProviderComponent";
import DraggableFileCard from "./DraggableFileCard";

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
  const [files, setFiles] = useState<File[]>([]);

  const moveCard = useCallback(
    (dragIndex: any, hoverIndex: any) => {
      const updatedFiles = [...files];
      const [draggedFile] = updatedFiles.splice(dragIndex, 1);
      updatedFiles.splice(hoverIndex, 0, draggedFile);
      setFiles(updatedFiles);
    },
    [files],
  );

  const handleDeleteButtonClick = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  const handleButtonClick = () => {
    if (!fileInputRef.current) return;

    fileInputRef.current.click();
  };

  const handleDrag = (e: any) => {
    e.preventDefault();
  };

  const handleDrop = (e: any) => {
    e.preventDefault();
    const droppedFiles: Array<File> = Array.from(e.dataTransfer.files);
    setFiles((prevFiles) => [...prevFiles, ...droppedFiles]);
  };

  const handleFileInputChange = (e: any) => {
    const selectedFiles: Array<File> = Array.from(e.target.files);
    setFiles((prevFiles) => [...prevFiles, ...selectedFiles]);
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
    <DndProviderComponent>
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
          complete the user goal. Take a screenshot of the screen before and
          after each interaction, such as clicking a button. Upload screenshots
          of the flow using the upload button below.
        </Typography>

        <div className="mt-4">
          <input
            accept="images/*"
            className="hidden"
            multiple={true}
            name="file"
            onChange={handleFileInputChange}
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
            <Button onClick={handleButtonClick} variant="gradient">
              Upload
            </Button>
            <Typography color="blue-gray">
              Supported file formats: .png and .jpg
            </Typography>
          </div>
          <div
            className="mt-4 grid gap-4"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(275px, 1fr))",
            }}
          >
            {files.map((file, index) => (
              <DraggableFileCard
                key={index}
                index={index}
                file={file}
                moveCard={moveCard}
              />
              // <Card key={index} className="flex flex-row">
              //   <CardHeader
              //     shadow={false}
              //     floated={false}
              //     className="m-0 w-2/5 shrink-0 rounded-r-none"
              //   >
              //     <Image
              //       src={URL.createObjectURL(file)}
              //       alt={file.name}
              //       fill
              //       className="h-full w-full object-cover object-left"
              //     />
              //   </CardHeader>
              //   <CardBody className="flex w-full flex-row p-2">
              //     <div>
              //       <Typography variant="paragraph">{file.name}</Typography>
              //       <Typography variant="small" className="text-gray-500">
              //         {(file.size / 1024 / 1024).toFixed(2)} MB
              //       </Typography>
              //     </div>
              //     <Button
              //       className="ml-auto h-fit w-fit p-2"
              //       ripple={false}
              //       variant="text"
              //       onClick={() => handleDeleteButtonClick(index)}
              //     >
              //       <svg
              //         xmlns="http://www.w3.org/2000/svg"
              //         fill="none"
              //         viewBox="0 0 24 24"
              //         stroke="currentColor"
              //         className="h-6 w-6"
              //       >
              //         <path
              //           fillRule="evenodd"
              //           d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z"
              //           clipRule="evenodd"
              //         ></path>
              //       </svg>
              //     </Button>
              //   </CardBody>
              // </Card>
            ))}
          </div>
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
          {errors.fieldErrors.heuristic &&
          errors.fieldErrors.heuristic.length > 0
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
    </DndProviderComponent>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
import { z } from "zod";
import { getInitials } from "@/apps/nextjs-app/lib/utils";
import { useRouter } from "next/navigation";
import { updateUserName, updateUserImage } from "@/apps/nextjs-app/lib/data";
import {
  getProfileImagePutUrl,
  deleteS3Objects,
} from "@/apps/nextjs-app/lib/action";
import { toast } from "sonner";

// Zod schema to ensure non-empty full name when changed
const nameSchema = z.string().trim().min(1, {
  message: "Your full name is required.",
});

interface AccountInformationProps {
  name: string;
  email: string;
  image?: string;
  userId: string;
  imageKey?: string | null; // uploaded image key (only set if user uploaded)
  imageUpdatedAt?: string | null; // used to differentiate google image vs removed
}

export default function AccountInformation({
  name,
  email,
  image,
  userId,
  imageKey,
  imageUpdatedAt,
}: AccountInformationProps) {
  const router = useRouter();
  const [currentName, setCurrentName] = useState(name); // optimistic display name
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftImage, setDraftImage] = useState<string | undefined>(image);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentImageKey, setCurrentImageKey] = useState<string | null>(
    imageKey || null,
  );
  const [draftImageFile, setDraftImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previousImageKey, setPreviousImageKey] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false); // mark removal of uploaded image

  // Keep optimistic name in sync with server-provided prop after refresh
  // and ensure draftName reflects latest server value when not editing
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setCurrentName(name);
    if (!isEditing) setDraftName(name);
    // We intentionally don't include isEditing in deps to avoid resetting while editing
  }, [name]);

  function handleStartEdit() {
    setDraftName(currentName);
    setDraftImage(image);
    setIsEditing(true);
    setRemoveExistingImage(false);
  }

  function handleCancel() {
    setDraftName(currentName);
    setDraftImage(image);
    setIsEditing(false);
    setSaveError(null);
    setDraftImageFile(null);
    setPreviewUrl(null);
    setRemoveExistingImage(false);
  }

  function handleSelectImage() {
    fileInputRef.current?.click();
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Selecting a new file cancels any pending removal
    setRemoveExistingImage(false);
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Unsupported image type. Use JPEG, PNG, or WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large. Max 5MB.");
      return;
    }
    setDraftImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Validation / change detection
  const isNameChanged = draftName !== currentName;
  const isImageChanged = !!draftImageFile || removeExistingImage; // include removal
  const parsedName = isNameChanged
    ? nameSchema.safeParse(draftName)
    : undefined;
  const isNameValid = !isNameChanged || (parsedName?.success ?? true);
  const nameError =
    isEditing && isNameChanged && !isNameValid
      ? (!parsedName?.success && parsedName?.error?.errors?.[0]?.message) ||
        "Your full name is required."
      : undefined;
  const canSave = !isSaving && isNameValid && (isNameChanged || isImageChanged);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    const prevName = currentName;
    let uploadedImageKey: string | null = null;
    try {
      // Handle optimistic name update
      const trimmed = draftName.trim();
      const shouldUpdateName = isNameChanged && isNameValid;
      if (shouldUpdateName) {
        setCurrentName(trimmed);
      }

      const keysToDelete: string[] = [];
      // Upload new image
      if (draftImageFile) {
        const { uploadURL, key } = await getProfileImagePutUrl(
          draftImageFile.name,
          draftImageFile.type,
          draftImageFile.size,
        );
        const putResp = await fetch(uploadURL, {
          method: "PUT",
          headers: { "Content-Type": draftImageFile.type },
          body: draftImageFile,
        });
        if (!putResp.ok) throw new Error("Failed to upload image");
        uploadedImageKey = key;
        await updateUserImage(userId, key);
        if (currentImageKey) keysToDelete.push(currentImageKey);
        setCurrentImageKey(key);
      } else if (removeExistingImage && currentImageKey) {
        // Remove existing uploaded image
        await updateUserImage(userId, null);
        keysToDelete.push(currentImageKey);
        setCurrentImageKey(null);
      }
      // Persist name
      if (shouldUpdateName) {
        await updateUserName(userId, trimmed);
      }

      // Delete old images
      if (keysToDelete.length) {
        await deleteS3Objects(keysToDelete);
      }

      toast.success("Successfully updated account information");
      setIsEditing(false);
    } catch (error: any) {
      // If failure after uploading new image, attempt cleanup
      if (uploadedImageKey && uploadedImageKey !== currentImageKey) {
        await deleteS3Objects([uploadedImageKey]);
      }
      // If removal failed, restore currentImageKey state (we didn't actually set it null until success)
      if (removeExistingImage && currentImageKey) {
        setCurrentImageKey(currentImageKey);
      }
      if (isNameChanged) setCurrentName(prevName); // revert name
      setSaveError("Failed to update account");
      toast.error("Failed to update account information");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="group">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Information
        </h3>
        {!isEditing && (
          <Button
            size="sm"
            variant="link"
            onClick={handleStartEdit}
            className="opacity-100 transition-opacity md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:focus-visible:pointer-events-auto md:focus-visible:opacity-100"
          >
            Edit
          </Button>
        )}
      </div>

      <div className="grid max-w-2xl grid-cols-[140px_1fr] gap-x-6 gap-y-4">
        {/* Profile image row */}
        <div className="self-center">
          <Label className="text-xs leading-7 tracking-tight text-zinc-500">
            Profile image
          </Label>
        </div>
        <div className="flex items-center gap-4">
          <Avatar className="ml-3 h-12 w-12 rounded-lg">
            <AvatarImage
              src={previewUrl || (removeExistingImage ? undefined : image)}
              alt={name}
              className="h-full w-full object-cover"
            />
            <AvatarFallback className="rounded-lg">
              {getInitials(currentName || name)}
            </AvatarFallback>
          </Avatar>
          {isEditing && (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8"
              >
                {draftImageFile
                  ? "Replace"
                  : currentImageKey
                    ? "Change"
                    : "Choose image"}
              </Button>
              {currentImageKey && !draftImageFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={`h-8 ${removeExistingImage ? "" : "text-red-500 hover:text-red-600"}`}
                  onClick={() => {
                    if (removeExistingImage) {
                      setRemoveExistingImage(false); // undo removal
                    } else {
                      setRemoveExistingImage(true); // mark for removal
                      setPreviewUrl(null);
                    }
                  }}
                >
                  {removeExistingImage ? "Undo" : "Remove"}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Full name row */}
        <div className="self-center">
          <Label
            className="text-xs leading-7 tracking-tight text-zinc-500"
            htmlFor="name"
          >
            Full name
          </Label>
        </div>
        <div className="flex items-center">
          {isEditing ? (
            <div className="w-full">
              <Input
                id="name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="What's your full name"
                aria-invalid={isNameChanged && !isNameValid}
                aria-describedby={nameError ? "name-error" : undefined}
                className="h-10 w-full"
              />
              {nameError && (
                <p
                  id="name-error"
                  className="mt-1 text-[0.8rem] font-medium text-red-500"
                >
                  {nameError}
                </p>
              )}
            </div>
          ) : (
            <div className="flex h-10 w-full items-center rounded-md border border-transparent px-3 text-sm leading-7 tracking-tight">
              {currentName || "—"}
            </div>
          )}
        </div>

        {/* Email row */}
        <div className="self-start">
          <Label
            className="text-xs leading-7 tracking-tight text-zinc-500"
            htmlFor="email"
          >
            Email
          </Label>
        </div>
        <div className="pl-3">
          {isEditing ? (
            <div className="flex flex-col">
              <div
                id="email"
                className="text-sm leading-7 tracking-tight text-zinc-500"
              >
                {email || "—"}
              </div>
              <p className="mt-1 text-[0.8rem] text-zinc-500">
                Your email address cannot be changed because it is linked to
                your account.
              </p>
            </div>
          ) : (
            <div id="email" className="text-sm leading-7 tracking-tight">
              {email || "—"}
            </div>
          )}
        </div>
      </div>

      {/* Persistent space for action buttons to avoid layout shift */}
      <div className="mt-6 flex min-h-[2.5rem] justify-end gap-2">
        {isEditing && (
          <>
            <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSave}
              title={!isNameValid ? nameError : undefined}
            >
              Save
            </Button>
          </>
        )}
      </div>
      {saveError && (
        <p className="mt-2 text-right text-xs font-medium text-red-500">
          {saveError}
        </p>
      )}
    </section>
  );
}

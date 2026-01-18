"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { z } from "zod";
import { updateUserName, updateUserImage } from "@/apps/nextjs-app/lib/db/data";
import {
  getProfileImagePutUrl,
  deleteS3Objects,
} from "@/apps/nextjs-app/lib/actions/s3-actions";
import { toast } from "sonner";

// Zod schema to ensure non-empty full name when changed
const nameSchema = z.string().trim().min(1, {
  message: "Your full name is required.",
});

// Allowed image types and max size
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

interface UseAccountInformationProps {
  name: string;
  image?: string;
  userId: string;
  imageKey?: string | null;
}

export function useAccountInformation({
  name,
  image,
  userId,
  imageKey,
}: UseAccountInformationProps) {
  const [currentName, setCurrentName] = useState(name);
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentImageKey, setCurrentImageKey] = useState<string | null>(
    imageKey || null,
  );
  const [draftImageFile, setDraftImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  // Keep optimistic name in sync with server-provided prop after refresh
  useEffect(() => {
    if (isEditing) return;
    setCurrentName(name);
    setDraftName(name);
  }, [name, isEditing]);

  // Cleanup object URL to prevent memory leak
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleStartEdit = useCallback(() => {
    setDraftName(currentName);
    setIsEditing(true);
    setRemoveExistingImage(false);
  }, [currentName]);

  const handleCancel = useCallback(() => {
    setDraftName(currentName);
    setIsEditing(false);
    setSaveError(null);
    setDraftImageFile(null);
    setPreviewUrl(null);
    setRemoveExistingImage(false);
  }, [currentName]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setRemoveExistingImage(false);
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error("Unsupported image type. Use JPEG, PNG, or WEBP.");
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error("Image too large. Max 5MB.");
        return;
      }
      setDraftImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    },
    [],
  );

  // Validation / change detection - memoized to prevent recomputation
  const validationState = useMemo(() => {
    const isNameChanged = draftName !== currentName;
    const isImageChanged = !!draftImageFile || removeExistingImage;
    const parsedName = isNameChanged
      ? nameSchema.safeParse(draftName)
      : undefined;
    const isNameValid = !isNameChanged || (parsedName?.success ?? true);
    const nameError =
      isNameChanged && !isNameValid
        ? (!parsedName?.success && parsedName?.error?.errors?.[0]?.message) ||
          "Your full name is required."
        : undefined;
    const canSave = isNameValid && (isNameChanged || isImageChanged);
    return { isNameChanged, isImageChanged, isNameValid, nameError, canSave };
  }, [draftName, currentName, draftImageFile, removeExistingImage]);

  const { isNameChanged, isImageChanged, isNameValid, nameError, canSave } =
    validationState;
  const showNameError = isEditing && nameError;

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    const prevName = currentName;
    let uploadedImageKey: string | null = null;
    try {
      const trimmed = draftName.trim();
      const shouldUpdateName = isNameChanged && isNameValid;
      if (shouldUpdateName) {
        setCurrentName(trimmed);
      }

      const keysToDelete: string[] = [];
      if (draftImageFile) {
        const result = await getProfileImagePutUrl(
          draftImageFile.name,
          draftImageFile.type,
          draftImageFile.size,
        );
        if (!result.success) throw new Error(result.error);
        const { uploadURL, key } = result.data;
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
        await updateUserImage(userId, null);
        keysToDelete.push(currentImageKey);
        setCurrentImageKey(null);
      }
      if (shouldUpdateName) {
        await updateUserName(userId, trimmed);
      }

      if (keysToDelete.length) {
        await deleteS3Objects(keysToDelete);
      }

      toast.success("Successfully updated account information");
      setIsEditing(false);
    } catch (error) {
      if (uploadedImageKey && uploadedImageKey !== currentImageKey) {
        await deleteS3Objects([uploadedImageKey]);
      }
      if (removeExistingImage && currentImageKey) {
        setCurrentImageKey(currentImageKey);
      }
      if (isNameChanged) setCurrentName(prevName);
      setSaveError("Failed to update account");
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update account";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    currentName,
    draftName,
    isNameChanged,
    isNameValid,
    draftImageFile,
    removeExistingImage,
    currentImageKey,
    userId,
  ]);

  const toggleRemoveImage = useCallback(() => {
    if (removeExistingImage) {
      setRemoveExistingImage(false);
    } else {
      setRemoveExistingImage(true);
      setPreviewUrl(null);
    }
  }, [removeExistingImage]);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    // State
    currentName,
    isEditing,
    draftName,
    isSaving,
    saveError,
    currentImageKey,
    draftImageFile,
    previewUrl,
    removeExistingImage,
    fileInputRef,
    // Validation
    isNameChanged,
    isImageChanged,
    isNameValid,
    nameError,
    canSave,
    showNameError,
    // Handlers
    handleStartEdit,
    handleCancel,
    handleFileChange,
    handleSave,
    toggleRemoveImage,
    triggerFileInput,
    setDraftName,
  };
}

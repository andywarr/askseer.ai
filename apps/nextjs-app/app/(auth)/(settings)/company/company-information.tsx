"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
import { toast } from "sonner";
import { z } from "zod";
import { getInitials } from "@/apps/nextjs-app/lib/utils/utils";
import {
  getCompanyLogoPutUrl,
  deleteS3Objects,
  getCompanyLogoGetUrl,
} from "@/apps/nextjs-app/lib/actions/s3-actions";
import {
  updateCompanyLogo,
  updateCompanyName,
} from "@/apps/nextjs-app/lib/db/data";

type Company = {
  id: string;
  name: string;
  status?: string; // ApprovalStatus
  logoKey?: string | null;
  logoUpdatedAt?: string | null;
};

interface Props {
  domain: string;
  company: Company;
  isOwner: boolean;
}

const nameSchema = z
  .string()
  .trim()
  .min(1, { message: "Company name is required." });

export default function CompanyInformation({
  domain,
  company,
  isOwner,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [currentName, setCurrentName] = useState(company.name);
  const [currentLogoKey, setCurrentLogoKey] = useState<string | null>(
    company.logoKey || null,
  );
  const [draftName, setDraftName] = useState(company.name);
  const [draftLogoFile, setDraftLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeExistingLogo, setRemoveExistingLogo] = useState(false);

  useEffect(() => {
    if (isEditing) return;
    setCurrentName(company.name);
    setDraftName(company.name);
    setCurrentLogoKey(company.logoKey || null);
  }, [company.id, company.name, company.logoKey, isEditing]);

  // Memoize derived state to avoid recalculating on every render
  const isNameChanged = useMemo(
    () => draftName.trim() !== currentName.trim(),
    [draftName, currentName],
  );
  const isImageChanged = useMemo(
    () => !!draftLogoFile || removeExistingLogo,
    [draftLogoFile, removeExistingLogo],
  );
  const parsedName = useMemo(
    () => nameSchema.safeParse(draftName),
    [draftName],
  );
  const isNameValid = useMemo(
    () => !isNameChanged || (parsedName?.success ?? true),
    [isNameChanged, parsedName?.success],
  );
  const nameError = useMemo(
    () =>
      isEditing && isNameChanged && !isNameValid
        ? (!parsedName?.success && parsedName?.error?.errors?.[0]?.message) ||
          "Company name is required."
        : undefined,
    [isEditing, isNameChanged, isNameValid, parsedName],
  );
  const canSave = useMemo(
    () => isOwner && !isSaving && isNameValid && (isNameChanged || isImageChanged),
    [isOwner, isSaving, isNameValid, isNameChanged, isImageChanged],
  );

  // Stabilize event handlers with useCallback
  const handleStartEdit = useCallback(() => {
    setDraftName(currentName);
    setIsEditing(true);
    setRemoveExistingLogo(false);
  }, [currentName]);

  const handleCancel = useCallback(() => {
    setDraftName(currentName);
    setIsEditing(false);
    setSaveError(null);
    setDraftLogoFile(null);
    setPreviewUrl(null);
    setRemoveExistingLogo(false);
  }, [currentName]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDraftLogoFile(file);
    setRemoveExistingLogo(false);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleSave = async () => {
    if (!isOwner || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    const prevName = currentName;
    let uploadedKey: string | null = null;
    const keysToDelete: string[] = [];
    try {
      const shouldUpdateName = isNameChanged && isNameValid;
      const trimmed = draftName.trim();
      if (shouldUpdateName) {
        setCurrentName(trimmed);
      }

      if (draftLogoFile) {
        const result = await getCompanyLogoPutUrl(
          company.id,
          draftLogoFile.name,
          draftLogoFile.type,
          draftLogoFile.size,
        );
        if (!result.success || !result.data) {
          throw new Error(
            result.success ? "No upload data returned" : result.error,
          );
        }
        const { uploadURL, key } = result.data;
        const putResp = await fetch(uploadURL, {
          method: "PUT",
          headers: { "Content-Type": draftLogoFile.type },
          body: draftLogoFile,
        });
        if (!putResp.ok) throw new Error("Failed to upload logo");
        uploadedKey = key;
        await updateCompanyLogo(company.id, key);
        if (currentLogoKey) keysToDelete.push(currentLogoKey);
        setCurrentLogoKey(key);
      } else if (removeExistingLogo && currentLogoKey) {
        await updateCompanyLogo(company.id, null);
        keysToDelete.push(currentLogoKey);
        setCurrentLogoKey(null);
      }

      if (shouldUpdateName) {
        await updateCompanyName(company.id, trimmed);
      }

      if (keysToDelete.length) {
        await deleteS3Objects(keysToDelete);
      }

      toast.success("Company updated");
      setIsEditing(false);
    } catch (e: any) {
      if (uploadedKey && uploadedKey !== currentLogoKey) {
        await deleteS3Objects([uploadedKey]);
      }
      if (isNameChanged) setCurrentName(prevName);
      setSaveError(e?.message || "Failed to update company");
      toast.error("Failed to update company");
    } finally {
      setIsSaving(false);
    }
  };

  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!currentLogoKey || previewUrl) {
        setResolvedImageUrl(null);
        return;
      }
      try {
        const result = await getCompanyLogoGetUrl(company.id, currentLogoKey);
        if (!ignore)
          setResolvedImageUrl(
            result.success && result.data ? result.data : null,
          );
      } catch {
        if (!ignore) setResolvedImageUrl(null);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [company.id, currentLogoKey, previewUrl]);

  return (
    <section className="group">
      <div className="flex items-start justify-between">
        <div className="grid max-w-2xl grid-cols-[140px_1fr] gap-x-6 gap-y-4">
          {/* Logo */}
          <div className="self-center">
            <Label className="text-xs leading-7 tracking-tight text-zinc-500">
              Logo
            </Label>
          </div>
          <div className="flex items-center gap-4">
            <Avatar className="ml-3 h-12 w-12 rounded-lg">
              <AvatarImage
                src={previewUrl || resolvedImageUrl || undefined}
                alt={currentName}
                className="h-full w-full object-cover"
              />
              <AvatarFallback className="rounded-lg">
                {getInitials(currentName)}
              </AvatarFallback>
            </Avatar>
            {isEditing && (
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
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
                  {draftLogoFile
                    ? "Replace"
                    : currentLogoKey
                      ? "Change"
                      : "Choose image"}
                </Button>
                {currentLogoKey && !draftLogoFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`h-8 ${removeExistingLogo ? "" : "text-red-500 hover:text-red-600"}`}
                    onClick={() => {
                      if (removeExistingLogo) {
                        setRemoveExistingLogo(false);
                      } else {
                        setRemoveExistingLogo(true);
                        setPreviewUrl(null);
                      }
                    }}
                  >
                    {removeExistingLogo ? "Undo" : "Remove"}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Name */}
          <div className="self-center">
            <Label
              className="text-xs leading-7 tracking-tight text-zinc-500"
              htmlFor="company-name"
            >
              Name
            </Label>
          </div>
          <div className="flex items-center">
            {isEditing ? (
              <div className="w-full">
                <Input
                  id="company-name"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Company name"
                  aria-invalid={isNameChanged && !isNameValid}
                  aria-describedby={
                    nameError ? "company-name-error" : undefined
                  }
                  className="h-10 w-full"
                />
                {nameError && (
                  <p
                    id="company-name-error"
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

          {/* Domain (read-only) */}
          <div className="self-start">
            <Label className="text-xs leading-7 tracking-tight text-zinc-500">
              Domain
            </Label>
          </div>
          {isEditing ? (
            <div className="pl-3">
              <div className="text-sm leading-7 tracking-tight">{domain}</div>
              <p className="mt-1 text-[0.8rem] text-zinc-500">
                Your domain cannot be changed. For support contact{" "}
                <a
                  href="mailto:support@askseer.ai"
                  className="underline underline-offset-2"
                >
                  support@askseer.ai
                </a>
                .
              </p>
            </div>
          ) : (
            <div className="pl-3 text-sm leading-7 tracking-tight">
              {domain}
            </div>
          )}
        </div>
        {isOwner && !isEditing && (
          <Button
            size="sm"
            variant="link"
            onClick={handleStartEdit}
            className="ml-6 opacity-100 transition-opacity md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:focus-visible:pointer-events-auto md:focus-visible:opacity-100"
          >
            Edit
          </Button>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {isOwner && isEditing && (
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

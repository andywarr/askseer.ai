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
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/apps/nextjs-app/components/ui/hover-card";
import { z } from "zod";
import { getInitials } from "@/apps/nextjs-app/lib/utils";
import { useRouter } from "next/navigation";
import { updateUserName } from "@/apps/nextjs-app/lib/data";
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
}

export default function AccountInformation({
  name,
  email,
  image,
  userId,
}: AccountInformationProps) {
  const router = useRouter();
  const [currentName, setCurrentName] = useState(name); // optimistic display name
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftImage, setDraftImage] = useState<string | undefined>(image);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
  }

  function handleCancel() {
    setDraftName(currentName);
    setDraftImage(image);
    setIsEditing(false);
    setSaveError(undefined);
  }

  function handleSelectImage() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setDraftImage(url);
  }

  // Validation: only enforce non-empty name if it has changed (vs currentName)
  const isNameChanged = draftName !== currentName;
  const parsedName = isNameChanged
    ? nameSchema.safeParse(draftName)
    : undefined;
  const isNameValid = !isNameChanged || (parsedName?.success ?? true);
  const nameError =
    isEditing && isNameChanged && !isNameValid
      ? (!parsedName?.success && parsedName?.error?.errors?.[0]?.message) ||
        "Your full name is required."
      : undefined;

  return (
    <section className="group">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Account Information
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
          <Label
            className="text-xs leading-7 tracking-tight text-zinc-500"
            htmlFor="profile-image"
          >
            Profile image
          </Label>
        </div>
        <div className="flex items-center gap-4 pl-3">
          <Avatar className="h-12 w-12 rounded-lg">
            {draftImage && (
              <AvatarImage
                src={draftImage}
                alt={draftName || email || "Profile image"}
                onError={() => setDraftImage(undefined)}
              />
            )}
            <AvatarFallback>
              {getInitials(draftName || email || "?")}
            </AvatarFallback>
          </Avatar>
          {isEditing && (
            <>
              <input
                ref={fileInputRef}
                id="profile-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button size="sm" variant="secondary" onClick={handleSelectImage}>
                Change photo
              </Button>
            </>
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
        <div className="self-center">
          <Label
            className="text-xs leading-7 tracking-tight text-zinc-500"
            htmlFor="email"
          >
            Email
          </Label>
        </div>
        <div className="flex items-center pl-3">
          {isEditing ? (
            <HoverCard>
              <HoverCardTrigger asChild>
                <div
                  id="email"
                  className="flex h-10 cursor-help items-center text-sm leading-7 tracking-tight text-zinc-500"
                >
                  {email || "—"}
                </div>
              </HoverCardTrigger>
              <HoverCardContent className="text-sm" side="top">
                Your email address cannot be changed because it is linked to
                your account.
              </HoverCardContent>
            </HoverCard>
          ) : (
            <div className="flex h-10 items-center text-sm leading-7 tracking-tight">
              {email || "—"}
            </div>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!isNameValid || !isNameChanged) return;
              const prevName = currentName;
              try {
                setIsSaving(true);
                setSaveError(undefined);
                const trimmed = draftName.trim();
                setCurrentName(trimmed); // Optimistically update UI
                await updateUserName(userId, trimmed);
                toast.success("Successfully updated account information");
                setIsSaving(false);
                setIsEditing(false);
                router.refresh();
              } catch (e) {
                setCurrentName(prevName); // Revert optimistic update
                setIsSaving(false);
                setSaveError("Failed to save changes. Please try again.");
                toast.error("Failed to update account information");
              }
            }}
            disabled={!isNameValid || isSaving || !isNameChanged}
            title={!isNameValid ? nameError : undefined}
          >
            Save
          </Button>
        </div>
      )}
      {saveError && (
        <p className="mt-2 text-right text-xs font-medium text-red-500">
          {saveError}
        </p>
      )}
    </section>
  );
}

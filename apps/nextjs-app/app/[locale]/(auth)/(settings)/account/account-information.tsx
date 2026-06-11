"use client";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
import { getInitials } from "@/apps/nextjs-app/lib/utils/utils";
import { Loader2 } from "lucide-react";
import { useAccountInformation } from "./use-account-information";
import { useTranslations } from "next-intl";

interface AccountInformationProps {
  name: string;
  email: string;
  image?: string;
  userId: string;
  imageKey?: string | null;
  imageUpdatedAt?: string | null;
}

export default function AccountInformation({
  name,
  email,
  image,
  userId,
  imageKey,
  imageUpdatedAt,
}: AccountInformationProps) {
  const t = useTranslations("AccountSettings");
  const {
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
    isNameChanged,
    isNameValid,
    nameError,
    canSave,
    showNameError,
    handleStartEdit,
    handleCancel,
    handleFileChange,
    handleSave,
    toggleRemoveImage,
    triggerFileInput,
    setDraftName,
  } = useAccountInformation({ name, image, userId, imageKey });

  return (
    <section className="group">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          {t("information.title")}
        </h3>
        {!isEditing && (
          <Button
            size="sm"
            variant="link"
            onClick={handleStartEdit}
            className="opacity-100 transition-opacity md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:focus-visible:pointer-events-auto md:focus-visible:opacity-100"
          >
            {t("information.edit")}
          </Button>
        )}
      </div>

      <div className="grid max-w-2xl grid-cols-[140px_1fr] gap-x-6 gap-y-4">
        {/* Profile image row */}
        <div className="self-center">
          <Label className="text-xs leading-7 tracking-tight text-zinc-500">
            {t("information.profileImage")}
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
                onClick={triggerFileInput}
                className="h-8"
              >
                {draftImageFile
                  ? t("information.replace")
                  : currentImageKey
                    ? t("information.change")
                    : t("information.chooseImage")}
              </Button>
              {currentImageKey && !draftImageFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={`h-8 ${removeExistingImage ? "" : "text-red-500 hover:text-red-600"}`}
                  onClick={toggleRemoveImage}
                >
                  {removeExistingImage ? t("information.undo") : t("information.remove")}
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
            {t("information.fullName")}
          </Label>
        </div>
        <div className="flex items-center">
          {isEditing ? (
            <div className="w-full">
              <Input
                id="name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder={t("information.fullNamePlaceholder")}
                aria-invalid={isNameChanged && !isNameValid}
                aria-describedby={nameError ? "name-error" : undefined}
                className="h-10 w-full"
              />
              {showNameError && (
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
            {t("information.email")}
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
                {t("information.emailNotice")}
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
              {t("information.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSave}
              title={!isNameValid ? nameError : undefined}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("information.save")}
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

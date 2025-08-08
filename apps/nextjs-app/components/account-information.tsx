"use client";

import { useState, useRef } from "react";
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

interface AccountInformationProps {
  name: string;
  email: string;
  image?: string;
}

export default function AccountInformation({
  name,
  email,
  image,
}: AccountInformationProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftImage, setDraftImage] = useState<string | undefined>(image);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleStartEdit() {
    setDraftName(name);
    setDraftImage(image);
    setIsEditing(true);
  }

  function handleCancel() {
    setDraftName(name);
    setDraftImage(image);
    setIsEditing(false);
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

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Account Information
        </h3>
        {!isEditing && (
          <Button size="sm" variant="link" onClick={handleStartEdit}>
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
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 rounded-lg">
            {draftImage && (
              <AvatarImage
                src={draftImage}
                alt={draftName || email || "Profile image"}
                onError={() => setDraftImage(undefined)}
              />
            )}
            <AvatarFallback>
              {(draftName || email || "?")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
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
            <Input
              id="name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Your name"
              className="h-10"
            />
          ) : (
            <div className="flex h-10 items-center text-sm leading-7 tracking-tight">
              {name || "—"}
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
        <div className="flex items-center">
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
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={() => setIsEditing(false)}>Save</Button>
        </div>
      )}
    </section>
  );
}

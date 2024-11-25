"use client";

// React function imports
import React, { useState } from "react";

// UI component imports
import { Button } from "@/components/ui/button";

interface TitleProps {
  children: string;
  studyId: string;
  userId: string;
  updateStudyName: (userId: string, studyId: string, newTitle: string) => void;
}

export default function Title({
  children,
  studyId,
  userId,
  updateStudyName,
}: TitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(children);

  const handleSave = async () => {
    setIsEditing(false);

    await updateStudyName(userId, studyId, newTitle);
  };

  return (
    <div className="group flex items-center">
      <h2 className="inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        {isEditing ? (
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSave();
              }
            }}
            className="border-b-2 border-gray-300 focus:outline-none"
          />
        ) : (
          newTitle
        )}
      </h2>
      {!isEditing && (
        <Button
          variant="ghost"
          size="icon"
          className="ml-4 hidden group-hover:inline-flex"
          onClick={() => setIsEditing(true)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="h-4"
            viewBox="0 -960 960 960"
            width="h-4"
            fill="currentColor"
          >
            <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z" />
          </svg>
        </Button>
      )}
      {isEditing && (
        <Button variant="ghost" size="icon" onClick={handleSave}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="h-4"
            viewBox="0 -960 960 960"
            width="h-4"
            fill="#currentColor"
          >
            <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" />
          </svg>
        </Button>
      )}
    </div>
  );
}

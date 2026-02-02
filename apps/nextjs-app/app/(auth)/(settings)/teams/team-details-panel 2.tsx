"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/apps/nextjs-app/components/ui/radio-group";
import { toast } from "sonner";
import {
  updateTeamName,
  updateTeamDescription,
  updateTeamJoinPolicy,
} from "@/apps/nextjs-app/lib/db/data";
import {
  TEAM_NAME_MIN_LENGTH,
  TEAM_NAME_MAX_LENGTH,
} from "@/apps/shared/constants";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";
import type { Team } from "./types";
import type { TeamJoinPolicy } from "@/apps/nextjs-app/types/types";

const TEAM_JOIN_POLICY_OPTIONS: Array<{
  value: TeamJoinPolicy;
  label: string;
  description: string;
}> = [
  {
    value: "INVITE_ONLY",
    label: "Invite-only",
    description: "Only team admins can add company members to the team.",
  },
  {
    value: "SECRET",
    label: "Secret",
    description: "An invite-only team hidden from the Teams directory.",
  },
  {
    value: "REQUEST_TO_JOIN",
    label: "Request to join",
    description: "Company members can request to join the team.",
  },
  {
    value: "SELF_JOIN",
    label: "Join",
    description: "Any company member can join the team instantly.",
  },
  {
    value: "AUTO_JOIN",
    label: "Auto-join",
    description: "All company members are automatically added to the team.",
  },
];

interface TeamDetailsPanelProps {
  team: Team;
  currentUserId: string;
  canRename: boolean;
  canUpdateJoinPolicy: boolean;
  joinPolicyOverride?: TeamJoinPolicy;
  onJoinPolicyChange: (policy: TeamJoinPolicy) => void;
  onFetchJoinRequests: () => Promise<void>;
}

export function TeamDetailsPanel({
  team,
  currentUserId,
  canRename,
  canUpdateJoinPolicy,
  joinPolicyOverride,
  onJoinPolicyChange,
  onFetchJoinRequests,
}: TeamDetailsPanelProps) {
  const router = useRouter();
  const [renamePending, startRenameTransition] = useTransition();
  const [joinPolicyPending, startJoinPolicyTransition] = useTransition();
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [renameValue, setRenameValue] = useState(team.name);
  const [descriptionValue, setDescriptionValue] = useState(
    team.description || ""
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  // Sync values when team changes
  useEffect(() => {
    setRenameValue(team.name);
    setDescriptionValue(team.description || "");
    setEditingName(false);
    setEditingDescription(false);
  }, [team]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  useEffect(() => {
    if (editingDescription && descriptionInputRef.current) {
      descriptionInputRef.current.focus();
      descriptionInputRef.current.select();
    }
  }, [editingDescription]);

  const handleNameSave = useCallback(
    async (newName: string) => {
      const trimmed = newName.trim();

      if (!trimmed) {
        toast.error("Team name cannot be empty");
        return;
      }

      if (
        trimmed.length < TEAM_NAME_MIN_LENGTH ||
        trimmed.length > TEAM_NAME_MAX_LENGTH
      ) {
        toast.error(
          `Team name must be between ${TEAM_NAME_MIN_LENGTH} and ${TEAM_NAME_MAX_LENGTH} characters`
        );
        return;
      }

      if (trimmed === team.name) {
        setEditingName(false);
        return;
      }

      startRenameTransition(async () => {
        try {
          await updateTeamName(team.id, currentUserId, trimmed);
          toast.success("Team name updated");
          setEditingName(false);
          setRenameValue(trimmed);
          router.refresh();
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Failed to update team name";
          toast.error(message);
        }
      });
    },
    [team, currentUserId, router]
  );

  const handleDescriptionSave = useCallback(
    async (newDescription: string) => {
      const trimmed = newDescription.trim() || null;
      const currentDescription = team.description?.trim() || null;

      if (trimmed === currentDescription) {
        setEditingDescription(false);
        return;
      }

      startRenameTransition(async () => {
        try {
          await updateTeamDescription(team.id, currentUserId, trimmed);
          toast.success("Team description updated");
          setEditingDescription(false);
          setDescriptionValue(trimmed || "");
          router.refresh();
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "Failed to update team description";
          toast.error(message);
          setDescriptionValue(team.description || "");
          setEditingDescription(false);
        }
      });
    },
    [team, currentUserId, router]
  );

  const handleJoinPolicyChange = useCallback(
    (policy: TeamJoinPolicy) => {
      const currentPolicy = joinPolicyOverride ?? team.joinPolicy;
      if (policy === currentPolicy) return;

      startJoinPolicyTransition(async () => {
        try {
          await updateTeamJoinPolicy(team.id, currentUserId, policy);
          onJoinPolicyChange(policy);
          toast.success("Team join settings updated");
          if (policy === "AUTO_JOIN") {
            await onFetchJoinRequests();
          }
          router.refresh();
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "Failed to update join settings";
          toast.error(message);
        }
      });
    },
    [team, currentUserId, router, joinPolicyOverride, onJoinPolicyChange, onFetchJoinRequests]
  );

  const selectedJoinPolicy = joinPolicyOverride ?? team.joinPolicy;

  return (
    <>
      {/* Editable Team Name */}
      <div className="mb-2">
        <h2 className="inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
          {editingName ? (
            <input
              ref={inputRef}
              type="text"
              defaultValue={team.name}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!renamePending && inputRef.current) {
                    handleNameSave(inputRef.current.value);
                  }
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditingName(false);
                }
              }}
              onBlur={(e) => {
                e.stopPropagation();
                setTimeout(() => {
                  if (inputRef.current && editingName) {
                    handleNameSave(inputRef.current.value);
                  }
                }, 150);
              }}
              className="border-b-2 border-gray-300 focus:outline-hidden"
              disabled={renamePending}
            />
          ) : (
            <span
              onClick={() => {
                if (canRename && !renamePending) {
                  setEditingName(true);
                }
              }}
              className={cn(
                canRename &&
                  !renamePending &&
                  "hover:text-muted-foreground cursor-pointer transition-colors"
              )}
            >
              {renameValue}
            </span>
          )}
        </h2>
      </div>

      {/* Editable Team Description */}
      <div className="mb-6">
        {editingDescription ? (
          <input
            ref={descriptionInputRef}
            type="text"
            defaultValue={descriptionValue}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                if (!renamePending && descriptionInputRef.current) {
                  handleDescriptionSave(descriptionInputRef.current.value);
                }
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setEditingDescription(false);
              }
            }}
            onBlur={(e) => {
              e.stopPropagation();
              setTimeout(() => {
                if (descriptionInputRef.current && editingDescription) {
                  handleDescriptionSave(descriptionInputRef.current.value);
                }
              }, 150);
            }}
            className="text-muted-foreground w-full border-b border-gray-300 text-sm focus:outline-hidden"
            placeholder="Add description"
            disabled={renamePending}
          />
        ) : (
          <p
            onClick={() => {
              if (canRename && !renamePending) {
                setEditingDescription(true);
              }
            }}
            className={cn(
              "text-muted-foreground text-sm",
              canRename &&
                !renamePending &&
                "hover:text-muted-foreground/70 cursor-pointer transition-colors",
              !descriptionValue && "italic"
            )}
          >
            {descriptionValue || "Add description"}
          </p>
        )}
      </div>

      {/* Team Join Policy */}
      {!team.isPersonal && (
        <div className="mt-6">
          <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
            Team Join Policy
          </h3>
          {team.isDefaultForCompany && (
            <p className="text-muted-foreground mt-2 text-sm">
              This is the company&apos;s default team. Auto-join is enforced
              and the join policy cannot be changed.
            </p>
          )}
          <RadioGroup
            value={selectedJoinPolicy ?? undefined}
            onValueChange={(value) =>
              handleJoinPolicyChange(value as TeamJoinPolicy)
            }
            disabled={!canUpdateJoinPolicy || joinPolicyPending}
            className="mt-4 gap-4"
          >
            {TEAM_JOIN_POLICY_OPTIONS.map((option) => (
              <div
                key={option.value}
                className="flex w-fit items-start space-x-3"
              >
                <RadioGroupItem
                  value={option.value}
                  id={`join-policy-${option.value}`}
                  disabled={!canUpdateJoinPolicy || joinPolicyPending}
                />
                <label
                  htmlFor={`join-policy-${option.value}`}
                  className="flex cursor-pointer flex-col"
                >
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {option.description}
                  </span>
                </label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/apps/nextjs-app/components/ui/command";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/apps/nextjs-app/components/ui/select";
import { Plus, X } from "lucide-react";
import type { CompanyMember } from "./types";

export type MemberRole = "ADMIN" | "MEMBER";

export interface SelectedMember {
  userId: string;
  role: MemberRole;
}

interface MemberSelectorProps {
  /** List of company members available for selection */
  availableMembers: CompanyMember[];
  /** Currently selected members with their roles */
  selectedMembers: Record<string, MemberRole>;
  /** Callback when a member is added */
  onAddMember: (userId: string, role: MemberRole) => void;
  /** Callback when a member is removed */
  onRemoveMember: (userId: string) => void;
  /** Callback when a member's role changes */
  onRoleChange: (userId: string, role: MemberRole) => void;
  /** Whether the add member UI is disabled */
  disabled?: boolean;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Label for the add button when members already exist */
  addAnotherLabel?: string;
  /** Label for the add button when no members added yet */
  addFirstLabel?: string;
  /** ARIA label for the member selector */
  ariaLabel?: string;
}

/**
 * A reusable component for selecting company members with role assignment.
 * Used in both Create Team and Add Members dialogs.
 */
export function MemberSelector({
  availableMembers,
  selectedMembers,
  onAddMember,
  onRemoveMember,
  onRoleChange,
  disabled = false,
  searchPlaceholder,
  addAnotherLabel,
  addFirstLabel,
  ariaLabel,
}: MemberSelectorProps) {
  const t = useTranslations("TeamsSettings");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<MemberRole>("MEMBER");
  const [searchValue, setSearchValue] = useState("");
  const [listOpen, setListOpen] = useState(false);

  const finalSearchPlaceholder =
    searchPlaceholder ?? t("searchCompanyMembersPlaceholder");
  const finalAddAnotherLabel = addAnotherLabel ?? t("addAnotherMember");
  const finalAddFirstLabel = addFirstLabel ?? t("addMember");
  const finalAriaLabel = ariaLabel ?? t("selectTeamMembersAria");

  const hasSelectedMembers = Object.keys(selectedMembers).length > 0;
  const filteredAvailableMembers = availableMembers.filter(
    (m) => !selectedMembers[m.userId]
  );
  const selectedMemberData = filteredAvailableMembers.find(
    (m) => m.userId === selectedUserId
  );

  const handleConfirmAdd = () => {
    if (!selectedUserId) return;
    onAddMember(selectedUserId, selectedRole);
    setSelectedUserId(null);
    setSearchValue("");
    setSelectedRole("MEMBER");
    setIsAddingMember(false);
  };

  const handleStartAdding = () => {
    setIsAddingMember(true);
    setSearchValue("");
    setSelectedUserId(null);
  };

  const getMemberDisplay = (member: CompanyMember) =>
    member.user.name || member.user.email;

  // Show selected members list
  const renderSelectedMembers = () => {
    if (!hasSelectedMembers) return null;

    return (
      <div
        className="mb-4 max-h-60 overflow-y-auto"
        role="list"
        aria-label={t("selectedMembersAria")}
      >
        {Object.entries(selectedMembers).map(([userId, role]) => {
          const member = availableMembers.find((m) => m.userId === userId);
          if (!member) return null;
          return (
            <div
              key={userId}
              role="listitem"
              className="mb-2 flex items-center justify-between gap-2 last:mb-0"
            >
              <span className="text-sm">{getMemberDisplay(member)}</span>
              <div className="flex items-center gap-2">
                <Select
                  value={role}
                  onValueChange={(value) =>
                    onRoleChange(userId, value as MemberRole)
                  }
                  disabled={disabled}
                >
                  <SelectTrigger
                    className="h-8 w-[120px]"
                    aria-label={`Role for ${getMemberDisplay(member)}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">{t("roles.admin")}</SelectItem>
                    <SelectItem value="MEMBER">{t("roles.member")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveMember(userId)}
                  disabled={disabled}
                  aria-label={`Remove ${getMemberDisplay(member)}`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Show the add member search interface
  const renderAddMemberUI = () => {
    if (filteredAvailableMembers.length === 0) {
      if (!hasSelectedMembers) {
        return (
          <p className="mb-4 text-sm text-orange-500" role="alert">
            {t("noCompanyMembersAvailable")}
          </p>
        );
      }
      return null;
    }

    if (!isAddingMember && hasSelectedMembers) {
      return (
        <div className="mb-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleStartAdding}
            disabled={disabled}
          >
            {finalAddAnotherLabel}
          </Button>
        </div>
      );
    }

    return (
      <div
        className="mb-4 flex items-start gap-2"
        role="group"
        aria-label={finalAriaLabel}
      >
        <div
          className="flex-1"
          onBlur={(e) => {
            const next = e.relatedTarget as Node | null;
            if (!e.currentTarget.contains(next)) {
              setListOpen(false);
            }
          }}
        >
          <Command className="rounded-md border">
            <CommandInput
              placeholder={finalSearchPlaceholder}
              value={
                selectedMemberData
                  ? getMemberDisplay(selectedMemberData)
                  : searchValue
              }
              onValueChange={(v) => {
                setSearchValue(v);
                setSelectedUserId(null);
                setListOpen(true);
              }}
              onClick={() => setListOpen(true)}
              hideIcon
              aria-label={t("searchForMembersAria")}
            />
            <CommandList
              className={
                listOpen
                  ? "max-h-40 overflow-y-auto"
                  : "hidden max-h-40 overflow-y-auto"
              }
            >
              <CommandEmpty>{t("noMembersFound")}</CommandEmpty>
              <CommandGroup>
                {filteredAvailableMembers
                  .filter((m) =>
                    getMemberDisplay(m)
                      .toLowerCase()
                      .includes(searchValue.toLowerCase())
                  )
                  .map((m) => (
                    <CommandItem
                      key={m.userId}
                      value={getMemberDisplay(m)}
                      onSelect={() => {
                        setSelectedUserId(m.userId);
                        setSearchValue(getMemberDisplay(m));
                        setListOpen(false);
                      }}
                    >
                      {getMemberDisplay(m)}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
        <Select
          value={selectedRole}
          onValueChange={(value) => setSelectedRole(value as MemberRole)}
          disabled={disabled}
        >
          <SelectTrigger
            className="h-8 w-[120px] self-start"
            aria-label={t("selectRoleForNewMemberAria")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ADMIN">{t("roles.admin")}</SelectItem>
            <SelectItem value="MEMBER">{t("roles.member")}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="self-start"
          onClick={handleConfirmAdd}
          disabled={!selectedUserId || disabled}
          aria-label={t("addSelectedMemberAria")}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    );
  };

  return (
    <>
      {renderSelectedMembers()}
      {renderAddMemberUI()}
    </>
  );
}

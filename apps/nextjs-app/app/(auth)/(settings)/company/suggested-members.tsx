"use client";

import {
  useState,
  useTransition,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/apps/nextjs-app/components/ui/avatar";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";
import { Checkbox } from "@/apps/nextjs-app/components/ui/checkbox";
import { toast } from "sonner";
import { enrollDomainUsers } from "@/apps/nextjs-app/lib/data";
import { getInitials } from "@/apps/nextjs-app/lib/utils";

interface DomainUser {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  companyId: string;
  domain: string;
  users: DomainUser[];
  isOwner: boolean;
  onUsersEnrolled?: () => void | Promise<void>;
}

export default function SuggestedMembers({
  companyId,
  domain,
  users: initialUsers,
  isOwner,
  onUsersEnrolled,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [users, setUsers] = useState(initialUsers);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);

  const edgeFadeColor = "255, 255, 255";
  const topEdgeGradient = `linear-gradient(to top, rgba(${edgeFadeColor}, 1) 0%, rgba(${edgeFadeColor}, 0.6) 60%, rgba(${edgeFadeColor}, 0) 100%)`;
  const bottomEdgeGradient = `linear-gradient(to bottom, rgba(${edgeFadeColor}, 1) 0%, rgba(${edgeFadeColor}, 0.6) 60%, rgba(${edgeFadeColor}, 0) 100%)`;

  const updateScrollShadows = useCallback(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      setShowTopShadow(false);
      setShowBottomShadow(false);
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = container;
    const canScroll = scrollHeight - clientHeight > 1;

    setShowTopShadow(canScroll && scrollTop > 0);
    setShowBottomShadow(
      canScroll && scrollTop + clientHeight < scrollHeight - 1,
    );
  }, []);

  useEffect(() => {
    updateScrollShadows();
  }, [users, updateScrollShadows]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        updateScrollShadows();
      }, 100);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, [updateScrollShadows]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(new Set(users.map((u) => u.id)));
    } else {
      setSelectedUserIds(new Set());
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return next;
    });
  };

  const enrollUsers = useCallback(
    (userIds: string[]) => {
      if (userIds.length === 0) return;

      startTransition(async () => {
        try {
          await enrollDomainUsers(companyId, userIds);
          const count = userIds.length;
          toast.success(`${count} ${count === 1 ? "user" : "users"} enrolled`);
          const enrolledSet = new Set(userIds);
          setUsers((prev) => prev.filter((u) => !enrolledSet.has(u.id)));
          setSelectedUserIds((prev) => {
            const next = new Set(prev);
            userIds.forEach((id) => next.delete(id));
            return next;
          });
          if (onUsersEnrolled) {
            await onUsersEnrolled();
          }
          router.refresh();
        } catch (e: any) {
          toast.error(e?.message || "Failed to enroll users");
        }
      });
    },
    [companyId, onUsersEnrolled, router],
  );

  const handleEnrollSelected = () => {
    enrollUsers(Array.from(selectedUserIds));
  };

  const handleEnrollAll = () => {
    enrollUsers(users.map((u) => u.id));
  };

  const handleEnrollSingle = (userId: string) => {
    enrollUsers([userId]);
  };

  const domainArticle = useMemo(
    () => (/^[aeiou]/i.test(domain?.[0] ?? "") ? "an" : "a"),
    [domain],
  );
  const allSelected = useMemo(
    () => users.length > 0 && selectedUserIds.size === users.length,
    [users.length, selectedUserIds.size],
  );
  const someSelected = useMemo(
    () => selectedUserIds.size > 0 && !allSelected,
    [selectedUserIds.size, allSelected],
  );

  if (users.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Suggested Members</CardTitle>
        <CardDescription>
          {users.length} existing{" "}
          {users.length === 1 ? "user has" : "users have"} {domainArticle}{" "}
          {domain} email address and {users.length === 1 ? "is" : "are"} not
          part of this company yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={allSelected}
              ref={(el) => {
                if (el) {
                  (
                    el as HTMLButtonElement & { indeterminate?: boolean }
                  ).indeterminate = someSelected;
                }
              }}
              disabled={!isOwner || pending}
              onCheckedChange={(checked: boolean) => handleSelectAll(!!checked)}
            />
            <label htmlFor="select-all" className="text-sm text-zinc-700">
              Select all
            </label>
          </div>
          <div className="flex items-center gap-2">
            {selectedUserIds.size > 0 && (
              <Button
                size="sm"
                onClick={handleEnrollSelected}
                disabled={!isOwner || pending}
              >
                Enroll Selected ({selectedUserIds.size})
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleEnrollAll}
              disabled={!isOwner || pending}
            >
              Enroll All
            </Button>
          </div>
        </div>
        <div className="relative">
          <div
            ref={scrollContainerRef}
            onScroll={updateScrollShadows}
            className="max-h-80 overflow-y-auto"
          >
            {users.map((user, index) => (
              <div
                key={user.id}
                className={`flex items-center justify-between gap-3 border-x border-b p-3 ${
                  index === 0 ? "rounded-t-lg border-t" : ""
                } ${index === users.length - 1 ? "rounded-b-lg" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedUserIds.has(user.id)}
                    disabled={!isOwner || pending}
                    onCheckedChange={(checked: boolean) =>
                      handleSelectUser(user.id, !!checked)
                    }
                  />
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback>
                      {getInitials(user.name || user.email) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">
                      {user.name || user.email}
                    </span>
                    {user.name && (
                      <span className="text-muted-foreground truncate text-sm">
                        {user.email}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleEnrollSingle(user.id)}
                  disabled={!isOwner || pending}
                >
                  Enroll
                </Button>
              </div>
            ))}
          </div>
          {showTopShadow && (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-lg"
              style={{ background: bottomEdgeGradient }}
            />
          )}
          {showBottomShadow && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-lg"
              style={{ background: topEdgeGradient }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

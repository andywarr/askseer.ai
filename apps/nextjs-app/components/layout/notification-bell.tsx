"use client";

import {
  useState,
  useEffect,
  useTransition,
  useMemo,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  ExternalLink,
  UserPlus,
  UserCheck,
  UserX,
  FileCheck,
  FileX,
  AlertTriangle,
  AlertOctagon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useTranslations, useLocale } from "next-intl";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/apps/nextjs-app/components/ui/popover";
import { ScrollArea } from "@/apps/nextjs-app/components/ui/scroll-area";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/apps/nextjs-app/components/ui/tabs";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type Notification,
} from "@/apps/nextjs-app/lib/db/data";

type FilterTab = "all" | "user" | "admin";

interface NotificationBellProps {
  userId: string;
  isAdmin?: boolean;
}

const ICON_CLASS = "h-4 w-4";

function getNotificationIcon(type: string) {
  switch (type) {
    case "TEAM_JOIN_REQUEST":
      return <UserPlus className={`${ICON_CLASS} text-blue-500`} />;
    case "TEAM_JOIN_APPROVED":
      return <UserCheck className={`${ICON_CLASS} text-green-500`} />;
    case "TEAM_JOIN_REJECTED":
      return <UserX className={`${ICON_CLASS} text-red-500`} />;
    case "STUDY_COMPLETE":
      return <FileCheck className={`${ICON_CLASS} text-green-500`} />;
    case "STUDY_FAILED":
      return <FileX className={`${ICON_CLASS} text-red-500`} />;
    case "CREDITS_LOW":
    case "BALANCE_LOW":
      return <AlertTriangle className={`${ICON_CLASS} text-amber-500`} />;
    case "CREDITS_EXHAUSTED":
    case "BALANCE_EXHAUSTED":
      return <AlertOctagon className={`${ICON_CLASS} text-red-500`} />;
    default:
      return <Bell className={`${ICON_CLASS} text-muted-foreground`} />;
  }
}

export function NotificationBell({
  userId,
  isAdmin = false,
}: NotificationBellProps) {
  const router = useRouter();
  const t = useTranslations("Notifications");
  const locale = useLocale();
  const dateLocale = locale === "es" ? es : enUS;

  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<FilterTab>(
    isAdmin ? "all" : "user",
  );

  const getLocalizedNotification = useCallback((notification: Notification) => {
    let typeKey = notification.type;
    if (typeKey === "CREDITS_LOW") {
      typeKey = "BALANCE_LOW";
    } else if (typeKey === "CREDITS_EXHAUSTED") {
      typeKey = "BALANCE_EXHAUSTED";
    }

    let localizedTitle = notification.title;
    let localizedMessage = notification.message;

    const knownTypes = [
      "STUDY_COMPLETE",
      "STUDY_FAILED",
      "TEAM_JOIN_REQUEST",
      "TEAM_JOIN_APPROVED",
      "TEAM_JOIN_REJECTED",
      "BALANCE_LOW",
      "BALANCE_EXHAUSTED"
    ];

    if (knownTypes.includes(typeKey)) {
      try {
        localizedTitle = t(`types.${typeKey}.title`);

        const metadata = notification.metadata || {};
        const msgParams: Record<string, string> = {};

        if (typeKey === "STUDY_COMPLETE" || typeKey === "STUDY_FAILED") {
          msgParams.studyName = (metadata.studyName as string) || "Your study";
        } else if (typeKey === "TEAM_JOIN_REQUEST") {
          msgParams.requesterName = (metadata.requesterName as string) || "A user";
          let teamName = "your team";
          if (notification.message) {
            const match = notification.message.match(/requested to join (.+)$/);
            if (match) teamName = match[1];
          }
          msgParams.teamName = teamName;
        } else if (typeKey === "TEAM_JOIN_APPROVED") {
          let teamName = "your team";
          if (notification.message) {
            const match = notification.message.match(/Your request to join (.+) was approved/);
            if (match) teamName = match[1];
          }
          msgParams.teamName = teamName;
        } else if (typeKey === "TEAM_JOIN_REJECTED") {
          let teamName = (metadata.teamName as string) || "your team";
          if (!teamName && notification.message) {
            const match = notification.message.match(/Your request to join (.+) was declined/);
            if (match) teamName = match[1];
          }
          const rejectReason = (metadata.rejectReason as string | null) || null;
          msgParams.teamName = teamName;
          msgParams.rejectReason = rejectReason || "";
          
          if (rejectReason) {
            localizedMessage = t(`types.${typeKey}.messageWithReason`, msgParams);
            return { title: localizedTitle, message: localizedMessage };
          }
        } else if (typeKey === "BALANCE_LOW") {
          let teamName = "your team";
          let balance = "$0.00";
          if (notification.message) {
            const match = notification.message.match(/(.+) has (.+) remaining\. Add more/);
            if (match) {
              teamName = match[1];
              balance = match[2];
            }
          }
          msgParams.teamName = teamName;
          msgParams.balance = balance;
        } else if (typeKey === "BALANCE_EXHAUSTED") {
          let teamName = "your team";
          let balance = "$0.00";
          if (notification.message) {
            const match = notification.message.match(/(.+) has insufficient funds \((.+)\)\. Studies/);
            if (match) {
              teamName = match[1];
              balance = match[2];
            }
          }
          msgParams.teamName = teamName;
          msgParams.balance = balance;
        }

        localizedMessage = t(`types.${typeKey}.message`, msgParams);
      } catch (err) {
        console.error("Failed to translate notification:", err);
      }
    }

    return { title: localizedTitle, message: localizedMessage };
  }, [t]);

  // Fetch unread count on mount and periodically
  useEffect(() => {
    const fetchCount = async () => {
      const count = await getUnreadNotificationCount(userId);
      setUnreadCount(count);
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [userId]);

  // Fetch notifications when popover opens
  useEffect(() => {
    if (open) {
      setLoading(true);
      getNotifications(userId, { pageSize: 50 }) // Fetch more to allow filtering
        .then((data) => {
          setNotifications(data.notifications);
        })
        .catch(() => {
          setNotifications([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, userId]);

  // Filter notifications based on active tab (admins only)
  const filteredNotifications = useMemo(() => {
    // Non-admins always see all notifications (they won't have ADMIN audience ones)
    if (!isAdmin) return notifications;

    switch (activeTab) {
      case "user":
        return notifications.filter((n) => n.audience === "USER");
      case "admin":
        return notifications.filter((n) => n.audience === "ADMIN");
      default:
        return notifications;
    }
  }, [notifications, activeTab, isAdmin]);

  // Count notifications per tab for badges
  const tabCounts = useMemo(() => {
    const userCount = notifications.filter(
      (n) => n.audience === "USER" && !n.isRead,
    ).length;
    const adminCount = notifications.filter(
      (n) => n.audience === "ADMIN" && !n.isRead,
    ).length;
    return { user: userCount, admin: adminCount };
  }, [notifications]);

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      startTransition(async () => {
        if (!notification.isRead) {
          await markNotificationAsRead(notification.id, userId);
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notification.id ? { ...n, isRead: true } : n,
            ),
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }

        if (notification.actionUrl) {
          setOpen(false);
          router.push(notification.actionUrl);
        }
      });
    },
    [userId, router, startTransition],
  );

  const handleMarkAllRead = useCallback(() => {
    startTransition(async () => {
      await markAllNotificationsAsRead(userId);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    });
  }, [userId, startTransition]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label={`${t("title")}${unreadCount > 0 ? ` ${t("unreadCount", { count: unreadCount })}` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="text-sm font-semibold">{t("title")}</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={handleMarkAllRead}
              disabled={pending}
            >
              <Check className="mr-1 h-3 w-3" />
              {t("markAllRead")}
            </Button>
          )}
        </div>

        {/* Filter Tabs - Only shown for admins */}
        {isAdmin && (
          <div className="border-b px-2 py-2">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as FilterTab)}
            >
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1 text-xs">
                  {t("all")}
                </TabsTrigger>
                <TabsTrigger value="user" className="flex-1 text-xs">
                  {t("personal")}
                  {tabCounts.user > 0 && (
                    <span className="ml-1 rounded-full bg-blue-500 px-1.5 text-[10px] text-white">
                      {tabCounts.user}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="admin" className="flex-1 text-xs">
                  {t("team")}
                  {tabCounts.admin > 0 && (
                    <span className="ml-1 rounded-full bg-purple-500 px-1.5 text-[10px] text-white">
                      {tabCounts.admin}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        <ScrollArea className="h-[280px]">
          {loading ? (
            <div className="flex h-20 items-center justify-center">
              <span className="text-muted-foreground text-sm">{t("loading")}</span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex h-20 items-center justify-center">
              <span className="text-muted-foreground text-sm">
                {t("noNotifications")}
              </span>
            </div>
          ) : (
            <div className="divide-y">
              {filteredNotifications.map((notification) => (
                <button
                  key={notification.id}
                  className={cn(
                    "hover:bg-muted/50 flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                    !notification.isRead && notification.audience === "ADMIN"
                      ? "bg-purple-50/50 dark:bg-purple-950/20"
                      : !notification.isRead
                        ? "bg-blue-50/50 dark:bg-blue-950/20"
                        : "",
                  )}
                  onClick={() => handleNotificationClick(notification)}
                  disabled={pending}
                >
                  <div className="mt-0.5 shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    {(() => {
                      const { title, message } = getLocalizedNotification(notification);
                      return (
                        <>
                          <p
                            className={cn(
                              "truncate text-sm",
                              !notification.isRead && "font-medium",
                            )}
                          >
                            {title}
                          </p>
                          {message && (
                            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                              {message}
                            </p>
                          )}
                        </>
                      );
                    })()}
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                        locale: dateLocale,
                      })}
                    </p>
                  </div>
                  {notification.actionUrl && (
                    <ExternalLink className="text-muted-foreground mt-0.5 h-3 w-3 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

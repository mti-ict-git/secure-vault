import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { SyncEvent } from "@/hooks/useSyncEvents";
import { get, post } from "@/lib/api";

export type NotificationSeverity = "info" | "warning" | "critical";

export type NotificationItem = {
  id: string;
  t: number;
  type: string;
  severity: NotificationSeverity;
  message: string;
  read: boolean;
};

export type NotificationsContextValue = {
  notifications: NotificationItem[];
  unreadCount: number;
  pushSyncEvent: (event: SyncEvent) => void;
  markAllRead: () => void;
  clear: () => void;
};

export const NotificationsContext = createContext<NotificationsContextValue>({
  notifications: [],
  unreadCount: 0,
  pushSyncEvent: () => {},
  markAllRead: () => {},
  clear: () => {},
});

type ServerNotification = {
  id: string;
  type: string;
  severity?: NotificationSeverity;
  message: string;
  created_at: string;
  read_at: string | null;
};

/**
 * Notifications are stored on the server (security receipts and alerts), so they
 * survive reloads and reach users who were offline. Sync events only trigger a refetch.
 */
export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const res = await get<{ items: ServerNotification[] }>("/notifications");
    if (!res.ok || !res.body?.items) return;
    setNotifications(
      res.body.items.map((n) => ({
        id: n.id,
        t: new Date(n.created_at).getTime(),
        type: n.type,
        severity: n.severity ?? "info",
        message: n.message,
        read: !!n.read_at,
      }))
    );
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
    };
  }, [load]);

  const pushSyncEvent = useCallback(
    (event: SyncEvent) => {
      if (event.type !== "notification") return;
      // Several notifications can arrive together; fetch once.
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(() => void load(), 300);
    },
    [load]
  );

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
    void post("/notifications/read", {});
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
    void post("/notifications/dismiss", {});
  }, []);

  const unreadCount = useMemo(() => notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0), [notifications]);

  const value: NotificationsContextValue = useMemo(
    () => ({ notifications, unreadCount, pushSyncEvent, markAllRead, clear }),
    [notifications, unreadCount, pushSyncEvent, markAllRead, clear]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = () => useContext(NotificationsContext);

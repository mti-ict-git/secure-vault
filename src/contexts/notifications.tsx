import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { SyncEvent } from "@/hooks/useSyncEvents";

export type NotificationItem = {
  id: string;
  t: number;
  type: SyncEvent["type"];
  message: string;
  read: boolean;
  raw: SyncEvent;
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

const formatSyncEventMessage = (event: SyncEvent) => {
  switch (event.type) {
    case "vault_create":
      return "Vault created";
    case "blob_upload":
      return "File uploaded";
    case "team_create":
      return "Team created";
    case "team_invite":
      return "Team invite sent";
    case "team_invite_accept":
      return "Team invite accepted";
    case "team_update":
      return "Team updated";
    case "team_delete":
      return "Team deleted";
    case "team_role_update":
      return "Team role updated";
    case "team_member_remove":
      return "Team member removed";
    case "vault_share":
      return "Vault shared";
    case "heartbeat":
      return "Sync heartbeat";
    default:
      return "New activity";
  }
};

const makeId = () => {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const pushSyncEvent = useCallback((event: SyncEvent) => {
    if (event.type === "heartbeat") return;
    setNotifications((prev) => {
      const next: NotificationItem = {
        id: makeId(),
        t: event.t,
        type: event.type,
        message: formatSyncEventMessage(event),
        read: false,
        raw: event,
      };
      const merged = [next, ...prev];
      return merged.slice(0, 50);
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = useMemo(() => notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0), [notifications]);

  const value: NotificationsContextValue = useMemo(
    () => ({
      notifications,
      unreadCount,
      pushSyncEvent,
      markAllRead,
      clear,
    }),
    [notifications, unreadCount, pushSyncEvent, markAllRead, clear]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = () => useContext(NotificationsContext);

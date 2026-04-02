import { Bell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/contexts/notifications";

const formatTime = (t: number) => {
  const d = new Date(t);
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
};

export function NotificationsBell() {
  const { notifications, unreadCount, markAllRead, clear } = useNotifications();

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) markAllRead();
      }}
    >
      <PopoverTrigger asChild>
        <div className="relative">
          <Button variant="outline" size="icon" aria-label="Notifications">
            <Bell className="w-4 h-4" />
          </Button>
          {unreadCount > 0 ? (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-[10px] leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          ) : null}
        </div>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="text-sm font-semibold">Notifications</div>
          <Button variant="ghost" size="icon-sm" onClick={clear} aria-label="Clear notifications">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        <div className="max-h-80 overflow-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">No notifications</div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 10).map((n) => (
                <div key={n.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm text-foreground">{n.message}</div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(n.t)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}


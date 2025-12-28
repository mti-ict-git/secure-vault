import { useEffect, useState } from 'react';
import { 
  Activity, 
  Shield, 
  Users, 
  Share2, 
  Key, 
  Upload, 
  Trash2,
  UserPlus,
  Settings,
  RefreshCw,
  Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { get } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AuditEvent {
  id: string;
  action: string;
  actor_user_id: string;
  actor_username?: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'vault.create': Shield,
  'vault.delete': Trash2,
  'blob.upload': Upload,
  'blob.delete': Trash2,
  'team.create': Users,
  'team.delete': Trash2,
  'team.invite': UserPlus,
  'team.member.remove': Trash2,
  'team.member.role': Settings,
  'share.create': Share2,
  'share.revoke': Trash2,
  'keys.register': Key,
};

const ACTION_LABELS: Record<string, string> = {
  'vault.create': 'Created vault',
  'vault.delete': 'Deleted vault',
  'blob.upload': 'Uploaded file',
  'blob.delete': 'Deleted file',
  'team.create': 'Created team',
  'team.delete': 'Deleted team',
  'team.invite': 'Invited member',
  'team.member.remove': 'Removed member',
  'team.member.role': 'Changed member role',
  'share.create': 'Shared vault',
  'share.revoke': 'Revoked share',
  'keys.register': 'Registered keys',
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

export function ActivityView() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await get<{ events: AuditEvent[] }>('/audit');
      if (res.ok && res.body?.events) {
        setEvents(res.body.events);
      } else {
        setError('Failed to load activity');
      }
    } catch (err) {
      setError('Failed to load activity');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={fetchActivity}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Activity</h2>
            <p className="text-sm text-muted-foreground">
              Recent actions in your vaults
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchActivity}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Activity list */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {events.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No activity yet</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
              
              <div className="space-y-6">
                {events.map((event, index) => {
                  const Icon = ACTION_ICONS[event.action] || Activity;
                  const label = ACTION_LABELS[event.action] || event.action;
                  
                  return (
                    <div key={event.id} className="relative flex gap-4">
                      {/* Icon */}
                      <div className={cn(
                        "relative z-10 w-10 h-10 rounded-full flex items-center justify-center",
                        "bg-background border border-border"
                      )}>
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 pt-1">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium">{label}</p>
                            {event.actor_username && (
                              <p className="text-xs text-muted-foreground">
                                by {event.actor_username}
                              </p>
                            )}
                            {event.target_type && event.target_id && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {event.target_type}: {event.target_id.slice(0, 8)}...
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatRelativeTime(event.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

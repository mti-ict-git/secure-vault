import { useCallback, useEffect, useState } from 'react';
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
  Loader2,
  User,
  Lock,
  Copy,
  AlertCircle,
  FilePlus,
  Pencil,
  Folder,
  Download,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { get } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AuditEvent {
  id: string;
  action: string;
  actor_user_id: string;
  actor_username?: string;
  resource_type?: string;
  resource_id?: string;
  details_json?: unknown;
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
  'team.role.update': Settings,
  'share.create': Share2,
  'share.revoke': Trash2,
  'keys.register': Key,
  'vault.share': Share2,
  'auth.login': User,
  'auth.login.failed': AlertCircle,
  'vault.unlock': Lock,
  'vault.unlock.failed': AlertCircle,
  'password.copy': Copy,
  'username.copy': Copy,
  'entry.create': FilePlus,
  'entry.update': Pencil,
  'entry.delete': Trash2,
  'entry.favorite': Star,
  'folder.create': Folder,
  'folder.delete': Trash2,
  'export.json': Download,
  'export.csv': Download,
  'export.kdbx': Download,
  'import.kdbx': Upload,
  'entry.copy.to.team': Share2,
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
  'team.role.update': 'Changed member role',
  'share.create': 'Shared vault',
  'share.revoke': 'Revoked share',
  'keys.register': 'Registered keys',
  'vault.share': 'Shared vault',
  'auth.login': 'Signed in',
  'auth.login.failed': 'Failed sign-in',
  'vault.unlock': 'Unlocked vault',
  'vault.unlock.failed': 'Failed vault unlock',
  'password.copy': 'Copied password',
  'username.copy': 'Copied username',
  'entry.create': 'Created credential',
  'entry.update': 'Updated credential',
  'entry.delete': 'Deleted credential',
  'entry.favorite': 'Toggled favorite',
  'folder.create': 'Created folder',
  'folder.delete': 'Deleted folder',
  'export.json': 'Exported entries (JSON)',
  'export.csv': 'Exported entries (CSV)',
  'export.kdbx': 'Exported KeePass (.kdbx)',
  'import.kdbx': 'Imported from KeePass',
  'entry.copy.to.team': 'Copied entries to team',
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
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [action, setAction] = useState('');

  const fetchActivity = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const qs = new URLSearchParams();
      if (since) qs.set('since', since);
      if (until) qs.set('until', until);
      if (action) qs.set('action', action);
      const res = await get<{ items: AuditEvent[] }>(`/audit${qs.toString() ? `?${qs.toString()}` : ''}`);
      if (res.ok && res.body?.items) {
        const normalized = (res.body.items || []).map((e) => ({
          ...e,
          action: e.action.includes("_") ? e.action.split("_").join(".") : e.action,
        }));
        setEvents(normalized);
      } else {
        setError('Failed to load activity');
      }
    } catch (err) {
      setError('Failed to load activity');
    } finally {
      setIsLoading(false);
    }
  }, [since, until, action]);

  useEffect(() => {
    void fetchActivity();
  }, [fetchActivity]);

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

      <div className="p-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-4">
            <div className="space-y-3 p-4 border rounded-xl bg-card/40">
              <div className="space-y-2">
                <label className="text-sm font-medium">Since (ISO)</label>
                <Input value={since} onChange={(e) => setSince(e.target.value)} placeholder="YYYY-MM-DD" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Until (ISO)</label>
                <Input value={until} onChange={(e) => setUntil(e.target.value)} placeholder="YYYY-MM-DD" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Action</label>
                <Select value={action || 'all'} onValueChange={(v) => setAction(v === 'all' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    <SelectItem value="vault.create">Vault create</SelectItem>
                    <SelectItem value="vault.delete">Vault delete</SelectItem>
                    <SelectItem value="vault.share">Vault share</SelectItem>
                    <SelectItem value="blob.upload">Blob upload</SelectItem>
                    <SelectItem value="blob.delete">Blob delete</SelectItem>
                    <SelectItem value="team.create">Team create</SelectItem>
                    <SelectItem value="team.delete">Team delete</SelectItem>
                    <SelectItem value="team.invite">Team invite</SelectItem>
                    <SelectItem value="team.member.remove">Team member remove</SelectItem>
                    <SelectItem value="team.member.role">Team role change</SelectItem>
                    <SelectItem value="auth.login">Login</SelectItem>
                    <SelectItem value="auth.login.failed">Login failed</SelectItem>
                    <SelectItem value="vault.unlock">Unlock vault</SelectItem>
                    <SelectItem value="vault.unlock.failed">Unlock failed</SelectItem>
                    <SelectItem value="password.copy">Password copy</SelectItem>
                    <SelectItem value="username.copy">Username copy</SelectItem>
                    <SelectItem value="keys.register">Keys register</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={fetchActivity} disabled={isLoading}>Apply Filters</Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
          <div className="col-span-12 md:col-span-8">
            <ScrollArea className="flex-1 h-[60vh]">
              <div className="p-0">
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
                            {event.resource_type && event.resource_id && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {event.resource_type}: {event.resource_id.slice(0, 8)}...
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
        </div>
      </div>
    </div>
  );
}

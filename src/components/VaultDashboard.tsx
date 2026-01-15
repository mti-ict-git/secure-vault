import { useEffect, useMemo, useState, useCallback } from 'react';
import { Search, Plus, Filter, SortAsc, Users, FileKey, ShieldCheck, Trash2, FolderInput, Star, Download, X, ListChecks, RefreshCw, Share2, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VaultSidebar } from '@/components/VaultSidebar';
import { PasswordEntryCard } from '@/components/PasswordEntry';
import { AddEntryDialog } from '@/components/AddEntryDialog';
import { CreateTeamDialog } from '@/components/CreateTeamDialog';
import { TeamMembersDialog } from '@/components/TeamMembersDialog';
import { KdbxImportExportDialog } from '@/components/KdbxImportExportDialog';
import { ShareVaultDialog } from '@/components/ShareVaultDialog';
import { SecurityDashboard } from '@/components/SecurityDashboard';
import { PasswordEntry, Folder, Team, TeamInvite } from '@/types/vault';
import { downloadFile } from '@/lib/kdbx-utils';
import type { KdbxImportedEntry, KdbxImportedFolder } from '@/lib/kdbx-utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { get, post } from '@/lib/api';

type FolderOption = { id: string; name: string; depth: number };

const buildFolderOptions = (folders: Folder[]): FolderOption[] => {
  const childrenByParent = new Map<string | null, Folder[]>();
  folders.forEach((folder) => {
    const parent = folder.parentId ?? null;
    const siblings = childrenByParent.get(parent);
    if (siblings) siblings.push(folder);
    else childrenByParent.set(parent, [folder]);
  });

  const result: FolderOption[] = [];

  const visit = (folder: Folder, depth: number) => {
    result.push({ id: folder.id, name: folder.name, depth });
    const children = childrenByParent.get(folder.id) ?? [];
    children
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((child) => visit(child, depth + 1));
  };

  (childrenByParent.get(null) ?? [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((folder) => visit(folder, 0));

  return result;
};

const escapeCsvValue = (value: string): string => {
  const needsQuotes = /[\n\r,"]/u.test(value);
  const escaped = value.replace(/"/gu, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

const toCsv = (rows: Array<Record<string, string>>): string => {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(escapeCsvValue).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvValue(row[h] ?? '')).join(','));
  }
  return lines.join('\n');
};

const isoDateOnly = (d: Date): string => d.toISOString().slice(0, 10);

interface VaultDashboardProps {
  entries: PasswordEntry[];
  folders: Folder[];
  teams: Team[];
  onLock: () => void;
  onRefresh: () => void | Promise<void>;
  onAddEntry: (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateEntry: (id: string, updates: Partial<PasswordEntry>) => void;
  onDeleteEntry: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onAddFolder: (name: string, parentId?: string) => void | Promise<void>;
  onDeleteFolder: (folderId: string) => void | Promise<void>;
  // Team actions
  onCreateTeam: (name: string, description?: string) => void;
  onUpdateTeam: (id: string, updates: { name: string; description?: string }) => void;
  onDeleteTeam: (id: string) => void;
  onInviteMember: (teamId: string, email: string, role: 'admin' | 'editor' | 'viewer') => void;
  onRemoveMember: (teamId: string, memberId: string) => void;
  onUpdateMemberRole: (teamId: string, memberId: string, role: 'admin' | 'editor' | 'viewer') => void;
  onCancelInvite: (inviteId: string) => void;
  getTeamInvites: (teamId: string) => TeamInvite[];
  isInvitePending: (teamId: string) => boolean;
  onAcceptInvite: (teamId: string) => void;
  // Permissions
  getPermissionsForTeamId?: (teamId: string) => 'read' | 'write' | null;
  // Import/Export
  onImportEntries: (entries: KdbxImportedEntry[], folders: KdbxImportedFolder[], meta?: { filename?: string }) => void;
  // Vault share helpers
  currentVaultId: string | null;
  getCurrentVaultKey: () => Uint8Array | null;
  getVaultIdForTeamId: (teamId: string) => string | null;
  getVaultKeyByVaultId: (vaultId: string) => Uint8Array | null;
  isAdmin?: boolean;
}

export function VaultDashboard({
  entries,
  folders,
  teams,
  onLock,
  onRefresh,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onToggleFavorite,
  onAddFolder,
  onDeleteFolder,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
  onInviteMember,
  onRemoveMember,
  onUpdateMemberRole,
  onCancelInvite,
  getTeamInvites,
  isInvitePending,
  onAcceptInvite,
  getPermissionsForTeamId,
  onImportEntries,
  currentVaultId,
  getCurrentVaultKey,
  getVaultIdForTeamId,
  getVaultKeyByVaultId,
  isAdmin,
}: VaultDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showAdminAudit, setShowAdminAudit] = useState(false);
  type AdminAuditItem = {
    id: string;
    action: string;
    actor_user_id: string | null;
    actor_username?: string | null;
    resource_type?: string | null;
    resource_id?: string | null;
    details_json?: unknown;
    created_at: string;
  };
  const [adminItems, setAdminItems] = useState<AdminAuditItem[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminActorId, setAdminActorId] = useState('');
  const [adminSince, setAdminSince] = useState('');
  const [adminUntil, setAdminUntil] = useState('');
  const normalizeAction = (a: string) => (a.includes('_') ? a.split('_').join('.') : a);
  const adminLoad = useCallback(async () => {
    setAdminLoading(true);
    setAdminError(null);
    const qs = new URLSearchParams();
    if (adminActorId) qs.set('actor_id', adminActorId);
    if (adminSince) qs.set('since', adminSince);
    if (adminUntil) qs.set('until', adminUntil);
    const res = await get<{ items: AdminAuditItem[] }>(`/admin/audit${qs.toString() ? '?' + qs.toString() : ''}`);
    if (!res.ok) {
      setAdminError('Failed to load audit');
      setAdminItems([]);
    } else {
      setAdminItems(res.body?.items || []);
    }
    setAdminLoading(false);
  }, [adminActorId, adminSince, adminUntil]);
  useEffect(() => {
    if (showAdminAudit && isAdmin) {
      void adminLoad();
    }
  }, [showAdminAudit, isAdmin, adminLoad]);
  const adminActionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of adminItems) {
      const k = normalizeAction(it.action);
      map.set(k, (map.get(k) || 0) + 1);
    }
    return map;
  }, [adminItems]);
  const adminTopCopied = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of adminItems) {
      const k = normalizeAction(it.action);
      if (k !== 'password.copy' && k !== 'username.copy') continue;
      const rid = it.resource_id;
      const rtype = it.resource_type;
      if (!rid || rtype !== 'entry') continue;
      counts.set(rid, (counts.get(rid) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [adminItems]);
  const adminTopSharers = useMemo(() => {
    const counts = new Map<string, number>();
    const names = new Map<string, string>();
    for (const it of adminItems) {
      const k = normalizeAction(it.action);
      if (k !== 'vault.share' && k !== 'entry.copy.to.team') continue;
      const actor = it.actor_user_id || '';
      counts.set(actor, (counts.get(actor) || 0) + 1);
      if (it.actor_username) names.set(actor, it.actor_username);
    }
    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, label: names.get(key) || key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [adminItems]);
  const adminTopCopiers = useMemo(() => {
    const counts = new Map<string, number>();
    const names = new Map<string, string>();
    for (const it of adminItems) {
      const k = normalizeAction(it.action);
      if (k !== 'password.copy' && k !== 'username.copy') continue;
      const actor = it.actor_user_id || '';
      counts.set(actor, (counts.get(actor) || 0) + 1);
      if (it.actor_username) names.set(actor, it.actor_username);
    }
    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, label: names.get(key) || key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [adminItems]);
  const exportScopeCounts = useMemo(() => {
    const byScope = new Map<string, number>();
    const byType = new Map<string, number>();
    for (const it of adminItems) {
      const k = normalizeAction(it.action);
      if (!k.startsWith('export.')) continue;
      const d = it.details_json as Record<string, unknown> | undefined;
      const scope = (d?.scope as string | undefined) || '';
      const type = k.split('.')[1] || '';
      if (scope) byScope.set(scope, (byScope.get(scope) || 0) + 1);
      if (type) byType.set(type, (byType.get(type) || 0) + 1);
    }
    return { byScope, byType };
  }, [adminItems]);
  const renderAdminDetails = (it: AdminAuditItem) => {
    const a = normalizeAction(it.action);
    const d = it.details_json as Record<string, unknown> | undefined;
    const text = (() => {
      if (a === 'export.json') {
        const c = d?.count as number | undefined;
        const fn = d?.filename as string | undefined;
        const sc = d?.scope as string | undefined;
        return `${c || 0} items • ${fn || ''} • ${sc || ''}`.trim();
      }
      if (a === 'export.csv') {
        const c = d?.count as number | undefined;
        const fn = d?.filename as string | undefined;
        const sc = d?.scope as string | undefined;
        return `${c || 0} items • ${fn || ''} • ${sc || ''}`.trim();
      }
      if (a === 'export.kdbx') {
        const db = d?.databaseName as string | undefined;
        const ec = d?.personalEntryCount as number | undefined;
        const fc = d?.personalFolderCount as number | undefined;
        return `${db || ''} • entries ${ec || 0} • folders ${fc || 0}`.trim();
      }
      if (a === 'import.kdbx') {
        const ec = d?.entries as number | undefined;
        const fc = d?.folders as number | undefined;
        const fn = d?.filename as string | undefined;
        return `${ec || 0} entries • ${fc || 0} folders • ${fn || ''}`.trim();
      }
      if (a === 'entry.update') {
        const mt = d?.moved_team as boolean | undefined;
        const mf = d?.moved_folder as boolean | undefined;
        return `${mt ? 'team moved' : ''} ${mf ? 'folder moved' : ''}`.trim();
      }
      if (a === 'folder.delete') {
        const cc = d?.cascade_count as number | undefined;
        return `deleted ${cc || 0} folder(s)`;
      }
      if (a === 'entry.favorite') {
        const fav = d?.favorite as boolean | undefined;
        return fav ? 'marked favorite' : 'unmarked favorite';
      }
      return '';
    })();
    if (!text) return null;
    return <div className="text-xs text-muted-foreground">{text}</div>;
  };
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<PasswordEntry | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [kdbxDialogOpen, setKdbxDialogOpen] = useState(false);
  const [kdbxDialogTab, setKdbxDialogTab] = useState<'import' | 'export'>('import');

  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoveFolderId, setBulkMoveFolderId] = useState<string | null>(null);
  const [bulkCopyOpen, setBulkCopyOpen] = useState(false);
  const [bulkCopyTeamId, setBulkCopyTeamId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareVaultId, setShareVaultId] = useState<string | null>(null);
  const [shareVaultKey, setShareVaultKey] = useState<Uint8Array | null>(null);
  
  // Team dialogs
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [membersTeamId, setMembersTeamId] = useState<string | null>(null);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);

  const membersTeam = useMemo(
    () => (membersTeamId ? teams.find(t => t.id === membersTeamId) || null : null),
    [membersTeamId, teams]
  );

  const openKdbxDialog = (tab: 'import' | 'export') => {
    setKdbxDialogTab(tab);
    setKdbxDialogOpen(true);
  };

  const openShareDialog = () => {
    const vId = selectedTeam ? getVaultIdForTeamId(selectedTeam) : currentVaultId;
    if (!vId) {
      toast.error('Vault not available');
      return;
    }
    const vKey = selectedTeam ? getVaultKeyByVaultId(vId) : getCurrentVaultKey();
    if (!vKey) {
      toast.error('Vault key unavailable');
      return;
    }
    setShareVaultId(vId);
    setShareVaultKey(vKey);
    setShareOpen(true);
  };

  // Get personal entries (no teamId)
  const personalEntries = useMemo(() => entries.filter(e => !e.teamId), [entries]);
  const personalFolders = useMemo(() => folders.filter(f => !f.teamId), [folders]);
  const selectedTeamFolders = useMemo(
    () => (selectedTeam ? folders.filter((f) => f.teamId === selectedTeam) : []),
    [folders, selectedTeam]
  );
  const availableFolders = selectedTeam ? selectedTeamFolders : personalFolders;

  useEffect(() => {
    setSelectedEntryIds(new Set());
  }, [selectedFolder, selectedTeam, showFavorites, showSecurity]);

  useEffect(() => {
    setSelectedEntryIds((prev) => {
      const existing = new Set(entries.map((e) => e.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (existing.has(id)) next.add(id);
      }
      return next;
    });
  }, [entries]);

  // Calculate team entry counts
  const teamEntryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    teams.forEach(team => {
      counts[team.id] = entries.filter(e => e.teamId === team.id).length;
    });
    return counts;
  }, [teams, entries]);

  const filteredEntries = useMemo(() => {
    let filtered: PasswordEntry[];

    if (showFavorites) {
      filtered = entries.filter((e) => e.favorite);
    } else if (selectedTeam) {
      filtered = entries.filter((e) => e.teamId === selectedTeam);
    } else {
      filtered = personalEntries;

      if (selectedFolder) {
        filtered = filtered.filter((e) => e.folderId === selectedFolder);
      }
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        e =>
          e.title.toLowerCase().includes(query) ||
          e.username.toLowerCase().includes(query) ||
          e.url?.toLowerCase().includes(query)
      );
    }

    // Sort by favorite first, then by title
    return filtered.sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }, [entries, personalEntries, selectedFolder, selectedTeam, showFavorites, searchQuery]);

  const favoriteCount = entries.filter((e) => e.favorite).length;

  const selectedEntries = useMemo(
    () => filteredEntries.filter((e) => selectedEntryIds.has(e.id)),
    [filteredEntries, selectedEntryIds]
  );
  const selectedCount = selectedEntries.length;

  const allFilteredSelected = useMemo(() => {
    if (filteredEntries.length === 0) return false;
    return filteredEntries.every((e) => selectedEntryIds.has(e.id));
  }, [filteredEntries, selectedEntryIds]);

  const setEntrySelected = (id: string, selected: boolean) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedEntryIds(new Set());

  const toggleSelectAllFiltered = () => {
    if (filteredEntries.length === 0) return;
    if (allFilteredSelected) {
      clearSelection();
      return;
    }
    setSelectedEntryIds(new Set(filteredEntries.map((e) => e.id)));
  };

  const downloadText = (text: string, filename: string) => {
    const bytes = new TextEncoder().encode(text);
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    downloadFile(buf, filename);
  };

  const exportSelectedAsJson = () => {
    if (selectedCount === 0) return;
    const prefix = selectedTeam ? `team-${selectedTeam}` : 'personal';
    const filename = `secure-vault-${prefix}-export-${isoDateOnly(new Date())}.json`;
    const payload = selectedEntries.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));
    downloadText(JSON.stringify(payload, null, 2), filename);
    toast.success(`Exported ${selectedCount} entries`);
    void post('/audit/log', { action: 'export_json', resource_type: 'vault', resource_id: selectedTeam ? selectedTeam : currentVaultId, details: { count: selectedCount, filename, scope: selectedTeam ? 'team' : 'personal' } });
    clearSelection();
  };

  const exportSelectedAsCsv = () => {
    if (selectedCount === 0) return;
    const prefix = selectedTeam ? `team-${selectedTeam}` : 'personal';
    const filename = `secure-vault-${prefix}-export-${isoDateOnly(new Date())}.csv`;
    const rows = selectedEntries.map((e) => ({
      title: e.title,
      username: e.username,
      password: e.password,
      url: e.url ?? '',
      notes: e.notes ?? '',
      favorite: e.favorite ? 'true' : 'false',
      folderId: e.folderId ?? '',
      teamId: e.teamId ?? '',
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));
    downloadText(toCsv(rows), filename);
    toast.success(`Exported ${selectedCount} entries`);
    void post('/audit/log', { action: 'export_csv', resource_type: 'vault', resource_id: selectedTeam ? selectedTeam : currentVaultId, details: { count: selectedCount, filename, scope: selectedTeam ? 'team' : 'personal' } });
    clearSelection();
  };

  const handleBulkDelete = () => {
    if (selectedCount === 0) return;
    selectedEntries.forEach((e) => onDeleteEntry(e.id));
    toast.success(`Deleted ${selectedCount} entries`);
    clearSelection();
    setBulkDeleteOpen(false);
  };

  const handleBulkMove = () => {
    if (selectedCount === 0) return;
    const nextFolderId = bulkMoveFolderId ?? undefined;
    selectedEntries.forEach((e) => onUpdateEntry(e.id, { folderId: nextFolderId }));
    toast.success(`Moved ${selectedCount} entries`);
    clearSelection();
    setBulkMoveOpen(false);
    setBulkMoveFolderId(null);
  };

  const handleBulkToggleFavorites = () => {
    if (selectedCount === 0) return;
    selectedEntries.forEach((e) => onToggleFavorite(e.id));
    toast.success(`Updated ${selectedCount} entries`);
    clearSelection();
  };

  const handleBulkCopyToTeam = () => {
    if (selectedCount === 0) return;
    const targetTeamId = bulkCopyTeamId;
    if (!targetTeamId) return;
    const canWrite = getPermissionsForTeamId ? getPermissionsForTeamId(targetTeamId) === 'write' : true;
    if (!canWrite) {
      toast.error('You only have read access to this team');
      return;
    }
    selectedEntries.forEach((e) => {
      const payload = {
        title: e.title,
        username: e.username,
        password: e.password,
        url: e.url,
        notes: e.notes,
        favorite: e.favorite,
        folderId: undefined,
        teamId: targetTeamId,
        createdBy: 'current-user',
      };
      onAddEntry(payload);
    });
    toast.success(`Copied ${selectedCount} entr${selectedCount === 1 ? 'y' : 'ies'} to team`);
    void post('/audit/log', { action: 'entry_copy_to_team', resource_type: 'team', resource_id: targetTeamId, details: { count: selectedCount } });
    clearSelection();
    setBulkCopyOpen(false);
    setBulkCopyTeamId(null);
  };

  const handleSaveEntry = (entryData: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    // If we're in a team context, add the teamId
    const finalEntry = selectedTeam 
      ? { ...entryData, teamId: selectedTeam, createdBy: 'current-user' }
      : entryData;

    if (editEntry) {
      onUpdateEntry(editEntry.id, finalEntry);
      toast.success('Entry updated');
    } else {
      onAddEntry(finalEntry);
      toast.success(selectedTeam ? 'Shared entry added' : 'Entry added');
    }
    setEditEntry(null);
  };

  const handleDeleteEntry = () => {
    if (deleteEntryId) {
      onDeleteEntry(deleteEntryId);
      toast.success('Entry deleted');
      setDeleteEntryId(null);
    }
  };

  const handleDeleteTeam = () => {
    if (deleteTeamId) {
      onDeleteTeam(deleteTeamId);
      toast.success('Team deleted');
      setDeleteTeamId(null);
      if (selectedTeam === deleteTeamId) {
        setSelectedTeam(null);
      }
    }
  };

  const getCurrentTitle = () => {
    if (showSecurity) return 'Security Dashboard';
    if (showFavorites) return 'Favorites';
    if (selectedTeam) {
      const team = teams.find(t => t.id === selectedTeam);
      return team?.name || 'Team';
    }
    if (selectedFolder) {
      const folder = personalFolders.find(f => f.id === selectedFolder);
      return folder?.name || 'My Vault';
    }
    return 'My Vault';
  };

  const currentTeam = selectedTeam ? teams.find(t => t.id === selectedTeam) : null;
  const currentTeamPermissions = selectedTeam && getPermissionsForTeamId ? getPermissionsForTeamId(selectedTeam) : null;
  const isTeamReadOnly = selectedTeam ? currentTeamPermissions === 'read' : false;

  return (
    <div className="flex h-screen bg-background">
      <VaultSidebar
        folders={folders}
        teams={teams}
        selectedFolder={selectedFolder}
        selectedTeam={selectedTeam}
        showSecurity={showSecurity}
        showAdminAudit={showAdminAudit}
        onSelectFolder={setSelectedFolder}
        onSelectTeam={setSelectedTeam}
        onToggleSecurity={() => setShowSecurity(!showSecurity)}
        onToggleAdminAudit={() => setShowAdminAudit(!showAdminAudit)}
        showFavorites={showFavorites}
        onToggleFavorites={() => setShowFavorites(!showFavorites)}
        entryCount={personalEntries.length}
        favoriteCount={favoriteCount}
        teamEntryCounts={teamEntryCounts}
        onAddFolder={onAddFolder}
        onDeleteFolder={onDeleteFolder}
        onLock={onLock}
        onCreateTeam={() => setCreateTeamOpen(true)}
        onEditTeam={(team) => {
          setEditTeam(team);
          setCreateTeamOpen(true);
        }}
        onDeleteTeam={(id) => setDeleteTeamId(id)}
        onManageMembers={(team) => setMembersTeamId(team.id)}
        onOpenKdbxDialog={openKdbxDialog}
        isAdmin={isAdmin}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 p-4 border-b border-border bg-card/30">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-md">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={selectedTeam ? "Search team passwords..." : "Search vault..."}
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => openKdbxDialog('import')} title="Import/Export KeePass">
              <FileKey className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon">
              <SortAsc className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={openShareDialog}>
              <Share2 className="w-4 h-4" />
            </Button>
            <Button onClick={() => setAddDialogOpen(true)} disabled={selectedTeam ? isTeamReadOnly : false}>
              <Plus className="w-4 h-4" />
              {selectedTeam ? (isTeamReadOnly ? 'Read-only' : 'Share Password') : 'Add Entry'}
            </Button>
          </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {showAdminAudit ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">Audit & Compliance</h2>
                    <span className="text-sm text-muted-foreground">Monitor system activity with filters, metrics, top copied credentials, and sharing counts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void adminLoad()}>
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 md:col-span-4">
                    <div className="space-y-3 p-4 border rounded-xl bg-card/40">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Actor ID</label>
                        <Input value={adminActorId} onChange={(e) => setAdminActorId(e.target.value)} placeholder="optional" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Since (ISO)</label>
                        <Input value={adminSince} onChange={(e) => setAdminSince(e.target.value)} placeholder="YYYY-MM-DD" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Until (ISO)</label>
                        <Input value={adminUntil} onChange={(e) => setAdminUntil(e.target.value)} placeholder="YYYY-MM-DD" />
                      </div>
                      <Button onClick={() => void adminLoad()} disabled={adminLoading}>Apply Filters</Button>
                      {adminError && <p className="text-sm text-destructive">{adminError}</p>}
                    </div>
                  </div>
                  <div className="col-span-12 md:col-span-8">
                    <div className="space-y-6">
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-12 md:col-span-4">
                          <div className="p-4 border rounded-xl bg-background/50">
                            <div className="text-sm font-medium text-muted-foreground">Total Events</div>
                            <div className="text-2xl font-bold text-foreground">{adminItems.length}</div>
                          </div>
                        </div>
                        <div className="col-span-12 md:col-span-4">
                          <div className="p-4 border rounded-xl bg-background/50">
                            <div className="text-sm font-medium text-muted-foreground">Shares</div>
                            <div className="text-2xl font-bold text-foreground">{adminActionCounts.get('vault.share') || 0}</div>
                          </div>
                        </div>
                        <div className="col-span-12 md:col-span-4">
                          <div className="p-4 border rounded-xl bg-background/50">
                            <div className="text-sm font-medium text-muted-foreground">Copies</div>
                            <div className="text-2xl font-bold text-foreground">{(adminActionCounts.get('password.copy') || 0) + (adminActionCounts.get('username.copy') || 0)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 border rounded-xl bg-card/40">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-sm font-medium">Recent Events</div>
                          <div className="text-xs text-muted-foreground">Details shown when available</div>
                        </div>
                        <div className="space-y-3">
                          {adminItems.map((it) => (
                            <div key={it.id} className="p-3 border rounded-xl bg-card/40">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="text-sm font-medium">{normalizeAction(it.action)}</div>
                                  <div className="text-xs text-muted-foreground">{it.actor_username || it.actor_user_id || ''}</div>
                                  {it.resource_type && it.resource_id && (
                                    <div className="text-xs text-muted-foreground">{it.resource_type}: {String(it.resource_id).slice(0,8)}...</div>
                                  )}
                                  {renderAdminDetails(it)}
                                </div>
                                <div className="text-xs text-muted-foreground whitespace-nowrap">{new Date(it.created_at).toLocaleString()}</div>
                              </div>
                            </div>
                          ))}
                          {adminItems.length === 0 && !adminLoading && (
                            <div className="text-center py-12">
                              <Activity className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                              <p className="text-muted-foreground">No audit data</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-4 border rounded-xl bg-card/40">
                        <div className="text-sm font-medium mb-2">Top Copied Credentials</div>
                        <div className="space-y-2">
                          {adminTopCopied.map((row) => (
                            <div key={row.key} className="flex items-center justify-between text-sm">
                              <div className="text-muted-foreground">entry: {row.key.slice(0,8)}...</div>
                              <div className="font-medium">{row.count}</div>
                            </div>
                          ))}
                          {adminTopCopied.length === 0 && (
                            <div className="text-xs text-muted-foreground">No copy events</div>
                          )}
                        </div>
                      </div>

                      <div className="p-4 border rounded-xl bg-card/40">
                        <div className="text-sm font-medium mb-2">Sharing Activity</div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="text-muted-foreground">Vault shares</div>
                            <div className="font-medium">{adminActionCounts.get('vault.share') || 0}</div>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <div className="text-muted-foreground">Entry copy to team</div>
                            <div className="font-medium">{adminActionCounts.get('entry.copy.to.team') || 0}</div>
                          </div>
                          <div className="mt-3">
                            <div className="text-xs font-medium text-muted-foreground mb-1">Top Sharers</div>
                            <div className="space-y-1">
                              {adminTopSharers.map((row) => (
                                <div key={row.key} className="flex items-center justify-between text-xs">
                                  <div className="text-muted-foreground">{row.label}</div>
                                  <div className="font-medium">{row.count}</div>
                                </div>
                              ))}
                              {adminTopSharers.length === 0 && (
                                <div className="text-xs text-muted-foreground">No sharing events</div>
                              )}
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="text-xs font-medium text-muted-foreground mb-1">Top Copiers</div>
                            <div className="space-y-1">
                              {adminTopCopiers.map((row) => (
                                <div key={row.key} className="flex items-center justify-between text-xs">
                                  <div className="text-muted-foreground">{row.label}</div>
                                  <div className="font-medium">{row.count}</div>
                                </div>
                              ))}
                              {adminTopCopiers.length === 0 && (
                                <div className="text-xs text-muted-foreground">No copy events</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 border rounded-xl bg-card/40">
                        <div className="text-sm font-medium mb-2">Export Activity</div>
                        <div className="grid grid-cols-12 gap-4">
                          <div className="col-span-12 md:col-span-6">
                            <div className="text-xs font-medium text-muted-foreground mb-1">By Scope</div>
                            <div className="space-y-1">
                              {Array.from(exportScopeCounts.byScope.entries()).map(([scope, count]) => (
                                <div key={scope} className="flex items-center justify-between text-xs">
                                  <div className="text-muted-foreground">{scope || 'unknown'}</div>
                                  <div className="font-medium">{count}</div>
                                </div>
                              ))}
                              {exportScopeCounts.byScope.size === 0 && (
                                <div className="text-xs text-muted-foreground">No export events</div>
                              )}
                            </div>
                          </div>
                          <div className="col-span-12 md:col-span-6">
                            <div className="text-xs font-medium text-muted-foreground mb-1">By Type</div>
                            <div className="space-y-1">
                              {Array.from(exportScopeCounts.byType.entries()).map(([type, count]) => (
                                <div key={type} className="flex items-center justify-between text-xs">
                                  <div className="text-muted-foreground">{type}</div>
                                  <div className="font-medium">{count}</div>
                                </div>
                              ))}
                              {exportScopeCounts.byType.size === 0 && (
                                <div className="text-xs text-muted-foreground">No export events</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : showSecurity ? (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">{getCurrentTitle()}</h2>
                </div>
                <SecurityDashboard 
                  entries={entries} 
                  onEditEntry={(entry) => {
                    setEditEntry(entry);
                    setAddDialogOpen(true);
                  }}
                />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    {selectedTeam && <Users className="w-5 h-5 text-primary" />}
                    <h2 className="text-xl font-semibold text-foreground">{getCurrentTitle()}</h2>
                    {currentTeam && (
                      <span className="text-sm text-muted-foreground">
                        {currentTeam.members.length} member{currentTeam.members.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void onRefresh()}>
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </Button>
                    {filteredEntries.length > 0 && (
                      <Button variant="outline" size="sm" onClick={toggleSelectAllFiltered}>
                        <ListChecks className="w-4 h-4" />
                        {allFilteredSelected ? 'Deselect all' : 'Select all'}
                      </Button>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {filteredEntries.length} {filteredEntries.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                </div>

                {selectedCount > 0 && (
                  <div className="mb-6 p-3 rounded-xl border border-border bg-card/40 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
                    <div className="ml-auto flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={clearSelection}>
                        <X className="w-4 h-4" />
                        Clear
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setBulkMoveOpen(true)}>
                        <FolderInput className="w-4 h-4" />
                        Move
                      </Button>
                      {!selectedTeam && teams.length > 0 && (
                        <Button variant="outline" size="sm" onClick={() => setBulkCopyOpen(true)}>
                          <Users className="w-4 h-4" />
                          Copy to Team
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={handleBulkToggleFavorites}>
                        <Star className="w-4 h-4" />
                        Toggle favorite
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Download className="w-4 h-4" />
                            Export
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={exportSelectedAsCsv}>Export CSV</DropdownMenuItem>
                          <DropdownMenuItem onClick={exportSelectedAsJson}>Export JSON</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setBulkDeleteOpen(true)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}

                {/* Team info banner */}
                {selectedTeam && currentTeam && (
                  <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {currentTeam.description || 'Shared passwords for this team'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          🔐 Encrypted with team key • All members can access these passwords
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setMembersTeamId(currentTeam.id)}
                      >
                        <Users className="w-4 h-4 mr-1" />
                        Manage
                      </Button>
                    </div>
                  </div>
                )}

        {filteredEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
                      {selectedTeam ? <Users className="w-8 h-8 text-muted-foreground" /> : <Search className="w-8 h-8 text-muted-foreground" />}
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      {searchQuery ? 'No results found' : selectedTeam ? 'No shared passwords yet' : 'No entries yet'}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery
                        ? 'Try adjusting your search query'
                        : selectedTeam 
                          ? 'Share passwords with your team members'
                          : 'Add your first password entry to get started'}
                    </p>
                    {!searchQuery && (
                      <Button onClick={() => setAddDialogOpen(true)} disabled={selectedTeam ? isTeamReadOnly : false}>
                        <Plus className="w-4 h-4" />
                        {selectedTeam ? (isTeamReadOnly ? 'Read-only' : 'Share Password') : 'Add Entry'}
                      </Button>
                    )}
                  </div>
        ) : (
                  <div className="space-y-3">
                    {filteredEntries.map((entry) => (
                      <PasswordEntryCard
                        key={entry.id}
                        entry={entry}
                        selected={selectedEntryIds.has(entry.id)}
                        onSelectedChange={(selected) => setEntrySelected(entry.id, selected)}
                        onToggleFavorite={onToggleFavorite}
                        onEdit={(e) => {
                          setEditEntry(e);
                          setAddDialogOpen(true);
                        }}
                        onDelete={(id) => setDeleteEntryId(id)}
                      />
                    ))}
                  </div>
        )}

        <ShareVaultDialog
          open={shareOpen}
          onOpenChange={(o) => setShareOpen(o)}
          vaultId={shareVaultId || ''}
          vaultKey={shareVaultKey}
        />
      </>
      )}
          </div>
        </div>
      </main>

      {/* Add/Edit Entry Dialog */}
      <AddEntryDialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) setEditEntry(null);
        }}
        onSave={handleSaveEntry}
        editEntry={editEntry}
        folders={availableFolders}
        defaultFolderId={selectedTeam ? null : selectedFolder}
      />

      {/* Create/Edit Team Dialog */}
      <CreateTeamDialog
        open={createTeamOpen}
        onOpenChange={(open) => {
          setCreateTeamOpen(open);
          if (!open) setEditTeam(null);
        }}
        onSave={(name, description) => {
          onCreateTeam(name, description);
          toast.success('Team created');
        }}
        editTeam={editTeam}
        onUpdate={onUpdateTeam}
      />

      {/* Team Members Dialog */}
      {membersTeam && (
        <TeamMembersDialog
          open={!!membersTeam}
          onOpenChange={(open) => !open && setMembersTeamId(null)}
          team={membersTeam}
          invites={getTeamInvites(membersTeam.id)}
          onInviteMember={(email, role) => onInviteMember(membersTeam.id, email, role)}
          onRemoveMember={(memberId) => onRemoveMember(membersTeam.id, memberId)}
          onUpdateRole={(memberId, role) => onUpdateMemberRole(membersTeam.id, memberId, role)}
          onCancelInvite={onCancelInvite}
          isCurrentUserPending={isInvitePending(membersTeam.id)}
          onAcceptInvite={() => onAcceptInvite(membersTeam.id)}
        />
      )}

      {/* Delete Entry Confirmation */}
      <AlertDialog open={!!deleteEntryId} onOpenChange={() => setDeleteEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEntry}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount} entr{selectedCount === 1 ? 'y' : 'ies'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={bulkMoveOpen} onOpenChange={(open) => {
        setBulkMoveOpen(open);
        if (!open) setBulkMoveFolderId(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Selected</DialogTitle>
            <DialogDescription>Choose a destination folder for the selected items.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Select
              value={bulkMoveFolderId ?? 'none'}
              onValueChange={(value) => setBulkMoveFolderId(value === 'none' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No folder</SelectItem>
                {buildFolderOptions(availableFolders).map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    <span className="whitespace-pre">{'  '.repeat(f.depth)}{f.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMoveOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkMove}>
              Move {selectedCount}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkCopyOpen} onOpenChange={(open) => {
        setBulkCopyOpen(open);
        if (!open) setBulkCopyTeamId(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Selected to Team</DialogTitle>
            <DialogDescription>Select a team to duplicate the selected passwords into.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Select
              value={bulkCopyTeamId ?? 'none'}
              onValueChange={(value) => setBulkCopyTeamId(value === 'none' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choose a team</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkCopyOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkCopyToTeam} disabled={!bulkCopyTeamId}>
              Copy {selectedCount}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Team Confirmation */}
      <AlertDialog open={!!deleteTeamId} onOpenChange={() => setDeleteTeamId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this team? All shared passwords will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTeam}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* KeePass Import/Export Dialog */}
      <KdbxImportExportDialog
        open={kdbxDialogOpen}
        onOpenChange={setKdbxDialogOpen}
        initialTab={kdbxDialogTab}
        entries={entries}
        folders={folders}
        currentVaultId={currentVaultId}
        onImport={(importedEntries, importedFolders, meta) => {
          onImportEntries(importedEntries, importedFolders, meta);
          toast.success(`Imported ${importedEntries.length} entries`);
        }}
      />
    </div>
  );
}

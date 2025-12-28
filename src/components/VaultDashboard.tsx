import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Filter, SortAsc, Users, FileKey, ShieldCheck, Trash2, FolderInput, Star, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VaultSidebar } from '@/components/VaultSidebar';
import { PasswordEntryCard } from '@/components/PasswordEntry';
import { AddEntryDialog } from '@/components/AddEntryDialog';
import { CreateTeamDialog } from '@/components/CreateTeamDialog';
import { TeamMembersDialog } from '@/components/TeamMembersDialog';
import { KdbxImportExportDialog } from '@/components/KdbxImportExportDialog';
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
  // Import/Export
  onImportEntries: (entries: KdbxImportedEntry[], folders: KdbxImportedFolder[]) => void;
}

export function VaultDashboard({
  entries,
  folders,
  teams,
  onLock,
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
  onImportEntries,
}: VaultDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<PasswordEntry | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [kdbxDialogOpen, setKdbxDialogOpen] = useState(false);
  const [kdbxDialogTab, setKdbxDialogTab] = useState<'import' | 'export'>('import');

  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoveFolderId, setBulkMoveFolderId] = useState<string | null>(null);
  
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

    // Filter by team or personal
    if (selectedTeam) {
      filtered = entries.filter(e => e.teamId === selectedTeam);
    } else {
      filtered = personalEntries;
      
      // Filter by favorites
      if (showFavorites) {
        filtered = filtered.filter(e => e.favorite);
      }
      // Filter by folder
      else if (selectedFolder) {
        filtered = filtered.filter(e => e.folderId === selectedFolder);
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

  const favoriteCount = personalEntries.filter(e => e.favorite).length;

  const selectedEntries = useMemo(
    () => filteredEntries.filter((e) => selectedEntryIds.has(e.id)),
    [filteredEntries, selectedEntryIds]
  );
  const selectedCount = selectedEntries.length;

  const setEntrySelected = (id: string, selected: boolean) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedEntryIds(new Set());

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
    if (selectedTeam) {
      const team = teams.find(t => t.id === selectedTeam);
      return team?.name || 'Team';
    }
    if (showFavorites) return 'Favorites';
    if (selectedFolder) {
      const folder = personalFolders.find(f => f.id === selectedFolder);
      return folder?.name || 'My Vault';
    }
    return 'My Vault';
  };

  const currentTeam = selectedTeam ? teams.find(t => t.id === selectedTeam) : null;

  return (
    <div className="flex h-screen bg-background">
      <VaultSidebar
        folders={folders}
        teams={teams}
        selectedFolder={selectedFolder}
        selectedTeam={selectedTeam}
        showSecurity={showSecurity}
        onSelectFolder={setSelectedFolder}
        onSelectTeam={setSelectedTeam}
        onToggleSecurity={() => setShowSecurity(!showSecurity)}
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
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-4 h-4" />
                {selectedTeam ? 'Share Password' : 'Add Entry'}
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {showSecurity ? (
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
                  <span className="text-sm text-muted-foreground">
                    {filteredEntries.length} {filteredEntries.length === 1 ? 'item' : 'items'}
                  </span>
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
                      <Button onClick={() => setAddDialogOpen(true)}>
                        <Plus className="w-4 h-4" />
                        {selectedTeam ? 'Share Password' : 'Add Entry'}
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
        onImport={(importedEntries, importedFolders) => {
          onImportEntries(importedEntries, importedFolders);
          toast.success(`Imported ${importedEntries.length} entries`);
        }}
      />
    </div>
  );
}

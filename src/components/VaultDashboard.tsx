import { useState, useMemo } from 'react';
import { Search, Plus, Filter, SortAsc, Users, FileKey } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VaultSidebar } from '@/components/VaultSidebar';
import { PasswordEntryCard } from '@/components/PasswordEntry';
import { AddEntryDialog } from '@/components/AddEntryDialog';
import { CreateTeamDialog } from '@/components/CreateTeamDialog';
import { TeamMembersDialog } from '@/components/TeamMembersDialog';
import { KdbxImportExportDialog } from '@/components/KdbxImportExportDialog';
import { PasswordEntry, Folder, Team } from '@/types/vault';
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
import { toast } from 'sonner';

interface VaultDashboardProps {
  entries: PasswordEntry[];
  folders: Folder[];
  teams: Team[];
  onLock: () => void;
  onAddEntry: (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateEntry: (id: string, updates: Partial<PasswordEntry>) => void;
  onDeleteEntry: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  // Team actions
  onCreateTeam: (name: string, description?: string) => void;
  onUpdateTeam: (id: string, updates: { name: string; description?: string }) => void;
  onDeleteTeam: (id: string) => void;
  onInviteMember: (teamId: string, email: string, role: 'admin' | 'member') => void;
  onRemoveMember: (teamId: string, memberId: string) => void;
  onUpdateMemberRole: (teamId: string, memberId: string, role: 'owner' | 'admin' | 'member') => void;
  onCancelInvite: (inviteId: string) => void;
  getTeamInvites: (teamId: string) => any[];
  // Import/Export
  onImportEntries: (entries: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>[], folders: Omit<Folder, 'id'>[]) => void;
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
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<PasswordEntry | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [kdbxDialogOpen, setKdbxDialogOpen] = useState(false);
  
  // Team dialogs
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [membersTeam, setMembersTeam] = useState<Team | null>(null);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);

  // Get personal entries (no teamId)
  const personalEntries = useMemo(() => entries.filter(e => !e.teamId), [entries]);
  const personalFolders = useMemo(() => folders.filter(f => !f.teamId), [folders]);

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
        onSelectFolder={setSelectedFolder}
        onSelectTeam={setSelectedTeam}
        showFavorites={showFavorites}
        onToggleFavorites={() => setShowFavorites(!showFavorites)}
        entryCount={personalEntries.length}
        favoriteCount={favoriteCount}
        teamEntryCounts={teamEntryCounts}
        onLock={onLock}
        onCreateTeam={() => setCreateTeamOpen(true)}
        onEditTeam={(team) => {
          setEditTeam(team);
          setCreateTeamOpen(true);
        }}
        onDeleteTeam={(id) => setDeleteTeamId(id)}
        onManageMembers={(team) => setMembersTeam(team)}
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
              <Button variant="outline" size="icon" onClick={() => setKdbxDialogOpen(true)} title="Import/Export KeePass">
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
                    onClick={() => setMembersTeam(currentTeam)}
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
          onOpenChange={(open) => !open && setMembersTeam(null)}
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

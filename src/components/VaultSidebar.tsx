import { useEffect, useMemo, useState } from 'react';
import { 
  Shield,
  ShieldCheck,
  Star, 
  Folder, 
  Plus, 
  Lock,
  Code,
  User,
  CreditCard,
  Briefcase,
  Settings,
  Import,
  FileDown,
  Users,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Folder as FolderType, Team } from '@/types/vault';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VaultSidebarProps {
  folders: FolderType[];
  teams: Team[];
  selectedFolder: string | null;
  selectedTeam: string | null;
  showSecurity: boolean;
  onSelectFolder: (folderId: string | null) => void;
  onSelectTeam: (teamId: string | null) => void;
  onToggleSecurity: () => void;
  showFavorites: boolean;
  onToggleFavorites: () => void;
  entryCount: number;
  favoriteCount: number;
  teamEntryCounts: Record<string, number>;
  onAddFolder: (name: string, parentId?: string) => void | Promise<void>;
  onDeleteFolder: (folderId: string) => void | Promise<void>;
  onLock: () => void;
  onCreateTeam: () => void;
  onEditTeam: (team: Team) => void;
  onDeleteTeam: (teamId: string) => void;
  onManageMembers: (team: Team) => void;
  onOpenKdbxDialog: (tab: 'import' | 'export') => void;
}

type FolderOption = { id: string; name: string; depth: number };

const buildFolderOptions = (folders: FolderType[]): FolderOption[] => {
  const foldersById = new Map<string, FolderType>();
  const childrenByParent = new Map<string, FolderType[]>();

  for (const folder of folders) {
    foldersById.set(folder.id, folder);
  }

  for (const folder of folders) {
    const parentId = folder.parentId;
    if (!parentId || !foldersById.has(parentId)) continue;
    const children = childrenByParent.get(parentId) ?? [];
    children.push(folder);
    childrenByParent.set(parentId, children);
  }

  const roots = folders
    .filter((f) => !f.parentId || !foldersById.has(f.parentId))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const result: FolderOption[] = [];
  const walk = (node: FolderType, depth: number) => {
    result.push({ id: node.id, name: node.name, depth });
    const children = (childrenByParent.get(node.id) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) walk(child, depth + 1);
  };

  for (const root of roots) walk(root, 0);
  return result;
};

const FOLDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  code: Code,
  user: User,
  'credit-card': CreditCard,
  briefcase: Briefcase,
  users: Users,
};

export function VaultSidebar({
  folders,
  teams,
  selectedFolder,
  selectedTeam,
  showSecurity,
  onSelectFolder,
  onSelectTeam,
  onToggleSecurity,
  showFavorites,
  onToggleFavorites,
  entryCount,
  favoriteCount,
  teamEntryCounts,
  onAddFolder,
  onDeleteFolder,
  onLock,
  onCreateTeam,
  onEditTeam,
  onDeleteTeam,
  onManageMembers,
  onOpenKdbxDialog,
}: VaultSidebarProps) {
  const [teamsExpanded, setTeamsExpanded] = useState(true);
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set());
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFolderName, setCreateFolderName] = useState('');
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);

  const personalFolders = useMemo(() => folders.filter((f) => !f.teamId), [folders]);

  const personalFolderById = useMemo(() => {
    const map = new Map<string, FolderType>();
    for (const f of personalFolders) map.set(f.id, f);
    return map;
  }, [personalFolders]);

  const personalParentById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const f of personalFolders) {
      map.set(f.id, f.parentId ?? null);
    }
    return map;
  }, [personalFolders]);

  const personalChildrenByParent = useMemo(() => {
    const map = new Map<string, FolderType[]>();
    for (const f of personalFolders) {
      if (!f.parentId) continue;
      if (!personalFolderById.has(f.parentId)) continue;
      const arr = map.get(f.parentId) ?? [];
      arr.push(f);
      map.set(f.parentId, arr);
    }

    for (const [parentId, children] of map.entries()) {
      map.set(parentId, children.slice().sort((a, b) => a.name.localeCompare(b.name)));
    }

    return map;
  }, [personalFolderById, personalFolders]);

  const personalRoots = useMemo(() => {
    return personalFolders
      .filter((f) => !f.parentId || !personalFolderById.has(f.parentId))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [personalFolderById, personalFolders]);

  useEffect(() => {
    if (expandedFolderIds.size !== 0) return;
    if (personalRoots.length === 0) return;
    setExpandedFolderIds(new Set(personalRoots.map((f) => f.id)));
  }, [expandedFolderIds.size, personalRoots]);

  useEffect(() => {
    if (!selectedFolder) return;
    const next = new Set(expandedFolderIds);
    let current = personalParentById.get(selectedFolder) ?? null;
    while (current) {
      next.add(current);
      current = personalParentById.get(current) ?? null;
    }
    if (next.size !== expandedFolderIds.size) setExpandedFolderIds(next);
  }, [expandedFolderIds, personalParentById, selectedFolder]);

  const handleSelectPersonal = () => {
    onSelectTeam(null);
    onSelectFolder(null);
    if (showFavorites) onToggleFavorites();
    if (showSecurity) onToggleSecurity();
  };

  const openCreateFolder = () => {
    const defaultParentId = !selectedTeam && !showFavorites && !showSecurity ? selectedFolder : null;
    setCreateFolderName('');
    setCreateFolderParentId(defaultParentId);
    setCreateFolderOpen(true);
  };

  const handleCreateFolder = async () => {
    const trimmed = createFolderName.trim();
    if (!trimmed) return;
    await onAddFolder(trimmed, createFolderParentId || undefined);
    toast.success('Folder created');
    setCreateFolderOpen(false);
    setCreateFolderName('');
    setCreateFolderParentId(null);
  };

  const handleConfirmDeleteFolder = async () => {
    const id = deleteFolderId;
    if (!id) return;

    if (selectedFolder) {
      let current: string | null = selectedFolder;
      while (current) {
        if (current === id) {
          onSelectFolder(null);
          break;
        }
        current = personalParentById.get(current) ?? null;
      }
    }

    await onDeleteFolder(id);
    toast.success('Folder deleted');
    setDeleteFolderId(null);
  };

  return (
    <aside className="w-64 flex-shrink-0 border-r border-border bg-card/50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-foreground">SecureVault</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-vault-unlocked animate-pulse" />
              <span className="text-xs text-muted-foreground">Unlocked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {/* All Personal items */}
        <button
          onClick={handleSelectPersonal}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            !selectedFolder && !showFavorites && !selectedTeam
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Shield className="w-4 h-4" />
          <span className="flex-1 text-left">My Vault</span>
          <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{entryCount}</span>
        </button>

        {/* Favorites */}
        <button
          onClick={() => {
            onSelectTeam(null);
            onSelectFolder(null);
            if (showSecurity) onToggleSecurity();
            if (!showFavorites) onToggleFavorites();
          }}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            showFavorites && !selectedTeam && !showSecurity
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Star className="w-4 h-4" />
          <span className="flex-1 text-left">Favorites</span>
          <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{favoriteCount}</span>
        </button>

        {/* Security Dashboard */}
        <button
          onClick={() => {
            onSelectTeam(null);
            onSelectFolder(null);
            if (showFavorites) onToggleFavorites();
            if (!showSecurity) onToggleSecurity();
          }}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            showSecurity && !selectedTeam
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <ShieldCheck className="w-4 h-4" />
          <span className="flex-1 text-left">Security</span>
        </button>

        {/* Personal Folders section */}
        <div className="pt-4">
          <div className="flex items-center justify-between px-3 mb-2">
            <button
              onClick={() => setFoldersExpanded(!foldersExpanded)}
              className="flex items-center gap-1"
            >
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Folders
              </span>
              {foldersExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={openCreateFolder}
              className="p-1 rounded hover:bg-accent transition-colors"
              aria-label="Add folder"
            >
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {foldersExpanded && (
            <div className="space-y-1">
              {personalRoots.map((folder) => {
                const renderNode = (node: FolderType, depth: number) => {
                  const Icon = FOLDER_ICONS[node.icon || ''] || Folder;
                  const isSelected = selectedFolder === node.id && !showFavorites && !selectedTeam;
                  const children = personalChildrenByParent.get(node.id) ?? [];
                  const hasChildren = children.length > 0;
                  const isExpanded = expandedFolderIds.has(node.id);

                  return (
                    <div key={node.id}>
                      <div className="group relative">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            onSelectTeam(null);
                            onSelectFolder(node.id);
                            if (showFavorites) onToggleFavorites();
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter' && e.key !== ' ') return;
                            e.preventDefault();
                            onSelectTeam(null);
                            onSelectFolder(node.id);
                            if (showFavorites) onToggleFavorites();
                          }}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                            isSelected
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          )}
                          style={{ paddingLeft: 12 + depth * 12 }}
                        >
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedFolderIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(node.id)) next.delete(node.id);
                                  else next.add(node.id);
                                  return next;
                                });
                              }}
                              className="p-0.5 rounded hover:bg-accent"
                              aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="w-4" />
                          )}
                          <Icon className="w-4 h-4" />
                          <span className="flex-1 text-left truncate">{node.name}</span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteFolderId(node.id);
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-all"
                          aria-label="Delete folder"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>

                      {hasChildren && isExpanded && (
                        <div className="space-y-1">
                          {children.map((child) => renderNode(child, depth + 1))}
                        </div>
                      )}
                    </div>
                  );
                };

                return renderNode(folder, 0);
              })}
            </div>
          )}
        </div>

        {/* Teams section */}
        <div className="pt-4">
          <div className="flex items-center justify-between px-3 mb-2">
            <button
              onClick={() => setTeamsExpanded(!teamsExpanded)}
              className="flex items-center gap-1"
            >
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Teams
              </span>
              {teamsExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
            <button 
              onClick={onCreateTeam}
              className="p-1 rounded hover:bg-accent transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {teamsExpanded && (
            <div className="space-y-1">
              {teams.map((team) => {
                const isSelected = selectedTeam === team.id;
                const entryCount = teamEntryCounts[team.id] || 0;
                
                return (
                  <div key={team.id} className="group relative">
                    <button
                      onClick={() => {
                        onSelectTeam(team.id);
                        onSelectFolder(null);
                        if (showFavorites) onToggleFavorites();
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Users className="w-4 h-4" />
                      <span className="flex-1 text-left truncate">{team.name}</span>
                      <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">
                        {entryCount}
                      </span>
                    </button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-all">
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onManageMembers(team)}>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Manage Members
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditTeam(team)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit Team
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => onDeleteTeam(team.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Team
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}

              {teams.length === 0 && (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-muted-foreground mb-2">No teams yet</p>
                  <Button variant="outline" size="sm" onClick={onCreateTeam}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Create Team
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Bottom actions */}
      <div className="p-3 border-t border-border space-y-1">
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          onClick={() => onOpenKdbxDialog('import')}
        >
          <Import className="w-4 h-4" />
          <span>Import .kdbx</span>
        </button>
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          onClick={() => onOpenKdbxDialog('export')}
        >
          <FileDown className="w-4 h-4" />
          <span>Export Vault</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
        
        <Button
          variant="danger"
          className="w-full mt-2"
          onClick={onLock}
        >
          <Lock className="w-4 h-4" />
          Lock Vault
        </Button>
      </div>

      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Folder name *</label>
              <Input
                value={createFolderName}
                onChange={(e) => setCreateFolderName(e.target.value)}
                placeholder="e.g., Personal, Work, Banking"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Parent folder</label>
              <Select
                value={createFolderParentId ?? 'none'}
                onValueChange={(value) => setCreateFolderParentId(value === 'none' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent</SelectItem>
                  {buildFolderOptions(personalFolders).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      <span className="whitespace-pre">{'  '.repeat(f.depth)}{f.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!createFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFolderId} onOpenChange={(open) => !open && setDeleteFolderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting this folder will also delete any subfolders. Entries inside will be moved to “No folder”. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteFolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

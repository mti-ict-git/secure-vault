import { useState } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Folder as FolderType, Team } from '@/types/vault';
import { cn } from '@/lib/utils';

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
  onLock: () => void;
  onCreateTeam: () => void;
  onEditTeam: (team: Team) => void;
  onDeleteTeam: (teamId: string) => void;
  onManageMembers: (team: Team) => void;
  onOpenKdbxDialog: (tab: 'import' | 'export') => void;
}

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
  onLock,
  onCreateTeam,
  onEditTeam,
  onDeleteTeam,
  onManageMembers,
  onOpenKdbxDialog,
}: VaultSidebarProps) {
  const [teamsExpanded, setTeamsExpanded] = useState(true);
  const [foldersExpanded, setFoldersExpanded] = useState(true);

  const personalFolders = folders.filter(f => !f.teamId);

  const handleSelectPersonal = () => {
    onSelectTeam(null);
    onSelectFolder(null);
    if (showFavorites) onToggleFavorites();
    if (showSecurity) onToggleSecurity();
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
          <button
            onClick={() => setFoldersExpanded(!foldersExpanded)}
            className="w-full flex items-center justify-between px-3 mb-2 group"
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

          {foldersExpanded && (
            <div className="space-y-1">
              {personalFolders.map((folder) => {
                const Icon = FOLDER_ICONS[folder.icon || ''] || Folder;
                const isSelected = selectedFolder === folder.id && !showFavorites && !selectedTeam;
                
                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      onSelectTeam(null);
                      onSelectFolder(folder.id);
                      if (showFavorites) onToggleFavorites();
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{folder.name}</span>
                  </button>
                );
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
    </aside>
  );
}

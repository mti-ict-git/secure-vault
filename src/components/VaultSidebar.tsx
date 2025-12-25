import { 
  Shield, 
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
  FileDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Folder as FolderType } from '@/types/vault';
import { cn } from '@/lib/utils';

interface VaultSidebarProps {
  folders: FolderType[];
  selectedFolder: string | null;
  onSelectFolder: (folderId: string | null) => void;
  showFavorites: boolean;
  onToggleFavorites: () => void;
  entryCount: number;
  favoriteCount: number;
  onLock: () => void;
}

const FOLDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  code: Code,
  user: User,
  'credit-card': CreditCard,
  briefcase: Briefcase,
};

export function VaultSidebar({
  folders,
  selectedFolder,
  onSelectFolder,
  showFavorites,
  onToggleFavorites,
  entryCount,
  favoriteCount,
  onLock,
}: VaultSidebarProps) {
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
        {/* All items */}
        <button
          onClick={() => {
            onSelectFolder(null);
            if (showFavorites) onToggleFavorites();
          }}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            !selectedFolder && !showFavorites
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Shield className="w-4 h-4" />
          <span className="flex-1 text-left">All Items</span>
          <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{entryCount}</span>
        </button>

        {/* Favorites */}
        <button
          onClick={onToggleFavorites}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            showFavorites
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Star className="w-4 h-4" />
          <span className="flex-1 text-left">Favorites</span>
          <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{favoriteCount}</span>
        </button>

        {/* Folders section */}
        <div className="pt-4">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Folders
            </span>
            <button className="p-1 rounded hover:bg-accent transition-colors">
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-1">
            {folders.map((folder) => {
              const Icon = FOLDER_ICONS[folder.icon || ''] || Folder;
              const isSelected = selectedFolder === folder.id && !showFavorites;
              
              return (
                <button
                  key={folder.id}
                  onClick={() => {
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
        </div>
      </nav>

      {/* Bottom actions */}
      <div className="p-3 border-t border-border space-y-1">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <Import className="w-4 h-4" />
          <span>Import .kdbx</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
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

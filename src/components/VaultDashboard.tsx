import { useState, useMemo } from 'react';
import { Search, Plus, Filter, SortAsc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VaultSidebar } from '@/components/VaultSidebar';
import { PasswordEntryCard } from '@/components/PasswordEntry';
import { AddEntryDialog } from '@/components/AddEntryDialog';
import { PasswordEntry, Folder } from '@/types/vault';
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
  onLock: () => void;
  onAddEntry: (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateEntry: (id: string, updates: Partial<PasswordEntry>) => void;
  onDeleteEntry: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function VaultDashboard({
  entries,
  folders,
  onLock,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onToggleFavorite,
}: VaultDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<PasswordEntry | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    let filtered = entries;

    // Filter by favorites
    if (showFavorites) {
      filtered = filtered.filter(e => e.favorite);
    }
    // Filter by folder
    else if (selectedFolder) {
      filtered = filtered.filter(e => e.folderId === selectedFolder);
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
  }, [entries, selectedFolder, showFavorites, searchQuery]);

  const favoriteCount = entries.filter(e => e.favorite).length;

  const handleSaveEntry = (entryData: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editEntry) {
      onUpdateEntry(editEntry.id, entryData);
      toast.success('Entry updated');
    } else {
      onAddEntry(entryData);
      toast.success('Entry added');
    }
    setEditEntry(null);
  };

  const handleDelete = () => {
    if (deleteEntryId) {
      onDeleteEntry(deleteEntryId);
      toast.success('Entry deleted');
      setDeleteEntryId(null);
    }
  };

  const getCurrentTitle = () => {
    if (showFavorites) return 'Favorites';
    if (selectedFolder) {
      const folder = folders.find(f => f.id === selectedFolder);
      return folder?.name || 'All Items';
    }
    return 'All Items';
  };

  return (
    <div className="flex h-screen bg-background">
      <VaultSidebar
        folders={folders}
        selectedFolder={selectedFolder}
        onSelectFolder={setSelectedFolder}
        showFavorites={showFavorites}
        onToggleFavorites={() => setShowFavorites(!showFavorites)}
        entryCount={entries.length}
        favoriteCount={favoriteCount}
        onLock={onLock}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 p-4 border-b border-border bg-card/30">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-md">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search vault..."
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon">
                <SortAsc className="w-4 h-4" />
              </Button>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-4 h-4" />
                Add Entry
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">{getCurrentTitle()}</h2>
              <span className="text-sm text-muted-foreground">
                {filteredEntries.length} {filteredEntries.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {searchQuery ? 'No results found' : 'No entries yet'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : 'Add your first password entry to get started'}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setAddDialogOpen(true)}>
                    <Plus className="w-4 h-4" />
                    Add Entry
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

      {/* Add/Edit Dialog */}
      <AddEntryDialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) setEditEntry(null);
        }}
        onSave={handleSaveEntry}
        editEntry={editEntry}
      />

      {/* Delete Confirmation */}
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
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

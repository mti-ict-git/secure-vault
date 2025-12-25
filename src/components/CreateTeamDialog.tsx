import { useState } from 'react';
import { Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Team } from '@/types/vault';

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description?: string) => void;
  editTeam?: Team | null;
  onUpdate?: (id: string, updates: { name: string; description?: string }) => void;
}

export function CreateTeamDialog({
  open,
  onOpenChange,
  onSave,
  editTeam,
  onUpdate,
}: CreateTeamDialogProps) {
  const [name, setName] = useState(editTeam?.name || '');
  const [description, setDescription] = useState(editTeam?.description || '');

  const handleSave = () => {
    if (!name.trim()) return;

    if (editTeam && onUpdate) {
      onUpdate(editTeam.id, { name: name.trim(), description: description.trim() || undefined });
    } else {
      onSave(name.trim(), description.trim() || undefined);
    }

    setName('');
    setDescription('');
    onOpenChange(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setName('');
      setDescription('');
    } else if (editTeam) {
      setName(editTeam.name);
      setDescription(editTeam.description || '');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {editTeam ? 'Edit Team' : 'Create New Team'}
          </DialogTitle>
          <DialogDescription>
            Teams allow you to share passwords securely with group members using shared encryption keys.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Team Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Engineering, Marketing"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this team for?"
              rows={3}
            />
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="font-medium text-foreground mb-2">🔐 Zero-Knowledge Team Sharing</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Each team has a unique encryption key</li>
              <li>• Team key is encrypted for each member</li>
              <li>• Server never sees plaintext passwords</li>
              <li>• Removing members triggers key rotation</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {editTeam ? 'Save Changes' : 'Create Team'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

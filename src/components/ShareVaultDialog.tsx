import { useState, useEffect } from 'react';
import { Share2, Users, User, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { post, get } from '@/lib/api';
import { sealToRecipient } from '@/lib/crypto/box';

interface ShareVaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultId: string;
  vaultKey: Uint8Array | null;
}

type ShareTarget = 'user' | 'team';
type Permission = 'read' | 'write';

type LookupUser = {
  id: string;
  display_name?: string;
  email?: string;
};

type TeamOption = { id: string; name: string };

export function ShareVaultDialog({
  open,
  onOpenChange,
  vaultId,
  vaultKey,
}: ShareVaultDialogProps) {
  const { toast } = useToast();
  const [targetType, setTargetType] = useState<ShareTarget>('user');
  const [permission, setPermission] = useState<Permission>('read');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<LookupUser | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [searchResults, setSearchResults] = useState<LookupUser[]>([]);

  // Fetch teams on mount
  useEffect(() => {
    if (open) {
      void (async () => {
        type TeamListItem = {
          id: string;
          name: string;
        };
        const r = await get<{ items: TeamListItem[] }>('/teams');
        if (r.ok && r.body?.items) {
          setTeams(r.body.items.map((t) => ({ id: t.id, name: t.name })));
        }
      })();
    }
  }, [open]);

  const lookupUser = async () => {
    if (!userSearch) return;
    setIsLookingUp(true);
    try {
      const res = await get<LookupUser>(`/users/lookup?email=${encodeURIComponent(userSearch)}`);
      if (res.ok && res.body?.id) {
        setSelectedUser(res.body);
        setSearchResults([]);
        return true;
      }
      toast({ title: 'User not found', description: 'No user with that email.' , variant: 'destructive' });
      return false;
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleShare = async () => {
    if (!vaultKey) {
      toast({
        title: 'Vault not unlocked',
        description: 'Please unlock the vault first.',
        variant: 'destructive',
      });
      return;
    }

    setIsSharing(true);

    try {
      if (targetType === 'user') {
        let user = selectedUser;
        if (!user) {
          const ok = await lookupUser();
          if (!ok) return;
          user = selectedUser;
          if (!user) return;
        }
        const pkRes = await get<{ public_enc_key?: string | null }>(`/users/${user.id}/public-keys`);
        const recipientPk = pkRes.body?.public_enc_key || null;
        if (!pkRes.ok || !recipientPk) {
          toast({ title: 'Cannot share', description: 'Recipient has no encryption keys.', variant: 'destructive' });
          return;
        }
        const wrappedKey = await sealToRecipient(recipientPk, vaultKey);
        const sharePayload = {
          source_vault_id: vaultId,
          target_user_id: user.id,
          wrapped_key: wrappedKey,
          permissions: permission,
        };
        const res = await post('/shares', sharePayload);
        if (!res.ok) {
          throw new Error('Failed to create share');
        }
      } else {
        if (!selectedTeamId) {
          toast({
            title: 'No team selected',
            description: 'Please select a team to share with.',
            variant: 'destructive',
          });
          return;
        }
        const membersRes = await get<{ items: Array<{ id: string; user_id: string; joined_at: string | null }> }>(`/teams/${selectedTeamId}/members`);
        if (!membersRes.ok || !membersRes.body?.items) {
          throw new Error('Failed to load team members');
        }
        const joined = membersRes.body.items.filter((m) => m.joined_at);
        if (joined.length === 0) {
          toast({ title: 'No active members', description: 'Team has no joined members.', variant: 'destructive' });
          return;
        }
        const tasks = joined.map(async (m) => {
          const pkRes = await get<{ public_enc_key?: string | null }>(`/users/${m.user_id}/public-keys`);
          const recipientPk = pkRes.body?.public_enc_key || null;
          if (!pkRes.ok || !recipientPk) return false;
          const wrappedKey = await sealToRecipient(recipientPk, vaultKey);
          const sharePayload = {
            source_vault_id: vaultId,
            target_user_id: m.user_id,
            wrapped_key: wrappedKey,
            permissions: permission,
          };
          const r = await post('/shares', sharePayload);
          return r.ok;
        });
        const results = await Promise.all(tasks);
        const okCount = results.filter(Boolean).length;
        if (okCount === 0) {
          throw new Error('Failed to share with team members');
        }
      }

      toast({
        title: 'Vault shared',
        description: targetType === 'user' ? 'Vault has been shared with the user.' : 'Vault has been shared with team members.',
      });

      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Share failed:', error);
      toast({
        title: 'Share failed',
        description: 'There was an error sharing the vault. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSharing(false);
    }
  };

  const resetForm = () => {
    setTargetType('user');
    setPermission('read');
    setUserSearch('');
    setSelectedUser(null);
    setSelectedTeamId('');
    setSearchResults([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Share2 className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Share Vault</DialogTitle>
          <DialogDescription className="text-center">
            Share this vault with a user or team. The vault key will be encrypted for the recipient.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Target type selection */}
          <div className="space-y-2">
            <Label>Share with</Label>
            <RadioGroup
              value={targetType}
              onValueChange={(v) => setTargetType(v as ShareTarget)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="user" id="user" />
                <Label htmlFor="user" className="flex items-center gap-2 cursor-pointer">
                  <User className="w-4 h-4" />
                  User
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="team" id="team" />
                <Label htmlFor="team" className="flex items-center gap-2 cursor-pointer">
                  <Users className="w-4 h-4" />
                  Team
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* User lookup */}
          {targetType === 'user' && (
            <div className="space-y-2">
              <Label>User Email</Label>
              <Input
                placeholder="user@example.com"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void lookupUser()} disabled={isLookingUp || !userSearch.trim()}>
                  {isLookingUp ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Lookup
                    </>
                  ) : (
                    'Lookup'
                  )}
                </Button>
              </div>
              {selectedUser && (
                <p className="text-sm text-muted-foreground">
                  Selected: <span className="font-medium">{selectedUser.email || selectedUser.display_name || selectedUser.id}</span>
                </p>
              )}
            </div>
          )}

          {/* Team selection */}
          {targetType === 'team' && (
            <div className="space-y-2">
              <Label>Select team</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Permissions */}
          <div className="space-y-2">
            <Label>Permissions</Label>
            <Select value={permission} onValueChange={(v) => setPermission(v as Permission)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">Read only</SelectItem>
                <SelectItem value="write">Read & Write</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              disabled={
                isSharing ||
                (targetType === 'user' && !selectedUser && !userSearch.trim()) ||
                (targetType === 'team' && !selectedTeamId)
              }
              className="flex-1"
            >
              {isSharing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sharing...
                </>
              ) : (
                'Share'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
import { bytesToBase64, base64ToBytes } from '@/lib/crypto/encoding';
import { Team } from '@/types/vault';

interface ShareVaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultId: string;
  vaultKey: Uint8Array | null;
}

type ShareTarget = 'user' | 'team';
type Permission = 'read' | 'write';

interface UserSearchResult {
  id: string;
  username: string;
  public_enc_key: string;
}

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
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);

  // Fetch teams on mount
  useEffect(() => {
    if (open) {
      get<{ teams: Team[] }>('/teams').then((res) => {
        if (res.ok && res.body?.teams) {
          setTeams(res.body.teams);
        }
      });
    }
  }, [open]);

  // Search users
  useEffect(() => {
    if (targetType !== 'user' || userSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await get<{ users: UserSearchResult[] }>(
          `/users/search?q=${encodeURIComponent(userSearch)}`
        );
        if (res.ok && res.body?.users) {
          setSearchResults(res.body.users);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [userSearch, targetType]);

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
      let wrappedKey: string;
      let sharePayload: Record<string, unknown>;

      if (targetType === 'user') {
        if (!selectedUser) {
          toast({
            title: 'No user selected',
            description: 'Please select a user to share with.',
            variant: 'destructive',
          });
          return;
        }

        // Wrap vault key to user's public encryption key
        wrappedKey = await sealToRecipient(selectedUser.public_enc_key, vaultKey);

        sharePayload = {
          source_vault_id: vaultId,
          target_user_id: selectedUser.id,
          wrapped_key: wrappedKey,
          permissions: permission,
        };
      } else {
        if (!selectedTeamId) {
          toast({
            title: 'No team selected',
            description: 'Please select a team to share with.',
            variant: 'destructive',
          });
          return;
        }

        // For team sharing, we need the team's public key
        const teamRes = await get<{ team: { public_enc_key: string } }>(
          `/teams/${selectedTeamId}`
        );
        
        if (!teamRes.ok || !teamRes.body?.team?.public_enc_key) {
          throw new Error('Could not get team public key');
        }

        wrappedKey = await sealToRecipient(teamRes.body.team.public_enc_key, vaultKey);

        sharePayload = {
          source_vault_id: vaultId,
          target_team_id: selectedTeamId,
          wrapped_key: wrappedKey,
          permissions: permission,
        };
      }

      const res = await post('/shares', sharePayload);

      if (!res.ok) {
        throw new Error('Failed to create share');
      }

      toast({
        title: 'Vault shared',
        description: `Vault has been shared with ${
          targetType === 'user' ? selectedUser?.username : 'the team'
        }.`,
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

          {/* User search */}
          {targetType === 'user' && (
            <div className="space-y-2">
              <Label>Search user</Label>
              <Input
                placeholder="Type username to search..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
              {isSearching && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user);
                        setUserSearch(user.username);
                        setSearchResults([]);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                    >
                      {user.username}
                    </button>
                  ))}
                </div>
              )}
              {selectedUser && (
                <p className="text-sm text-muted-foreground">
                  Selected: <span className="font-medium">{selectedUser.username}</span>
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
                (targetType === 'user' && !selectedUser) ||
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

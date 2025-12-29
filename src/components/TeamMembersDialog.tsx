import { useState } from 'react';
import {
  Users,
  Mail,
  Crown,
  Shield,
  Eye,
  Pencil,
  MoreVertical,
  Trash2,
  UserPlus,
  Clock,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Team, TeamMember, TeamInvite } from '@/types/vault';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TeamMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
  invites: TeamInvite[];
  onInviteMember: (email: string, role: 'admin' | 'editor' | 'viewer') => void;
  onRemoveMember: (memberId: string) => void;
  onUpdateRole: (memberId: string, role: 'admin' | 'editor' | 'viewer') => void;
  onCancelInvite: (inviteId: string) => void;
  isCurrentUserPending?: boolean;
  onAcceptInvite?: () => void;
}

const ROLE_CONFIG = {
  owner: { icon: Crown, label: 'Owner', color: 'text-warning' },
  admin: { icon: Shield, label: 'Admin', color: 'text-primary' },
  editor: { icon: Pencil, label: 'Editor', color: 'text-muted-foreground' },
  viewer: { icon: Eye, label: 'Viewer', color: 'text-muted-foreground' },
};

export function TeamMembersDialog({
  open,
  onOpenChange,
  team,
  invites,
  onInviteMember,
  onRemoveMember,
  onUpdateRole,
  onCancelInvite,
  isCurrentUserPending,
  onAcceptInvite,
}: TeamMembersDialogProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');

  const handleInvite = () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Check if already a member
    if (team.members.some(m => m.email.toLowerCase() === inviteEmail.toLowerCase())) {
      toast.error('This person is already a team member');
      return;
    }

    // Check if already invited
    if (invites.some(i => i.email.toLowerCase() === inviteEmail.toLowerCase())) {
      toast.error('This person has already been invited');
      return;
    }

    onInviteMember(inviteEmail.trim(), inviteRole);
    setInviteEmail('');
    toast.success(`Invite sent to ${inviteEmail}`);
  };

  const pendingInvites = invites.filter(i => i.status === 'pending');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {team.name} - Team Members
          </DialogTitle>
          <DialogDescription>
            Manage team members and their access levels. All members can access shared passwords.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {isCurrentUserPending && (
            <div className="p-3 rounded-lg border border-warning/30 bg-warning/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-warning" />
                <div>
                  <p className="text-sm font-medium text-foreground">You are invited to join this team</p>
                  <p className="text-xs text-muted-foreground">Accept to access shared passwords</p>
                </div>
              </div>
              <Button size="sm" onClick={() => onAcceptInvite && onAcceptInvite()}>Accept Invite</Button>
            </div>
          )}
          {/* Invite new member */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Invite New Member</label>
            <div className="flex gap-2">
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                icon={<Mail className="w-4 h-4" />}
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'editor' | 'viewer')}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleInvite}>
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pending Invites ({pendingInvites.length})
              </label>
              <div className="space-y-2">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-dashed border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{invite.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Invited as {invite.role} • Expires in 7 days
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        onCancelInvite(invite.id);
                        toast.success('Invite cancelled');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current members */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">
              Team Members ({team.members.length})
            </label>
            <div className="space-y-2">
              {team.members.map((member) => {
                const roleConfig = ROLE_CONFIG[member.role];
                const RoleIcon = roleConfig.icon;
                const isOwner = member.role === 'owner';

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-card rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={cn('flex items-center gap-1.5', roleConfig.color)}>
                        <RoleIcon className="w-4 h-4" />
                        <span className="text-xs font-medium">{roleConfig.label}</span>
                      </div>

                      {!isOwner && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onUpdateRole(member.id, 'admin')}>
                              <Shield className="w-4 h-4 mr-2" />
                              Make Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateRole(member.id, 'editor')}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Make Editor
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateRole(member.id, 'viewer')}>
                              <Eye className="w-4 h-4 mr-2" />
                              Make Viewer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                onRemoveMember(member.id);
                                toast.success(`${member.name} removed from team`);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove from Team
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security note */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm">
            <p className="font-medium text-primary mb-1">🔄 Key Rotation</p>
            <p className="text-muted-foreground">
              When a member is removed, the team encryption key is automatically rotated
              and re-encrypted for remaining members. This ensures removed members cannot
              access future passwords.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

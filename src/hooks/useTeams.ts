import { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { get, post, request } from '@/lib/api';
import { Team, TeamMember, TeamInvite } from '@/types/vault';

type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

type TeamListItem = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  vault_id: string | null;
  role: TeamRole;
  invited_at: string;
  joined_at: string | null;
  team_key_wrapped: string;
};

type ListTeamsResponse = { items: TeamListItem[] };

type TeamMemberRow = {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  invited_by: string | null;
  invited_at: string;
  joined_at: string | null;
  revoked_at: string | null;
  team_key_wrapped: string;
  display_name: string | null;
  email: string | null;
};

type ListMembersResponse = { items: TeamMemberRow[] };

type CreateTeamResponse = { id?: string; vault_id?: string; error?: string };

type LookupUserResponse = {
  id: string;
  display_name?: string;
  email?: string;
};

type InviteMemberResponse = { id?: string; error?: string };

type OkResponse = { ok?: boolean; error?: string };

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const randomWrappedKey = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const mapTeam = (item: TeamListItem): Team => ({
  id: item.id,
  name: item.name,
  description: item.description ?? undefined,
  vaultId: item.vault_id ?? undefined,
  members: [],
  createdAt: new Date(item.created_at),
  createdBy: item.created_by,
});

const mapMember = (row: TeamMemberRow): TeamMember => {
  const email = row.email ?? '';
  const name = row.display_name ?? (email || row.user_id);
  return {
    id: row.id,
    userId: row.user_id,
    email,
    name,
    role: row.role,
    joinedAt: row.joined_at ? new Date(row.joined_at) : undefined,
  };
};

const mapInvite = (row: TeamMemberRow): TeamInvite | null => {
  if (row.joined_at) return null;
  if (row.role !== 'admin' && row.role !== 'editor' && row.role !== 'viewer') return null;
  const createdAt = new Date(row.invited_at);
  return {
    id: row.id,
    teamId: row.team_id,
    email: row.email ?? '',
    role: row.role,
    invitedBy: row.invited_by ?? '',
    createdAt,
    expiresAt: new Date(createdAt.getTime() + ONE_WEEK_MS),
    status: 'pending',
  };
};

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const refreshTeamMembers = useCallback(async (teamId: string) => {
    const r = await get<ListMembersResponse>(`/teams/${teamId}/members`);
    if (!r.ok) {
      if (r.status === 401) return;
      toast.error('Failed to load team members');
      return;
    }
    const members = r.body.items
      .filter((row) => !!row.joined_at)
      .map(mapMember);
    const teamInvites = r.body.items
      .map(mapInvite)
      .filter((v): v is TeamInvite => v !== null);

    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, members } : t)));
    setInvites((prev) => [...prev.filter((i) => i.teamId !== teamId), ...teamInvites]);
  }, []);

  const refreshTeams = useCallback(async () => {
    const r = await get<ListTeamsResponse>('/teams');
    if (!r.ok) {
      if (r.status === 401) return;
      toast.error('Failed to load teams');
      return;
    }
    const mapped = r.body.items.map(mapTeam);
    setTeams(mapped);
    setInvites([]);
    await Promise.all(mapped.map((t) => refreshTeamMembers(t.id)));
  }, [refreshTeamMembers]);

  useEffect(() => {
    void refreshTeams();
  }, [refreshTeams]);

  const createTeam = useCallback(
    (name: string, description?: string) => {
      void (async () => {
        const r = await post<CreateTeamResponse>('/teams', {
          name,
          description,
          team_key_wrapped_for_creator: randomWrappedKey(),
        });
        if (!r.ok || !r.body.id) {
          toast.error('Failed to create team');
          return;
        }
        await refreshTeams();
      })();
    },
    [refreshTeams]
  );

  const updateTeam = useCallback(
    (id: string, updates: Partial<Pick<Team, 'name' | 'description'>>) => {
      void (async () => {
        const r = await request<OkResponse>(`/teams/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
        if (!r.ok) {
          toast.error('Failed to update team');
          return;
        }
        await refreshTeams();
      })();
    },
    [refreshTeams]
  );

  const deleteTeam = useCallback(
    (id: string) => {
      void (async () => {
        const r = await request<OkResponse>(`/teams/${id}`, { method: 'DELETE' });
        if (!r.ok) {
          toast.error('Failed to delete team');
          return;
        }
        setSelectedTeam((prev) => (prev === id ? null : prev));
        await refreshTeams();
      })();
    },
    [refreshTeams]
  );

  const inviteMember = useCallback(
    (teamId: string, email: string, role: 'admin' | 'editor' | 'viewer') => {
      void (async () => {
        const lookup = await get<LookupUserResponse>(`/users/lookup?email=${encodeURIComponent(email)}`);
        if (!lookup.ok || !lookup.body.id) {
          toast.error('User not found');
          return;
        }
        const r = await post<InviteMemberResponse>(`/teams/${teamId}/invite`, {
          user_id: lookup.body.id,
          role,
          team_key_wrapped: randomWrappedKey(),
        });
        if (!r.ok || !r.body.id) {
          toast.error('Failed to send invite');
          return;
        }
        await refreshTeamMembers(teamId);
      })();
    },
    [refreshTeamMembers]
  );

  const cancelInvite = useCallback(
    (inviteId: string) => {
      void (async () => {
        const invite = invites.find((i) => i.id === inviteId);
        if (!invite) return;
        const r = await request<OkResponse>(`/teams/${invite.teamId}/members/${inviteId}`, { method: 'DELETE' });
        if (!r.ok) {
          toast.error('Failed to cancel invite');
          return;
        }
        await refreshTeamMembers(invite.teamId);
      })();
    },
    [invites, refreshTeamMembers]
  );

  const removeMember = useCallback(
    (teamId: string, memberId: string) => {
      void (async () => {
        const r = await request<OkResponse>(`/teams/${teamId}/members/${memberId}`, { method: 'DELETE' });
        if (!r.ok) {
          toast.error('Failed to remove member');
          return;
        }
        await refreshTeamMembers(teamId);
      })();
    },
    [refreshTeamMembers]
  );

  const updateMemberRole = useCallback(
    (teamId: string, memberId: string, role: TeamMember['role']) => {
      void (async () => {
        if (role === 'owner') {
          toast.error('Cannot assign owner role');
          return;
        }
        const r = await post<OkResponse>(`/teams/${teamId}/members/${memberId}/role`, { role });
        if (!r.ok) {
          toast.error('Failed to update role');
          return;
        }
        await refreshTeamMembers(teamId);
      })();
    },
    [refreshTeamMembers]
  );

  const getTeamInvites = useCallback((teamId: string) => {
    return invites.filter(invite => invite.teamId === teamId && invite.status === 'pending');
  }, [invites]);

  return {
    teams,
    invites,
    selectedTeam,
    setSelectedTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    inviteMember,
    cancelInvite,
    removeMember,
    updateMemberRole,
    getTeamInvites,
  };
}

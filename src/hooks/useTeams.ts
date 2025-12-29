import { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { get, post, request } from '@/lib/api';
import { Team, TeamMember, TeamInvite } from '@/types/vault';
import { sealToRecipient } from '@/lib/crypto/box';

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

type VaultDeps = {
  getVaultIdForTeamId: (teamId: string) => string | null;
  getVaultKeyByVaultId: (vaultId: string) => Uint8Array | null;
};

export function useTeams(deps?: VaultDeps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [pendingByTeamId, setPendingByTeamId] = useState<Set<string>>(() => new Set());
  const getVaultIdForTeamId = deps?.getVaultIdForTeamId;
  const getVaultKeyByVaultId = deps?.getVaultKeyByVaultId;

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
    const pendingSet = new Set<string>();
    for (const item of r.body.items) {
      if (!item.joined_at) pendingSet.add(item.id);
    }
    setPendingByTeamId(pendingSet);
    await Promise.all(mapped.map((t) => refreshTeamMembers(t.id)));
  }, [refreshTeamMembers]);

  useEffect(() => {
    void refreshTeams();
  }, [refreshTeams]);

  const createTeam = useCallback(
    (name: string, description?: string) => {
      void (async () => {
        type KeysMeResponse = { public_enc_key?: string | null };
        const keysRes = await get<KeysMeResponse>('/keys/me');
        const encPk = keysRes.body?.public_enc_key;
        if (!keysRes.ok || !encPk) {
          toast.error('Cannot create team: encryption keys not registered');
          return;
        }
        const teamKey = crypto.getRandomValues(new Uint8Array(32));
        const wrappedForCreator = await sealToRecipient(encPk, teamKey);
        const r = await post<CreateTeamResponse>('/teams', {
          name,
          description,
          team_key_wrapped_for_creator: wrappedForCreator,
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
        const userId = lookup.body.id;
        const pkRes = await get<{ public_enc_key?: string | null }>(`/users/${userId}/public-keys`);
        const recipientPk = pkRes.body?.public_enc_key;
        if (!pkRes.ok || !recipientPk) {
          toast.error('Cannot invite: recipient has no encryption keys');
          return;
        }
        const vaultId = getVaultIdForTeamId ? getVaultIdForTeamId(teamId) : null;
        if (!vaultId) {
          toast.error('Team vault not available');
          return;
        }
        const teamKey = getVaultKeyByVaultId ? getVaultKeyByVaultId(vaultId) : null;
        if (!teamKey) {
          toast.error('Team key not available');
          return;
        }
        const wrapped = await sealToRecipient(recipientPk, teamKey);
        const r = await post<InviteMemberResponse>(`/teams/${teamId}/invite`, {
          user_id: userId,
          role,
          team_key_wrapped: wrapped,
        });
        if (!r.ok || !r.body.id) {
          toast.error('Failed to send invite');
          return;
        }
        await refreshTeamMembers(teamId);
      })();
    },
    [getVaultIdForTeamId, getVaultKeyByVaultId, refreshTeamMembers]
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

  const isInvitePending = useCallback((teamId: string) => {
    return pendingByTeamId.has(teamId);
  }, [pendingByTeamId]);

  const acceptInvite = useCallback((teamId: string) => {
    void (async () => {
      const r = await post<OkResponse>(`/teams/${teamId}/accept`, {});
      if (!r.ok) {
        toast.error('Failed to accept invite');
        return;
      }
      toast.success('Joined team');
      await refreshTeams();
      await refreshTeamMembers(teamId);
    })();
  }, [refreshTeams, refreshTeamMembers]);

  const leaveTeam = useCallback((teamId: string) => {
    void (async () => {
      const r = await post<OkResponse>(`/teams/${teamId}/leave`, {});
      if (!r.ok) {
        toast.error('Failed to leave team');
        return;
      }
      toast.success('Left team');
      if (selectedTeam === teamId) setSelectedTeam(null);
      await refreshTeams();
    })();
  }, [refreshTeams, selectedTeam]);

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
    refreshTeamMembers,
    isInvitePending,
    acceptInvite,
    leaveTeam,
  };
}

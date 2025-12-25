import { useState, useCallback } from 'react';
import { Team, TeamMember, TeamInvite } from '@/types/vault';

const DEMO_TEAMS: Team[] = [
  {
    id: 'team-1',
    name: 'Engineering',
    description: 'Development team credentials',
    createdAt: new Date('2024-01-10'),
    createdBy: 'user-1',
    members: [
      {
        id: 'member-1',
        userId: 'user-1',
        email: 'admin@company.com',
        name: 'John Admin',
        role: 'owner',
        joinedAt: new Date('2024-01-10'),
      },
      {
        id: 'member-2',
        userId: 'user-2',
        email: 'dev@company.com',
        name: 'Jane Developer',
        role: 'member',
        joinedAt: new Date('2024-01-15'),
      },
    ],
  },
  {
    id: 'team-2',
    name: 'Marketing',
    description: 'Marketing and social media accounts',
    createdAt: new Date('2024-02-01'),
    createdBy: 'user-1',
    members: [
      {
        id: 'member-3',
        userId: 'user-1',
        email: 'admin@company.com',
        name: 'John Admin',
        role: 'owner',
        joinedAt: new Date('2024-02-01'),
      },
    ],
  },
];

const DEMO_INVITES: TeamInvite[] = [
  {
    id: 'invite-1',
    teamId: 'team-1',
    email: 'newdev@company.com',
    role: 'member',
    invitedBy: 'user-1',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'pending',
  },
];

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>(DEMO_TEAMS);
  const [invites, setInvites] = useState<TeamInvite[]>(DEMO_INVITES);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const createTeam = useCallback((name: string, description?: string) => {
    const newTeam: Team = {
      id: crypto.randomUUID(),
      name,
      description,
      createdAt: new Date(),
      createdBy: 'current-user',
      members: [
        {
          id: crypto.randomUUID(),
          userId: 'current-user',
          email: 'you@example.com',
          name: 'You',
          role: 'owner',
          joinedAt: new Date(),
        },
      ],
    };
    setTeams(prev => [...prev, newTeam]);
    return newTeam;
  }, []);

  const updateTeam = useCallback((id: string, updates: Partial<Pick<Team, 'name' | 'description'>>) => {
    setTeams(prev =>
      prev.map(team =>
        team.id === id ? { ...team, ...updates } : team
      )
    );
  }, []);

  const deleteTeam = useCallback((id: string) => {
    setTeams(prev => prev.filter(team => team.id !== id));
    if (selectedTeam === id) {
      setSelectedTeam(null);
    }
  }, [selectedTeam]);

  const inviteMember = useCallback((teamId: string, email: string, role: 'admin' | 'member') => {
    const newInvite: TeamInvite = {
      id: crypto.randomUUID(),
      teamId,
      email,
      role,
      invitedBy: 'current-user',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending',
    };
    setInvites(prev => [...prev, newInvite]);
    return newInvite;
  }, []);

  const cancelInvite = useCallback((inviteId: string) => {
    setInvites(prev => prev.filter(invite => invite.id !== inviteId));
  }, []);

  const removeMember = useCallback((teamId: string, memberId: string) => {
    setTeams(prev =>
      prev.map(team =>
        team.id === teamId
          ? { ...team, members: team.members.filter(m => m.id !== memberId) }
          : team
      )
    );
  }, []);

  const updateMemberRole = useCallback((teamId: string, memberId: string, role: TeamMember['role']) => {
    setTeams(prev =>
      prev.map(team =>
        team.id === teamId
          ? {
              ...team,
              members: team.members.map(m =>
                m.id === memberId ? { ...m, role } : m
              ),
            }
          : team
      )
    );
  }, []);

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

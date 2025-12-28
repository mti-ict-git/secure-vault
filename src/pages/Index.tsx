import { useEffect } from 'react';
import { UnlockScreen } from '@/components/UnlockScreen';
import { VaultDashboard } from '@/components/VaultDashboard';
import { KeySetupDialog } from '@/components/KeySetupDialog';
import { useVault } from '@/hooks/useVault';
import { useTeams } from '@/hooks/useTeams';

const Index = () => {
  const {
    isLocked,
    entries,
    folders,
    needsKeySetup,
    unlock,
    lock,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleFavorite,
    importEntries,
    onKeySetupComplete,
  } = useVault();

  const {
    teams,
    createTeam,
    updateTeam,
    deleteTeam,
    inviteMember,
    cancelInvite,
    removeMember,
    updateMemberRole,
    getTeamInvites,
  } = useTeams();

  // Apply dark mode by default
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  if (needsKeySetup) {
    return <KeySetupDialog open={true} onComplete={onKeySetupComplete} />;
  }

  if (isLocked) {
    return <UnlockScreen onUnlock={unlock} />;
  }

  return (
    <VaultDashboard
      entries={entries}
      folders={folders}
      teams={teams}
      onLock={lock}
      onAddEntry={addEntry}
      onUpdateEntry={updateEntry}
      onDeleteEntry={deleteEntry}
      onToggleFavorite={toggleFavorite}
      onCreateTeam={createTeam}
      onUpdateTeam={updateTeam}
      onDeleteTeam={deleteTeam}
      onInviteMember={inviteMember}
      onRemoveMember={removeMember}
      onUpdateMemberRole={updateMemberRole}
      onCancelInvite={cancelInvite}
      getTeamInvites={getTeamInvites}
      onImportEntries={importEntries}
    />
  );
};

export default Index;

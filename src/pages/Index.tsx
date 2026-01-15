import { useEffect } from 'react';
import { UnlockScreen } from '@/components/UnlockScreen';
import { VaultDashboard } from '@/components/VaultDashboard';
import { KeySetupDialog } from '@/components/KeySetupDialog';
import { useVault } from '@/hooks/useVault';
import { useTeams } from '@/hooks/useTeams';
import { useSyncEvents } from '@/hooks/useSyncEvents';
import { Loader2, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/auth';

const Index = () => {
  const {
    isLocked,
    entries,
    folders,
    needsKeySetup,
    isCheckingKeys,
    unlock,
    lock,
    refresh,
    resetKeys,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleFavorite,
    importEntries,
    addFolder,
    deleteFolder,
    onKeySetupComplete,
    currentVaultId,
    getCurrentVaultKey,
    getVaultIdForTeamId,
    getVaultKeyByVaultId,
    getPermissionsForTeamId,
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
    isInvitePending,
    acceptInvite,
    refreshTeams,
    refreshTeamMembers,
  } = useTeams({ getVaultIdForTeamId, getVaultKeyByVaultId });

  const { user } = useAuth();
  const isAdmin = !!user && (user as { role?: 'user' | 'admin' }).role === 'admin';

  useSyncEvents({
    enabled: !isLocked,
    onVaultChange: () => { void refresh(); },
    onTeamChange: (teamId) => { void refreshTeams(); void refreshTeamMembers(teamId); },
  });

  

  // Show loading while checking if user has keys
  if (isCheckingKeys) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Loading vault...</p>
      </div>
    );
  }

  // New user: show key setup dialog to CREATE a master password
  if (needsKeySetup) {
    return <KeySetupDialog open={true} onComplete={onKeySetupComplete} />;
  }

  // Existing user: show unlock screen to ENTER existing master password
  if (isLocked) {
    return <UnlockScreen onUnlock={unlock} onResetKeys={resetKeys} />;
  }

  return (
    <VaultDashboard
      entries={entries}
      folders={folders}
      teams={teams}
      onLock={lock}
      onRefresh={() => { void refresh(); }}
      onAddEntry={addEntry}
      onUpdateEntry={updateEntry}
      onDeleteEntry={deleteEntry}
      onToggleFavorite={toggleFavorite}
      onAddFolder={addFolder}
      onDeleteFolder={deleteFolder}
      onCreateTeam={createTeam}
      onUpdateTeam={updateTeam}
      onDeleteTeam={deleteTeam}
      onInviteMember={inviteMember}
      onRemoveMember={removeMember}
      onUpdateMemberRole={updateMemberRole}
      onCancelInvite={cancelInvite}
      getTeamInvites={getTeamInvites}
      isInvitePending={isInvitePending}
      onAcceptInvite={acceptInvite}
      getPermissionsForTeamId={getPermissionsForTeamId}
      onImportEntries={importEntries}
      currentVaultId={currentVaultId}
      getCurrentVaultKey={getCurrentVaultKey}
      getVaultIdForTeamId={getVaultIdForTeamId}
      getVaultKeyByVaultId={getVaultKeyByVaultId}
      isAdmin={isAdmin}
    />
  );
};

export default Index;

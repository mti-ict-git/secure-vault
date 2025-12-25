import { useEffect } from 'react';
import { UnlockScreen } from '@/components/UnlockScreen';
import { VaultDashboard } from '@/components/VaultDashboard';
import { useVault } from '@/hooks/useVault';

const Index = () => {
  const {
    isLocked,
    entries,
    folders,
    unlock,
    lock,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleFavorite,
  } = useVault();

  // Apply dark mode by default
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  if (isLocked) {
    return <UnlockScreen onUnlock={unlock} />;
  }

  return (
    <VaultDashboard
      entries={entries}
      folders={folders}
      onLock={lock}
      onAddEntry={addEntry}
      onUpdateEntry={updateEntry}
      onDeleteEntry={deleteEntry}
      onToggleFavorite={toggleFavorite}
    />
  );
};

export default Index;

import { useState, useCallback, useEffect, useRef } from 'react';
import { PasswordEntry, Folder, VaultState } from '@/types/vault';
import { get, post, getBinary, postForm } from '@/lib/api';
import { decryptVaultSnapshot, encryptVaultSnapshot, deserializeEncryptedSnapshot, serializeEncryptedSnapshot, type VaultSnapshotV1 } from '@/lib/crypto/vault';
import { openSealed } from '@/lib/crypto/box';
import { decryptPrivateKeys, type PrivateKeysPlain, type EncryptedPrivateKeysV1 } from '@/lib/crypto/privateKeys';
import { base64ToBytes, bytesToBase64 } from '@/lib/crypto/encoding';
import { getSodium } from '@/lib/crypto/sodium';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

interface VaultRecord {
  id: string;
  kind: 'personal' | 'team';
  team_id: string | null;
  vault_key_wrapped: string;
  version: number;
}

interface VaultKeys {
  privateKeys: PrivateKeysPlain;
  vaultKeys: Map<string, Uint8Array>; // vaultId -> decrypted vault key
}

export function useVault() {
  const [state, setState] = useState<VaultState>({
    isLocked: true,
    entries: [],
    folders: [],
    lastActivity: new Date(),
  });
  
  const [needsKeySetup, setNeedsKeySetup] = useState(false);
  const [vaults, setVaults] = useState<VaultRecord[]>([]);
  const [currentVaultId, setCurrentVaultId] = useState<string | null>(null);
  const keysRef = useRef<VaultKeys | null>(null);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    
    setState(prev => ({ ...prev, lastActivity: new Date() }));
    
    inactivityTimer.current = setTimeout(() => {
      lock();
    }, INACTIVITY_TIMEOUT);
  }, []);

  const checkKeysRegistered = async (): Promise<boolean> => {
    const res = await get<{ has_keys: boolean }>('/keys/me');
    return res.ok && res.body?.has_keys === true;
  };

  const fetchAndDecryptVaults = async (keys: VaultKeys): Promise<{
    entries: PasswordEntry[];
    folders: Folder[];
    vaultId: string | null;
  }> => {
    const res = await get<{ vaults: VaultRecord[] }>('/vaults');
    if (!res.ok || !res.body?.vaults) {
      return { entries: [], folders: [], vaultId: null };
    }

    const vaultRecords = res.body.vaults;
    setVaults(vaultRecords);

    if (vaultRecords.length === 0) {
      return { entries: [], folders: [], vaultId: null };
    }

    // Decrypt vault keys and fetch blobs for each vault
    const allEntries: PasswordEntry[] = [];
    const allFolders: Folder[] = [];
    let primaryVaultId: string | null = null;

    for (const vault of vaultRecords) {
      try {
        // Decrypt the vault key using user's private encryption key
        const vaultKey = await openSealed(
          vault.vault_key_wrapped,
          keys.privateKeys.enc_pk_b64,
          keys.privateKeys.enc_sk_b64
        );
        keys.vaultKeys.set(vault.id, vaultKey);

        if (!primaryVaultId && vault.kind === 'personal') {
          primaryVaultId = vault.id;
        }

        // Fetch the latest blob (vault snapshot)
        const blobsRes = await get<{ blobs: { id: string; blob_type: string }[] }>(
          `/vaults/${vault.id}/blobs`
        );
        
        if (!blobsRes.ok || !blobsRes.body?.blobs?.length) {
          continue;
        }

        // Find the latest vault_snapshot blob
        const snapshotBlob = blobsRes.body.blobs.find(b => b.blob_type === 'vault_snapshot');
        if (!snapshotBlob) continue;

        // Download and decrypt the blob
        const blobData = await getBinary(`/vaults/${vault.id}/blobs/${snapshotBlob.id}`);
        if (!blobData.ok) continue;

        const encryptedSnapshot = deserializeEncryptedSnapshot(blobData.data);
        const snapshot = await decryptVaultSnapshot(vaultKey, encryptedSnapshot);

        // Map snapshot entries to PasswordEntry
        for (const entry of snapshot.entries) {
          allEntries.push({
            id: entry.id,
            title: entry.title,
            username: entry.username,
            password: entry.password,
            url: entry.url,
            notes: entry.notes,
            folderId: entry.folderId,
            teamId: entry.teamId,
            createdAt: new Date(entry.createdAt),
            updatedAt: new Date(entry.updatedAt),
            favorite: entry.favorite,
            createdBy: entry.createdBy,
          });
        }

        for (const folder of snapshot.folders) {
          allFolders.push({
            id: folder.id,
            name: folder.name,
            icon: folder.icon,
            parentId: folder.parentId,
            teamId: folder.teamId,
          });
        }
      } catch (err) {
        console.error(`Failed to decrypt vault ${vault.id}:`, err);
      }
    }

    return { entries: allEntries, folders: allFolders, vaultId: primaryVaultId };
  };

  const saveVaultSnapshot = async (entries: PasswordEntry[], folders: Folder[]) => {
    if (!currentVaultId || !keysRef.current) return;

    const vaultKey = keysRef.current.vaultKeys.get(currentVaultId);
    if (!vaultKey) {
      console.error('No vault key for current vault');
      return;
    }

    // Create snapshot from current state
    const snapshot: VaultSnapshotV1 = {
      v: 1,
      entries: entries.map(e => ({
        id: e.id,
        title: e.title,
        username: e.username,
        password: e.password,
        url: e.url,
        notes: e.notes,
        folderId: e.folderId,
        teamId: e.teamId,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        favorite: e.favorite,
        createdBy: e.createdBy,
      })),
      folders: folders.map(f => ({
        id: f.id,
        name: f.name,
        icon: f.icon,
        parentId: f.parentId,
        teamId: f.teamId,
      })),
    };

    // Encrypt and upload
    const encrypted = await encryptVaultSnapshot(vaultKey, snapshot);
    const bytes = serializeEncryptedSnapshot(encrypted);
    
    // Calculate SHA-256 hash
    const bytesBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytesBuffer);
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

    const form = new FormData();
    form.append('meta', JSON.stringify({
      blob_type: 'vault_snapshot',
      content_sha256: hashHex,
      size_bytes: bytes.length,
    }));
    form.append('file', new Blob([bytesBuffer], { type: 'application/octet-stream' }));

    await postForm(`/vaults/${currentVaultId}/blobs`, form);
  };

  const unlock = useCallback(async (masterPassword: string): Promise<boolean> => {
    try {
      // First check if user has keys registered
      const hasKeys = await checkKeysRegistered();
      if (!hasKeys) {
        setNeedsKeySetup(true);
        return false;
      }

      // Fetch encrypted private key from server
      const keysRes = await get<{ encrypted_private_key: EncryptedPrivateKeysV1 }>('/keys/me');
      if (!keysRes.ok || !keysRes.body?.encrypted_private_key) {
        console.error('Failed to fetch private keys');
        return false;
      }

      // Decrypt private keys with master password
      const privateKeys = await decryptPrivateKeys(masterPassword, keysRes.body.encrypted_private_key);
      
      const keys: VaultKeys = {
        privateKeys,
        vaultKeys: new Map(),
      };
      keysRef.current = keys;

      // Fetch and decrypt vaults
      const { entries, folders, vaultId } = await fetchAndDecryptVaults(keys);
      setCurrentVaultId(vaultId);

      setState({
        isLocked: false,
        entries,
        folders,
        lastActivity: new Date(),
      });
      
      resetInactivityTimer();
      return true;
    } catch (err) {
      console.error('Unlock failed:', err);
      return false;
    }
  }, [resetInactivityTimer]);

  const lock = useCallback(() => {
    // Clear sensitive data from memory
    keysRef.current = null;
    setVaults([]);
    setCurrentVaultId(null);
    
    setState({
      isLocked: true,
      entries: [],
      folders: [],
      lastActivity: new Date(),
    });
    
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
  }, []);

  const addEntry = useCallback(async (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newEntry: PasswordEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setState(prev => {
      const newState = {
        ...prev,
        entries: [...prev.entries, newEntry],
      };
      // Save to backend
      saveVaultSnapshot(newState.entries, newState.folders);
      return newState;
    });
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const updateEntry = useCallback(async (id: string, updates: Partial<PasswordEntry>) => {
    setState(prev => {
      const newEntries = prev.entries.map(entry =>
        entry.id === id
          ? { ...entry, ...updates, updatedAt: new Date() }
          : entry
      );
      const newState = { ...prev, entries: newEntries };
      // Save to backend
      saveVaultSnapshot(newState.entries, newState.folders);
      return newState;
    });
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const deleteEntry = useCallback(async (id: string) => {
    setState(prev => {
      const newEntries = prev.entries.filter(entry => entry.id !== id);
      const newState = { ...prev, entries: newEntries };
      // Save to backend
      saveVaultSnapshot(newState.entries, newState.folders);
      return newState;
    });
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const toggleFavorite = useCallback(async (id: string) => {
    setState(prev => {
      const newEntries = prev.entries.map(entry =>
        entry.id === id
          ? { ...entry, favorite: !entry.favorite }
          : entry
      );
      const newState = { ...prev, entries: newEntries };
      // Save to backend
      saveVaultSnapshot(newState.entries, newState.folders);
      return newState;
    });
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const importEntries = useCallback(async (
    newEntries: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>[],
    newFolders: Omit<Folder, 'id'>[]
  ) => {
    // Add folders with generated IDs
    const folderIdMap = new Map<string, string>();
    const foldersWithIds: Folder[] = newFolders.map(folder => {
      const id = crypto.randomUUID();
      if (folder.name) {
        folderIdMap.set(folder.name, id);
      }
      return { ...folder, id };
    });

    // Add entries with generated IDs
    const entriesWithIds: PasswordEntry[] = newEntries.map(entry => ({
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    setState(prev => {
      const newState = {
        ...prev,
        entries: [...prev.entries, ...entriesWithIds],
        folders: [...prev.folders, ...foldersWithIds],
      };
      // Save to backend
      saveVaultSnapshot(newState.entries, newState.folders);
      return newState;
    });
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const getPersonalEntries = useCallback(() => {
    return state.entries.filter(e => !e.teamId);
  }, [state.entries]);

  const getTeamEntries = useCallback((teamId: string) => {
    return state.entries.filter(e => e.teamId === teamId);
  }, [state.entries]);

  const getPersonalFolders = useCallback(() => {
    return state.folders.filter(f => !f.teamId);
  }, [state.folders]);

  const getTeamFolders = useCallback((teamId: string) => {
    return state.folders.filter(f => f.teamId === teamId);
  }, [state.folders]);

  const getCurrentVaultKey = useCallback((): Uint8Array | null => {
    if (!currentVaultId || !keysRef.current) return null;
    return keysRef.current.vaultKeys.get(currentVaultId) || null;
  }, [currentVaultId]);

  const onKeySetupComplete = useCallback(() => {
    setNeedsKeySetup(false);
  }, []);

  // Track user activity
  useEffect(() => {
    if (state.isLocked) return;

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    const handleActivity = () => {
      resetInactivityTimer();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [state.isLocked, resetInactivityTimer]);

  return {
    ...state,
    needsKeySetup,
    currentVaultId,
    vaults,
    unlock,
    lock,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleFavorite,
    importEntries,
    getPersonalEntries,
    getTeamEntries,
    getPersonalFolders,
    getTeamFolders,
    getCurrentVaultKey,
    onKeySetupComplete,
  };
}

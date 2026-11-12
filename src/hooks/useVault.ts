import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { PasswordEntry, Folder, VaultState } from '@/types/vault';
import { get, post, del, getBinary, postForm } from '@/lib/api';
import { decryptVaultSnapshot, encryptVaultSnapshot, deserializeEncryptedSnapshot, serializeEncryptedSnapshot, type VaultSnapshotV1 } from '@/lib/crypto/vault';
import { openSealed, sealToRecipient } from '@/lib/crypto/box';
import { decryptPrivateKeys, type PrivateKeysPlain, type EncryptedPrivateKeysV1 } from '@/lib/crypto/privateKeys';
import { base64ToBytes, bytesToBase64 } from '@/lib/crypto/encoding';
import { getSodium } from '@/lib/crypto/sodium';
import type { KdbxImportedEntry, KdbxImportedFolder } from '@/lib/kdbx-utils';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export interface VaultRecord {
  id: string;
  kind: 'personal' | 'team';
  team_id: string | null;
  vault_key_wrapped_for_user: string;
  version: number;
  permissions?: 'read' | 'write';
  /** Incremented on every key rotation; uploads must name it. */
  key_version?: number;
  owner_user_id?: string | null;
  purpose?: 'primary' | 'transfer';
  created_at?: string;
  /** 1 when this is the caller's own primary personal vault (not a shared or transfer vault). */
  is_own_primary?: number | boolean;
}

const isOwnPrimary = (v: VaultRecord) => v.is_own_primary === 1 || v.is_own_primary === true;

type CreateVaultResponse = { id?: string; error?: string };

interface VaultKeys {
  privateKeys: PrivateKeysPlain;
  vaultKeys: Map<string, Uint8Array>; // vaultId -> decrypted vault key
}

type KeysMeResponse = {
  public_sign_key?: string | null;
  public_enc_key?: string | null;
  encrypted_private_key?: string | null;
};

const hasRegisteredKeys = (body: KeysMeResponse | null | undefined): boolean => {
  return !!(body?.public_sign_key && body?.public_enc_key && body?.encrypted_private_key);
};

const isEncryptedPrivateKeysV1 = (value: unknown): value is EncryptedPrivateKeysV1 => {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  if (obj.v !== 1) return false;
  if (typeof obj.kdf !== 'object' || obj.kdf === null) return false;
  if (typeof obj.enc !== 'object' || obj.enc === null) return false;

  const kdf = obj.kdf as Record<string, unknown>;
  if (kdf.name !== 'argon2id') return false;
  if (typeof kdf.salt_b64 !== 'string') return false;
  if (typeof kdf.iterations !== 'number') return false;
  if (typeof kdf.memorySize !== 'number') return false;
  if (typeof kdf.parallelism !== 'number') return false;
  if (typeof kdf.hashLength !== 'number') return false;

  const enc = obj.enc as Record<string, unknown>;
  if (enc.v !== 1) return false;
  if (enc.alg !== 'xchacha20poly1305_ietf') return false;
  if (typeof enc.nonce_b64 !== 'string') return false;
  if (typeof enc.cipher_b64 !== 'string') return false;
  if (enc.ad_b64 !== undefined && typeof enc.ad_b64 !== 'string') return false;

  return true;
};

const parseEncryptedPrivateKeys = (json: string): EncryptedPrivateKeysV1 | null => {
  try {
    const parsed: unknown = JSON.parse(json);
    return isEncryptedPrivateKeysV1(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export function useVault() {
  const [state, setState] = useState<VaultState>({
    isLocked: true,
    entries: [],
    folders: [],
    lastActivity: new Date(),
  });
  
  const [needsKeySetup, setNeedsKeySetup] = useState(false);
  const [isCheckingKeys, setIsCheckingKeys] = useState(true); // Start with loading state
  const [vaults, setVaults] = useState<VaultRecord[]>([]);
  const [currentVaultId, setCurrentVaultId] = useState<string | null>(null);
  const [canUndoLastImport, setCanUndoLastImport] = useState(false);
  const keysRef = useRef<VaultKeys | null>(null);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const lastImportRef = useRef<{ entryIds: string[]; folderIds: string[] } | null>(null);

  // Check if user has keys registered on mount
  useEffect(() => {
    const checkKeys = async () => {
      const token = localStorage.getItem('sv.jwt');
      if (!token) {
        setIsCheckingKeys(false);
        return;
      }

      try {
        const res = await get<KeysMeResponse>('/keys/me');
        if (res.ok) {
          setNeedsKeySetup(!hasRegisteredKeys(res.body));
        } else if (res.status === 401) {
          // Not authenticated, will be handled by login flow
          setNeedsKeySetup(false);
        }
      } catch (err) {
        console.error('Failed to check keys:', err);
      } finally {
        setIsCheckingKeys(false);
      }
    };

    checkKeys();
  }, []);

  const lock = useCallback(() => {
    keysRef.current = null;
    setVaults([]);
    setCurrentVaultId(null);
    setCanUndoLastImport(false);
    lastImportRef.current = null;

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

  const resetKeys = useCallback(async (adPassword: string): Promise<boolean> => {
    const res = await post<{ ok?: boolean }>('/keys/reset', { password: adPassword });
    if (!res.ok || !res.body?.ok) return false;
    lock();
    setNeedsKeySetup(true);
    return true;
  }, [lock]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    
    setState(prev => ({ ...prev, lastActivity: new Date() }));
    
    inactivityTimer.current = setTimeout(() => {
      lock();
    }, INACTIVITY_TIMEOUT);
  }, [lock]);

  // 'error' means the server could not answer; never treat that as "no keys",
  // or the user is pushed to set up a new master password and overwrite their keys.
  const checkKeysRegistered = useCallback(async (): Promise<'yes' | 'no' | 'error'> => {
    try {
      const res = await get<KeysMeResponse>('/keys/me');
      if (!res.ok) return 'error';
      return hasRegisteredKeys(res.body) ? 'yes' : 'no';
    } catch {
      return 'error';
    }
  }, []);

  const getPersonalVaultId = useCallback((): string | null => {
    const personal = vaults.find(isOwnPrimary);
    return personal?.id ?? currentVaultId;
  }, [currentVaultId, vaults]);

  const getVaultIdForTeamId = useCallback(
    (teamId: string): string | null => {
      const teamVault = vaults.find((v) => v.kind === 'team' && v.team_id === teamId);
      return teamVault?.id ?? null;
    },
    [vaults]
  );

  const getVaultRecordById = useCallback(
    (vaultId: string): VaultRecord | null => {
      return vaults.find((v) => v.id === vaultId) ?? null;
    },
    [vaults]
  );

  const getVaultKeyByVaultId = useCallback((vaultId: string): Uint8Array | null => {
    const keys = keysRef.current;
    if (!keys) return null;
    const existing = keys.vaultKeys.get(vaultId);
    if (existing) return existing;
    const record = getVaultRecordById(vaultId);
    if (!record) return null;
    const setKey = (key: Uint8Array) => {
      keys.vaultKeys.set(vaultId, key);
    };
    void openSealed(
      record.vault_key_wrapped_for_user,
      keys.privateKeys.enc_pk_b64,
      keys.privateKeys.enc_sk_b64
    )
      .then((key) => setKey(key))
      .catch(() => {});
    return null;
  }, [getVaultRecordById]);

  const getPermissionsForTeamId = useCallback((teamId: string): 'read' | 'write' | null => {
    const v = vaults.find((rec) => rec.kind === 'team' && rec.team_id === teamId);
    return v?.permissions ?? null;
  }, [vaults]);


  const filterEntriesForVault = useCallback(
    (vault: VaultRecord | null, entries: PasswordEntry[]): PasswordEntry[] => {
      if (!vault) return entries;
      if (vault.kind === 'team') {
        const teamId = vault.team_id;
        if (!teamId) return [];
        return entries.filter((e) => e.teamId === teamId);
      }
      return entries.filter((e) => !e.teamId);
    },
    []
  );

  const filterFoldersForVault = useCallback(
    (vault: VaultRecord | null, folders: Folder[]): Folder[] => {
      if (!vault) return folders;
      if (vault.kind === 'team') {
        const teamId = vault.team_id;
        if (!teamId) return [];
        return folders.filter((f) => f.teamId === teamId);
      }
      return folders.filter((f) => !f.teamId);
    },
    []
  );

  const fetchAndDecryptVaults = async (keys: VaultKeys): Promise<{
    entries: PasswordEntry[];
    folders: Folder[];
    vaultId: string | null;
  }> => {
    const res = await get<{ items: VaultRecord[] }>('/vaults');
    if (!res.ok || !res.body?.items) {
      return { entries: [], folders: [], vaultId: null };
    }

    let vaultRecords = res.body.items;
    setVaults(vaultRecords);

    if (!vaultRecords.some(isOwnPrimary)) {
      const vaultKey = crypto.getRandomValues(new Uint8Array(32));
      const wrapped = await sealToRecipient(keys.privateKeys.enc_pk_b64, vaultKey);
      const createRes = await post<CreateVaultResponse>('/vaults', {
        kind: 'personal',
        version: 1,
        vault_key_wrapped: wrapped,
      });
      const id = createRes.body?.id;
      if (!createRes.ok || typeof id !== 'string') {
        return { entries: [], folders: [], vaultId: null };
      }
      const ownPrimary: VaultRecord = {
        id,
        kind: 'personal',
        team_id: null,
        vault_key_wrapped_for_user: wrapped,
        version: 1,
        is_own_primary: 1,
      };
      keys.vaultKeys.set(id, vaultKey);
      if (vaultRecords.length === 0) {
        setVaults([ownPrimary]);
        return { entries: [], folders: [], vaultId: id };
      }
      vaultRecords = [ownPrimary, ...vaultRecords];
      setVaults(vaultRecords);
    }

    // Decrypt vault keys and fetch blobs for each vault
    const entriesById = new Map<string, { entry: PasswordEntry; sourceKind: VaultRecord['kind'] }>();
    const foldersById = new Map<string, { folder: Folder; sourceKind: VaultRecord['kind'] }>();
    let primaryVaultId: string | null = null;

    for (const vault of vaultRecords) {
      try {
        // Decrypt the vault key using user's private encryption key
        const vaultKey = await openSealed(
          vault.vault_key_wrapped_for_user,
          keys.privateKeys.enc_pk_b64,
          keys.privateKeys.enc_sk_b64
        );
        keys.vaultKeys.set(vault.id, vaultKey);

        if (!primaryVaultId && isOwnPrimary(vault)) {
          primaryVaultId = vault.id;
        }

        // Fetch the latest blob (vault snapshot)
        const blobsRes = await get<{ items: { id: string; blob_type: string }[] }>(
          `/vaults/${vault.id}/blobs`
        );
        
        if (!blobsRes.ok || !blobsRes.body?.items?.length) {
          continue;
        }

        // Find the latest snapshot blob
        const snapshotBlob =
          blobsRes.body.items.find((b) => b.blob_type === 'snapshot') ||
          blobsRes.body.items.find((b) => b.blob_type === 'vault_snapshot');
        if (!snapshotBlob) continue;

        // Download and decrypt the blob
        const blobData = await getBinary(`/vaults/${vault.id}/blobs/${snapshotBlob.id}`);
        if (!blobData.ok) continue;

        const encryptedSnapshot = deserializeEncryptedSnapshot(blobData.data);
        const snapshot = await decryptVaultSnapshot(vaultKey, encryptedSnapshot);

        for (const entry of snapshot.entries) {
          const effectiveTeamId = vault.kind === 'team' ? vault.team_id ?? entry.teamId : entry.teamId;
          const mapped: PasswordEntry = {
            id: entry.id,
            title: entry.title,
            username: entry.username,
            password: entry.password,
            url: entry.url,
            notes: entry.notes,
            folderId: entry.folderId,
            teamId: effectiveTeamId ?? undefined,
            createdAt: new Date(entry.createdAt),
            updatedAt: new Date(entry.updatedAt),
            favorite: entry.favorite,
            createdBy: entry.createdBy,
          };

          const existing = entriesById.get(mapped.id);
          if (!existing) {
            entriesById.set(mapped.id, { entry: mapped, sourceKind: vault.kind });
          } else if (existing.sourceKind === 'personal' && vault.kind === 'team') {
            entriesById.set(mapped.id, { entry: mapped, sourceKind: vault.kind });
          }
        }

        for (const folder of snapshot.folders) {
          const effectiveTeamId = vault.kind === 'team' ? vault.team_id ?? folder.teamId : folder.teamId;
          const mapped: Folder = {
            id: folder.id,
            name: folder.name,
            icon: folder.icon,
            parentId: folder.parentId,
            teamId: effectiveTeamId ?? undefined,
          };

          const existing = foldersById.get(mapped.id);
          if (!existing) {
            foldersById.set(mapped.id, { folder: mapped, sourceKind: vault.kind });
          } else if (existing.sourceKind === 'personal' && vault.kind === 'team') {
            foldersById.set(mapped.id, { folder: mapped, sourceKind: vault.kind });
          }
        }
      } catch (err) {
        console.error(`Failed to decrypt vault ${vault.id}:`, err);
      }
    }

    const entries = Array.from(entriesById.values()).map((v) => v.entry);
    const folders = Array.from(foldersById.values()).map((v) => v.folder);

    return { entries, folders, vaultId: primaryVaultId || vaultRecords[0]?.id || null };
  };

  const saveVaultSnapshotForVault = useCallback(async (vaultId: string, entries: PasswordEntry[], folders: Folder[]) => {
    if (!keysRef.current) return;

    let vaultKey = getVaultKeyByVaultId(vaultId);
    if (!vaultKey) {
      let record = getVaultRecordById(vaultId);
      if (!record) {
        const res = await get<{ items: VaultRecord[] }>("/vaults");
        if (!res.ok || !res.body?.items) {
          console.error('Snapshot save failed: vaults fetch error', { status: res.status, ok: res.ok });
          return;
        }
        setVaults(res.body.items);
        record = res.body.items.find((v) => v.id === vaultId) ?? null;
        if (!record) {
          console.error('Snapshot save failed: vault record not found', { vaultId });
          return;
        }
      }
      const keys = keysRef.current;
      try {
        const derived = await openSealed(
          record.vault_key_wrapped_for_user,
          keys.privateKeys.enc_pk_b64,
          keys.privateKeys.enc_sk_b64
        );
        if (!derived || derived.length === 0) {
          console.error('Snapshot save failed: derived key empty', {
            vaultId,
            wrappedLen: record.vault_key_wrapped_for_user.length,
          });
          return;
        }
        keys.vaultKeys.set(vaultId, derived);
        vaultKey = derived;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const pk = keys.privateKeys.enc_pk_b64;
        console.error('Snapshot save failed: key derivation error', {
          vaultId,
          error: errMsg,
          userPublicKeyLength: pk.length,
          wrappedLen: record.vault_key_wrapped_for_user.length,
          kind: getVaultRecordById(vaultId)?.kind,
          teamId: getVaultRecordById(vaultId)?.team_id,
        });
        if (errMsg.includes('incorrect key pair')) {
          const rec = getVaultRecordById(vaultId);
          if (rec?.kind === 'team' && rec.team_id) {
            try {
              const accept = await post<{ ok?: boolean }>(`/teams/${rec.team_id}/accept`, {});
              if (accept.ok && accept.body?.ok) {
                const refresh = await get<{ items: VaultRecord[] }>("/vaults");
                if (refresh.ok && refresh.body?.items) {
                  setVaults(refresh.body.items);
                  const updated = refresh.body.items.find((v) => v.id === vaultId) ?? null;
                  if (updated) {
                    const retried = await openSealed(
                      updated.vault_key_wrapped_for_user,
                      keys.privateKeys.enc_pk_b64,
                      keys.privateKeys.enc_sk_b64
                    );
                    if (retried && retried.length > 0) {
                      keys.vaultKeys.set(vaultId, retried);
                      vaultKey = retried;
                    } else {
                      toast.error('Still cannot access team vault. Ask an owner/admin to re-invite you to refresh encryption keys.');
                      return;
                    }
                  } else {
                    toast.error('Team vault record missing after accepting invite.');
                    return;
                  }
                } else {
                  toast.error('Failed to refresh vaults after accepting invite.');
                  return;
                }
              } else {
                toast.error('Invite acceptance failed or not pending. Ask an owner/admin to re-invite you.');
                return;
              }
            } catch {
              toast.error('Automatic invite acceptance failed. Ask an owner/admin to re-invite you.');
              return;
            }
          } else {
            toast.error('Your team access is out of date. Ask an owner/admin to re-invite you, or leave and accept a new invite to refresh your encryption keys.');
            return;
          }
        } else {
          return;
        }
      }
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
      blob_type: 'snapshot',
      content_sha256: hashHex,
      size_bytes: bytes.length,
      key_version: getVaultRecordById(vaultId)?.key_version ?? 1,
    }));
    form.append('file', new Blob([bytesBuffer], { type: 'application/octet-stream' }));

    const res = await postForm<{ id?: string; error?: string }>(`/vaults/${vaultId}/blobs`, form);
    if (!res.ok) {
      console.error('Failed to save vault snapshot:', res.status, res.body);
      const err = (() => {
        if (typeof res.body !== 'object' || res.body === null) return undefined;
        const r = res.body as Record<string, unknown>;
        const e = r.error;
        return typeof e === 'string' ? e : undefined;
      })();
      if (res.status === 409 && err === 'stale_vault_key') {
        // The vault key was rotated elsewhere; drop the cached key so the next refresh re-derives it.
        keysRef.current?.vaultKeys.delete(vaultId);
        toast.error('This vault was re-keyed by its owner. Refresh, then repeat your last change.');
        return;
      }
      toast.error(`Failed to save changes (${res.status}${err ? `: ${err}` : ''})`);
    }
  }, [getVaultKeyByVaultId, getVaultRecordById]);

  const saveAllVaultSnapshots = useCallback(
    async (entries: PasswordEntry[], folders: Folder[]) => {
      const vaultIds = vaults.map((v) => v.id);
      const fallbackId = currentVaultId;
      const ids = vaultIds.length ? vaultIds : fallbackId ? [fallbackId] : [];
      await Promise.all(
        ids.map(async (vaultId) => {
          const record = getVaultRecordById(vaultId);
          const entriesForVault = filterEntriesForVault(record, entries);
          const foldersForVault = filterFoldersForVault(record, folders);
          await saveVaultSnapshotForVault(vaultId, entriesForVault, foldersForVault);
        })
      );
    },
    [currentVaultId, filterEntriesForVault, filterFoldersForVault, getVaultRecordById, saveVaultSnapshotForVault, vaults]
  );

  const saveVaultSnapshotForSingleVault = useCallback(
    async (vaultId: string, entries: PasswordEntry[], folders: Folder[]) => {
      const record = getVaultRecordById(vaultId);
      const entriesForVault = filterEntriesForVault(record, entries);
      const foldersForVault = filterFoldersForVault(record, folders);
      await saveVaultSnapshotForVault(vaultId, entriesForVault, foldersForVault);
    },
    [filterEntriesForVault, filterFoldersForVault, getVaultRecordById, saveVaultSnapshotForVault]
  );

  const undoLastImport = useCallback(() => {
    const last = lastImportRef.current;
    if (!last) return;

    setState((prev) => {
      const importedEntryIds = new Set(last.entryIds);
      const importedFolderIds = new Set(last.folderIds);

      const entries = prev.entries
        .filter((e) => !importedEntryIds.has(e.id))
        .map((e) =>
          e.folderId && importedFolderIds.has(e.folderId) ? { ...e, folderId: undefined } : e
        );

      const folders = prev.folders.filter((f) => !importedFolderIds.has(f.id));
      const next = { ...prev, entries, folders };
      void saveAllVaultSnapshots(next.entries, next.folders);
      return next;
    });

    setCanUndoLastImport(false);
    lastImportRef.current = null;
    resetInactivityTimer();
  }, [resetInactivityTimer, saveAllVaultSnapshots, currentVaultId]);

  const addFolder = useCallback(
    async (name: string, parentId?: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const personalVaultId = getPersonalVaultId();
      if (!personalVaultId) return;

      const id = crypto.randomUUID();
      setState((prev) => {
        const next = {
          ...prev,
          folders: [...prev.folders, { id, name: trimmed, parentId }],
        };
        void saveVaultSnapshotForSingleVault(personalVaultId, next.entries, next.folders);
        void post('/audit/log', { action: 'folder_create', resource_type: 'folder', resource_id: id, details: { name_len: trimmed.length, parent_id: parentId || null } });
        return next;
      });
      resetInactivityTimer();
    },
    [getPersonalVaultId, resetInactivityTimer, saveVaultSnapshotForSingleVault]
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      const personalVaultId = getPersonalVaultId();
      if (!personalVaultId) return;

      setState((prev) => {
        const childrenByParent = new Map<string, string[]>();
        for (const f of prev.folders) {
          if (f.teamId) continue;
          if (!f.parentId) continue;
          const arr = childrenByParent.get(f.parentId) || [];
          arr.push(f.id);
          childrenByParent.set(f.parentId, arr);
        }

        const toDelete = new Set<string>();
        const stack = [folderId];
        while (stack.length) {
          const id = stack.pop();
          if (!id || toDelete.has(id)) continue;
          toDelete.add(id);
          const kids = childrenByParent.get(id) || [];
          for (const k of kids) stack.push(k);
        }

      const folders = prev.folders.filter((f) => f.teamId || !toDelete.has(f.id));
      const entries = prev.entries.map((e) =>
        e.teamId || !e.folderId || !toDelete.has(e.folderId) ? e : { ...e, folderId: undefined }
      );

        const next = { ...prev, entries, folders };
        void saveVaultSnapshotForSingleVault(personalVaultId, next.entries, next.folders);
        void post('/audit/log', { action: 'folder_delete', resource_type: 'folder', resource_id: folderId, details: { cascade_count: toDelete.size } });
        return next;
      });
      resetInactivityTimer();
    },
    [getPersonalVaultId, resetInactivityTimer, saveVaultSnapshotForSingleVault]
  );

  const unlock = useCallback(async (masterPassword: string): Promise<boolean> => {
    try {
      // First check if user has keys registered
      const hasKeys = await checkKeysRegistered();
      if (hasKeys === 'error') {
        console.error('Server unavailable while checking keys');
        return false;
      }
      if (hasKeys === 'no') {
        setNeedsKeySetup(true);
        return false;
      }

      // Fetch encrypted private key from server
      const keysRes = await get<KeysMeResponse>('/keys/me');
      const encryptedPrivateKeyJson = keysRes.body?.encrypted_private_key;
      if (!keysRes.ok || !encryptedPrivateKeyJson) {
        console.error('Failed to fetch private keys');
        return false;
      }

      const encryptedPrivateKey = parseEncryptedPrivateKeys(encryptedPrivateKeyJson);
      if (!encryptedPrivateKey) {
        console.error('Invalid encrypted private key format');
        return false;
      }

      // Decrypt private keys with master password
      const privateKeys = await decryptPrivateKeys(masterPassword, encryptedPrivateKey);
      
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
  }, [checkKeysRegistered, resetInactivityTimer]);

  const addEntry = useCallback(async (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newEntry: PasswordEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const targetVaultId = newEntry.teamId ? getVaultIdForTeamId(newEntry.teamId) : getPersonalVaultId();
    if (!targetVaultId) return;
    
    setState(prev => {
      const newState = {
        ...prev,
        entries: [...prev.entries, newEntry],
      };
      void saveVaultSnapshotForSingleVault(targetVaultId, newState.entries, newState.folders);
      void post('/audit/log', { action: 'entry_create', resource_type: 'entry', resource_id: newEntry.id, details: { has_url: !!newEntry.url, title_len: newEntry.title.length, username_len: newEntry.username.length, team_id: newEntry.teamId || null, folder_id: newEntry.folderId || null } });
      return newState;
    });
    resetInactivityTimer();
  }, [getPersonalVaultId, getVaultIdForTeamId, resetInactivityTimer, saveVaultSnapshotForSingleVault]);

  const updateEntry = useCallback(async (id: string, updates: Partial<PasswordEntry>) => {
    const personalVaultId = getPersonalVaultId();
    if (!personalVaultId) return;

    setState(prev => {
      const existing = prev.entries.find((e) => e.id === id);
      if (!existing) return prev;

      const updated: PasswordEntry = { ...existing, ...updates, updatedAt: new Date() };

      const oldVaultId = existing.teamId ? getVaultIdForTeamId(existing.teamId) : personalVaultId;
      const newVaultId = updated.teamId ? getVaultIdForTeamId(updated.teamId) : personalVaultId;
      const ids = [oldVaultId, newVaultId].filter((v): v is string => typeof v === 'string');
      const saveVaultIds = Array.from(new Set(ids));

      const newEntries = prev.entries.map((entry) => (entry.id === id ? updated : entry));
      const newState = { ...prev, entries: newEntries };
      void Promise.all(
        saveVaultIds.map((vaultId) => saveVaultSnapshotForSingleVault(vaultId, newState.entries, newState.folders))
      );
      void post('/audit/log', { action: 'entry_update', resource_type: 'entry', resource_id: id, details: { moved_team: existing.teamId !== updated.teamId, moved_folder: existing.folderId !== updated.folderId } });
      return newState;
    });
    resetInactivityTimer();
  }, [getPersonalVaultId, getVaultIdForTeamId, resetInactivityTimer, saveVaultSnapshotForSingleVault]);

  const deleteEntry = useCallback(async (id: string) => {
    const personalVaultId = getPersonalVaultId();
    if (!personalVaultId) return;

    setState(prev => {
      const existing = prev.entries.find((e) => e.id === id);
      if (!existing) return prev;

      const saveVaultId = existing.teamId ? getVaultIdForTeamId(existing.teamId) : personalVaultId;

      const newEntries = prev.entries.filter(entry => entry.id !== id);
      const newState = { ...prev, entries: newEntries };
      if (saveVaultId) {
        void saveVaultSnapshotForSingleVault(saveVaultId, newState.entries, newState.folders);
      }
      void post('/audit/log', { action: 'entry_delete', resource_type: 'entry', resource_id: id, details: { team_id: existing.teamId || null } });
      return newState;
    });
    resetInactivityTimer();
  }, [getPersonalVaultId, getVaultIdForTeamId, resetInactivityTimer, saveVaultSnapshotForSingleVault]);

  const toggleFavorite = useCallback(async (id: string) => {
    const personalVaultId = getPersonalVaultId();
    if (!personalVaultId) return;

    setState(prev => {
      const existing = prev.entries.find((e) => e.id === id);
      if (!existing) return prev;

      const saveVaultId = existing.teamId ? getVaultIdForTeamId(existing.teamId) : personalVaultId;
      const updated: PasswordEntry = { ...existing, favorite: !existing.favorite, updatedAt: new Date() };
      const newEntries = prev.entries.map((entry) => (entry.id === id ? updated : entry));
      const newState = { ...prev, entries: newEntries };
      if (saveVaultId) {
        void saveVaultSnapshotForSingleVault(saveVaultId, newState.entries, newState.folders);
      }
      void post('/audit/log', { action: 'entry_favorite', resource_type: 'entry', resource_id: id, details: { favorite: updated.favorite } });
      return newState;
    });
    resetInactivityTimer();
  }, [getPersonalVaultId, getVaultIdForTeamId, resetInactivityTimer, saveVaultSnapshotForSingleVault]);

  const importEntries = useCallback(async (
    newEntries: KdbxImportedEntry[],
    newFolders: KdbxImportedFolder[],
    meta?: { filename?: string }
  ) => {
    const folderIdMap = new Map<string, string>();
    for (const folder of newFolders) {
      folderIdMap.set(folder.sourceId, crypto.randomUUID());
    }

    const foldersWithIds: Folder[] = newFolders.map((folder) => {
      const id = folderIdMap.get(folder.sourceId) || crypto.randomUUID();
      const parentId = folder.parentSourceId ? folderIdMap.get(folder.parentSourceId) : undefined;
      return {
        id,
        name: folder.name,
        icon: folder.icon,
        parentId,
        teamId: folder.teamId,
      };
    });

    // Add entries with generated IDs
    const entriesWithIds: PasswordEntry[] = newEntries.map(entry => ({
      title: entry.title,
      username: entry.username,
      password: entry.password,
      url: entry.url,
      notes: entry.notes,
      favorite: entry.favorite,
      teamId: entry.teamId,
      folderId: entry.folderSourceId ? folderIdMap.get(entry.folderSourceId) : undefined,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const importedEntryIds = entriesWithIds.map((e) => e.id);
    const importedFolderIds = foldersWithIds.map((f) => f.id);

    lastImportRef.current = { entryIds: importedEntryIds, folderIds: importedFolderIds };
    setCanUndoLastImport(true);

    setState(prev => {
      const newState = {
        ...prev,
        entries: [...prev.entries, ...entriesWithIds],
        folders: [...prev.folders, ...foldersWithIds],
      };
      void saveAllVaultSnapshots(newState.entries, newState.folders);
      void post('/audit/log', { action: 'import_kdbx', resource_type: 'vault', resource_id: currentVaultId, details: { entries: entriesWithIds.length, folders: foldersWithIds.length, filename: meta?.filename || null } });
      return newState;
    });
    resetInactivityTimer();
  }, [resetInactivityTimer, saveAllVaultSnapshots]);

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

  const refresh = useCallback(async (): Promise<boolean> => {
    const keys = keysRef.current;
    if (!keys) return false;
    const { entries, folders, vaultId } = await fetchAndDecryptVaults(keys);
    setCurrentVaultId((prev) => prev ?? vaultId);
    setState(prev => ({ ...prev, entries, folders, lastActivity: new Date() }));
    resetInactivityTimer();
    return true;
  }, [resetInactivityTimer]);

  type VaultShareItem = {
    id: string;
    target_user_id: string | null;
    target_team_id: string | null;
    permissions: 'read' | 'write';
    created_at: string;
    display_name?: string | null;
    email?: string | null;
  };

  const listVaultShares = useCallback(async (vaultId: string): Promise<VaultShareItem[] | null> => {
    const res = await get<{ items: VaultShareItem[] }>(`/shares/vault/${vaultId}`);
    return res.ok && res.body?.items ? res.body.items : null;
  }, []);

  /**
   * Re-key a vault the caller owns: decrypt the latest snapshot with the old key,
   * encrypt it with a fresh key, and wrap that key for the owner and every
   * remaining share. Anyone who held the old key loses access to new data.
   */
  const rotateVaultKey = useCallback(async (vaultId: string): Promise<boolean> => {
    const keys = keysRef.current;
    if (!keys) return false;
    const vaultsRes = await get<{ items: VaultRecord[] }>('/vaults');
    const record = vaultsRes.body?.items?.find((v) => v.id === vaultId);
    if (!vaultsRes.ok || !record) {
      toast.error('Rotation failed: vault not found');
      return false;
    }
    const oldKey = await openSealed(record.vault_key_wrapped_for_user, keys.privateKeys.enc_pk_b64, keys.privateKeys.enc_sk_b64);

    let snapshot: VaultSnapshotV1 = { v: 1, entries: [], folders: [] };
    const blobsRes = await get<{ items: { id: string; blob_type: string }[] }>(`/vaults/${vaultId}/blobs`);
    const latest = blobsRes.body?.items?.find((b) => b.blob_type === 'snapshot');
    if (latest) {
      const data = await getBinary(`/vaults/${vaultId}/blobs/${latest.id}`);
      if (!data.ok) {
        toast.error('Rotation failed: could not read the current snapshot');
        return false;
      }
      snapshot = await decryptVaultSnapshot(oldKey, deserializeEncryptedSnapshot(data.data));
    }

    const shares = await listVaultShares(vaultId);
    if (!shares) {
      toast.error('Rotation failed: could not list shares');
      return false;
    }
    const newKey = crypto.getRandomValues(new Uint8Array(32));
    const rewrapped: { share_id: string; wrapped_key: string }[] = [];
    for (const s of shares) {
      if (!s.target_user_id) {
        toast.error('Rotation failed: a team share must be removed first');
        return false;
      }
      const pkRes = await get<{ public_enc_key?: string | null }>(`/users/${s.target_user_id}/public-keys`);
      const pk = pkRes.body?.public_enc_key;
      if (!pkRes.ok || !pk) {
        toast.error(`Rotation failed: ${s.display_name || s.email || 'a recipient'} has no encryption keys`);
        return false;
      }
      rewrapped.push({ share_id: s.id, wrapped_key: await sealToRecipient(pk, newKey) });
    }

    const encrypted = await encryptVaultSnapshot(newKey, snapshot);
    const bytes = serializeEncryptedSnapshot(encrypted);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
    const form = new FormData();
    form.append('meta', JSON.stringify({
      expected_key_version: record.key_version ?? 1,
      vault_key_wrapped: await sealToRecipient(keys.privateKeys.enc_pk_b64, newKey),
      shares: rewrapped,
      content_sha256: Array.from(hash).map((b) => b.toString(16).padStart(2, '0')).join(''),
      size_bytes: bytes.length,
    }));
    form.append('file', new Blob([buffer], { type: 'application/octet-stream' }));
    const res = await postForm<{ ok?: boolean; error?: string }>(`/vaults/${vaultId}/rotate-key`, form);
    if (!res.ok || !res.body?.ok) {
      const reason = res.body?.error === 'shares_changed' || res.body?.error === 'stale_key_version'
        ? 'the vault changed meanwhile, please try again'
        : `server error ${res.status}`;
      toast.error(`Rotation failed: ${reason}`);
      return false;
    }
    keys.vaultKeys.set(vaultId, newKey);
    await refresh();
    return true;
  }, [listVaultShares, refresh]);

  type SnapshotHistoryItem = {
    id: string;
    created_at: string;
    created_by_name?: string | null;
    size_bytes?: number;
  };

  const listVaultHistory = useCallback(async (vaultId: string): Promise<SnapshotHistoryItem[] | null> => {
    const res = await get<{ items: (SnapshotHistoryItem & { blob_type: string })[] }>(`/vaults/${vaultId}/blobs`);
    if (!res.ok || !res.body?.items) return null;
    return res.body.items.filter((b) => b.blob_type === 'snapshot');
  }, []);

  /** Decrypt one historical snapshot with the vault's current key; null if it was encrypted with an older key. */
  const loadSnapshot = useCallback(async (vaultId: string, blobId: string): Promise<VaultSnapshotV1 | null> => {
    const keys = keysRef.current;
    if (!keys) return null;
    let vaultKey = keys.vaultKeys.get(vaultId) ?? null;
    if (!vaultKey) {
      const record = vaults.find((v) => v.id === vaultId);
      if (!record) return null;
      vaultKey = await openSealed(record.vault_key_wrapped_for_user, keys.privateKeys.enc_pk_b64, keys.privateKeys.enc_sk_b64);
      keys.vaultKeys.set(vaultId, vaultKey);
    }
    const data = await getBinary(`/vaults/${vaultId}/blobs/${blobId}`);
    if (!data.ok) return null;
    try {
      return await decryptVaultSnapshot(vaultKey, deserializeEncryptedSnapshot(data.data));
    } catch {
      return null; // written before a key rotation
    }
  }, [vaults]);

  /**
   * Restore = upload the chosen snapshot again as the newest version. Nothing is
   * deleted: the version being replaced stays in the history.
   */
  const restoreSnapshot = useCallback(async (vaultId: string, blobId: string): Promise<boolean> => {
    const keys = keysRef.current;
    const snapshot = await loadSnapshot(vaultId, blobId);
    const vaultKey = keys?.vaultKeys.get(vaultId);
    if (!keys || !snapshot || !vaultKey) {
      toast.error('This version cannot be restored (it may predate a key rotation).');
      return false;
    }
    const encrypted = await encryptVaultSnapshot(vaultKey, snapshot);
    const bytes = serializeEncryptedSnapshot(encrypted);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
    const form = new FormData();
    form.append('meta', JSON.stringify({
      blob_type: 'snapshot',
      content_sha256: Array.from(hash).map((b) => b.toString(16).padStart(2, '0')).join(''),
      size_bytes: bytes.length,
      key_version: vaults.find((v) => v.id === vaultId)?.key_version ?? 1,
    }));
    form.append('file', new Blob([buffer], { type: 'application/octet-stream' }));
    const res = await postForm<{ id?: string; error?: string }>(`/vaults/${vaultId}/blobs`, form);
    if (!res.ok) {
      toast.error(`Restore failed (${res.status}${res.body?.error ? `: ${res.body.error}` : ''})`);
      return false;
    }
    void post('/audit/log', { action: 'vault_restore', resource_type: 'vault', resource_id: vaultId, details: { from_blob_id: blobId } });
    await refresh();
    return true;
  }, [loadSnapshot, refresh, vaults]);

  /** Revoke one share, then re-key the vault so the revoked user's copy of the key is useless. */
  const revokeShare = useCallback(async (vaultId: string, shareId: string): Promise<boolean> => {
    const res = await del<{ ok?: boolean }>(`/shares/${shareId}`);
    if (!res.ok || !res.body?.ok) {
      toast.error('Failed to revoke access');
      return false;
    }
    const rotated = await rotateVaultKey(vaultId);
    if (!rotated) {
      toast.error('Access was revoked, but the vault key was not rotated. Use "Rotate key" to finish.');
    }
    return rotated;
  }, [rotateVaultKey]);

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
    isCheckingKeys,
    canUndoLastImport,
    currentVaultId,
    vaults,
    unlock,
    lock,
    refresh,
    resetKeys,
    listVaultShares,
    rotateVaultKey,
    revokeShare,
    listVaultHistory,
    loadSnapshot,
    restoreSnapshot,
    undoLastImport,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleFavorite,
    importEntries,
    addFolder,
    deleteFolder,
    getPersonalEntries,
    getTeamEntries,
    getPersonalFolders,
    getTeamFolders,
    getCurrentVaultKey,
    getVaultIdForTeamId,
    getVaultKeyByVaultId,
    getPermissionsForTeamId,
    onKeySetupComplete,
  };
}

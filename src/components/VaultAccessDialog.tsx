import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type OwnedVault = { id: string; label: string };

export type VaultShareItem = {
  id: string;
  target_user_id: string | null;
  target_team_id: string | null;
  permissions: 'read' | 'write';
  created_at: string;
  display_name?: string | null;
  email?: string | null;
};

interface VaultAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vaults the current user owns: their personal vault and any Copy-to-User copies. */
  ownedVaults: OwnedVault[];
  currentUserId: string | null;
  listVaultShares: (vaultId: string) => Promise<VaultShareItem[] | null>;
  revokeShare: (vaultId: string, shareId: string) => Promise<boolean>;
  rotateVaultKey: (vaultId: string) => Promise<boolean>;
}

type PendingAction =
  | { kind: 'revoke'; vaultId: string; share: VaultShareItem }
  | { kind: 'rotate'; vaultId: string; label: string };

/**
 * Shows who can open each vault the user owns. Revoking access also re-keys the
 * vault, because the removed person may still hold the old key.
 */
export function VaultAccessDialog({
  open,
  onOpenChange,
  ownedVaults,
  currentUserId,
  listVaultShares,
  revokeShare,
  rotateVaultKey,
}: VaultAccessDialogProps) {
  const [sharesByVault, setSharesByVault] = useState<Record<string, VaultShareItem[] | null>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const next: Record<string, VaultShareItem[] | null> = {};
    for (const v of ownedVaults) {
      next[v.id] = await listVaultShares(v.id);
    }
    setSharesByVault(next);
    setLoading(false);
  }, [ownedVaults, listVaultShares]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const isSelf = (s: VaultShareItem) =>
    !!currentUserId && !!s.target_user_id && s.target_user_id.toLowerCase() === currentUserId.toLowerCase();

  const runPending = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const ok =
        pending.kind === 'revoke'
          ? await revokeShare(pending.vaultId, pending.share.id)
          : await rotateVaultKey(pending.vaultId);
      if (ok) {
        toast.success(pending.kind === 'revoke' ? 'Access revoked and vault key rotated' : 'Vault key rotated');
      }
    } catch (err) {
      console.error('Vault access action failed', err);
      toast.error('Action failed. Nothing was changed if the vault key could not be rotated.');
    } finally {
      setBusy(false);
      setPending(null);
      void load();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vault access</DialogTitle>
            <DialogDescription>
              People who can open vaults you own. Revoking access also gives the vault a new key, so a copy of the old
              key becomes useless.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading access list…
            </div>
          ) : (
            <div className="space-y-5 max-h-[60vh] overflow-y-auto">
              {ownedVaults.map((v) => {
                const shares = sharesByVault[v.id];
                const others = (shares || []).filter((s) => !isSelf(s));
                return (
                  <div key={v.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{v.label}</div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => setPending({ kind: 'rotate', vaultId: v.id, label: v.label })}
                      >
                        <KeyRound className="h-4 w-4" /> Rotate key
                      </Button>
                    </div>
                    {shares === null ? (
                      <p className="text-sm text-destructive">Could not load the access list.</p>
                    ) : others.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Only you can open this vault.</p>
                    ) : (
                      <ul className="divide-y rounded-md border">
                        {others.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {s.display_name || s.email || (s.target_team_id ? 'Team' : 'Unknown user')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Since {new Date(s.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge variant={s.permissions === 'write' ? 'destructive' : 'secondary'}>
                                {s.permissions === 'write' ? 'Can edit' : 'Can view'}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => setPending({ kind: 'revoke', vaultId: v.id, share: s })}
                              >
                                <UserMinus className="h-4 w-4" /> Revoke
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && !busy && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === 'revoke' ? 'Revoke access?' : 'Rotate vault key?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === 'revoke'
                ? `${pending.share.display_name || pending.share.email || 'This user'} will no longer be able to open this vault. The vault gets a new key; everyone else keeps access.`
                : 'The vault gets a new key. Anyone who copied the old key can no longer read new changes. People with access keep it.'}
              {' '}Passwords they already saw stay known to them: change the important ones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void runPending();
              }}
            >
              {busy ? 'Working…' : pending?.kind === 'revoke' ? 'Revoke and rotate' : 'Rotate key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

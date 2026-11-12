import { useEffect, useMemo, useState } from 'react';
import { History, Loader2, RotateCcw } from 'lucide-react';
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
import type { VaultSnapshotV1 } from '@/lib/crypto/vault';

export type SnapshotHistoryItem = {
  id: string;
  created_at: string;
  created_by_name?: string | null;
  size_bytes?: number;
};

interface VaultHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultId: string | null;
  vaultLabel: string;
  canRestore: boolean;
  listVaultHistory: (vaultId: string) => Promise<SnapshotHistoryItem[] | null>;
  loadSnapshot: (vaultId: string, blobId: string) => Promise<VaultSnapshotV1 | null>;
  restoreSnapshot: (vaultId: string, blobId: string) => Promise<boolean>;
}

type Diff = { added: string[]; removed: string[]; passwordChanged: string[]; otherChanged: string[]; total: number };

// What restoring this version would change compared with what is shown now.
type SnapEntry = VaultSnapshotV1['entries'][number];
const diffAgainstCurrent = (snapshot: VaultSnapshotV1, current: SnapEntry[]): Diff => {
  const now = new Map(current.map((e) => [e.id, e]));
  const then = new Map(snapshot.entries.map((e) => [e.id, e]));
  const diff: Diff = { added: [], removed: [], passwordChanged: [], otherChanged: [], total: snapshot.entries.length };
  for (const [id, e] of then) {
    const cur = now.get(id);
    if (!cur) diff.added.push(e.title);
    else if (cur.password !== e.password) diff.passwordChanged.push(e.title);
    else if (cur.title !== e.title || cur.username !== e.username || (cur.url ?? '') !== (e.url ?? '') || (cur.notes ?? '') !== (e.notes ?? '')) {
      diff.otherChanged.push(e.title);
    }
  }
  for (const [id, e] of now) if (!then.has(id)) diff.removed.push(e.title);
  return diff;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const TitleList = ({ label, items, tone }: { label: string; items: string[]; tone?: 'danger' }) =>
  items.length === 0 ? null : (
    <div className="text-sm">
      <div className={tone === 'danger' ? 'font-medium text-destructive' : 'font-medium'}>
        {label} ({items.length})
      </div>
      <div className="text-muted-foreground">
        {items.slice(0, 8).join(', ')}
        {items.length > 8 ? `, and ${items.length - 8} more` : ''}
      </div>
    </div>
  );

/**
 * Lists saved versions of a vault, shows what restoring one would change (titles
 * only, never passwords), and restores it as a new version.
 */
export function VaultHistoryDialog({
  open,
  onOpenChange,
  vaultId,
  vaultLabel,
  canRestore,
  listVaultHistory,
  loadSnapshot,
  restoreSnapshot,
}: VaultHistoryDialogProps) {
  const [items, setItems] = useState<SnapshotHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SnapshotHistoryItem | null>(null);
  const [preview, setPreview] = useState<VaultSnapshotV1 | null | 'unreadable'>(null);
  const [latest, setLatest] = useState<VaultSnapshotV1 | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!open || !vaultId) return;
    setSelected(null);
    setPreview(null);
    setLatest(null);
    setLoading(true);
    void listVaultHistory(vaultId).then(async (r) => {
      setItems(r);
      if (r && r.length) setLatest(await loadSnapshot(vaultId, r[0].id));
      setLoading(false);
    });
  }, [open, vaultId, listVaultHistory, loadSnapshot]);

  const select = async (item: SnapshotHistoryItem) => {
    if (!vaultId) return;
    setSelected(item);
    setPreview(null);
    setPreviewLoading(true);
    const snap = await loadSnapshot(vaultId, item.id);
    setPreview(snap ?? 'unreadable');
    setPreviewLoading(false);
  };

  const diff = useMemo(
    () => (preview && preview !== 'unreadable' ? diffAgainstCurrent(preview, latest?.entries ?? []) : null),
    [preview, latest]
  );
  const isLatest = !!items?.length && selected?.id === items[0].id;

  const doRestore = async () => {
    if (!vaultId || !selected) return;
    setRestoring(true);
    const ok = await restoreSnapshot(vaultId, selected.id);
    setRestoring(false);
    setConfirming(false);
    if (ok) {
      toast.success(`Restored the version from ${fmt(selected.created_at)}`);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Version history · {vaultLabel}
            </DialogTitle>
            <DialogDescription>
              Every save keeps a version. Restoring adds the chosen version as the newest one; nothing is deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="max-h-[55vh] overflow-y-auto rounded-md border">
              {loading ? (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading versions…
                </div>
              ) : !items ? (
                <div className="p-4 text-sm text-destructive">Could not load the history.</div>
              ) : items.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No saved versions yet.</div>
              ) : (
                <ul className="divide-y">
                  {items.map((it, i) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => void select(it)}
                        className={`w-full px-3 py-2 text-left hover:bg-muted ${selected?.id === it.id ? 'bg-muted' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2 text-sm font-medium">
                          {fmt(it.created_at)}
                          {i === 0 ? <Badge variant="secondary">Current</Badge> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">by {it.created_by_name || 'unknown'}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3 rounded-md border p-3">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Select a version to see what restoring it would change.</p>
              ) : previewLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Decrypting…
                </div>
              ) : preview === 'unreadable' ? (
                <p className="text-sm text-muted-foreground">
                  This version was saved before the vault key was rotated and cannot be opened with the current key.
                </p>
              ) : diff ? (
                <>
                  <div className="text-sm">
                    <span className="font-medium">{diff.total} entries</span>
                    <span className="text-muted-foreground"> · saved {fmt(selected.created_at)} by {selected.created_by_name || 'unknown'}</span>
                  </div>
                  {isLatest ? (
                    <p className="text-sm text-muted-foreground">This is the current version.</p>
                  ) : diff.added.length + diff.removed.length + diff.passwordChanged.length + diff.otherChanged.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Same entries as now.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Restoring would</div>
                      <TitleList label="Bring back" items={diff.added} />
                      <TitleList label="Remove" items={diff.removed} tone="danger" />
                      <TitleList label="Change the password of" items={diff.passwordChanged} tone="danger" />
                      <TitleList label="Change other details of" items={diff.otherChanged} />
                    </div>
                  )}
                  {canRestore && !isLatest ? (
                    <Button variant="outline" onClick={() => setConfirming(true)}>
                      <RotateCcw className="h-4 w-4" /> Restore this version
                    </Button>
                  ) : null}
                  {!canRestore ? (
                    <p className="text-xs text-muted-foreground">You have view-only access to this vault.</p>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={(o) => !o && !restoring && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              The vault will show the {diff?.total ?? 0} entries saved on {selected ? fmt(selected.created_at) : ''}.
              The current version stays in the history, so this can be undone the same way.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoring}
              onClick={(e) => {
                e.preventDefault();
                void doRestore();
              }}
            >
              {restoring ? 'Restoring…' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

# Offline Mode Implementation Plan

## Decisions and Scope
- Personal vault: editable offline; queue ops and reconcile on reconnect.
- Team vault: view-only offline; block invites, role changes, member actions.
- Conflict handling: stricter conflict dialog instead of silent last-write-wins.
- Attachments: defer offline buffering support for now; revisit later.
- Compliance: persist offline audit logs within 10 minutes of reconnect (configurable).

## High-Level UX Flow
- Detect offline and show an Offline banner with pending changes count.
- Personal vault remains fully usable; edits apply locally and enqueue operations.
- Team vault renders read-only; actions that require server are disabled with messaging.
- On reconnect: background sync applies queued operations, surfaces conflicts with a dialog.
- After sync: clear pending queue; post local audit logs to server and mark them confirmed.

## Component Tree (Web: Shadcn UI + Tailwind)
- App
  - Header
    - SyncStatusBadge
  - OfflineBanner
  - VaultDashboard
    - VaultSidebar
    - Content
      - PasswordEntry list
      - ConflictDialog

## Component Tree (Mobile: React Native Paper/Tamagui)
- App
  - AppBar with Badge
  - Offline Banner
  - Tabs: Vault | Activity | Settings
  - ConflictDialog

## Responsive Layout Guidelines
- Banner and header:
  <div className="grid grid-cols-12 gap-4">
    <div className="col-span-12 md:col-span-8">...</div>
    <div className="col-span-12 md:col-span-4">...</div>
  </div>
- Tailwind states for banner:
  <div className="w-full border border-yellow-300 bg-yellow-50 dark:bg-yellow-950 px-4 py-3 rounded-md flex items-center justify-between">
    <span className="text-sm">Offline. Changes will sync on reconnect.</span>
    <div className="flex gap-2">
      <button className="btn btn-outline btn-sm">Retry</button>
      <span className="text-xs text-muted-foreground">3 pending</span>
    </div>
  </div>

## Accessibility (WCAG 2.1)
- OfflineBanner uses role="status" with clear contrast and text.
- ConflictDialog supports keyboard navigation, focus trap, and descriptive labels.
- Screen-reader friendly labels for disabled actions indicating “offline” reasons.

## Data Storage (IndexedDB + localStorage)
- IndexedDB stores encrypted snapshots and operation queue.
  - stores:
    - snapshots: { vaultId, blobType: "snapshot", encryptedBlob, ts }
    - ops: { id, kind, vaultId, entryId?, folderId?, payload?, ts }
    - meta: { key: string, value: string }
- localStorage stores lightweight metadata (e.g., pending count) and JWT.
- Only encrypted payloads are stored; keys remain in memory or are sealed.

## Operation Model
- Operation kinds: entry_add, entry_update, entry_delete, folder_add, folder_delete.
- Each operation includes client timestamp and IDs for reconciliation.
- Queue applies optimistically to UI and persists in IndexedDB when offline.

## Sync and Reconciliation
- On reconnect:
  - Fetch latest server snapshot for personal vault.
  - Submit queued operations via POST /sync/deltas.
  - If server version conflicts with local changes, open ConflictDialog.
  - Choices: Keep mine, Keep remote, Merge notes (for notes field).
  - Apply choice locally, resubmit if needed, then mark operation resolved.
- Tombstones represent deletions to avoid reappearing entries after merge.

## API Endpoints (Backend: Fastify)
- GET /vaults/:id/snapshot: returns latest encrypted snapshot for rebase.
- POST /sync/deltas: accepts batch operations, returns per-op status and conflicts.
- Existing SSE: GET /sync/events continues to stream updates post-reconnect.

## Sample Web Hooks and Components (React + Tailwind)
- Offline detection and queue management (types avoid any):
  ```typescript
  type OperationKind = "entry_add" | "entry_update" | "entry_delete" | "folder_add" | "folder_delete";
  type Operation = {
    id: string;
    kind: OperationKind;
    vaultId: string;
    entryId?: string;
    folderId?: string;
    payload?: Record<string, unknown>;
    ts: number;
  };

  const offlineKey = "sv.offline.ops";

  const loadOps = (): Operation[] => {
    const s = localStorage.getItem(offlineKey);
    if (!s) return [];
    try {
      const parsed: unknown = JSON.parse(s);
      return Array.isArray(parsed) ? (parsed as Operation[]) : [];
    } catch {
      return [];
    }
  };

  const saveOps = (ops: Operation[]) => {
    localStorage.setItem(offlineKey, JSON.stringify(ops));
  };

  export const useOfflineSync = () => {
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
    const [ops, setOps] = useState<Operation[]>(() => loadOps());

    useEffect(() => {
      const onOnline = () => setIsOnline(true);
      const onOffline = () => setIsOnline(false);
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      return () => {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      };
    }, []);

    useEffect(() => {
      saveOps(ops);
    }, [ops]);

    const enqueue = (op: Operation) => setOps((prev) => [...prev, op]);
    const clear = (ids: string[]) => setOps((prev) => prev.filter((o) => !ids.includes(o.id)));

    return { isOnline, ops, enqueue, clear };
  };
  ```

- Offline banner (Shadcn):
  ```tsx
  export const OfflineBanner = ({ isOnline, pending }: { isOnline: boolean; pending: number }) =>
    !isOnline ? (
      <div className="w-full border border-yellow-300 bg-yellow-50 dark:bg-yellow-950 px-4 py-3 rounded-md flex items-center justify-between" role="status" aria-live="polite">
        <span className="text-sm">Offline. Changes will sync on reconnect.</span>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground">{pending} pending</span>
        </div>
      </div>
    ) : null;
  ```

## Mobile Sample (React Native Paper)
```tsx
import { Banner, Appbar, Badge } from "react-native-paper";

const Header = ({ pending }: { pending: number }) => (
  <Appbar.Header>
    <Appbar.Content title="SecureVault" />
    {pending > 0 && <Badge>{pending}</Badge>}
  </Appbar.Header>
);

const OfflineBannerMobile = ({ isOnline }: { isOnline: boolean }) =>
  !isOnline ? <Banner visible={!isOnline}>Offline. Changes will sync.</Banner> : null;
```

## PWA Service Worker (Purpose & Approach)
- Purpose: cache static assets (offline shell) so the app loads offline; provide offline fallback for personal vault view.
- Approach: register a service worker (e.g., Vite plugin or Workbox), precache build assets, cache-first for static, network-first for API with graceful fallback.

## Security
- Store only encrypted snapshots and data; never plaintext passwords offline.
- Keep private keys sealed; avoid exposing keys in persistent storage.
- Protect offline audit logs; include only minimal metadata.

## Compliance
- Local offline audit log maintained and flushed to server within 10 minutes after reconnect (configurable).
- Mark entries as “unsynced” until server confirms; include server-side audit insertion for queued operations.

## Rollout Plan
1. View-only offline baseline (personal + team read-only), banner and indicators.
2. Personal vault offline edits with queue and optimistic UI.
3. ConflictDialog and reconciliation logic.
4. Service worker for offline shell and asset caching.
5. Batch sync endpoint and robust error handling.

## Phases & Checkpoints

### Phase 1: Offline-Aware UI Baseline
- Scope: Detect offline; show OfflineBanner and SyncStatusBadge; team read-only state.
- Deliverables: Banner component, status badge, disabled team actions with tooltips.
- Checkpoints:
  - Offline toggling correctly updates banner and disabled states.
  - Team actions (invite, role change, remove) blocked offline.
  - Accessibility verified (role="status", keyboard, contrast).

### Phase 2: Personal Vault Offline Edits
- Scope: Queue operations (add/update/delete entries; add/delete folders) and optimistic UI.
- Deliverables: IndexedDB stores (snapshots, ops), useOfflineSync hook, state wiring in personal vault.
- Checkpoints:
  - Ops persist across page reloads while offline.
  - Pending count reflects queued operations.
  - Only encrypted data stored; no plaintext in storage.

### Phase 3: Conflict Detection & Dialog
- Scope: Detect server/local divergence on reconnect; resolve via ConflictDialog.
- Deliverables: Reconciliation logic, tombstones for deletions, dialog with keep-mine/keep-remote/merge-notes.
- Checkpoints:
  - Conflicts reliably detected on field-level changes.
  - User choice applies correctly and records to local audit.
  - No ghost reappearances after deletions (tombstones honored).

### Phase 4: PWA Offline Shell
- Scope: Service worker precaching; cache-first static assets; network-first APIs with fallbacks.
- Deliverables: SW registration, precache manifest, offline-ready app shell.
- Checkpoints:
  - App loads without network, showing cached UI and personal vault view.
  - SW updates propagate correctly on new deploys.
  - No stale API responses served from cache.

### Phase 5: Backend Batch Sync & Compliance
- Scope: POST /sync/deltas endpoint; GET /vaults/:id/snapshot; robust error handling; audit flush.
- Deliverables: Fastify routes, per-op result/conflict payloads, audit flush within 10 minutes.
- Checkpoints:
  - Queued ops apply on reconnect; conflicts returned with details.
  - Local audit logs flush within SLA and appear in server audit.
  - SSE resumes and reflects server-side changes after sync.

### Phase 6: Hardening & Telemetry
- Scope: Retry/backoff strategies; telemetry for offline usage; feature flags.
- Deliverables: Backoff config, metrics, toggles for offline-first mode.
- Checkpoints:
  - Reconnect stability under intermittent networks.
  - Metrics dashboard shows offline sessions, pending ops, conflict rates.
  - Feature flag safely disables offline edits if needed.

## Acceptance Criteria
- Offline banner appears when disconnected; counts reflect queued operations.
- Personal vault edits work offline; team actions are disabled with messaging.
- On reconnect, queued ops apply; conflicts prompt and resolve correctly.
- Audit logs flush within the configured window after reconnect.

## References
- SSE already implemented: /sync/events (backend) and hook wiring (frontend).
- Backend routes registration and sync events filtering exist.

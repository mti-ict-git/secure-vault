import { getVault } from "./repo/vaults.js";
import {
  createNotification,
  displayNameOf,
  listAdminIds,
  listJoinedTeamMemberIds,
  recentShareTargets,
} from "./repo/notifications.js";

// Security notifications. Failures here must never break the request that triggered
// them, so every entry point swallows and logs its own errors.
const safe = async (label: string, fn: () => Promise<void>) => {
  try {
    await fn();
  } catch (err) {
    console.error(`notify ${label} failed`, err);
  }
};

const sameId = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

type VaultInfo = { kind?: string; owner_user_id?: string | null; team_id?: string | null; purpose?: string };

const vaultLabel = (v: VaultInfo | null) =>
  v?.kind === "team" ? "a team vault" : v?.purpose === "transfer" ? "a shared copy" : "your personal vault";

const alertAdmins = async (message: string, type: string, vault_id: string | null, actor: string | null) => {
  for (const admin of await listAdminIds()) {
    await createNotification({ user_id: admin, type, severity: "critical", message, vault_id, actor_user_id: actor });
  }
};

export const notifyShareCreated = (vault_id: string, actor_id: string, target_user_id: string | null, permissions: string) =>
  safe("share", async () => {
    const v = (await getVault(vault_id)) as VaultInfo | null;
    const actor = await displayNameOf(actor_id);
    const access = permissions === "write" ? "view and edit" : "view";
    if (target_user_id && !sameId(target_user_id, actor_id)) {
      await createNotification({
        user_id: target_user_id,
        type: "share_received",
        message: `${actor} gave you ${access} access to ${v?.kind === "team" ? "a team vault" : "a shared vault"}.`,
        actor_user_id: actor_id,
        vault_id,
      });
    }
    // Receipt to the owner, so a share made from a hijacked session is noticed.
    if (v?.owner_user_id && target_user_id && !sameId(target_user_id, v.owner_user_id)) {
      const target = await displayNameOf(target_user_id);
      await createNotification({
        user_id: v.owner_user_id,
        type: "share_created",
        severity: "warning",
        message: `${actor} shared ${vaultLabel(v)} with ${target} (${access}).`,
        actor_user_id: actor_id,
        vault_id,
      });
    }
    // Several recipients within minutes is how the 2026-11 leak looked: tell the admins once.
    if ((await recentShareTargets(vault_id, 5)) === 3) {
      await alertAdmins(`${actor} shared one vault with 3 or more people within 5 minutes. Check that this was intended.`, "alert_share_fanout", vault_id, actor_id);
    }
  });

export const notifyShareRevoked = (vault_id: string, actor_id: string, target_user_id: string | null) =>
  safe("revoke", async () => {
    const actor = await displayNameOf(actor_id);
    if (target_user_id && !sameId(target_user_id, actor_id)) {
      await createNotification({
        user_id: target_user_id,
        type: "share_revoked",
        message: `${actor} removed your access to a shared vault.`,
        actor_user_id: actor_id,
        vault_id,
      });
    }
  });

export const notifyKeyRotated = (vault_id: string, actor_id: string) =>
  safe("rotate", async () => {
    await createNotification({
      user_id: actor_id,
      type: "vault_key_rotated",
      message: "Your vault was given a new key. Old copies of the key can no longer read new changes.",
      actor_user_id: actor_id,
      vault_id,
    });
  });

export const notifyBlocked = (vault_id: string, actor_id: string, what: "share" | "write") =>
  safe("blocked", async () => {
    const v = (await getVault(vault_id)) as VaultInfo | null;
    const actor = await displayNameOf(actor_id);
    const verb = what === "share" ? "share" : "write to";
    if (v?.owner_user_id && !sameId(v.owner_user_id, actor_id)) {
      await createNotification({
        user_id: v.owner_user_id,
        type: "blocked_attempt",
        severity: "critical",
        message: `${actor} tried to ${verb} your personal vault. It was blocked.`,
        actor_user_id: actor_id,
        vault_id,
      });
    }
    await alertAdmins(`${actor} tried to ${verb} a personal vault they do not own. It was blocked.`, "alert_blocked_attempt", vault_id, actor_id);
  });

export const notifyKeysReset = (user_id: string) =>
  safe("keys_reset", async () => {
    await createNotification({
      user_id,
      type: "keys_reset",
      severity: "critical",
      message: "Your encryption keys were reset. If this was not you, contact IT now.",
      actor_user_id: user_id,
    });
    const who = await displayNameOf(user_id);
    await alertAdmins(`${who} reset their encryption keys. Old keys are archived.`, "alert_keys_reset", null, user_id);
  });

/** A team vault changed: tell the other members (at most one unread notice per 10 minutes). */
export const notifyVaultUpdated = (vault_id: string, actor_id: string) =>
  safe("vault_updated", async () => {
    const v = (await getVault(vault_id)) as VaultInfo | null;
    if (v?.kind !== "team" || !v.team_id) return;
    const actor = await displayNameOf(actor_id);
    for (const member of await listJoinedTeamMemberIds(v.team_id)) {
      if (sameId(member, actor_id)) continue;
      await createNotification({
        user_id: member,
        type: "vault_updated",
        message: `${actor} updated passwords in a team vault.`,
        actor_user_id: actor_id,
        vault_id,
        coalesceMinutes: 10,
      });
    }
  });

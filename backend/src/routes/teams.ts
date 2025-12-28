import type { FastifyInstance } from "fastify";
import { InviteSchema, CreateTeamSchema, UpdateRoleSchema, UpdateTeamSchema } from "../utils/validators.js";
import { acceptInvite, createTeam, deleteTeam, getTeamMemberById, getUserRoleInTeam, inviteMember, isTeamMember, listTeamMembers, listTeamsForUser, removeMember, updateMemberRole, updateTeam } from "../repo/teams.js";
import { createVault } from "../repo/vaults.js";
import { writeAudit } from "../repo/audit.js";
import { publishSyncEvent } from "../state/store.js";

export const teamRoutes = async (app: FastifyInstance) => {
  app.get("/", async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const items = await listTeamsForUser(userId);
    return reply.send({ items });
  });
  app.post("/", async (req, reply) => {
    const body = CreateTeamSchema.parse(req.body);
    const creatorId = req.user?.id;
    if (!creatorId) return reply.status(401).send({ error: "unauthorized" });
    const teamId = await createTeam(
      body.name,
      body.description,
      creatorId,
      body.team_key_wrapped_for_creator
    );
    const vaultId = await createVault(null, teamId, "team", 1, body.team_key_wrapped_for_creator);
    await writeAudit(creatorId, "team_create", "team", teamId, { name: body.name, vault_id: vaultId });
    publishSyncEvent({ t: Date.now(), type: "team_create", team_id: teamId, vault_id: vaultId, actor_user_id: creatorId });
    return reply.status(201).send({ id: teamId, vault_id: vaultId });
  });
  app.post("/:id/invite", async (req, reply) => {
    type Params = { id: string };
    const teamId = (req.params as Params).id;
    const body = InviteSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const role = await getUserRoleInTeam(teamId, userId);
    if (!role || (role !== "owner" && role !== "admin")) {
      return reply.status(403).send({ error: "forbidden" });
    }
    const id = await inviteMember(teamId, body.user_id, body.role, userId, body.team_key_wrapped);
    await writeAudit(userId, "team_invite", "team", teamId, { member_id: id, invited_user_id: body.user_id, role: body.role });
    publishSyncEvent({ t: Date.now(), type: "team_invite", team_id: teamId, member_id: id, actor_user_id: userId });
    return reply.status(201).send({ id });
  });
  app.patch("/:id", async (req, reply) => {
    type Params = { id: string };
    const teamId = (req.params as Params).id;
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const role = await getUserRoleInTeam(teamId, userId);
    if (!role || (role !== "owner" && role !== "admin")) {
      return reply.status(403).send({ error: "forbidden" });
    }
    const body = UpdateTeamSchema.parse(req.body);
    await updateTeam(teamId, body.name, body.description);
    await writeAudit(userId, "team_update", "team", teamId, { name: body.name, description: body.description });
    publishSyncEvent({ t: Date.now(), type: "team_update", team_id: teamId, actor_user_id: userId });
    return reply.send({ ok: true });
  });
  app.delete("/:id", async (req, reply) => {
    type Params = { id: string };
    const teamId = (req.params as Params).id;
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const role = await getUserRoleInTeam(teamId, userId);
    if (!role || role !== "owner") {
      return reply.status(403).send({ error: "forbidden" });
    }
    await deleteTeam(teamId);
    await writeAudit(userId, "team_delete", "team", teamId, {});
    publishSyncEvent({ t: Date.now(), type: "team_delete", team_id: teamId, actor_user_id: userId });
    return reply.send({ ok: true });
  });
  app.post("/:id/accept", async (req, reply) => {
    type Params = { id: string };
    const teamId = (req.params as Params).id;
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    await acceptInvite(teamId, userId);
    await writeAudit(userId, "team_invite_accept", "team", teamId, {});
    publishSyncEvent({ t: Date.now(), type: "team_invite_accept", team_id: teamId, actor_user_id: userId });
    return reply.send({ ok: true });
  });
  app.get("/:id/members", async (req, reply) => {
    type Params = { id: string };
    const teamId = (req.params as Params).id;
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const ok = await isTeamMember(teamId, userId);
    if (!ok) return reply.status(403).send({ error: "forbidden" });
    const items = await listTeamMembers(teamId);
    return reply.send({ items });
  });
  app.post("/:id/members/:memberId/role", async (req, reply) => {
    type Params = { id: string; memberId: string };
    const teamId = (req.params as Params).id;
    const memberId = (req.params as Params).memberId;
    const { role } = UpdateRoleSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const actorRole = await getUserRoleInTeam(teamId, userId);
    if (!actorRole) return reply.status(403).send({ error: "forbidden" });
    if (role === "owner") return reply.status(400).send({ error: "invalid_role" });
    const member = await getTeamMemberById(memberId);
    if (!member || member.team_id !== teamId) return reply.status(404).send({ error: "not_found" });
    if (member.user_id === userId) return reply.status(403).send({ error: "forbidden" });
    if (actorRole !== "owner") {
      if (member.role === "owner" || member.role === "admin") return reply.status(403).send({ error: "forbidden" });
      if (role === "admin") return reply.status(403).send({ error: "forbidden" });
    }
    await updateMemberRole(memberId, role);
    await writeAudit(userId, "team_role_update", "team_member", memberId, { team_id: teamId, role, target_user_id: member.user_id });
    publishSyncEvent({ t: Date.now(), type: "team_role_update", team_id: teamId, member_id: memberId, actor_user_id: userId });
    return reply.send({ ok: true });
  });
  app.delete("/:id/members/:memberId", async (req, reply) => {
    type Params = { id: string; memberId: string };
    const teamId = (req.params as Params).id;
    const memberId = (req.params as Params).memberId;
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const actorRole = await getUserRoleInTeam(teamId, userId);
    if (!actorRole) return reply.status(403).send({ error: "forbidden" });
    const member = await getTeamMemberById(memberId);
    if (!member || member.team_id !== teamId) return reply.status(404).send({ error: "not_found" });
    if (member.user_id === userId) return reply.status(403).send({ error: "forbidden" });
    if (actorRole !== "owner") {
      if (member.role === "owner" || member.role === "admin") return reply.status(403).send({ error: "forbidden" });
    }
    await removeMember(memberId);
    await writeAudit(userId, "team_member_remove", "team_member", memberId, { team_id: teamId, target_user_id: member.user_id });
    publishSyncEvent({ t: Date.now(), type: "team_member_remove", team_id: teamId, member_id: memberId, actor_user_id: userId });
    return reply.send({ ok: true });
  });
};

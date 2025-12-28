import type { FastifyInstance } from "fastify";
import { InviteSchema, CreateTeamSchema, UpdateRoleSchema } from "../utils/validators.js";
import { createTeam, inviteMember, updateMemberRole, removeMember } from "../repo/teams.js";
import { writeAudit } from "../repo/audit.js";

export const teamRoutes = async (app: FastifyInstance) => {
  app.post("/", async (req, reply) => {
    const { name } = CreateTeamSchema.parse(req.body);
    const id = await createTeam(name, req.user?.id || "");
    await writeAudit(req.user?.id || null, "team_create", "team", id, { name });
    return reply.status(201).send({ id });
  });
  app.post("/:id/invite", async (req, reply) => {
    type Params = { id: string };
    const teamId = (req.params as Params).id;
    const body = InviteSchema.parse(req.body);
    const id = await inviteMember(teamId, body.user_id, body.role, req.user?.id || "", body.team_key_wrapped);
    await writeAudit(req.user?.id || null, "team_invite", "team", teamId, { member_id: id, role: body.role });
    return reply.status(201).send({ id });
  });
  app.post("/:id/members/:memberId/role", async (req, reply) => {
    type Params = { id: string; memberId: string };
    const memberId = (req.params as Params).memberId;
    const { role } = UpdateRoleSchema.parse(req.body);
    await updateMemberRole(memberId, role);
    await writeAudit(req.user?.id || null, "team_role_update", "team_member", memberId, { role });
    return reply.send({ ok: true });
  });
  app.delete("/:id/members/:memberId", async (req, reply) => {
    type Params = { id: string; memberId: string };
    const memberId = (req.params as Params).memberId;
    await removeMember(memberId);
    await writeAudit(req.user?.id || null, "team_member_remove", "team_member", memberId, {});
    return reply.send({ ok: true });
  });
};

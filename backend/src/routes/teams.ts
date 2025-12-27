import type { FastifyInstance } from "fastify";
import { InviteSchema } from "../utils/validators.js";
import { store, uid } from "../state/store.js";

export const teamRoutes = async (app: FastifyInstance) => {
  app.post("/", async (req, reply) => {
    const name = (req.body as any)?.name as string;
    if (!name) return reply.status(400).send({ error: "invalid_name" });
    const id = uid();
    store.teams.set(id, {
      id,
      name,
      created_by: "",
      created_at: Date.now(),
    });
    return reply.status(201).send({ id });
  });
  app.post("/:id/invite", async (req, reply) => {
    const teamId = (req.params as any).id as string;
    const body = InviteSchema.parse(req.body);
    const id = uid();
    store.team_members.set(id, {
      id,
      team_id: teamId,
      user_id: body.user_id,
      role: body.role,
      invited_by: "",
      invited_at: Date.now(),
      team_key_wrapped: body.team_key_wrapped,
    });
    return reply.status(201).send({ id });
  });
  app.post("/:id/members/:memberId/role", async (req, reply) => {
    const memberId = (req.params as any).memberId as string;
    const role = (req.body as any)?.role as string;
    const m = store.team_members.get(memberId);
    if (!m) return reply.status(404).send({ error: "not_found" });
    m.role = role as any;
    return reply.send({ ok: true });
  });
  app.delete("/:id/members/:memberId", async (req, reply) => {
    const memberId = (req.params as any).memberId as string;
    store.team_members.delete(memberId);
    return reply.send({ ok: true });
  });
};

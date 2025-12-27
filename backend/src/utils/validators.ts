import { z } from "zod";

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const KeysRegisterSchema = z.object({
  public_sign_key: z.string().min(16),
  public_enc_key: z.string().min(16),
  encrypted_private_key: z.string().min(32),
});

export const CreateVaultSchema = z.object({
  kind: z.enum(["personal", "team"]),
  team_id: z.string().uuid().optional(),
  version: z.number().int().min(1),
  vault_key_wrapped: z.string().min(16),
});

export const InviteSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["owner", "admin", "editor", "viewer"]),
  team_key_wrapped: z.string().min(16),
});

export const ShareSchema = z.object({
  source_vault_id: z.string().uuid(),
  target_user_id: z.string().uuid().optional(),
  target_team_id: z.string().uuid().optional(),
  wrapped_key: z.string().min(16),
  permissions: z.enum(["read", "write"]),
});

import dotenv from "dotenv";
import { join } from "path";
import { Client } from "ldapts";
import { config } from "../src/config.js";

dotenv.config({ path: join(process.cwd(), ".env") });
dotenv.config({ path: join(process.cwd(), "..", ".env") });

type BindDetail = { name?: string; message?: string };
type BindResult = { id: string; ok: boolean; detail?: BindDetail };

const tryBind = async (id: string, password: string): Promise<BindResult> => {
  const client = new Client({
    url: config.ldap.url,
    timeout: config.ldap.timeout,
    connectTimeout: config.ldap.connectTimeout,
    tlsOptions: { rejectUnauthorized: config.ldap.tlsRejectUnauthorized },
  });
  try {
    await client.bind(id, password);
    await client.unbind();
    return { id, ok: true };
  } catch (e: unknown) {
    const name = typeof e === "object" && e !== null ? (e as { name?: unknown }).name : undefined;
    const message = e instanceof Error ? e.message : (typeof e === "object" && e !== null ? (e as { message?: unknown }).message : undefined);
    await client.unbind().catch(() => undefined);
    return { id, ok: false, detail: { name: typeof name === "string" ? name : undefined, message: typeof message === "string" ? message : undefined } };
  }
};

const deriveDomainName = (): string | undefined => {
  const base = config.ldap.baseDN || config.ldap.userSearchBase || "";
  const parts = base.split(",").map((s) => s.trim());
  const dcs = parts.filter((p) => p.toUpperCase().startsWith("DC=")).map((p) => p.slice(3));
  return dcs.length ? dcs[0].toUpperCase() : undefined;
};

const run = async () => {
  const dn = process.env.SV_TEST_DN || "";
  const upn = process.env.SV_TEST_UPN || "";
  const sam = process.env.SV_TEST_SAM || "";
  const password = process.env.SV_TEST_PASSWORD || "";
  const domainName = deriveDomainName();
  const domainSam = domainName && sam ? `${domainName}\\${sam}` : undefined;
  const ids = [dn, upn, domainSam, sam].filter((v): v is string => typeof v === "string" && v.length > 0);
  const results: BindResult[] = [];
  for (const id of ids) {
    const r = await tryBind(id, password);
    results.push(r);
  }
  console.log(JSON.stringify({ results }, null, 2));
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { Client } from "ldapts";
import { config } from "../config.js";

export const ldapLogin = async (username: string, password: string) => {
  if (!config.ldap.url) {
    if (username === "demo" && password === "demo") {
      return { dn: `cn=${username}`, email: `${username}@example.com` };
    }
    throw new Error("invalid_credentials");
  }
  const client = new Client({
    url: config.ldap.url,
    timeout: config.ldap.timeout,
    connectTimeout: config.ldap.connectTimeout,
    tlsOptions: { rejectUnauthorized: config.ldap.tlsRejectUnauthorized },
  });
  const adminBindDN = config.ldap.bindDN;
  const adminBindPassword = config.ldap.bindPassword;
  await client.bind(adminBindDN, adminBindPassword);
  const upn = username.includes("@") ? username : undefined;
  const primaryFilter = config.ldap.userSearchFilter.replace("{username}", username);
  const { searchEntries } = await client.search(config.ldap.userSearchBase, {
    scope: "sub",
    filter: primaryFilter,
  });
  const entry = searchEntries[0] as { dn: string; mail?: string; userPrincipalName?: string };
  if (!entry) {
    if (upn) {
      const { searchEntries: byUpn } = await client.search(config.ldap.userSearchBase, {
        scope: "sub",
        filter: `(userPrincipalName=${upn})`,
      });
      const alt = byUpn[0] as { dn: string; mail?: string; userPrincipalName?: string } | undefined;
      if (!alt) {
        await client.unbind();
        throw new Error("user_not_found");
      }
      try {
        await client.bind(alt.dn, password);
      } catch {
        await client.unbind();
        throw new Error("bind_failed");
      }
      await client.unbind();
      return { dn: alt.dn, email: alt.mail };
    }
    await client.unbind();
    throw new Error("user_not_found");
  }
  const candidates: string[] = [];
  candidates.push(entry.dn);
  if (entry.userPrincipalName) candidates.push(entry.userPrincipalName);
  if (upn) candidates.push(upn);
  if (!upn && config.ldap.domain) candidates.push(`${config.ldap.domain}\\${username}`);
  if (entry.mail) candidates.push(entry.mail);
  let bound = false;
  for (const id of candidates) {
    try {
      await client.bind(id, password);
      bound = true;
      break;
    } catch {
      continue;
    }
  }
  if (!bound) {
    await client.unbind();
    throw new Error("bind_failed");
  }
  await client.unbind();
  return { dn: entry.dn, email: entry.mail };
};

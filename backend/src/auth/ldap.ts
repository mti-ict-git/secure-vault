import { Client } from "ldapts";
import { config } from "../config.js";

const toFirstString = (v: unknown): string | undefined => {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    const first = v[0];
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
};

const escapeLdapFilterValue = (value: string): string => {
  let out = "";
  for (const c of value) {
    if (c === "*") out += "\\2a";
    else if (c === "(") out += "\\28";
    else if (c === ")") out += "\\29";
    else if (c === "\\") out += "\\5c";
    else if (c.charCodeAt(0) === 0) out += "\\00";
    else out += c;
  }
  return out;
};

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
  try {
    await client.bind(adminBindDN, adminBindPassword);
  } catch {
    await client.unbind();
    throw new Error("ldap_unavailable");
  }
  const upn = username.includes("@") ? username : undefined;
  const safeUsername = escapeLdapFilterValue(username);
  const primaryFilter = config.ldap.userSearchFilter.replace("{username}", safeUsername);

  const searchOne = async (filter: string) => {
    const { searchEntries } = await client.search(config.ldap.userSearchBase, {
      scope: "sub",
      filter,
    });
    const first = searchEntries[0] as Record<string, unknown> | undefined;
    const dn = toFirstString(first?.dn);
    if (!dn) return undefined;
    const mail = toFirstString(first?.mail);
    const userPrincipalName = toFirstString(first?.userPrincipalName);
    return { dn, mail, userPrincipalName };
  };

  const entry = await searchOne(primaryFilter);
  if (!entry) {
    if (upn) {
      const safeUpn = escapeLdapFilterValue(upn);
      const byUpn = await searchOne(`(userPrincipalName=${safeUpn})`);
      const byMail = await searchOne(`(mail=${safeUpn})`);
      const alt = byUpn || byMail;
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

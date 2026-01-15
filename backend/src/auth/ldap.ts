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
  const base = config.ldap.baseDN || config.ldap.userSearchBase || "";
  const partsPre = base.split(",").map((s) => s.trim());
  const dcsPre = partsPre.filter((p) => p.toUpperCase().startsWith("DC=")).map((p) => p.slice(3));
  const domainNamePre = dcsPre.length ? dcsPre[0].toUpperCase() : undefined;
  const preCandidates: string[] = [];
  if (username.includes("\\")) {
    preCandidates.push(username);
  } else {
    if (domainNamePre) preCandidates.push(`${domainNamePre}\\${username}`);
    preCandidates.push(username);
  }
  const isLikelyDn = (id: string): boolean => id.includes("=") && id.includes(",");
  const resolveAfterBind = async (id: string): Promise<{ dn: string; email: string | undefined }> => {
    if (isLikelyDn(id)) {
      const { searchEntries } = await client.search(id, { scope: "base", filter: "(objectClass=*)" });
      const first = searchEntries[0] as Record<string, unknown> | undefined;
      const dn = toFirstString(first?.dn) || id;
      const mail = toFirstString(first?.mail);
      return { dn, email: mail };
    }
    const sam = id.includes("\\") ? id.split("\\").slice(-1)[0] : id.includes("@") ? undefined : id;
    const upn = id.includes("@") ? id : undefined;
    const safeSam = sam ? escapeLdapFilterValue(sam) : undefined;
    const safeUpn = upn ? escapeLdapFilterValue(upn) : undefined;
    const baseSearch = config.ldap.userSearchBase || config.ldap.baseDN;
    const tryFilter = async (filter: string): Promise<{ dn: string; email: string | undefined } | undefined> => {
      const { searchEntries } = await client.search(baseSearch, { scope: "sub", filter });
      const first = searchEntries[0] as Record<string, unknown> | undefined;
      const dn = toFirstString(first?.dn);
      if (!dn) return undefined;
      const mail = toFirstString(first?.mail);
      return { dn, email: mail };
    };
    if (safeSam) {
      const r = await tryFilter(`(sAMAccountName=${safeSam})`);
      if (r) return r;
    }
    if (safeUpn) {
      const r1 = await tryFilter(`(userPrincipalName=${safeUpn})`);
      if (r1) return r1;
      const r2 = await tryFilter(`(mail=${safeUpn})`);
      if (r2) return r2;
    }
    return { dn: id, email: undefined };
  };
  for (const id of preCandidates) {
    try {
      await client.bind(id, password);
      const resolved = await resolveAfterBind(id);
      await client.unbind();
      return resolved;
    } catch {
      continue;
    }
  }
  const searchBase = config.ldap.baseDN || config.ldap.userSearchBase || "";
  const adminBindDN = config.ldap.bindDN;
  const adminBindPassword = config.ldap.bindPassword;
  try {
    await client.bind(adminBindDN, adminBindPassword);
  } catch (adminErr: unknown) {
    if (config.nodeEnv === "development" && username === "demo" && password === "demo") {
      await client.unbind();
      return { dn: `cn=${username}`, email: `${username}@example.com` };
    }
    const parts = searchBase.split(",").map((s) => s.trim());
    const dcs = parts.filter((p) => p.toUpperCase().startsWith("DC=")).map((p) => p.slice(3));
    const domainSuffix = dcs.length ? dcs.join(".") : "";
    const domainName = dcs.length ? dcs[0].toUpperCase() : "";
    const candidates: string[] = [];
    const upn = username.includes("@") ? username : undefined;
    if (upn) candidates.push(upn);
    if (domainSuffix) candidates.push(`${username}@${domainSuffix}`);
    if (domainName) candidates.push(`${domainName}\\${username}`);
    candidates.push(username);
    const errors: unknown[] = [];
    for (const id of candidates) {
      try {
        await client.bind(id, password);
        const resolved = await resolveAfterBind(id);
        await client.unbind();
        return resolved;
      } catch (err: unknown) {
        errors.push(err);
        continue;
      }
    }
    await client.unbind();
    const getName = (e: unknown): string | undefined => {
      if (typeof e === "object" && e !== null) {
        const name = (e as { name?: unknown }).name;
        return typeof name === "string" ? name : undefined;
      }
      return undefined;
    };
    const getMessage = (e: unknown): string | undefined => {
      if (e instanceof Error) return e.message;
      if (typeof e === "object" && e !== null) {
        const msg = (e as { message?: unknown }).message;
        return typeof msg === "string" ? msg : undefined;
      }
      return undefined;
    };
    const hadInvalid = errors.some((e) => {
      const name = (getName(e) || "").toLowerCase();
      const msg = (getMessage(e) || "").toLowerCase();
      return name.includes("invalidcredentials") || msg.includes("invalid credentials");
    });
    if (hadInvalid) throw new Error("invalid_credentials");
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

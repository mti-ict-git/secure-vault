import ldap from "ldapjs";
import { config } from "../config.js";

export const ldapLogin = async (username: string, password: string) => {
  if (!config.ldap.url || config.nodeEnv === "development") {
    return { dn: `cn=${username}`, email: `${username}@example.com` };
  }
  const client = ldap.createClient({
    url: config.ldap.url,
    timeout: config.ldap.timeout,
    connectTimeout: config.ldap.connectTimeout,
    tlsOptions: { rejectUnauthorized: config.ldap.tlsRejectUnauthorized },
  });
  const adminBindDN = config.ldap.bindDN;
  const adminBindPassword = config.ldap.bindPassword;
  await new Promise<void>((resolve, reject) =>
    client.bind(adminBindDN, adminBindPassword, (err) =>
      err ? reject(err) : resolve()
    )
  );
  const filter = config.ldap.userSearchFilter.replace(
    "{username}",
    username
  );
  const opts = { filter, scope: "sub" as const };
  const entries: any[] = [];
  await new Promise<void>((resolve, reject) => {
    client.search(config.ldap.userSearchBase, opts, (err, res) => {
      if (err) return reject(err);
      res.on("searchEntry", (e) => entries.push(e.object));
      res.on("end", () => resolve());
      res.on("error", reject);
    });
  });
  const entry = entries[0];
  if (!entry) throw new Error("user_not_found");
  await new Promise<void>((resolve, reject) =>
    client.bind(entry.dn, password, (err) => (err ? reject(err) : resolve()))
  );
  client.unbind();
  return { dn: entry.dn, email: entry.mail };
};

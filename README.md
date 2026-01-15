# SecureVault

Secure password vault.

## Development

```sh
npm i
npm run dev
```

## Scripts

- dev: Start the Vite dev server
- dev:full: Run backend and frontend together
- build: Build the frontend
- lint: Run ESLint
- preview: Preview the production build

## Administration

- Admin users can access the Administration page at /admin.
- View organization-wide audit and compliance events with server-side filters.
- Events include login attempts, vault unlocks, and copy/share actions.

## Share a Vault

1. Unlock your vault and open the dashboard.
2. Click the Share button in the header.
3. Choose User or Team and set permissions (read/write).
4. For User:
   - Enter the recipient's email and click Lookup.
   - The recipient must have registered encryption keys.
5. For Team:
   - Select a team; the vault key is encrypted for each joined member.
6. Confirm to share. Recipients will see the vault once their wrapped key is available.

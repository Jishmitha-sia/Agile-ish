# Phase 1 — Verification recipe

After Batch 5 lands, this is the recipe to get the whole local stack running and confirm Phase 1 works end-to-end.

## 1. Prereqs (one-time)

```powershell
# Node 20.11+ pinned in .nvmrc
nvm install 20.11.0     # or use fnm / volta
nvm use

# pnpm via corepack
corepack enable
corepack prepare pnpm@9.12.0 --activate

# Docker Desktop running (WSL2 backend on Windows)
docker --version
```

## 2. Configure `.env`

```powershell
Copy-Item .env.example .env

# Generate JWT keypair (one-time)
openssl genpkey -algorithm RSA -out jwt_private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem
$priv = [Convert]::ToBase64String([IO.File]::ReadAllBytes("jwt_private.pem"))
$pub  = [Convert]::ToBase64String([IO.File]::ReadAllBytes("jwt_public.pem"))

# Paste $priv and $pub into JWT_PRIVATE_KEY_BASE64 / JWT_PUBLIC_KEY_BASE64 in .env
# Then delete the PEM files
Remove-Item jwt_private.pem, jwt_public.pem
```

## 3. Install + start infra

```powershell
pnpm install                # downloads node_modules across the workspace
pnpm docker:up              # starts postgres + redis + mailhog
```

Wait ~10s for the postgres healthcheck to go green:

```powershell
docker compose -f infra/docker/docker-compose.yml ps
# All services should show STATUS = "Up (healthy)"
```

## 4. Run migrations + (optional) seed

```powershell
pnpm db:migrate             # applies the init migration as the superuser
pnpm db:seed                # creates demo@agile-ish.local / AgileIshDemo!2026
```

## 5. Start the apps

In two terminals (or one with `pnpm dev` which runs both in parallel):

```powershell
# Terminal A
pnpm --filter @agile-ish/api dev

# Terminal B
pnpm --filter @agile-ish/web dev
```

## 6. Smoke test

| Surface | URL | Expect |
| --- | --- | --- |
| Web | <http://localhost:3000> | Redirects to `/login` (no cookie) |
| Login page | <http://localhost:3000/login> | Form renders with dark theme |
| API health | <http://localhost:4000/health/live> | `{"status":"ok","uptime":...}` |
| API health (deep) | <http://localhost:4000/health/ready> | `{"status":"ok","info":{"database":"up","redis":"up"}}` |
| OpenAPI | <http://localhost:4000/docs> | Swagger UI listing every endpoint |
| MailHog | <http://localhost:8025> | Empty inbox (Phase 1.5 will use it) |

### Sign up a fresh user

1. Click "Sign up" at `/login`.
2. Enter: `you@local.test` / `LocalDevPass123!` / display name `You`.
3. Submit → redirected to `/` → see "Welcome, You" + your auto-created workspace.

### Verify the audit log

```powershell
docker exec -it agile-ish-postgres psql -U agile -d agile_ish -c "SELECT action, actor_id, target_type, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 5;"
```

You should see `auth.signup`, `workspace.created`, `auth.login` (or the signup-triggered login) rows.

### Verify refresh-token rotation

1. Open browser devtools → Application → Cookies → `localhost` — note `agile_rt` value.
2. In a terminal: `curl -i -X POST http://localhost:4000/auth/refresh -b "agile_rt=<value>"` → expect 200 + a `Set-Cookie` with a *different* value.
3. Re-run step 2 with the SAME old value → expect 401 (revoked) and the entire token family killed.

### Verify RLS

```powershell
# Connect as app_user (no superuser bypass).
docker exec -it agile-ish-postgres psql -U app_user -d agile_ish

# Without app.user_id set, the bypass clause kicks in and you see all rows
# (this is the system-context fallback used by migrations + seed):
SELECT id, slug FROM workspaces;

# Now scope to a user — only their workspaces should be visible:
SET app.user_id = '<paste the user_id from the audit_logs query above>';
SELECT id, slug FROM workspaces;
```

## 7. Log out, log back in

- Click "Log out" in the app header.
- Browser redirects to `/login`.
- Refresh cookie is cleared (devtools → Cookies should show it gone).
- Log in with the same credentials → back to `/`.

## What's NOT in Phase 1 (deliberately deferred)

- Email verification flow + password reset → Phase 1.5
- OAuth providers (Google, GitHub) → Phase 1.5
- "Active sessions" UI with per-device revocation → Phase 1.5
- Tests for the rotation / reuse path → Phase 1.5 alongside CI hardening
- Workspace dashboard / projects → Phase 2
- Issues / sprints / boards → Phase 3

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `app refused to start` with Zod error | Missing env var | Copy from `.env.example`; generate JWT keypair |
| `prisma: P1001 Can't reach database` | Postgres not healthy yet | `docker compose ps`; wait for "(healthy)" |
| 401 on every API call | Refresh cookie domain mismatch | Set `COOKIE_DOMAIN=localhost` exactly (no leading dot) |
| `app_user` permission denied | First migration not yet applied | Run `pnpm db:migrate` |
| `pnpm install` peer-dep errors | Stale lockfile | `pnpm install --no-frozen-lockfile` then commit the new lockfile |

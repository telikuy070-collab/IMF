# IMF Secrets Management

## Required GitHub Secrets

Configure these in GitHub Repository Settings в†’ Secrets and variables в†’ Actions:

### Production Secrets (Required)

| Secret Name                 | Description                                                             | Source                                                            |
| --------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `VITE_SUPABASE_URL`         | Supabase project URL (e.g., `https://dtxmuvsrrywpcchvlacv.supabase.co`) | Supabase Dashboard в†’ Settings в†’ API                           |
| `VITE_SUPABASE_ANON_KEY`    | Supabase anon/public key (safe for browser)                             | Supabase Dashboard в†’ Settings в†’ API                           |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only, for Edge Functions)                      | Supabase Dashboard в†’ Settings в†’ API                           |
| `SUPABASE_ACCESS_TOKEN`     | Supabase Personal Access Token (for CLI/migrations)                     | Supabase Dashboard в†’ Account в†’ Access Tokens                  |
| `GITHUB_PAT`                | GitHub Personal Access Token (for admin publishing via Contents API)    | GitHub Settings в†’ Developer settings в†’ Personal access tokens |

### Optional Secrets

| Secret Name         | Description                             | Source                                                     |
| ------------------- | --------------------------------------- | ---------------------------------------------------------- |
| `SENTRY_DSN`        | Sentry DSN for error tracking           | Sentry Dashboard в†’ Settings в†’ Projects в†’ Client Keys |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source map upload | Sentry Dashboard в†’ Settings в†’ Auth Tokens              |
| `SNYK_TOKEN`        | Snyk token for security scanning        | Snyk Dashboard в†’ Account в†’ API Token                   |

## Rotation Strategy

### Immediate Rotation Required (Credentials Exposed)

The following credentials were exposed in chat and **MUST BE ROTATED IMMEDIATELY**:

1. **Supabase Service Role Key** - Rotate in Supabase Dashboard в†’ Settings в†’ API в†’ "Reveal service role key" в†’ "Rotate"
2. **GitHub PAT** - Rotate in GitHub Settings в†’ Developer settings в†’ Personal access tokens в†’ "Regenerate token"
3. **Supabase Personal Access Token** - Rotate in Supabase Dashboard в†’ Account в†’ Access Tokens в†’ "Revoke" в†’ "Generate new token"

### Regular Rotation Schedule

| Secret                    | Frequency      | Method                                                     |
| ------------------------- | -------------- | ---------------------------------------------------------- |
| Supabase Service Role Key | Every 90 days  | Supabase Dashboard в†’ API в†’ Rotate                      |
| GitHub PAT                | Every 90 days  | GitHub Settings в†’ PAT в†’ Regenerate                     |
| Supabase Access Token     | Every 90 days  | Supabase Dashboard в†’ Access Tokens в†’ Revoke & Generate |
| Sentry DSN                | Every 180 days | Sentry в†’ Settings в†’ Client Keys в†’ Regenerate         |
| Snyk Token                | Every 180 days | Snyk в†’ Account в†’ API Token в†’ Regenerate              |

### Rotation Procedure

1. Generate new secret in source system
2. Update GitHub Secrets (Settings в†’ Secrets and variables в†’ Actions)
3. Verify CI/CD passes with new secret
4. Revoke old secret in source system
5. Document rotation in CHANGELOG or rotation log

## .env File Handling

- `.env` is in `.gitignore` - never commit
- `.env.example` documents required variables (no real values)
- Use `dotenv` only for local development
- Production uses GitHub Secrets injected at build time

## Verification Commands

```bash
# Check .env is not tracked
git ls-files | grep -E "^\.env" && echo "ERROR: .env is tracked!" || echo "OK: .env not tracked"

# Check git history for leaked secrets
git log --all --full-history --oneline -- .env
git log --all --full-history --oneline -- "*secret*" -- "*key*" -- "*token*"

# Verify GitHub Secrets are set (requires gh CLI)
gh secret list --repo telikuy070-collab/IMF

# Test build with secrets locally
VITE_SUPABASE_URL=xxx VITE_SUPABASE_ANON_KEY=yyy npm run build
```

---
name: deploy
description: "Deploy the site to its configured hosting target. Builds and publishes in one step."
---

# Deploy Site

Build the site and publish it to the configured hosting target in one step.

## Procedure

### 1. Check project state

Call `sitemd_status` to get auth state and deploy configuration.

### 2. Ensure authentication

If not authenticated:

1. Call `sitemd_auth_login` — it returns a URL and code
2. Tell the user to open the URL and enter the code
3. Call `sitemd_auth_poll` to complete the login
4. Confirm login succeeded before continuing

### 3. Ensure site is activated

If the site is not activated (check `sitemd_status`):

1. Ensure the `url` field is set in `settings/meta.md` — if not, ask the user for their domain and set it
2. Call `sitemd_activate` to activate the site (permanent, consumes 1 site slot)
3. The `deploy` command also triggers activation automatically if needed

### 4. Ensure deploy credentials are configured

If deploy credentials are missing, call `sitemd_status` to check what's set, then guide the user through providing the required values based on their target.

Read `settings/deploy.md` to determine the target (default: `cloudflare`). Required keys by target:

**Cloudflare** (default):
- `deploy.cloudflareProject` — Pages project name
- `deploy.cloudflareAccountId` — Account ID
- `deploy.cloudflareApiToken` — API token
- `deploy.cloudflareBranch` — Production branch (optional, defaults to `main` — must match the project's production branch in Cloudflare dashboard)

**Netlify:**
- `deploy.netlifySiteId` — Site ID
- `deploy.netlifyToken` — Personal access token

**Vercel:**
- `deploy.vercelProjectId` — Project ID
- `deploy.vercelToken` — API token
- `deploy.vercelTeamId` — Team ID (optional)

**GitHub Pages:**
- `deploy.githubRepo` — Repository (owner/repo)
- `deploy.githubToken` — Personal access token
- `deploy.githubBranch` — Deploy branch (optional, defaults to `gh-pages`)

For each missing key, ask the user for the value and call `sitemd_config_set` with `key` and `value`.

### 5. Confirm branch (first deploy only)

On the first deploy for a target, confirm the deploy branch with the user:

- **Cloudflare**: "Deploying to branch `main` (Cloudflare Pages production default). Is this correct?" — if not, set `deploy.cloudflareBranch` via `sitemd_config_set`
- **GitHub Pages**: "Deploying to branch `gh-pages`. Is this correct?" — if not, set `deploy.githubBranch` via `sitemd_config_set`

Skip this step on subsequent deploys if the branch is already configured.

### 6. SEO health check

Call `sitemd_seo_audit` with scope `all`.

Always present the full report to the user following the `/seo` skill report format:
1. Show the score with assessment (Excellent / Good / Needs attention / Critical)
2. List all errors with the `why` explanation and fix suggestion
3. List all warnings with the `why` explanation and fix suggestion
4. List info items as "Opportunities"
5. Show summary: X passed, Y errors, Z warnings

Then ask: **"Want me to fix any of these before deploying, or skip and continue?"**

- If the user wants to fix issues: follow the `/seo` skill fix procedure, then re-run the audit and present again
- If the user says skip/continue: proceed to deploy

### 7. Deploy

Call `sitemd_deploy` (no arguments — it reads config from settings and the config store).

Report the result: domain and number of pages deployed. If it fails, show the error and suggest checking credentials via `sitemd_status`.

## Rules

- **No permission required** — Call MCP tools immediately
- **Never store credentials in settings files** — Always use `sitemd_config_set` for API keys and tokens
- **Don't skip pre-flight checks** — Always verify auth and config before deploying, even if the user says "just deploy"
- If the user wants to change their deploy target, update `settings/deploy.md` frontmatter and then set the new target's credentials via `sitemd_config_set`

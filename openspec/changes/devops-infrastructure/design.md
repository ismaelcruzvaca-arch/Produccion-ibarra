# Design: DevOps Infrastructure

## Technical Approach

Host the Expo Router PWA on Vercel using SPA rewrite rules, add Playwright E2E tests that run against the static `dist/` build, and automate everything in GitHub Actions with Bun. No business logic is modified; this change is purely infrastructure.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Hosting | Vercel | Netlify, AWS S3+CloudFront | Native `vercel.json` SPA rewrite support, generous free tier, global CDN, and alignment with common Expo deployment patterns. |
| E2E framework | Playwright | Detox, Cypress | Playwright is web-first, runs directly against static HTML exports, and has superior headless performance. Detox is native-only and ill-suited for PWA validation. Cypress is slower and less parallel-friendly. |
| CI package manager | Bun | npm, pnpm | Matches the local development toolchain stated by the team. Faster install times and a single `bun.lockb` lockfile reduce CI drift. |
| Static server for tests | `npx serve dist` | Python http.server, custom server | `serve` is a one-liner familiar to the JS ecosystem. We add it as a dev dependency so it is cached with `node_modules`. |
| Auth in E2E | Live form interaction without backend mocks | Mock Nhost via `page.route` | The static build has no backend in CI, but the login form shows an error state on failed sign-in. We assert the loading spinner and error HelperText appear, avoiding both secrets and business-logic changes. |

## Data Flow

```
Developer push/PR
       |
       v
GitHub Actions (ubuntu-latest)
       |
       +-- Bun install --> cache ~/.bun/install/cache
       |
       +-- Playwright browsers --> cache ~/.cache/ms-playwright
       |
       +-- npx expo export -p web --> dist/
       |
       +-- npx playwright test
                |
                v
         webServer: npx serve dist
                |
                v
         Chromium navigates to /login
                |
                v
         Fill inputs -> click submit -> assert loading + error
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `vercel.json` | Create | SPA rewrite rule: all paths -> `index.html` |
| `playwright.config.ts` | Create | Test root `./e2e`, baseURL `http://localhost:3000`, `webServer` serving `dist/`, Chromium only |
| `e2e/auth.spec.ts` | Create | Navigates to `/login`, fills email/password, clicks submit, asserts loading and error states |
| `.github/workflows/e2e.yml` | Create | Bun setup, dependency + browser install, Expo web build, Playwright run, artifact upload on failure |
| `package.json` | Modify | Add `@playwright/test` and `serve` to `devDependencies`; add `e2e` script |

## Interfaces / Contracts

No new code interfaces or API contracts are introduced. The only contracts are infrastructure-level:

- **Playwright baseURL**: `http://localhost:3000` (served from `dist/`)
- **Vercel rewrite regex**: `{"source": "/(.*)", "destination": "/index.html"}`
- **CI artifact retention**: Playwright report uploaded on failure with 30-day retention

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| E2E | Login form presence, input filling, submit button state, loading spinner, error HelperText | Playwright Chromium against static `dist/` build served locally |

No unit or integration tests are added because this change contains no business logic.

## Migration / Rollout

No migration required. Rollout steps:
1. Merge the change.
2. Add the project to Vercel (or link existing project).
3. Verify the first GitHub Actions run passes.
4. Confirm `bun.lockb` is tracked in git so CI caching works.

## Open Questions

- None

## Vercel Config Design

`vercel.json` uses a single rewrite rule so that client-side routing (Expo Router) works on refresh or direct navigation:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This is the minimal configuration for an SPA. No `headers` or `redirects` are needed at this stage.

## Playwright Setup Design

`playwright.config.ts` targets the static build:

- `testDir: './e2e'`
- `fullyParallel: true`
- `forbidOnly: !!process.env.CI`
- `retries: process.env.CI ? 2 : 0`
- `workers: process.env.CI ? 1 : undefined`
- `reporter: 'list'`
- `use.baseURL: 'http://localhost:3000'`
- `webServer` block running `npx serve dist -l 3000` with `reuseExistingServer: !process.env.CI`
- Single project: `chromium` using `devices['Desktop Chrome']`

## CI Pipeline Design

`.github/workflows/e2e.yml` runs on `push` and `pull_request` to `main`:

1. **Checkout** with `actions/checkout@v4`
2. **Setup Bun** with `oven-sh/setup-bun@v1` (version from `.bun-version` or latest)
3. **Cache Bun** — `~/.bun/install/cache` keyed by hash of `bun.lockb`
4. **Install dependencies** — `bun install --frozen-lockfile`
5. **Cache Playwright browsers** — `~/.cache/ms-playwright` keyed by Playwright version from `node_modules/@playwright/test/package.json`
6. **Install Playwright deps** — `bunx playwright install --with-deps chromium`
7. **Build** — `bunx expo export -p web` (outputs to `dist/`)
8. **Test** — `bunx playwright test`
9. **Upload report** on failure — `actions/upload-artifact@v4` with `playwright-report/`

## Security Considerations

- No secrets are hardcoded in workflow files.
- If staging credentials are ever needed, they will be injected via `secrets.*` and referenced through `${{ secrets.NAME }}`.
- The Nhost anonymous key is already public by design; no additional exposure is introduced.

## Performance Considerations

- **Bun install cache** avoids re-downloading packages across runs when `bun.lockb` is unchanged.
- **Playwright browser cache** avoids reinstalling Chromium (~150 MB) on every run.
- **Worker count** is capped at `1` in CI to prevent resource contention on the free `ubuntu-latest` runner; local runs use default parallelism.
- **No parallel job splitting** is needed yet because the suite contains a single spec; if the suite grows, `matrix` shards can be introduced later without structural changes.

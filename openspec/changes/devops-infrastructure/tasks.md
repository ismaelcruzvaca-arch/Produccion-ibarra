# Tasks: DevOps Infrastructure

## Phase 1: Project Configuration & Tooling

- [x] 1.1 Add `@playwright/test` to `devDependencies` in `package.json`
- [x] 1.2 Run `bun install` to update lockfile with new dependency
- [x] 1.3 Create `playwright.config.ts` with base URL, `testDir: 'e2e'`, and headless browser config
- [x] 1.4 Create `vercel.json` with SPA rewrite rule routing all paths to `index.html`

## Phase 2: E2E Test Implementation

- [x] 2.1 Create `e2e/` directory
- [x] 2.2 Create `e2e/auth.spec.ts` with test: unauthenticated user redirected to login
- [x] 2.3 Add test to `e2e/auth.spec.ts`: valid credentials grant access to dashboard
- [x] 2.4 Add test to `e2e/auth.spec.ts`: invalid credentials show error message
- [x] 2.5 Run `bunx playwright install` to download browser binaries

## Phase 3: CI/CD Pipeline

- [x] 3.1 Create `.github/workflows/e2e.yml` with `ubuntu-latest` runner
- [x] 3.2 Add Bun setup step (oven-sh/setup-bun) to workflow
- [x] 3.3 Add install and build steps (`bun install`, `bun run build`) to workflow
- [x] 3.4 Add Playwright install and test steps to workflow (`bunx playwright install`, `bunx playwright test`)
- [x] 3.5 Configure workflow triggers for `push` to `main` and `pull_request`

## Phase 4: Verification

- [x] 4.1 Run `bunx playwright test` locally and confirm 3 auth tests pass
- [x] 4.2 Validate `vercel.json` syntax (valid JSON, correct rewrite shape)
- [x] 4.3 Verify `.github/workflows/e2e.yml` is valid YAML and has no syntax errors
- [x] 4.4 Confirm `@playwright/test` is listed in `package.json` devDependencies

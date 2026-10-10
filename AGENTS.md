<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:e2e-environment-rules -->

## E2E verification environment (deterministic)

- E2E (Playwright) must run against `npm run build` + `npm run start`, never `next dev`. Dev mode serves cross-origin-blocked resources (HMR, fonts) → hydration silently broken → clicks do nothing → false failures that look like code bugs.
- Before running the suite, ensure the test port is free. On Windows, terminating a shell does NOT kill `next dev`/`next start` children — zombie processes keep the port and Playwright's `reuseExistingServer` silently reuses them.
- Always run E2E via `npm run test:smoke`: its `pretest:smoke` hook (`scripts/ensure-port-free.mjs`) kills whatever listens on the port by PID before Playwright starts.
- When reporting verify results, state which server actually served the tests (fresh production spawn vs reused). A result against a reused/stale server is not evidence.

<!-- END:e2e-environment-rules -->

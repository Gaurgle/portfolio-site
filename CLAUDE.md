# CLAUDE.md - DevOps Portfolio

## What this is

Andreas Roos's personal portfolio site (https://andreasroos.vercel.app): an
Astro + Tailwind + React-islands frontend in `portfolio_FE/`, with a WebGL2 sky
and a scroll-driven choreography engine. `portfolio_BE/` is a Spring Boot
(Kotlin) + PostgreSQL contact API kept as a DevOps showcase; it is not deployed,
and the live contact form uses Web3Forms instead.

<!-- house-rules:start v1 -->
## House rules

These mirror the global config at `~/claude-config`, which is machine-local and
therefore invisible to cloud and mobile sessions. They apply here regardless of
where the session runs.

- Avoid em dashes (U+2014) and en dashes (U+2013) in new prose. Preserve exact
  quotations, literal data, code, and unrelated existing text.
- **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`,
  `cleanup:`), first line under 72 characters. Body is for the why, not the what.
- **No `Co-Authored-By` lines.** Ever.
- By default, present the full `git commit -m "..."` command for the human to
  run. An explicit commit/push request authorizes that action. **"Ship it"**
  authorizes committing and following this repo's branch/PR and **Ship policy**
  instructions. If that flow is missing or unclear, ask before committing or
  pushing. Never include unrelated changes or secrets, or ship failing checks.
- Merging, tagging, releasing, deploying, force-pushing, rewriting published
  history, deleting remote refs, and infrastructure changes need a separate
  explicit request. Check for deployment side effects before pushing.
- Never weaken tests just to hide a failure. Update tests for authorized
  behavior changes while preserving meaningful coverage. In spec-driven/ATDD
  mode, acceptance tests stay frozen; raise a suspected test defect first.
- Ask before dependency, schema/API, CI, or file-deletion changes unless
  already explicitly authorized. Do not request the same permission twice.
<!-- house-rules:end -->

## Current state

- Desktop is the polished experience. The phone version works but is behind
  and has known open issues; do not assume a desktop fix covers it.
- `src/lib/prismOptics.test.ts` exists but nothing runs it: vitest is not a
  dependency and CI does not test the frontend. The frontend gate is the build.

## Where things are written down

| Path | What it holds |
|---|---|
| `README.md` | Repo overview, local setup for both halves |
| `portfolio_FE/README.md` | Frontend features, folder layout, commands |
| `portfolio_BE/README.md` | Backend API, profiles, Docker |
| `portfolio_FE/src/lib/clouds.ts` | Sky: cloud passes, hero curtain, light beam, weather clock |
| `portfolio_FE/src/lib/smoothScroll.ts` | Lenis, pins, holds, showcases, card stacks |

## Working conventions

- Branch per change, PR to `main`, merge commit (no squash).
- Home page scroll lengths come from `data-pin` / `data-hold` attributes in
  `src/pages/index.astro`, read by `smoothScroll.ts`.

**Ship policy:** PR to `main`; merge only after Frontend CI (`build`) and the
Vercel preview pass. A push or merge to `main` touching `portfolio_FE/**`
triggers the Vercel production deploy (`frontend.yml` calls the deploy hook),
so merging is releasing and needs an explicit request.

## Build

```
cd portfolio_FE && npm ci && npm run build     # the frontend CI gate
cd portfolio_BE && ./gradlew test              # backend tests (need Postgres, see README)
```

- CI installs with npm 10. A lockfile rewritten by npm 11 drops `"peer": true`
  entries and breaks `npm ci`; never commit one without checking on npm 10.
- Run one `astro dev` server per checkout. A second one shares
  `node_modules/.vite` and breaks every React island (`jsxDEV is not a
  function`). For phone testing on the LAN, serve a production build of `dist/`.
- The contact form needs `PUBLIC_WEB3FORMS_KEY` in `portfolio_FE/.env.local`.

## Domain invariants - do not violate

- **Every visual change is continuous.** Opacity, masks, cloud formation, pane
  fades: eased ramps and lerps, never an on/off switch at a threshold.
- **Verify visuals in Safari, not only Chrome.** WebKit resolves some layout
  rules differently, and Safari pays far more for `backdrop-filter` over the
  animated sky; headless Chrome passing is not sign-off.
- **The weather is composed against the content.** `clouds.ts` runs its
  weather clock from the end of the hero pin (`WEATHER_HERO_PIN`). Changing
  scroll lengths elsewhere shifts which cloud meets which chapter, including
  the cloud the journey's light beam launches from; re-check those after.
- **No `backdrop-filter` or animated `filter` on many elements over the sky.**
  Each one re-filters the live WebGL canvas every frame. Fade a fixed filter
  with opacity on a single element, and hide it once faded.

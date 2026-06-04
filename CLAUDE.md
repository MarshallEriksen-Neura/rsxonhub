# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this project is

rsxonhub is a **single-user (login-protected) RSS × AI reader**. The product goal is AI-enhanced RSS: auto summaries/tags/importance scoring, a daily digest, and RAG Q&A over the whole subscription library with source citations. See `DESIGN.md` for the authoritative product + architecture spec (Chinese); selection changes must be synced back into it.

**Current state matters:** the repo is an early scaffold. Only `app/` (layout + page), one component (`components/retroui/Button.tsx`), and `lib/utils.ts` exist. Most of the stack below (Drizzle, pgvector, Auth.js, AI SDK wiring, rss-parser) is **planned in DESIGN.md but not yet built**. Verify what actually exists before assuming a module is present.

## Commands

Package manager is **bun** (`bun.lock` is the source of truth). Use `bun install`, and `bun run <script>` or `bunx`.

- `bun run dev` — start the dev server (http://localhost:3000)
- `bun run build` — production build (run this to typecheck/verify before claiming completion)
- `bun run start` — serve the production build
- `bun run lint` — ESLint (flat config in `eslint.config.mjs`; note Next 16 calls `eslint` directly, not `next lint`)

There is **no test runner configured yet**. If you add tests, pick the standard choice for a Next 16 / React 19 app and wire an npm script.

## Architecture & conventions

- **Stack:** Next.js 16 App Router (full-stack, not split front/back) + React 19 + TypeScript (`strict`). Server Components by default (`rsc: true`).
- **Path alias:** `@/*` maps to repo root (`./`). Import as `@/components`, `@/lib/utils`, `@/components/ui`, `@/hooks`.
- **Styling:** Tailwind v4 — config lives in `app/globals.css` via CSS variables (`@tailwindcss/postcss`), there is no `tailwind.config`. Use the `cn()` helper in `lib/utils.ts` (clsx + tailwind-merge) for conditional classes.
- **UI components — RetroUI first, do not reinvent.** The project's UI framework is **RetroUI**, installed via the shadcn registry `@retroui` (`https://retroui.dev/r/{name}.json`); components land in `components/retroui/`. Base: shadcn (`components.json`), style `radix-nova`, base color `neutral`, lucide icons. **Rule when you need a UI component: (1) check `components/retroui/` for an existing one and reuse it; (2) if missing, install it with `bunx shadcn@latest add @retroui/<name>`; (3) only hand-write a component when RetroUI does not provide it.** Currently only `Button` is installed.
- **Data layer (planned):** PostgreSQL + pgvector via Drizzle ORM. Single-user, so tables carry **no `user_id`** column. Original `articles` are kept separate from AI products (`article_summaries`, `article_chunks`) so AI can be recomputed/fail independently of fetching.
- **AI access (planned):** business code must go through a `lib/ai/` factory, never a provider SDK directly. Chat and embedding are configured separately (different endpoints/models). Both are OpenAI-compatible via custom `baseURL` + `apiKey`.
- **Auth (planned):** Auth.js (NextAuth v5) Credentials + bcrypt. `middleware.ts` must protect all pages and write APIs — unauthenticated pages redirect to `/login`, APIs return 401. Read APIs are protected too (single-user, no public content).
- **Background work (planned):** RSS fetch (`rss-parser`) and AI summarization run **async, outside the request lifecycle**. Dedup relies on a unique index `articles(feed_id, guid)`.

## Hard gotchas (from DESIGN.md — do not relitigate)

These are locked decisions with non-obvious failure modes:

- **pgvector dimension is fixed at table-creation time.** The embedding model (`nvidia/llama-nemotron-embed-1b-v2`) dimension is **not officially confirmed** (likely 2048). Before creating the `article_chunks.embedding vector(...)` column, make one live embedding call and read `embedding.length`, then set `EMBEDDING_DIM`. A wrong dimension means re-embedding the entire DB.
- **NVIDIA embedding requires an `input_type` param** passed via `extra_body` (not in the standard OpenAI body): use `passage` when ingesting chunks, `query` when searching. Mismatch silently degrades retrieval quality.
- **NVIDIA free API tier is dev/test with rate limits.** Commercial license/ToS is unconfirmed — do not assume it's production-safe.
- Images in RSS are **stored as URLs for display only**, never embedded. Only text is vectorized.

## Notes

- This repo runs under the OMX/OMC multi-agent orchestration layer (see `AGENTS.md`, imported above). Commit messages follow the Lore protocol defined there.
- Network policy in this environment blocks WebFetch to huggingface.co and docs.api.nvidia.com — use WebSearch instead.

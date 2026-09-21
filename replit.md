# FLUX File Intelligence

FLUX is a universal file workspace for transforming files and extracting useful meaning from documents.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/flux-file-intelligence/src/App.tsx` — routed product experience and reusable upload/tool surfaces
- `artifacts/flux-file-intelligence/src/index.css` — FLUX visual language, typography, palette, texture, and motion
- `lib/api-spec/openapi.yaml` — source of truth for file, dashboard, and processing contracts
- `artifacts/api-server/src/routes/` — API handlers for workspace files, dashboard summaries, processing jobs, and billing
- `artifacts/api-server/src/lib/processor.ts` — shared file-processing engine and result generation
- `docs/SOURCE_GUIDE.md` — file-by-file source walkthrough

## Architecture decisions

- The first release uses a typed OpenAPI contract and generated client hooks so additional file operations can be added without duplicating UI or request types.
- Processing is modeled as a job resource. The API accepts uploaded bytes, runs the operation asynchronously, stores the generated result in the current process, and exposes a download endpoint. A durable queue/object store can replace the in-process implementation later without changing the client contract.
- The landing page, tools, dashboard, and trust surfaces share one FLUX shell while the document chat and auth screens intentionally have focused layouts.

## Product

- Upload files by picker or drag-and-drop.
- Run document, image, AI/document-intelligence, student, and developer operations through registered file and processing job APIs.
- Browse tools, monitor workspace files, inspect activity and usage, and chat against a selected document surface.
- View pricing, privacy, security, terms, and auth entry points.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- OpenAPI integer fields currently need to be represented as numbers because the workspace's installed Zod runtime is v3 and does not expose `z.int()`.
- The current upload flow sends file bytes as base64 JSON and is capped at 24 MB in the browser; production should move bytes to App Storage and metadata/jobs to PostgreSQL.
- Restart both managed workflows after changing API or frontend source; the web app expects workflow-provided `PORT` and `BASE_PATH`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

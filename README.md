# FLUX File Intelligence

FLUX is a full-stack file workspace for turning uploaded documents, images, structured data, and developer files into useful outputs. The product combines a React/Vite workspace with an Express API, typed OpenAPI contracts, asynchronous processing jobs, downloadable results, and hosted Whop billing.

## Current capabilities

- Drag-and-drop or file-picker uploads from the landing page and tool pages.
- Real file bytes are sent to the API as base64 payloads for the current workspace flow.
- Processing jobs move through `queued`, `processing`, `completed`, or `failed`.
- Completed jobs expose a real downloadable result endpoint.
- PDF text extraction and PDF page rendering through Poppler utilities.
- PDF edits and page operations through `pdf-lib`.
- DOCX text extraction through Mammoth.
- XLSX/CSV parsing and XLSX generation through SheetJS.
- PPTX generation through PptxGenJS.
- Image conversion, compression, and OCR support through ImageMagick and Tesseract.
- Developer utilities for JSON, CSV, JWT, Base64, UUID, regex, timestamps, SQL, and minification.
- Dashboard file/activity summaries.
- Whop-hosted FLUX Pro checkout and server-side access verification endpoint.
- Optional server-side OpenAI processing for summaries, rewriting, translation, flashcards, MCQs, resume analysis, and document intelligence.

## Repository layout

```text
.
├── artifacts/
│   ├── api-server/                  Express API artifact
│   │   ├── src/app.ts               Express middleware and API mount
│   │   ├── src/routes/              REST route handlers
│   │   └── src/lib/processor.ts     File-processing operation engine
│   ├── flux-file-intelligence/      React/Vite web application
│   │   └── src/App.tsx              Routes, catalog, upload UI, job UI
│   └── mockup-sandbox/               Component preview artifact
├── lib/
│   ├── api-spec/openapi.yaml         API contract source of truth
│   ├── api-client-react/             Generated React Query client
│   ├── api-zod/                      Generated server validators/types
│   └── db/                           Drizzle database package
├── scripts/                          Workspace scripts
├── docs/SOURCE_GUIDE.md              Source-code walkthrough
├── package.json                      Workspace scripts and root tooling
├── pnpm-workspace.yaml               Workspace/catalog configuration
└── replit.md                         Replit collaborator notes
```

## Requirements

- Node.js 24
- pnpm
- Poppler utilities: `pdftotext`, `pdftoppm`, and `pdfunite`
- ImageMagick: `convert` or `magick`
- Tesseract OCR
- PostgreSQL environment variables if database-backed features are enabled

The managed Replit runtime already provides the native document/image utilities used by the API. On another machine, install equivalent packages before running document and image tools.

## Install

```bash
pnpm install
```

The workspace uses a one-day minimum package release age in `pnpm-workspace.yaml` as a supply-chain protection. Do not remove or bypass that setting without a deliberate security review.

## Run in Replit

The project already has managed workflows:

```text
artifacts/flux-file-intelligence: web
artifacts/api-server: API Server
artifacts/mockup-sandbox: Component Preview Server
```

Restart them from the Replit workflow controls after changing source, dependencies, or build commands. The API listens on its workflow-provided `PORT`; the web artifact is served through the shared preview proxy.

## Run locally

Start the API:

```bash
pnpm --filter @workspace/api-server run dev
```

Start the web app in a second terminal:

```bash
pnpm --filter @workspace/flux-file-intelligence run dev
```

The API mounts routes under `/api`. In Replit, use the shared proxy rather than calling the service port directly:

```bash
curl http://localhost:80/api/healthz
```

## Verification commands

Run the full workspace checks:

```bash
pnpm run typecheck
pnpm run build
```

Check an individual package:

```bash
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/flux-file-intelligence run typecheck
```

Regenerate all typed API clients and Zod validators after changing the OpenAPI contract:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Never edit generated files in `lib/api-client-react/src/generated` or `lib/api-zod/src/generated` directly. Change `lib/api-spec/openapi.yaml`, then run codegen.

## Processing flow

1. The user selects or drops a file in `UploadPanel`.
2. The browser reads the file and sends its bytes as `contentBase64` to `POST /api/files`.
3. The API creates a file record and stores the current workspace copy in its file-content map.
4. The browser starts `POST /api/processing/jobs` with the file ID and catalog operation slug.
5. The API creates a queued job and runs `processFile` asynchronously.
6. The browser polls `GET /api/processing/jobs/:id`.
7. When complete, the job contains `resultUrl`, `resultName`, and `resultContentType`.
8. The browser downloads the result from `GET /api/processing/jobs/:id/result`.

Example:

```bash
PAYLOAD=$(printf '%s' '{"title":"FLUX","items":[1,2,3]}' | base64 -w0)

FILE=$(curl -sS -X POST http://localhost:80/api/files \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"sample.json\",\"kind\":\"application/json\",\"size\":31,\"mimeType\":\"application/json\",\"contentBase64\":\"$PAYLOAD\"}")

FILE_ID=$(node -e 'console.log(JSON.parse(process.argv[1]).id)' "$FILE")

JOB=$(curl -sS -X POST http://localhost:80/api/processing/jobs \
  -H 'Content-Type: application/json' \
  -d "{\"fileId\":\"$FILE_ID\",\"operation\":\"json-formatter\"}")

echo "$JOB"
```

## API surface

The complete contract is in `lib/api-spec/openapi.yaml`. The main endpoints are:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/healthz` | API health |
| GET | `/api/files` | List workspace files |
| POST | `/api/files` | Register file metadata and bytes |
| GET | `/api/files/:id` | Read one file record |
| POST | `/api/processing/jobs` | Start a catalog operation |
| GET | `/api/processing/jobs/:id` | Poll job status |
| GET | `/api/processing/jobs/:id/result` | Download the completed result |
| GET | `/api/dashboard/summary` | Dashboard metrics and activity |
| GET | `/api/whop/config` | Billing configuration status |
| POST | `/api/whop/checkout` | Get the hosted Whop checkout URL |
| GET | `/api/whop/access` | Verify Whop access when a trusted Whop user token is present |

## Tool catalog

### Document tools

`pdf-to-word`, `pdf-to-excel`, `pdf-to-ppt`, `pdf-to-markdown`, `pdf-to-json`, `merge-pdf`, `compress-pdf`, `ocr-pdf`, `extract-tables`, `remove-pages`, `sign-pdf`, `redact-pdf`, `split-pdf`, and `pdf-to-image`.

### Image tools

`jpg-to-png`, `png-to-jpg`, `webp-converter`, `image-compressor`, `background-remover`, `image-to-pdf`, `screenshot-to-text`, and `image-to-editable-document`.

### AI/document-intelligence tools

`summarize-document`, `ask-questions-about-pdf`, `extract-data`, `translate-document`, `rewrite-document`, `generate-notes`, `generate-flashcards`, `generate-mcqs`, and `resume-analyzer`.

The current implementation provides local, deterministic document intelligence. A model-backed provider can be added behind the same job contract without changing the upload or download UI.

When `OPENAI_API_KEY` is configured as a server secret, these operations use OpenAI server-side with source-grounded prompts and deterministic local fallbacks:

- `summarize-document`
- `ask-questions-about-pdf`
- `rewrite-document`
- `translate-document`
- `generate-flashcards`
- `generate-mcqs`
- `resume-analyzer`

The browser never receives the API key. Set `OPENAI_MODEL` only when a different compatible model is needed; the default is `gpt-5.4-mini`.

### Student tools

`gpa-calculator`, `percentage-calculator`, `cgpa-calculator`, `attendance-calculator`, `assignment-formatter`, `citation-generator`, `pdf-to-notes`, `notes-to-pdf`, and `question-paper-generator`.

### Developer tools

`json-formatter`, `json-to-csv`, `csv-to-json`, `jwt-decoder`, `base64-encoder-decoder`, `uuid-generator`, `regex-tester`, `timestamp-converter`, `sql-formatter`, and `html-css-js-minifier`.

Every catalog card routes to `/:slug`; the slug is passed directly to the backend processing engine.

## Billing

FLUX uses Whop hosted checkout. The application never collects card details.

Configured server-side values include:

- `WHOP_COMPANY_ID`
- `WHOP_PLAN_ID`
- `WHOP_PRODUCT_ID`
- `WHOP_PLAN_PURCHASE_URL`

The Whop API client remains server-only. Paid access must be verified through Whop and must never be granted from a redirect query parameter, checkout ID, client email, or browser state.

### Environment template and Whop connection

The repository includes [`.env.example`](.env.example) as a safe local configuration template. It contains placeholders only; it does not contain the real OpenAI key or Whop credentials.

For a local copy:

```bash
cp .env.example .env
```

For a Replit copy, connect Whop from the Replit Integrations panel. The API reads the managed Whop credential through `ReplitConnectors`; the credential should not be placed in `.env`. Set the Whop company, plan, product, and hosted checkout URL values as non-secret environment variables, and keep `OPENAI_API_KEY` in Replit Secrets.

The current workspace Whop configuration is connected and reports the `FLUX Pro` plan as configured. A ZIP export cannot carry the live OAuth/API connection because those credentials are environment-bound.

## Storage and production notes

The current processing implementation keeps file records, uploaded bytes, jobs, and generated results in process memory. This is appropriate for the current workspace preview and end-to-end development flow, but it is not durable across API restarts or multiple API instances.

Before production scale, move:

1. Uploaded and generated bytes to Replit App Storage or another object store.
2. File/job metadata to PostgreSQL through Drizzle.
3. In-process execution to a durable queue/worker.
4. Placeholder/demo auth screens to a real authenticated session.
5. Pro enforcement to the authenticated user-to-Whop identity bridge.

The API contract and job model are already shaped for those replacements.

## Source-code guide

See [`docs/SOURCE_GUIDE.md`](docs/SOURCE_GUIDE.md) for a file-by-file explanation of the frontend, API, generated packages, processing engine, billing, and extension points.

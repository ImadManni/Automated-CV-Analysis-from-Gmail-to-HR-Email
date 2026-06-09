# Automated CV Analysis from Gmail to HR Email (PCA)

End-to-end recruitment automation: ingest CVs from Gmail, store files in MinIO, analyze candidates with OpenAI, and manage hiring on an HR dashboard (candidatures, campaigns, offers, interviews, decisions).

Repository: [github.com/ImadManni/Automated-CV-Analysis-from-Gmail-to-HR-Email](https://github.com/ImadManni/Automated-CV-Analysis-from-Gmail-to-HR-Email)

## Features

- **Email ingestion** — n8n IMAP trigger for candidature emails and CV attachments
- **Object storage** — CV files in MinIO (`cvs` bucket)
- **AI analysis** — OpenAI extraction, scoring, offer-context matching
- **HR dashboard** — React app: candidatures, KPIs, campaigns, offers, interviews
- **Decisions** — `ACCEPTEE`, `REFUSEE`, `A_REVOIR` with n8n email webhooks
- **RAG assistant** — platform-aware chat + optional CV upload for Q&A
- **LinkedIn (test)** — optional profile import via `scripts/scrapedin-test`

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, TypeScript, Redux Toolkit |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Workflows | n8n |
| Storage | MinIO |
| AI | OpenAI API |
| Cache / rate limit | Redis (optional) |
| Auth (optional) | Keycloak |

## Architecture flow

```
Gmail (IMAP) → n8n → PCA API → MinIO (CV)
                    ↓
              OpenAI analysis → PostgreSQL
                    ↓
              HR Dashboard (React) → decisions / interviews → n8n → SMTP
```

## Project structure

```
├── src/                 # React frontend (port 3004)
├── server/              # Express API (port 3005), OpenAI, RAG, SQL scripts
├── assets/              # Logos and static images
├── docs/                # Setup guides (n8n, MinIO, PostgreSQL, Keycloak)
├── n8n/workflows/       # n8n JSON exports (import in n8n UI)
├── scripts/             # Dev utilities (n8n start, MinIO, LinkedIn test)
├── spring-backend/      # Optional Spring Boot API (legacy / parallel)
├── start.bat            # Windows: API + frontend
└── package.json
```

## Quick start (Windows)

### 1. Prerequisites

- Node.js 18+ (LTS recommended)
- PostgreSQL
- MinIO
- Redis (optional)
- Google Chrome (for LinkedIn test scripts only)

### 2. Install

```powershell
git clone https://github.com/ImadManni/Automated-CV-Analysis-from-Gmail-to-HR-Email.git
cd Automated-CV-Analysis-from-Gmail-to-HR-Email
npm install
```

### 3. Environment

Copy and edit `.env` at the project root (never commit it):

```env
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://user:pass@localhost:5432/pca
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=cvs
MINIO_PUBLIC_URL=http://127.0.0.1:9000
N8N_DECISION_WEBHOOK_URL=http://127.0.0.1:5678/webhook/...
N8N_INTERVIEW_WEBHOOK_URL=http://127.0.0.1:5678/webhook/...
REDIS_URL=redis://127.0.0.1:6379
PORT=3005
```

See `docs/` for PostgreSQL init (`server/sql/init-pca.sql`) and MinIO setup.

### 4. Run services

```powershell
# Terminal 1 — API (port 3005)
npm run server:3005

# Terminal 2 — Frontend (port 3004)
npm run dev

# Terminal 3 — n8n (optional)
npm run n8n
```

Or use **`start.bat`** to launch API + frontend in two windows.

- Dashboard: http://localhost:3004  
- API: http://127.0.0.1:3005  
- API catalog test: http://127.0.0.1:3005/api/offers/catalog  

### 5. Database

```powershell
# Create DB and schema — see docs/INSTALL-POSTGRESQL-PCA.md
psql -U postgres -f server/sql/init-pca.sql
```

## n8n workflows

All exports live in **`n8n/workflows/`**.

| Workflow | Use |
|----------|-----|
| **`PCA - IMAP → MinIO → OpenAI (n8n) → PCA (9).json`** | **Import this one** — current full pipeline |
| Other `PCA - IMAP → …` files | Older versions (reference) |
| `n8n-workflow-full-process.json` | Earlier full-process export |

1. Open n8n → **Import from file** → select `(9).json`
2. Set IMAP, MinIO, OpenAI credentials
3. Set PCA API URL to `http://127.0.0.1:3005`
4. Activate the workflow

Details: `docs/n8n-integration.md`, `docs/TEST-FULL-PROCESS.md`

## Main API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/test/candidatures` | Create candidature (n8n) |
| `POST` | `/api/candidatures/:id/analyze` | Run CV analysis |
| `POST` | `/api/test/analyze` | Test analyze (text / LinkedIn) |
| `PATCH` | `/api/candidatures/:id` | Update decision / status |
| `GET` | `/api/campaigns` | List campaigns |
| `GET` | `/api/campaigns/:id/offers` | Offers per campaign |
| `POST` | `/api/candidatures/:id/interviews` | Schedule interview |
| `POST` | `/api/rag/chat` | RAG assistant |
| `POST` | `/api/rag/chat-with-cv` | RAG with uploaded CV |

Swagger (if enabled): `/api-docs`

## LinkedIn profile test (optional)

```powershell
cd scripts\scrapedin-test
copy .env.example .env
npm install
npm run test:one
npm run send:pca
```

Requires API on port 3005. See `scripts/scrapedin-test/README.md`.

## NPM scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite frontend |
| `npm run server:3005` | Express API on 3005 |
| `npm run start` | `start.bat` (API + front) |
| `npm run n8n` | Start n8n locally |
| `npm run build` | Production frontend build |
| `npm test` | Jest tests |

## Troubleshooting

- **MinIO 404 on analyze** — Check bucket `cvs` and object key from n8n upload node (`docs/FIX-N8N-UPLOAD-URL.md`)
- **Redis** — From install folder use `.\redis-cli.exe`, not global `redis-cli`
- **Push rejected (>100MB)** — Do not commit `minio/minio.exe`; it is in `.gitignore`
- **Ports busy** — `npm run kill-ports` or restart `start.bat`

## Security

- Do not commit `.env`, API keys, or IMAP passwords
- Rotate keys if they were ever exposed
- Use environment variables in production

## License

Apache-2.0 (see upstream scrapedin / project components where applicable).

## Author

**Imad Manni** — EMSI PFE 2026 — PCA (Payment Center Africa) recruitment automation platform.

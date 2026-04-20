# Automated CV Analysis from Gmail to HR Email

End-to-end recruitment automation platform that ingests CVs from Gmail, stores files in MinIO, analyzes profiles with OpenAI, and provides an HR dashboard to review candidatures, decisions, campaigns, offers, and interviews.

## Features

- IMAP ingestion of candidature emails and CV attachments.
- CV upload to MinIO object storage.
- Candidate profile extraction and scoring with OpenAI.
- Dashboard for candidatures, analytics, campaigns, offers, and interviews.
- Manual HR decisions (`ACCEPTEE`, `REFUSEE`, `A_REVOIR`) from the platform.
- n8n webhooks for decision emails and interview invitation emails.
- AI assistant (RAG + OpenAI) for platform-aware and general questions.
- CV upload inside AI assistant for ad-hoc CV Q&A.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Redux Toolkit
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Workflow Automation:** n8n
- **Object Storage:** MinIO
- **AI:** OpenAI API
- **Rate limiting / caching:** Redis (optional but recommended)

## High-Level Flow

1. Candidate sends email + CV attachment.
2. n8n IMAP trigger catches the email.
3. Backend creates candidature and returns upload URL.
4. n8n uploads CV to MinIO.
5. n8n calls backend analyze endpoint with offer context.
6. Backend parses CV + OpenAI extraction/scoring + persists result.
7. HR reviews details in dashboard and updates decisions/interviews.
8. Backend sends decision/interview events to n8n webhooks for email notifications.

## Project Structure

- `src/`: frontend application.
- `server/`: backend APIs, OpenAI integration, and SQL scripts.
- `assets/`: static logos and images.
- `n8n-workflow-full-process.json`: workflow export (if present in your local project).

## Environment Variables

Create your local `.env` and configure at least:

- `OPENAI_API_KEY`
- `DATABASE_URL` (or DB host/user/password variables used in this project)
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`
- `MINIO_PUBLIC_URL`
- `N8N_DECISION_WEBHOOK_URL`
- `N8N_INTERVIEW_WEBHOOK_URL`
- `REDIS_URL` (optional but recommended)

> Never commit `.env` to GitHub.

## Local Setup (Windows)

### 1) Install dependencies

```bash
npm install
```

### 2) Start required services

- PostgreSQL
- MinIO
- Redis (optional)
- n8n

### 3) Run backend + frontend

```bash
# backend
npm run dev:server

# frontend
npm run dev
```

If your scripts differ, use the script names in your local `package.json`.

## n8n Integration

Main workflow responsibilities:

- Read candidature emails from IMAP.
- Filter relevant emails.
- Initialize candidature through backend API.
- Upload CV to MinIO.
- Trigger CV analysis endpoint.
- Listen to decision/interview webhooks and send SMTP emails.

## API Overview

Typical endpoints used in this project:

- `POST /api/test/candidatures`
- `POST /api/candidatures/:id/analyze`
- `PATCH /api/candidatures/:id`
- `POST /api/rag/chat`
- `POST /api/rag/chat-with-cv`
- `GET /api/campaigns`
- `GET /api/campaigns/:id/offers`
- `POST /api/candidatures/:id/interviews`
- `GET /api/candidatures/:id/interviews`
- `PATCH /api/interviews/:id`

## Common Troubleshooting

- **GitHub push rejected (file >100MB):**
  - Remove large binaries from git tracking (example: `minio/minio.exe`).
  - Add them to `.gitignore`.
- **`gh` command not found:**
  - Reopen terminal after install or use full path to `gh.exe`.
- **Redis not found in PowerShell current folder:**
  - Use `.\redis-server.exe`, not `redis-server.exe`.
- **MinIO 404 while analyzing CV:**
  - Verify object key and bucket path used by n8n upload step.

## Security Notes

- Do not commit secrets, tokens, or credentials.
- Rotate API keys if they were ever exposed.
- Prefer environment variables and secret managers for production.

## Status

This project is actively evolving with iterative improvements in:

- CV extraction quality
- offer-context matching
- interview lifecycle
- assistant accuracy on real platform data

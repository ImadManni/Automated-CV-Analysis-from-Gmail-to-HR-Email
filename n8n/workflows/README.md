# n8n workflow exports

Import these JSON files in n8n: **Workflows → Import from file**.

## Recommended (latest)

| File | Description |
|------|-------------|
| `PCA - IMAP → MinIO → OpenAI (n8n) → PCA (9).json` | **Current production pipeline** — IMAP, MinIO upload, OpenAI analysis, PCA API |

## Other exports (history / variants)

Older iterations kept for reference: versions `(7)`, GPT-4 variants, shortened CV fixes, combined bundles (`pca-workflow-full-combined.json`, `n8n-workflow-full-process.json`, etc.).

After import, configure credentials (IMAP, MinIO, OpenAI) and set the PCA API base URL (`http://127.0.0.1:3005` locally).

See `docs/n8n-integration.md` and `docs/TEST-FULL-PROCESS.md` for setup steps.

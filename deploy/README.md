# Deployment

`docker-compose.yml` runs PostgreSQL + pgvector, MinIO (built from a pinned source release), the backend and the
Nginx-served frontend. See [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for configuration, health checks and the
manual verification checklist.

| Path | Purpose |
|---|---|
| `backend/Dockerfile` | Maven build, non-root JRE runtime |
| `frontend/Dockerfile` | `npm ci` + Vite build, served by Nginx |
| `minio/Dockerfile` | Builds the pinned MinIO release from source |
| `nginx/nginx.conf` | SPA routing, `/api` proxy, unbuffered SSE location, upload limit |
| `nginx/security-headers.conf` | Security headers included in every location |

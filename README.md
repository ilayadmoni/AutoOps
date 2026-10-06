# AutoOps

AI-first Linux automation platform for creating, managing, and securely executing workflows and commands across RHEL environments.

## Stack
React + TypeScript + Vite, Java 21 + Spring Boot, PostgreSQL + pgvector, MinIO, SSH/SFTP, OpenRouter-compatible AI.

## Architecture
AI proposes and explains. Spring Boot validates, authorizes, persists and executes. AI has no direct SSH or database access. High-risk operations require explicit human approval.

## Quick start
1. Copy `.env.example` to `.env` and replace secrets.
2. From the repository root run `docker compose -f deploy/docker-compose.yml up --build`.
3. Open the frontend at http://localhost:8088.
4. Backend health is available through the API service at `/actuator/health`.

Detailed design is documented in the `docs/` directory.

# AutoOps frontend

React 19 + TypeScript + Vite single-page app. `npm run dev` proxies `/api` to `localhost:8080`;
`npm run build` runs the i18n key check, the TypeScript check and the production build.

- `src/features/*` — one folder per domain (machines, commands, workflows, executions, approvals, files,
  credentials, ai-assistant, admin, settings, auth)
- `src/shared/api` — fetch client (in-memory access token, single-flight refresh, SSE over fetch) and DTO types
- `src/shared/ui` — loading, empty, error, field, modal, confirm, badge and toast components
- `src/i18n` — English and Hebrew dictionaries; Hebrew switches the document to RTL while code, paths and
  addresses stay LTR. The Hebrew dictionary is type-checked against English.

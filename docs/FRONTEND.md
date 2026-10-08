# Frontend

React 19 + TypeScript + Vite, TanStack Query for server state, React Router, Lucide icons and a small custom i18n
layer. No CSS framework: `src/assets/styles/` defines light/dark tokens and uses logical properties so RTL works.
The source layout (organized by responsibility, not file type) is described in `frontend/README.md`.

- **Auth**: `AuthProvider` refreshes the session on startup, loads `/auth/me`, keeps the access token in memory,
  exposes `isAdmin` for navigation and route guards, and logs out on refresh failure.
- **Machines**: create/edit/delete, credential selection, host-key discovery with explicit fingerprint confirmation,
  connection test, Run Command.
- **Command Bank**: search (lexical or smart), filters, details, propose a command with a parameter-schema editor,
  run dialog with schema-driven inputs, server preview, sudo, machines, mode, concurrency and failure policy.
- **Executions**: history and detail with preflight grid, step timeline, stdout/stderr, exit codes, approvals with
  HIGH-risk acknowledgement, Stop, Retry. Live updates use SSE over `fetch` (to send the bearer token), reconnect
  automatically and fall back to polling.
- **Workflows**: list/duplicate/delete/run and a builder for typed steps with real command and file selectors,
  success/failure edges, validation errors per step, versioned saves and unsaved-change protection.
- **Assistant**: conversations, chat, and proposal cards that open the builder or the run dialog.
- **Admin**: overview and maintenance, users, command reviews, dataset imports, audit log.
- **Settings**: theme (system/light/dark) and language (English/Hebrew), stored per device. Hebrew sets `dir=rtl`;
  commands, paths and addresses stay LTR.

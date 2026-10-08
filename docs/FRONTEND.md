# Frontend

React 19 + TypeScript + Vite, TanStack Query for server state, React Router, Lucide icons and a small custom i18n
layer. No CSS framework: `src/styles.css` defines light/dark tokens and uses logical properties so RTL works.

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
- **Assistant**: conversations (collapsible history rail), chat, and proposal cards that open the builder or the run
  dialog. When a workflow is being drafted the page splits: chat on the inline-start side (right in Hebrew), and a
  read-only pipeline canvas of the current proposal on the other side, updated with each revision.
- **Admin**: overview and maintenance, users, command reviews, dataset imports, audit log.
- **Settings**: theme (system/light/dark) and language (English/Hebrew), stored per device. Hebrew sets `dir=rtl`;
  commands, paths and addresses stay LTR.

## Shared UI

Every reusable visual lives in `src/shared/ui` and is imported from `shared/ui` (or `shared/ui/flow` for the canvas,
kept separate so React Flow only loads on pages that draw a graph). Feature folders compose these; they do not style
their own buttons, inputs or floating layers.

- Controls: `Button`, `IconButton` (tooltip = its label), `TextInput`, `Select` (portalled listbox with keyboard and
  type-ahead), `NumberInput`, `Checkbox`/`Radio`/`Switch`, `Segmented`.
- Floating layers: `Tooltip`, `Menu`, and the `Select` list all position through `useFloating` (`floating.ts`): fixed,
  portalled, flip when out of room, RTL-aware, never clipped by `overflow: hidden`.
- Surfaces: `Card` (+ `.cardFoot`), `Tile`, `ListItem`, `Modal`, `ConfirmDialog`, badges, alerts, loaders.
- Canvas (`shared/ui/flow`): `FlowCanvas` with n8n-style step nodes, a trigger-shaped preflight node, success/failure
  outputs, "+" stubs that add a wired next step, and selectable connections with a remove button. The canvas always
  lays out left to right because columns are execution order.
- Scrollbars, z-index layers, canvas and tooltip colours are tokens in `styles/tokens.css`.

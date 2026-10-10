# Frontend

React 19 + TypeScript + Vite, TanStack Query for server state, React Router, Lucide icons and a small custom i18n
layer. No CSS framework: `src/assets/styles/` defines light/dark tokens and uses logical properties so RTL works.
Fonts are self-hosted in `src/assets/fonts` (no external requests): Roboto for Latin text, Google Sans for Hebrew
(declared with a Hebrew `unicode-range`, so one stack mixes both per character) and IBM Plex Mono for code. `FontGate`
keeps the boot loader up until they are loaded, then mounts the app.

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
- **Preferences**: theme (light/dark) and language (English/Hebrew) are the two buttons in the top corner pill,
  stored per device; there is no separate Settings page. Hebrew sets `dir=rtl`; commands, paths and addresses stay LTR.

## Folder structure

Organized by responsibility, not file type:

- `app/`: `App.tsx` (routes), `providers/` (Auth, Theme, I18n), `layout/` (app shell, sidebar footer).
- `assets/styles/`: `index.css` imports the style layers in cascade order.
- `components/`: reusable UI. `ui/` holds the design-system primitives, `ui/flow/` the canvas; `AppControls` is the
  language/theme pill used by the app shell and the login page.
- `features/<name>/`: feature-specific components, hooks and stores (assistant chat, workflow builder, run forms).
- `pages/<name>/`: route-level views (`*Page.tsx`).
- `lib/i18n/`: English and Hebrew dictionaries.
- `services/`: API client (`client.ts`).
- `types/`: shared TypeScript types (`api.ts`).
- `utils/`: pure helpers (`format.ts`).

## Shared UI

Every reusable visual lives in `src/components/ui` and is imported from `components/ui` (or `components/ui/flow` for the canvas,
kept separate so React Flow only loads on pages that draw a graph). Feature folders compose these; they do not style
their own buttons, inputs or floating layers.

- Controls: `Button`, `IconButton` (tooltip = its label), `TextInput`, `Select` (portalled listbox with keyboard and
  type-ahead), `NumberInput`, `Checkbox`/`Radio`/`Switch`, `Segmented`.
- Floating layers: `Tooltip`, `Menu`, and the `Select` list all position through `useFloating` (`floating.ts`): fixed,
  portalled, flip when out of room, RTL-aware, never clipped by `overflow: hidden`.
- Surfaces: `Card` (+ `.cardFoot`), `Tile`, `ListItem`, `Modal`, `ConfirmDialog`, badges, alerts, loaders.
- Canvas (`components/ui/flow`): `FlowCanvas` with n8n-style step nodes, a trigger-shaped preflight node, success/failure
  outputs, "+" stubs that add a wired next step, and selectable connections with a remove button. The canvas always
  lays out left to right because columns are execution order.
- Scrollbars, z-index layers, canvas and tooltip colours are tokens in `assets/styles/tokens.css`.

## AI assistant composer and workflow workspace

- The composer (`features/ai-assistant/editor`) is a small contenteditable editor over an explicit document model
  (`mentionDoc.ts`): text parts and resource tags that carry the exact server or stored-file id. Tags are inline and atomic.
  Sending serializes tags as `@[Name](server:8)` / `#[file.sh](file:31)`; `fileIds` and `machineIds` are derived from the tags, so
  deleting the last tag of a resource removes it from the request. Sent messages and reopened conversations parse the same tokens;
  older messages with a trailing "[Attached ...]" block still render as chips.
- The workspace (`features/ai-assistant/workspace`) holds one authoritative draft per conversation (name, steps, missing fields,
  referenced servers and files, revision, saved version). It is stored in `localStorage` per conversation, separately from saved
  workflows, and is sent with every chat request, manual edits included. A reply based on an older revision is offered, not applied;
  a reply for another conversation only updates that conversation's stored draft. Step editing reuses `FlowCanvas`, `NodeInspector`
  and `useNodeEditing`, shared with the standalone builder.
- Save validates and then creates or updates through the workflow API; Run opens the usual run dialog with the conversation's servers
  preselected and is enabled only for a saved, unmodified revision. Nothing here is triggered by an assistant reply.
- A failed request keeps the user's message in the thread (marked "Not sent"), the draft untouched, and offers Retry with the same
  request. The backend answers an unusable empty reply with `502 AI_EMPTY_RESPONSE` and stores nothing for a failed request.

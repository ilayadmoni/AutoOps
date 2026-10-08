# AutoOps frontend

React 19 + TypeScript + Vite single-page app. `npm run dev` proxies `/api` to `localhost:8080`;
`npm run build` runs the i18n key check, the TypeScript check and the production build;
`npm run test:ui` runs the source-level UI and architecture checks.

## Where things go

`src/` is organized by responsibility, not by file type:

| Folder        | What lives there |
| ------------- | ---------------- |
| `app/`        | App setup: routing (`App.tsx`), route guards, the shell layout, and the global providers (query client, router, i18n, theme, toasts, auth). |
| `assets/`     | Static assets: images and the stylesheet layers (`assets/styles/index.css` imports them in cascade order). |
| `components/` | Reusable UI primitives used across features (buttons, inputs, modals, badges, loaders…). Import from the `components` barrel. |
| `features/`   | Feature-specific components and hooks, one folder per domain: `admin`, `ai-assistant`, `approvals`, `auth`, `commands`, `credentials`, `executions`, `machines`, `workflows`. |
| `hooks/`      | Reusable custom hooks: context accessors (`useAuth`, `useI18n`, `useTheme`, `useToast`), shared queries (`useMachines`, `useCredentials`, `useCommands`, `useFiles`, `usePendingApprovals`) and small utilities. |
| `lib/`        | Third-party configuration and low-level libraries: the fetch client (in-memory access token, single-flight refresh, SSE over fetch), the TanStack Query client and query keys, and the i18n dictionaries. |
| `pages/`      | Route-level views, one per route (`pages/admin/` for admin routes). Only the router imports them. |
| `services/`   | API calls, one module per backend area. UI code never calls the fetch helpers directly. |
| `types/`      | TypeScript types: API DTOs (`api.ts`) and UI preferences. |
| `utils/`      | Pure helpers and constants: formatting, storage, parameters, downloads. |

Quick decision guide for a new file: reusable UI → `components/`; tied to one feature → `features/<name>/`;
calls the server → `services/`; pure helper or constant → `utils/`; a whole screen behind a route → `pages/`.
`npm run test:ui` enforces the two boundaries that matter most: HTTP only through `services/`, and pages
imported only by the router.

## i18n

English and Hebrew dictionaries live in `lib/i18n/`; Hebrew switches the document to RTL while code, paths and
addresses stay LTR. The Hebrew dictionary is type-checked against English, and the build fails on a literal
`t('key')` that is missing from English.

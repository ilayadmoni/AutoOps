# AutoOps frontend

React 19 + TypeScript + Vite 7 SPA with TanStack Query, React Router, React Flow, Motion and Lucide. English/Hebrew and light/dark themes are supported.

## Run locally

Use Node.js 22 with npm. Start/configure the Java backend and infrastructure using [native development](../docs/DEVELOPMENT.md), then from `frontend/`:

```bash
npm ci
npm run dev
```

Open the URL Vite prints, normally **http://localhost:5173/**. The checked-in Vite config proxies `/api` to `http://localhost:8080`; it does not enable HTTPS. The [Docker installation](../docs/INSTALLATION.md) instead serves the built frontend through Nginx at **https://localhost/** on port 443.

AI keys and SSH passwords belong on the backend, not in Vite environment variables or client bundles. [AI configuration](../docs/AI_SETUP.md) controls whether the assistant is available; manual workflows remain usable without it.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | i18n key check, TypeScript check and production build into `dist/` |
| `npm run typecheck` | TypeScript check |
| `npm run i18n:check` | Validate translation-key usage |
| `npm run test:ui` | Node-based UI integration tests |
| `npm run preview` | Vite production-build preview; not the Docker HTTPS/API deployment |

## Source layout

- `src/app/` — routes, auth/theme/i18n providers and application shell.
- `src/pages/` — route-level screens.
- `src/features/` — assistant workspace and mentions, workflow builder, machine inventory/imports, run forms and other domain UI.
- `src/components/` — shared components and UI/flow primitives.
- `src/services/` — API client and domain calls.
- `src/types/` — client data types.
- `src/lib/i18n/` — English/Hebrew dictionaries; Hebrew changes document direction while paths, commands and addresses remain LTR.
- `src/assets/` — styles, theme tokens and self-hosted fonts.

The home route is the assistant. Workflow proposals appear beside chat for review; selecting machines with `@` attaches their actual IDs. Saving and running are separate explicit actions. See [first run](../docs/FIRST_RUN.md) and [frontend reference](../docs/FRONTEND.md).

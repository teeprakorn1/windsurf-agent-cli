# Contributing to Aiyu MultiAgent Dashboard

Thank you for your interest in contributing! This document covers the development workflow.

## Prerequisites

- Node.js 18+ (or Bun)
- npm 9+
- A running Aiyu API server (for integration testing)

## Setup

```bash
git clone https://github.com/teeprakorn1/aiyu-multi-agent.git
cd aiyu-multi-agent/aiyu-multi-agent-dashboard
npm install
```

## Development

```bash
# Start dev server (hot reload on :3001 by default)
npm run dev

# With custom WS URL
NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws npm run dev

# With Docker network metrics proxy
METRICS_PROXY_ALLOWED_HOSTS=aiyu-api npm run dev
```

## Code Style

- **TypeScript** — strict mode, no `any` unless interfacing with untyped WS payloads
- **Components** — functional, `"use client"` directive required for WS-consuming components, wrap with `React.memo` for performance
- **Styling** — Tailwind CSS utility classes, custom CSS variables in `globals.css`
- **State** — WS state via `useWs()` context, local state via `useState`
- **Naming** — kebab-case files, PascalCase components, camelCase functions

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(component): add search filter to logs viewer
fix(ws): prevent silent send when disconnected
docs: update README with architecture diagram
chore: remove unused dependencies
```

## Pull Request Process

1. Fork → Branch → Commit → Push → PR
2. Ensure `npm run build` passes with zero errors
3. Ensure `npm run lint` passes
4. Describe the change and reference any related issues
5. One approval required before merge

## Testing

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Build (catches most issues)
npm run build
```

## Project Structure

```
src/
├── app/           # Next.js App Router pages
├── components/    # React components (one per file)
└── lib/           # Hooks, types, context
```

## Adding a New Component

1. Create `src/components/your-component.tsx`
2. Add `"use client"` if it consumes WS state
3. Wrap with `React.memo` (e.g. `export const MyComponent = memo(function MyComponent() { ... })`)
4. Import from `@/lib/ws-context` via `useWs()`
5. Add to `src/app/page.tsx` layout inside the appropriate `<section>`
6. Update this README and CHANGELOG

## Reporting Bugs

Open an issue with:
- Dashboard version (`package.json` version)
- Browser + OS
- Steps to reproduce
- Console errors (browser dev tools)
- WS connection status (Live/Offline badge)

# Atlas

Atlas is a Phase 0 structural scaffold for a browser-first AI coding agent powered by OpenCode. This repository establishes maintainable frontend architecture and responsive layout primitives, not product functionality or final visual identity.

## Stack

- React 19 + TypeScript
- Vite
- Plain CSS variables, Grid, Flexbox, and responsive breakpoints
- Client-side route-aware rendering with no authentication or backend dependency

## Structure

- `src/App.tsx` contains the route map, landing-page hierarchy, public placeholders, and authenticated page composition.
- `src/components.tsx` contains shared site navigation, skeleton primitives, feature/integration cards, product preview, and application shell components.
- `src/styles.css` contains neutral structural tokens and mobile-first responsive rules.

## Commands

```sh
npm install
npm run lint
npm run build
npm run dev
```

## Deferred to Phase 1

OpenCode SDK integration, model/provider authentication, BYOK storage, MCP/CLI execution, database operations, agent streaming, workspace provisioning, project file operations, billing, final branding, marketing copy, imagery, and decorative motion are intentionally not implemented.

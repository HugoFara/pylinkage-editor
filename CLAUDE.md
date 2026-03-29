# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pylinkage Editor is a visual planar linkage design and synthesis tool. It's a React/TypeScript frontend that communicates with a Python backend (pylinkage) over `/api` for simulation and synthesis. Part of the [the-great-walker](../CLAUDE.md) monorepo.

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server at http://localhost:5173 (proxies /api → localhost:8000)
npm run build        # tsc + vite build
npm run lint         # ESLint
npm run type-check   # TypeScript checking (tsc --noEmit)
npm run preview      # preview production build
```

CI runs `lint`, `type-check`, and `build` on every push/PR to main.

## Architecture

### Data Model

**Link-first paradigm**: Links are the primary entity; joints are derived from connections between links. This is the inverse of pylinkage's joint-first model.

- **Links** have a type (`ground`, `driver`, `arc_driver`, `link`) and reference an array of joint IDs
- **Joints** have a type (`revolute`, `prismatic`, `tracker`) and a position
- A `MechanismDict` groups links, joints, and a ground link reference

### State Management (Zustand)

Three active stores, split by concern:

| Store | Responsibility | Undo/Redo |
|-------|---------------|-----------|
| `mechanismStore` | Mechanism data (links, joints, loci), CRUD operations, joint snapping | Yes (zundo, 50 states) |
| `editorStore` | UI mode, selection, hover, animation frame, draw state, view toggles | No |
| `synthesisStore` | Synthesis inputs (precision points, angle pairs, poses), results, options | No |

`linkageStore` exists but is **unused dead code** (legacy joint-first format). Safe to remove.

### Canvas Coordinate System

The canvas uses a mathematical coordinate system (origin at center, Y-up), converted to/from Konva screen coordinates:
- `screenToCanvas`: `(x - width/2, height/2 - y)`
- `canvasToScreen`: `(x + width/2, height/2 - y)`

### Mode-Driven Interaction

The editor is mode-based (selected via keyboard 1-4 or toolbar). Each mode changes click/drag behavior on the canvas:
- `select` / `draw-link` / `move-joint` / `delete`
- `place-crank` / `place-arccrank` / `place-linear` / `place-*-joint` for type conversion

### Backend API

All in `src/api/client.ts`. REST endpoints:
- **CRUD**: `/api/mechanisms` (list, get, create, update, delete)
- **Simulation**: `/api/mechanisms/{id}/simulate`, `/trajectory`, `/rotation-period`
- **Examples**: `/api/examples` (list, get, load)
- **Synthesis**: `/api/synthesis/{path,function,motion}-generation`

WebSocket endpoints for streaming simulation frames:
- `/api/ws/simulation/{id}` (frame-by-frame)
- `/api/ws/simulation-fast/{id}` (batch all frames)

### Synthesis Workflow

Three modes: path generation, function generation, motion generation. User adds constraint points on the synthesis canvas, solves via backend API, previews 4-bar solutions, then loads a selected solution into the mechanism editor.

### Path Alias

`@/` maps to `src/` (configured in both vite.config.ts and tsconfig.json).

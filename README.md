# Pylinkage Editor

A visual planar linkage design and synthesis tool. Build mechanisms interactively on a canvas, simulate their motion, and synthesize 4-bar linkages from constraints.

## Features

- **Interactive canvas** -- draw links, place joints (revolute, prismatic, tracker), snap connections, animate motion
- **Mechanism synthesis** -- path generation, function generation, and motion generation for 4-bar linkages
- **Simulation** -- run kinematic simulations and visualize coupler trajectories (loci)
- **Undo/redo** -- full history (50 states) via Zundo
- **Example library** -- browse and load prebuilt mechanisms
- **Keyboard shortcuts** -- mode selection and common operations

## Tech Stack

React 18, TypeScript, Zustand, Konva (react-konva), TanStack React Query, Vite

## Getting Started

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` and proxies `/api` requests to a backend at `http://localhost:8000` (the pylinkage Python server).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checking |

## Project Structure

```
src/
├── api/            # Backend API client (CRUD, simulation, synthesis)
├── components/
│   ├── canvas/     # Interactive Konva canvas and toolbar
│   ├── examples/   # Example browser panel
│   ├── layout/     # App shell, sidebar, tab bar
│   ├── sidebar/    # Animation controls, link list, example loader
│   └── synthesis/  # Synthesis canvas and sidebar
├── hooks/          # Keyboard shortcuts, simulation streaming
├── stores/         # Zustand stores (mechanism, editor, synthesis)
├── types/          # TypeScript type definitions
└── utils/
```

## Architecture

The editor uses a **link-first** data model: links are primary entities and joints are derived from their connections. The frontend communicates with a Python backend (pylinkage) over `/api` for computationally intensive tasks like synthesis and simulation.

State is managed with Zustand stores split by concern:
- **mechanismStore** -- links, joints, mechanism data, undo/redo
- **editorStore** -- UI mode, selection, canvas state
- **synthesisStore** -- synthesis inputs and results

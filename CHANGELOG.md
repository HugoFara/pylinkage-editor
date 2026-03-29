# Changelog

All notable changes to pylinkage-editor are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Topology synthesis mode:** Fourth synthesis mode that searches across
  4-bar, 6-bar, and 8-bar topologies, displaying ranked results with quality
  metrics (path accuracy, transmission angle, Grashof status). Configurable
  max link count (4/6/8).
- **Interact mode:** New editor mode (shortcut 4) for manually manipulating
  mechanisms. Drag any non-ground joint to scrub through the simulation and
  put the mechanism in a specific configuration — the crank becomes passive
  and all joints update dynamically to maintain constraints.
- **Joint trajectory preview:** Synthesis canvas now draws trajectories for
  all moving joints during solution preview, not just tracker points. Coupler
  paths are prominent; other joints show subtle traces for context.

## [0.1.0] - 2026-03-29

Initial release of pylinkage-editor — a visual planar linkage design and
synthesis tool built with React, TypeScript, and Konva.

### Added

- **Link-first mechanism editor:** Create, move, and delete links and joints
  on an interactive canvas with undo/redo (50 states via zundo).
- **Joint and link types:** Ground, driver (crank), arc driver, and standard
  links; revolute, prismatic, and tracker joints.
- **Canvas controls:** Zoom, pan, axis graduation, grid snapping, and
  mathematical coordinate system (origin-centered, Y-up).
- **Mode-driven interaction:** Select, draw-link, move-joint, delete modes
  with keyboard shortcuts (1-4).
- **Simulation:** Backend-driven kinematic simulation with frame-by-frame
  animation and trajectory visualization via WebSocket streaming.
- **Synthesis:** Path generation, function generation, and motion generation
  modes with precision point / angle pair / pose input, backend Burmester
  solving, and interactive solution preview with hover animation.
- **Optimization tab:** Multi-objective optimization UI with objective and
  algorithm configuration.
- **Export panel:** Python code, SVG, DXF, and STEP file downloads.
- **Examples:** Built-in example mechanisms loadable from the backend.
- **CI/CD:** GitHub Actions for lint, type-check, build, and auto-deploy to
  GitHub Pages.

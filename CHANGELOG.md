# Changelog

All notable changes to pylinkage-editor are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

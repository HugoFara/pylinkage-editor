/**
 * Store for synthesis tab state.
 * Manages inputs (points, angle pairs, poses), results, and selection.
 */

import { create } from 'zustand';
import type { SimulationFrame, SynthesisMode, SynthesisResponse, TopologySynthesisResponse } from '../types/mechanism';

interface SynthesisState {
  // Current synthesis mode
  mode: SynthesisMode;
  setMode: (mode: SynthesisMode) => void;

  // Path generation inputs
  precisionPoints: { x: number; y: number }[];
  addPoint: (point: { x: number; y: number }) => void;
  removePoint: (index: number) => void;
  clearPoints: () => void;

  // Function generation inputs
  anglePairs: { theta_in: number; theta_out: number }[];
  addAnglePair: (pair: { theta_in: number; theta_out: number }) => void;
  removeAnglePair: (index: number) => void;
  clearAnglePairs: () => void;

  // Motion generation inputs
  poses: { x: number; y: number; angle: number }[];
  addPose: (pose: { x: number; y: number; angle: number }) => void;
  removePose: (index: number) => void;
  clearPoses: () => void;

  // Options
  requireGrashof: boolean;
  setRequireGrashof: (v: boolean) => void;
  maxSolutions: number;
  setMaxSolutions: (n: number) => void;
  maxLinks: number;
  setMaxLinks: (n: number) => void;

  // Results
  results: SynthesisResponse | null;
  setResults: (results: SynthesisResponse | null) => void;
  topologyResults: TopologySynthesisResponse | null;
  setTopologyResults: (results: TopologySynthesisResponse | null) => void;
  selectedSolutionIndex: number | null;
  selectSolution: (index: number | null) => void;
  hoveredSolutionIndex: number | null;
  setHoveredSolution: (index: number | null) => void;
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;

  // Preview animation (simulated frames for hovered/selected solution)
  previewFrames: SimulationFrame[] | null;
  previewJointNames: string[] | null;
  previewFrame: number;
  setPreview: (frames: SimulationFrame[], jointNames: string[]) => void;
  clearPreview: () => void;
  setPreviewFrame: (frame: number) => void;

  // Reset all
  clearAll: () => void;
}

export const useSynthesisStore = create<SynthesisState>((set) => ({
  mode: 'path',
  setMode: (mode) => set({ mode, results: null, topologyResults: null, selectedSolutionIndex: null, hoveredSolutionIndex: null, previewFrames: null, previewJointNames: null, previewFrame: 0 }),

  // Path
  precisionPoints: [],
  addPoint: (point) =>
    set((s) => ({ precisionPoints: [...s.precisionPoints, point] })),
  removePoint: (index) =>
    set((s) => ({
      precisionPoints: s.precisionPoints.filter((_, i) => i !== index),
    })),
  clearPoints: () => set({ precisionPoints: [] }),

  // Function
  anglePairs: [],
  addAnglePair: (pair) =>
    set((s) => ({ anglePairs: [...s.anglePairs, pair] })),
  removeAnglePair: (index) =>
    set((s) => ({
      anglePairs: s.anglePairs.filter((_, i) => i !== index),
    })),
  clearAnglePairs: () => set({ anglePairs: [] }),

  // Motion
  poses: [],
  addPose: (pose) => set((s) => ({ poses: [...s.poses, pose] })),
  removePose: (index) =>
    set((s) => ({ poses: s.poses.filter((_, i) => i !== index) })),
  clearPoses: () => set({ poses: [] }),

  // Options
  requireGrashof: false,
  setRequireGrashof: (requireGrashof) => set({ requireGrashof }),
  maxSolutions: 10,
  setMaxSolutions: (maxSolutions) => set({ maxSolutions }),
  maxLinks: 6,
  setMaxLinks: (maxLinks) => set({ maxLinks }),

  // Results
  results: null,
  setResults: (results) => set({ results, selectedSolutionIndex: null, hoveredSolutionIndex: null, previewFrames: null, previewJointNames: null, previewFrame: 0 }),
  topologyResults: null,
  setTopologyResults: (topologyResults) => set({ topologyResults, selectedSolutionIndex: null, hoveredSolutionIndex: null, previewFrames: null, previewJointNames: null, previewFrame: 0 }),
  selectedSolutionIndex: null,
  selectSolution: (selectedSolutionIndex) => set({ selectedSolutionIndex }),
  hoveredSolutionIndex: null,
  setHoveredSolution: (hoveredSolutionIndex) => set({ hoveredSolutionIndex }),
  isRunning: false,
  setIsRunning: (isRunning) => set({ isRunning }),

  // Preview animation
  previewFrames: null,
  previewJointNames: null,
  previewFrame: 0,
  setPreview: (previewFrames, previewJointNames) => set({ previewFrames, previewJointNames, previewFrame: 0 }),
  clearPreview: () => set({ previewFrames: null, previewJointNames: null, previewFrame: 0 }),
  setPreviewFrame: (previewFrame) => set({ previewFrame }),

  // Reset
  clearAll: () =>
    set({
      precisionPoints: [],
      anglePairs: [],
      poses: [],
      results: null,
      topologyResults: null,
      selectedSolutionIndex: null,
      hoveredSolutionIndex: null,
      isRunning: false,
      previewFrames: null,
      previewJointNames: null,
      previewFrame: 0,
      maxLinks: 6,
    }),
}));

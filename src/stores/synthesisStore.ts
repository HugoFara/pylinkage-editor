/**
 * Store for synthesis tab state.
 * Manages inputs (points, angle pairs, poses), results, and selection.
 */

import { create } from 'zustand';
import type { SynthesisMode, SynthesisResponse } from '../types/mechanism';

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

  // Results
  results: SynthesisResponse | null;
  setResults: (results: SynthesisResponse | null) => void;
  selectedSolutionIndex: number | null;
  selectSolution: (index: number | null) => void;
  hoveredSolutionIndex: number | null;
  setHoveredSolution: (index: number | null) => void;
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;

  // Reset all
  clearAll: () => void;
}

export const useSynthesisStore = create<SynthesisState>((set) => ({
  mode: 'path',
  setMode: (mode) => set({ mode, results: null, selectedSolutionIndex: null }),

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

  // Results
  results: null,
  setResults: (results) => set({ results, selectedSolutionIndex: null, hoveredSolutionIndex: null }),
  selectedSolutionIndex: null,
  selectSolution: (selectedSolutionIndex) => set({ selectedSolutionIndex }),
  hoveredSolutionIndex: null,
  setHoveredSolution: (hoveredSolutionIndex) => set({ hoveredSolutionIndex }),
  isRunning: false,
  setIsRunning: (isRunning) => set({ isRunning }),

  // Reset
  clearAll: () =>
    set({
      precisionPoints: [],
      anglePairs: [],
      poses: [],
      results: null,
      selectedSolutionIndex: null,
      isRunning: false,
    }),
}));

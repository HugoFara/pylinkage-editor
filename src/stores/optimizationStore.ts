/**
 * Store for optimization tab state.
 * Manages objective, algorithm params, target points, results, and selection.
 */

import { create } from 'zustand';
import type {
  AlgorithmParams,
  AlgorithmType,
  ObjectiveType,
  OptimizationResponse,
} from '../types/optimization';

interface OptimizationState {
  // Objective
  objectiveType: ObjectiveType;
  setObjectiveType: (type: ObjectiveType) => void;
  jointIndex: number;
  setJointIndex: (index: number) => void;
  minimize: boolean;
  setMinimize: (v: boolean) => void;

  // Target path points (for target_path objective)
  targetPoints: { x: number; y: number }[];
  addTargetPoint: (point: { x: number; y: number }) => void;
  removeTargetPoint: (index: number) => void;
  clearTargetPoints: () => void;

  // Algorithm
  algorithmType: AlgorithmType;
  setAlgorithmType: (type: AlgorithmType) => void;

  // PSO params
  psoParticles: number;
  setPsoParticles: (n: number) => void;
  psoIterations: number;
  setPsoIterations: (n: number) => void;

  // DE params
  deIterations: number;
  setDeIterations: (n: number) => void;
  dePopulation: number;
  setDePopulation: (n: number) => void;

  // Nelder-Mead params
  nmIterations: number;
  setNmIterations: (n: number) => void;

  // Grid search params
  gsDivisions: number;
  setGsDivisions: (n: number) => void;
  gsResults: number;
  setGsResults: (n: number) => void;

  // Bounds
  boundsFactor: number;
  setBoundsFactor: (f: number) => void;

  // Results
  results: OptimizationResponse | null;
  setResults: (results: OptimizationResponse | null) => void;
  selectedResultIndex: number | null;
  selectResult: (index: number | null) => void;
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;
  error: string | null;
  setError: (e: string | null) => void;

  // Helpers
  buildAlgorithmParams: () => AlgorithmParams;
  clearAll: () => void;
}

export const useOptimizationStore = create<OptimizationState>((set, get) => ({
  // Objective
  objectiveType: 'x_extent',
  setObjectiveType: (objectiveType) =>
    set({ objectiveType, results: null, selectedResultIndex: null }),
  jointIndex: -1, // -1 means "last joint"
  setJointIndex: (jointIndex) => set({ jointIndex }),
  minimize: false,
  setMinimize: (minimize) => set({ minimize }),

  // Target points
  targetPoints: [],
  addTargetPoint: (point) =>
    set((s) => ({ targetPoints: [...s.targetPoints, point] })),
  removeTargetPoint: (index) =>
    set((s) => ({
      targetPoints: s.targetPoints.filter((_, i) => i !== index),
    })),
  clearTargetPoints: () => set({ targetPoints: [] }),

  // Algorithm
  algorithmType: 'pso',
  setAlgorithmType: (algorithmType) => set({ algorithmType }),

  // PSO
  psoParticles: 30,
  setPsoParticles: (psoParticles) => set({ psoParticles }),
  psoIterations: 100,
  setPsoIterations: (psoIterations) => set({ psoIterations }),

  // DE
  deIterations: 200,
  setDeIterations: (deIterations) => set({ deIterations }),
  dePopulation: 15,
  setDePopulation: (dePopulation) => set({ dePopulation }),

  // NM
  nmIterations: 1000,
  setNmIterations: (nmIterations) => set({ nmIterations }),

  // Grid
  gsDivisions: 5,
  setGsDivisions: (gsDivisions) => set({ gsDivisions }),
  gsResults: 5,
  setGsResults: (gsResults) => set({ gsResults }),

  // Bounds
  boundsFactor: 5.0,
  setBoundsFactor: (boundsFactor) => set({ boundsFactor }),

  // Results
  results: null,
  setResults: (results) => set({ results, selectedResultIndex: null }),
  selectedResultIndex: null,
  selectResult: (selectedResultIndex) => set({ selectedResultIndex }),
  isRunning: false,
  setIsRunning: (isRunning) => set({ isRunning }),
  error: null,
  setError: (error) => set({ error }),

  // Helpers
  buildAlgorithmParams: (): AlgorithmParams => {
    const s = get();
    switch (s.algorithmType) {
      case 'pso':
        return {
          algorithm: 'pso',
          n_particles: s.psoParticles,
          iterations: s.psoIterations,
          inertia: 0.6,
          leader: 3.0,
          follower: 0.1,
          neighbors: 17,
        };
      case 'differential_evolution':
        return {
          algorithm: 'differential_evolution',
          max_iterations: s.deIterations,
          population_size: s.dePopulation,
          tolerance: 0.01,
          mutation: [0.5, 1.0],
          recombination: 0.7,
          strategy: 'best1bin',
          seed: null,
        };
      case 'nelder_mead':
        return {
          algorithm: 'nelder_mead',
          max_iterations: s.nmIterations,
          tolerance: null,
        };
      case 'grid_search':
        return {
          algorithm: 'grid_search',
          divisions: s.gsDivisions,
          n_results: s.gsResults,
        };
    }
  },

  clearAll: () =>
    set({
      targetPoints: [],
      results: null,
      selectedResultIndex: null,
      isRunning: false,
      error: null,
    }),
}));

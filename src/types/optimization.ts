/**
 * TypeScript types for the optimization API.
 */

import type { MechanismDict } from './mechanism';

// Objective types
export type ObjectiveType =
  | 'path_length'
  | 'bounding_box_area'
  | 'x_extent'
  | 'y_extent'
  | 'target_path';

export interface ObjectiveSpec {
  type: ObjectiveType;
  joint_index: number;
  target_points?: number[][]; // Only for target_path
}

// Algorithm types
export type AlgorithmType =
  | 'pso'
  | 'differential_evolution'
  | 'nelder_mead'
  | 'grid_search';

export interface PSOParams {
  algorithm: 'pso';
  n_particles: number;
  iterations: number;
  inertia: number;
  leader: number;
  follower: number;
  neighbors: number;
}

export interface DifferentialEvolutionParams {
  algorithm: 'differential_evolution';
  max_iterations: number;
  population_size: number;
  tolerance: number;
  mutation: number[];
  recombination: number;
  strategy: string;
  seed: number | null;
}

export interface NelderMeadParams {
  algorithm: 'nelder_mead';
  max_iterations: number;
  tolerance: number | null;
}

export interface GridSearchParams {
  algorithm: 'grid_search';
  divisions: number;
  n_results: number;
}

export type AlgorithmParams =
  | PSOParams
  | DifferentialEvolutionParams
  | NelderMeadParams
  | GridSearchParams;

// Request / Response
export interface OptimizationRequest {
  mechanism: MechanismDict;
  objective: ObjectiveSpec;
  algorithm: AlgorithmParams;
  minimize: boolean;
  bounds_factor: number;
}

export interface OptimizationResultDTO {
  score: number;
  constraints: number[];
  mechanism_dict: MechanismDict | null;
}

export interface OptimizationResponse {
  results: OptimizationResultDTO[];
  best_score: number | null;
  constraint_names: string[];
  warnings: string[];
}

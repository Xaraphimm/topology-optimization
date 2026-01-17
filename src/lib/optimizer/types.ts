/**
 * Core types for topology optimization
 */

export interface OptimizationParams {
  nelx: number;           // Number of elements in x direction
  nely: number;           // Number of elements in y direction
  volfrac: number;        // Target volume fraction (0-1)
  penal: number;          // Penalization power (typically 3)
  rmin: number;           // Filter radius (in elements)
  maxIter: number;        // Maximum iterations
  tolx: number;           // Convergence tolerance for density change
}

export interface BoundaryCondition {
  type: 'fixed' | 'load';
  nodeIndices: number[];  // Node indices affected
  dofs: number[];         // Degrees of freedom (0=x, 1=y)
  values?: number[];      // Force values for loads
}

export interface ProblemDefinition {
  name: string;
  description: string;
  nelx: number;
  nely: number;
  fixedNodes: { x: number; y: number; dof: 'x' | 'y' | 'both' }[];
  loads: { x: number; y: number; fx: number; fy: number }[];
  aspectRatio: number;
}

export interface OptimizationState {
  densities: Float64Array;
  strainEnergy: Float64Array;  // Strain energy per element (for stress visualization)
  compliance: number;
  volume: number;
  iteration: number;
  converged: boolean;
  change: number;
}

export interface SparseMatrix {
  values: Float64Array;
  rowPtr: Int32Array;
  colInd: Int32Array;
  n: number;
}

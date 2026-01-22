/**
 * Constants for Topology Optimization
 *
 * Centralizes all magic numbers, default values, and configuration constants
 * used throughout the optimizer module.
 *
 * @module optimizer/constants
 */

/**
 * Default mesh configuration
 */
export const MESH_DEFAULTS = {
  /** Default number of elements in x direction */
  NELX: 60,
  /** Default number of elements in y direction */
  NELY: 20,
  /** Minimum allowed mesh elements in any direction */
  MIN_ELEMENTS: 1,
  /** Maximum allowed mesh elements in any direction */
  MAX_ELEMENTS: 1000,
} as const;

/**
 * SIMP algorithm parameters
 */
export const SIMP_DEFAULTS = {
  /** Default target volume fraction (0-1) */
  VOLUME_FRACTION: 0.5,
  /** Default penalization power */
  PENALIZATION: 3.0,
  /** Default filter radius in element sizes */
  FILTER_RADIUS: 1.5,
  /** Default maximum iterations */
  MAX_ITERATIONS: 200,
  /** Default convergence tolerance for density change */
  CONVERGENCE_TOLERANCE: 0.01,
  /** Minimum Young's modulus to prevent singularity */
  E_MIN: 1e-9,
  /** Solid material Young's modulus (normalized) */
  E_SOLID: 1.0,
  /** Default Poisson's ratio */
  POISSON_RATIO: 0.3,
} as const;

/**
 * Optimality Criteria (OC) update parameters
 */
export const OC_PARAMS = {
  /** Maximum density change per iteration */
  MOVE_LIMIT: 0.2,
  /** Minimum density value (prevents full void) */
  DENSITY_MIN: 0.001,
  /** Maximum density value */
  DENSITY_MAX: 1.0,
  /** Bisection initial upper bound for Lagrange multiplier */
  BISECTION_UPPER: 1e9,
  /** Bisection convergence tolerance */
  BISECTION_TOL: 1e-3,
} as const;

/**
 * Conjugate Gradient solver parameters
 */
export const CG_PARAMS = {
  /** Default solver tolerance */
  TOLERANCE: 1e-8,
  /** Default maximum iterations */
  MAX_ITERATIONS: 10000,
  /** Minimum residual for early termination */
  MIN_RESIDUAL: 1e-15,
} as const;

/**
 * Finite Element Method parameters
 */
export const FEM_PARAMS = {
  /** Nodes per element (Q4 quadrilateral) */
  NODES_PER_ELEMENT: 4,
  /** DOFs per node (2D: x and y) */
  DOFS_PER_NODE: 2,
  /** DOFs per element */
  DOFS_PER_ELEMENT: 8,
  /** Gauss quadrature points for 2x2 integration */
  GAUSS_POINTS: 2,
  /** Gauss point coordinate (1/sqrt(3)) */
  GAUSS_COORD: 0.5773502691896257,
} as const;

/**
 * Web Worker parameters
 */
export const WORKER_PARAMS = {
  /** Delay between optimization steps in worker (ms) */
  STEP_DELAY: 0,
} as const;

/**
 * History tracking parameters
 */
export const HISTORY_PARAMS = {
  /** Maximum history points to store */
  MAX_POINTS: 250,
} as const;

/**
 * Resolution presets for mesh dimensions
 */
export const RESOLUTION_PRESETS = {
  STANDARD: { label: 'Standard', multiplier: 1.0 },
  HIGH: { label: 'High', multiplier: 1.5 },
  ULTRA: { label: 'Ultra', multiplier: 2.0 },
} as const;

/**
 * Validate mesh dimensions against allowed range
 *
 * @param nelx - Number of elements in x direction
 * @param nely - Number of elements in y direction
 * @returns Clamped dimensions within valid range
 */
export function clampMeshDimensions(
  nelx: number,
  nely: number
): { nelx: number; nely: number } {
  return {
    nelx: Math.max(
      MESH_DEFAULTS.MIN_ELEMENTS,
      Math.min(MESH_DEFAULTS.MAX_ELEMENTS, Math.round(nelx))
    ),
    nely: Math.max(
      MESH_DEFAULTS.MIN_ELEMENTS,
      Math.min(MESH_DEFAULTS.MAX_ELEMENTS, Math.round(nely))
    ),
  };
}

/**
 * Validate volume fraction within allowed range
 *
 * @param volfrac - Target volume fraction
 * @returns Clamped volume fraction between 0.01 and 0.99
 */
export function clampVolumeFraction(volfrac: number): number {
  return Math.max(0.01, Math.min(0.99, volfrac));
}

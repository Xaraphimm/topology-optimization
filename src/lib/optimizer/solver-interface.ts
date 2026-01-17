/**
 * Unified Solver Interface
 * 
 * Provides a common interface for both JavaScript and WebAssembly
 * implementations of the Preconditioned Conjugate Gradient solver.
 */

import type { CSRMatrix } from './solver';
import { conjugateGradient as jsConjugateGradient } from './solver';
import { initWasm, isWasmAvailable, getWasmSolver } from './wasm-loader';

/**
 * Result from solving a linear system
 */
export interface SolveResult {
  x: Float64Array;
  iterations: number;
  residual: number;
}

/**
 * Common interface for PCG solvers
 */
export interface Solver {
  /**
   * Name of the solver implementation
   */
  readonly name: string;
  
  /**
   * Solve the linear system K*x = b
   * 
   * @param K - Sparse matrix in CSR format
   * @param b - Right-hand side vector
   * @param x0 - Initial guess (will be modified in place for JS solver)
   * @param tol - Convergence tolerance
   * @param maxIter - Maximum iterations
   * @returns Solution, iteration count, and final residual
   */
  solve(
    K: CSRMatrix,
    b: Float64Array,
    x0: Float64Array,
    tol: number,
    maxIter: number
  ): SolveResult;
}

/**
 * JavaScript implementation of the PCG solver
 * Wraps the existing conjugateGradient function
 */
export class JSSolver implements Solver {
  readonly name = 'JavaScript';
  
  solve(
    K: CSRMatrix,
    b: Float64Array,
    x0: Float64Array,
    tol: number,
    maxIter: number
  ): SolveResult {
    // Clone x0 since JS solver modifies in place
    const x = new Float64Array(x0);
    const result = jsConjugateGradient(K, b, x, tol, maxIter);
    return {
      x: result.x,
      iterations: result.iterations,
      residual: result.residual,
    };
  }
}

/**
 * WebAssembly implementation of the PCG solver
 * Uses the Rust-compiled WASM module for better performance
 */
export class WASMSolver implements Solver {
  readonly name = 'WebAssembly';
  
  solve(
    K: CSRMatrix,
    b: Float64Array,
    x0: Float64Array,
    tol: number,
    maxIter: number
  ): SolveResult {
    const wasmModule = getWasmSolver();
    
    if (!wasmModule) {
      throw new Error('WASM solver not available');
    }
    
    // Convert Int32Array to Uint32Array for WASM
    const colIndices = new Uint32Array(K.colIndices);
    const rowPointers = new Uint32Array(K.rowPointers);
    
    // Call the WASM solver
    const result = wasmModule.solve_pcg(
      K.values,
      colIndices,
      rowPointers,
      b,
      x0,
      tol,
      maxIter
    );
    
    // Extract results - solution is returned as a new array
    const solution = result.solution;
    const iterations = result.iterations;
    const residual = result.residual;
    
    // Free the WASM result object to avoid memory leaks
    // The solution array is already copied to JS
    if (typeof result.free === 'function') {
      result.free();
    }
    
    return {
      x: solution,
      iterations,
      residual,
    };
  }
}

// Singleton instances
let jsSolver: JSSolver | null = null;
let wasmSolver: WASMSolver | null = null;

/**
 * Get the JavaScript solver instance
 */
export function getJSSolver(): JSSolver {
  if (!jsSolver) {
    jsSolver = new JSSolver();
  }
  return jsSolver;
}

/**
 * Get the WASM solver instance
 * Returns null if WASM is not available
 */
export function getWASMSolver(): WASMSolver | null {
  if (!isWasmAvailable()) {
    return null;
  }
  if (!wasmSolver) {
    wasmSolver = new WASMSolver();
  }
  return wasmSolver;
}

/**
 * Create the best available solver
 * Prefers WASM if available, falls back to JavaScript
 * 
 * @param preferWasm - If false, always use JavaScript solver
 * @returns Promise resolving to the best available solver
 */
export async function createSolver(preferWasm: boolean = true): Promise<Solver> {
  if (preferWasm) {
    // Try to initialize WASM
    const wasmAvailable = await initWasm();
    
    if (wasmAvailable) {
      const solver = getWASMSolver();
      if (solver) {
        return solver;
      }
    }
  }
  
  // Fall back to JavaScript
  return getJSSolver();
}

/**
 * Create a solver synchronously (uses whatever is currently available)
 * Use createSolver() instead if you can wait for WASM initialization
 */
export function createSolverSync(): Solver {
  const wasmSolverInstance = getWASMSolver();
  if (wasmSolverInstance) {
    return wasmSolverInstance;
  }
  return getJSSolver();
}

/**
 * Check which solver type is currently preferred
 */
export function getPreferredSolverType(): 'wasm' | 'js' {
  return isWasmAvailable() ? 'wasm' : 'js';
}

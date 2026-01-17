/* tslint:disable */
/* eslint-disable */

/**
 * Preconditioned Conjugate Gradient solver for sparse linear systems
 *
 * Solves A*x = b where A is a symmetric positive definite sparse matrix
 * stored in CSR (Compressed Sparse Row) format.
 *
 * Uses Jacobi (diagonal) preconditioner for improved convergence.
 * Result struct containing solution and metadata
 */
export class SolveResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly iterations: number;
    readonly residual: number;
    readonly solution: Float64Array;
}

/**
 * Preconditioned Conjugate Gradient solver
 *
 * # Arguments
 * * `values` - Non-zero values of the sparse matrix (CSR format)
 * * `col_indices` - Column indices for each value
 * * `row_ptr` - Row pointers (index into values for each row start)
 * * `b` - Right-hand side vector
 * * `x0` - Initial guess
 * * `tol` - Convergence tolerance
 * * `max_iter` - Maximum number of iterations
 *
 * # Returns
 * SolveResult containing the solution vector, iteration count, and final residual
 */
export function solve_pcg(values: Float64Array, col_indices: Uint32Array, row_ptr: Uint32Array, b: Float64Array, x0: Float64Array, tol: number, max_iter: number): SolveResult;

/**
 * Simple test function to verify WASM is working
 */
export function wasm_test(): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_solveresult_free: (a: number, b: number) => void;
    readonly solve_pcg: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => number;
    readonly solveresult_iterations: (a: number) => number;
    readonly solveresult_residual: (a: number) => number;
    readonly solveresult_solution: (a: number) => [number, number];
    readonly wasm_test: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

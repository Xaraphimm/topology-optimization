/**
 * WASM module loader with error handling and caching
 * 
 * Handles async loading of the Rust-compiled PCG solver WASM module.
 * Supports both browser (fetch-based) and Node.js (file-based) environments.
 */

import type { InitOutput, SolveResult as WasmSolveResult } from './wasm-pkg/topology_wasm_solver';

// Module state
let wasmModule: InitOutput | null = null;
let loadPromise: Promise<InitOutput | null> | null = null;
let loadError: Error | null = null;

// Type for the WASM module exports
interface WasmSolverModule {
  solve_pcg: (
    values: Float64Array,
    col_indices: Uint32Array,
    row_ptr: Uint32Array,
    b: Float64Array,
    x0: Float64Array,
    tol: number,
    max_iter: number
  ) => WasmSolveResult;
  wasm_test: () => number;
}

// Re-export the solve result type
export type { WasmSolveResult };

/**
 * Check if we're in a Node.js-like environment where we can use native file reading
 */
function canUseNodeFs(): boolean {
  // Check for Node.js process and versions
  return typeof process !== 'undefined' && 
         process.versions != null && 
         process.versions.node != null;
}

/**
 * Load WASM in Node.js/vitest environment using native fs
 * This function uses dynamic imports to avoid bundler issues
 */
async function loadWasmInNode(): Promise<InitOutput | null> {
  // Dynamic import of Node.js built-ins
  const fs = await import('node:fs');
  const path = await import('node:path');
  const url = await import('node:url');
  
  // Get the directory of this module
  const __filename = url.fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Read the WASM file
  const wasmPath = path.join(__dirname, 'wasm-pkg', 'topology_wasm_solver_bg.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  
  // Import the WASM module and use initSync
  const wasmInit = await import('./wasm-pkg/topology_wasm_solver');
  wasmInit.initSync({ module: wasmBuffer });
  
  return wasmInit as unknown as InitOutput;
}

/**
 * Load WASM in browser environment using fetch
 */
async function loadWasmInBrowser(): Promise<InitOutput | null> {
  const wasmInit = await import('./wasm-pkg/topology_wasm_solver');
  await wasmInit.default();
  return wasmInit as unknown as InitOutput;
}

/**
 * Load and initialize the WASM module
 * Returns null if loading fails (caller should fall back to JS solver)
 */
async function loadWasmModule(): Promise<InitOutput | null> {
  try {
    let module: InitOutput | null;
    
    // Try Node.js-specific loading first if we're in a Node environment
    // This works in Node.js and vitest/jsdom environments
    if (canUseNodeFs()) {
      try {
        module = await loadWasmInNode();
      } catch {
        // Fall back to browser-style loading (might work in some Node setups)
        module = await loadWasmInBrowser();
      }
    } else {
      // Browser environment
      module = await loadWasmInBrowser();
    }
    
    if (!module) {
      throw new Error('Failed to load WASM module');
    }
    
    // Dynamic import to get the functions
    const wasmInit = await import('./wasm-pkg/topology_wasm_solver');
    
    // Test that the module works
    const testResult = wasmInit.wasm_test();
    const expectedSum = 1/11 + 7/11; // ~0.727
    
    if (Math.abs(testResult - expectedSum) > 1e-6) {
      throw new Error(`WASM test failed: expected ~${expectedSum}, got ${testResult}`);
    }
    
    return module;
  } catch (error) {
    console.warn('Failed to load WASM solver:', error);
    loadError = error instanceof Error ? error : new Error(String(error));
    return null;
  }
}

/**
 * Initialize the WASM module (call early to start loading)
 * Safe to call multiple times - will only load once
 */
export async function initWasm(): Promise<boolean> {
  if (wasmModule !== null) {
    return true;
  }
  
  if (loadError !== null) {
    return false;
  }
  
  if (loadPromise === null) {
    loadPromise = loadWasmModule();
  }
  
  wasmModule = await loadPromise;
  return wasmModule !== null;
}

/**
 * Check if WASM solver is available
 * Returns false if module hasn't loaded or failed to load
 */
export function isWasmAvailable(): boolean {
  return wasmModule !== null;
}

/**
 * Check if WASM loading has been attempted and failed
 */
export function hasWasmFailed(): boolean {
  return loadError !== null;
}

/**
 * Get the last WASM loading error, if any
 */
export function getWasmError(): Error | null {
  return loadError;
}

/**
 * Get the WASM solver module
 * Returns null if not loaded or failed to load
 * 
 * @throws Error if called before initWasm()
 */
export function getWasmSolver(): WasmSolverModule | null {
  if (wasmModule === null) {
    return null;
  }
  
  // Cast to our typed interface
  return wasmModule as unknown as WasmSolverModule;
}

/**
 * Synchronously check if WASM is loading
 */
export function isWasmLoading(): boolean {
  return loadPromise !== null && wasmModule === null && loadError === null;
}

/**
 * Reset the WASM module state (mainly for testing)
 */
export function resetWasmState(): void {
  wasmModule = null;
  loadPromise = null;
  loadError = null;
}

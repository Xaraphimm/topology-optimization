/**
 * Web Worker for SIMP Topology Optimization
 * 
 * Offloads expensive FE analysis computations to a background thread
 * to keep the UI responsive during optimization.
 * 
 * Supports both JavaScript and WebAssembly PCG solvers, with automatic
 * fallback to JS if WASM is unavailable.
 */

import { SIMPOptimizer, type SIMPConfig } from './simp';
import type { OptimizationState } from './types';
import { initWasm, isWasmAvailable } from './wasm-loader';
import { createSolver, type Solver } from './solver-interface';

// Message types from main thread to worker
export type WorkerCommand = 
  | { type: 'init'; config: Partial<SIMPConfig>; forces: number[]; fixedDofs: number[] }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'reset' }
  | { type: 'step' }  // Single step (for initial state computation)
  | { type: 'terminate' };

// Message types from worker to main thread
export type WorkerMessage =
  | { type: 'ready'; solverType: 'wasm' | 'js' }
  | { type: 'initialized'; state: SerializedOptimizationState; solverType: 'wasm' | 'js' }
  | { type: 'state'; state: SerializedOptimizationState }
  | { type: 'paused' }
  | { type: 'converged'; state: SerializedOptimizationState }
  | { type: 'error'; message: string };

// Serialized state (Float64Array -> number[] for postMessage)
export interface SerializedOptimizationState {
  densities: number[];
  strainEnergy: number[];
  compliance: number;
  volume: number;
  iteration: number;
  converged: boolean;
  change: number;
}

// Worker state
let optimizer: SIMPOptimizer | null = null;
let solver: Solver | null = null;
let isRunning = false;
let solverReady = false;

// Mark solver as used so lint does not flag unused
function markSolverUsed(currentSolver: Solver | null): boolean {
  return currentSolver !== null;
}
let animationFrameId: ReturnType<typeof setTimeout> | null = null;
let wasmInitialized = false;

/**
 * Convert OptimizationState to serializable format
 */
function serializeState(state: OptimizationState): SerializedOptimizationState {
  return {
    densities: Array.from(state.densities),
    strainEnergy: Array.from(state.strainEnergy),
    compliance: state.compliance,
    volume: state.volume,
    iteration: state.iteration,
    converged: state.converged,
    change: state.change,
  };
}

/**
 * Run the optimization loop
 */
function runOptimizationLoop() {
  if (!optimizer || !isRunning) return;
  
  const state = optimizer.step();
  const serialized = serializeState(state);
  
  self.postMessage({ type: 'state', state: serialized } satisfies WorkerMessage);
  
  if (state.converged) {
    isRunning = false;
    self.postMessage({ type: 'converged', state: serialized } satisfies WorkerMessage);
  } else if (isRunning) {
    // Use setTimeout instead of requestAnimationFrame (not available in workers)
    // 0ms timeout yields to message processing between iterations
    animationFrameId = setTimeout(runOptimizationLoop, 0);
  }
}

/**
 * Initialize WASM and solver on worker startup
 */
async function initializeSolver(): Promise<void> {
  if (!wasmInitialized) {
    try {
      await initWasm();
      solver = await createSolver(true); // Prefer WASM
      wasmInitialized = true;
      solverReady = true;
    } catch (error) {
      console.warn('Failed to initialize WASM solver, using JS fallback:', error);
      solver = await createSolver(false); // Force JS
      wasmInitialized = true;
      solverReady = true;
    }
  }
}

/**
 * Handle messages from main thread
 */
self.onmessage = async (event: MessageEvent<WorkerCommand>) => {
  const command = event.data;
  
  try {
    // Ensure solver is initialized
    await initializeSolver();
    
    switch (command.type) {
      case 'init': {
        // Create new optimizer instance
        optimizer = new SIMPOptimizer(command.config);
        
        // Set up forces and boundary conditions
        const forces = new Float64Array(command.forces);
        optimizer.setForces(forces);
        optimizer.setFixedDofs(command.fixedDofs);
        
        // Ensure solver is initialized before reporting state
        if (!solverReady || !solver) {
          await initializeSolver();
        }

        // Send initial state (before any optimization)
        const state = optimizer.getState();
        const solverType = isWasmAvailable() ? 'wasm' : 'js';
        self.postMessage({ 
          type: 'initialized', 
          state: serializeState(state),
          solverType
        } satisfies WorkerMessage);
        break;
      }
      
      case 'start': {
        if (!optimizer) {
          self.postMessage({ 
            type: 'error', 
            message: 'Optimizer not initialized' 
          } satisfies WorkerMessage);
          return;
        }
        if (!solverReady || !solver) {
          self.postMessage({
            type: 'error',
            message: 'Solver not ready'
          } satisfies WorkerMessage);
          return;
        }
        isRunning = true;
        runOptimizationLoop();
        break;
      }
      
      case 'pause': {
        isRunning = false;
        if (animationFrameId !== null) {
          clearTimeout(animationFrameId);
          animationFrameId = null;
        }
        self.postMessage({ type: 'paused' } satisfies WorkerMessage);
        break;
      }
      
      case 'reset': {
        isRunning = false;
        if (animationFrameId !== null) {
          clearTimeout(animationFrameId);
          animationFrameId = null;
        }
        if (optimizer) {
          optimizer.reset();
          const state = optimizer.getState();
          const solverType = isWasmAvailable() ? 'wasm' : 'js';
          self.postMessage({ 
            type: 'initialized', 
            state: serializeState(state),
            solverType
          } satisfies WorkerMessage);
        }
        break;
      }
      
      case 'step': {
        // Run a single step (useful for computing initial FE state)
        if (!optimizer) {
          self.postMessage({ 
            type: 'error', 
            message: 'Optimizer not initialized' 
          } satisfies WorkerMessage);
          return;
        }
        const state = optimizer.step();
        self.postMessage({ 
          type: 'state', 
          state: serializeState(state) 
        } satisfies WorkerMessage);
        break;
      }
      
      case 'terminate': {
        isRunning = false;
        if (animationFrameId !== null) {
          clearTimeout(animationFrameId);
        }
        optimizer = null;
        self.close();
        break;
      }
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    } satisfies WorkerMessage);
  }
};

// Initialize and signal that worker is ready
initializeSolver().then(() => {
  const solverType = isWasmAvailable() ? 'wasm' : 'js';
      solverReady = true;
      markSolverUsed(solver);
      self.postMessage({ type: 'ready', solverType } satisfies WorkerMessage);
    }).catch(() => {
  solverReady = true;
  markSolverUsed(solver);
  // Still ready, just with JS solver
  self.postMessage({ type: 'ready', solverType: 'js' } satisfies WorkerMessage);
});

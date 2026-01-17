/**
 * Web Worker for SIMP Topology Optimization
 * 
 * Offloads expensive FE analysis computations to a background thread
 * to keep the UI responsive during optimization.
 */

import { SIMPOptimizer, type SIMPConfig } from './simp';
import type { OptimizationState } from './types';

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
  | { type: 'ready' }
  | { type: 'initialized'; state: SerializedOptimizationState }
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
let isRunning = false;
let animationFrameId: ReturnType<typeof setTimeout> | null = null;

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
 * Handle messages from main thread
 */
self.onmessage = (event: MessageEvent<WorkerCommand>) => {
  const command = event.data;
  
  try {
    switch (command.type) {
      case 'init': {
        // Create new optimizer instance
        optimizer = new SIMPOptimizer(command.config);
        
        // Set up forces and boundary conditions
        const forces = new Float64Array(command.forces);
        optimizer.setForces(forces);
        optimizer.setFixedDofs(command.fixedDofs);
        
        // Send initial state (before any optimization)
        const state = optimizer.getState();
        self.postMessage({ 
          type: 'initialized', 
          state: serializeState(state) 
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
          self.postMessage({ 
            type: 'initialized', 
            state: serializeState(state) 
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

// Signal that worker is ready
self.postMessage({ type: 'ready' } satisfies WorkerMessage);

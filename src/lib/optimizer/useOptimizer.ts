/**
 * React hook for managing SIMP optimization via Web Worker
 *
 * Provides a clean interface for the UI to control optimization
 * while keeping computations off the main thread.
 *
 * v2.3.0: Refactored to use centralized constants module.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SIMPConfig } from './simp';
import type { WorkerCommand, WorkerMessage, SerializedOptimizationState } from './simp.worker';
import { HISTORY_PARAMS, SIMP_DEFAULTS } from './constants';

export interface UseOptimizerConfig {
  config: Partial<SIMPConfig>;
  forces: Float64Array;
  fixedDofs: number[];
}

export interface UseOptimizerState {
  densities: Float64Array;
  strainEnergy: Float64Array;
  compliance: number;
  volume: number;
  iteration: number;
  converged: boolean;
  change: number;
}

/**
 * A single point in the optimization history for graphing
 */
export interface HistoryPoint {
  iteration: number;
  compliance: number;
  change: number;
  volume: number;
}

export interface UseOptimizerReturn {
  state: UseOptimizerState;
  history: HistoryPoint[];
  isRunning: boolean;
  isReady: boolean;
  error: string | null;
  start: () => void;
  pause: () => void;
  reset: () => void;
  step: () => void;
}

/**
 * Initial state for optimizer hook
 * Uses SIMP_DEFAULTS for default volume fraction
 */
const INITIAL_STATE: UseOptimizerState = {
  densities: new Float64Array(0),
  strainEnergy: new Float64Array(0),
  compliance: Infinity,
  volume: SIMP_DEFAULTS.VOLUME_FRACTION,
  iteration: 0,
  converged: false,
  change: 1.0,
};

/**
 * Convert serialized state back to typed arrays
 */
function deserializeState(serialized: SerializedOptimizationState): UseOptimizerState {
  return {
    densities: new Float64Array(serialized.densities),
    strainEnergy: new Float64Array(serialized.strainEnergy),
    compliance: serialized.compliance,
    volume: serialized.volume,
    iteration: serialized.iteration,
    converged: serialized.converged,
    change: serialized.change,
  };
}

/**
 * Hook to manage SIMP optimization in a Web Worker
 */
export function useOptimizer(
  optimizerConfig: UseOptimizerConfig | null
): UseOptimizerReturn {
  const [state, setState] = useState<UseOptimizerState>(INITIAL_STATE);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const workerRef = useRef<Worker | null>(null);
  const configRef = useRef<UseOptimizerConfig | null>(null);
  const pendingStartRef = useRef(false);
  
  /**
   * Add a point to history, respecting max limit
   */
  const addHistoryPoint = useCallback((newState: UseOptimizerState) => {
    // Only add valid data points (after first FE solve)
    if (newState.iteration > 0 && newState.compliance < Infinity) {
      setHistory(prev => {
        const newPoint: HistoryPoint = {
          iteration: newState.iteration,
          compliance: newState.compliance,
          change: newState.change,
          volume: newState.volume,
        };
        
        // Avoid duplicates (same iteration)
        if (prev.length > 0 && prev[prev.length - 1].iteration === newPoint.iteration) {
          return prev;
        }
        
        const updated = [...prev, newPoint];
        // Cap at max points
        if (updated.length > HISTORY_PARAMS.MAX_POINTS) {
          return updated.slice(-HISTORY_PARAMS.MAX_POINTS);
        }
        return updated;
      });
    }
  }, []);
  
  /**
   * Clear history
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);
  
  // Initialize worker
  useEffect(() => {
    // Create worker
    const worker = new Worker(
      new URL('./simp.worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    workerRef.current = worker;
    
    // Handle messages from worker
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      
      switch (message.type) {
        case 'ready':
          // Worker is ready, initialize with config if available
          if (configRef.current) {
            const cmd: WorkerCommand = {
              type: 'init',
              config: configRef.current.config,
              forces: Array.from(configRef.current.forces),
              fixedDofs: configRef.current.fixedDofs,
            };
            worker.postMessage(cmd);
          }
          break;
          
        case 'initialized':
          setIsReady(true);
          setError(null);
          setState(deserializeState(message.state));
          if (pendingStartRef.current) {
            pendingStartRef.current = false;
            setIsRunning(true);
            worker.postMessage({ type: 'start' } satisfies WorkerCommand);
          }
          // Don't add to history - this is the initial state before optimization
          break;
          
        case 'state': {
          const newState = deserializeState(message.state);
          setState(newState);
          addHistoryPoint(newState);
          break;
        }
          
        case 'paused':
          setIsRunning(false);
          pendingStartRef.current = false;
          break;
          
        case 'converged': {
          setIsRunning(false);
          pendingStartRef.current = false;
          const newState = deserializeState(message.state);
          setState(newState);
          addHistoryPoint(newState);
          break;
        }
          
        case 'error':
          setError(message.message);
          setIsRunning(false);
          pendingStartRef.current = false;
          break;
      }
    };
    
    worker.onerror = (event) => {
      setError(event.message || 'Worker error');
      setIsRunning(false);
      pendingStartRef.current = false;
    };
    
    // Cleanup
    return () => {
      worker.postMessage({ type: 'terminate' } satisfies WorkerCommand);
      worker.terminate();
      workerRef.current = null;
    };
  }, [addHistoryPoint]);
  
  // Re-initialize when config changes
  useEffect(() => {
    if (!optimizerConfig) return;

    const nextConfig = optimizerConfig;

    configRef.current = nextConfig;
    setIsReady(false);
    setIsRunning(false);
    pendingStartRef.current = false;
    setState(INITIAL_STATE);
    clearHistory();
    setError(null);

    const worker = workerRef.current;
    if (worker) {
      const cmd: WorkerCommand = {
        type: 'init',
        config: nextConfig.config,
        forces: Array.from(nextConfig.forces),
        fixedDofs: nextConfig.fixedDofs,
      };
      worker.postMessage(cmd);
    }
  }, [optimizerConfig, clearHistory]);
  
  // Control functions
  const start = useCallback(() => {
    const worker = workerRef.current;
    if (!worker) {
      pendingStartRef.current = true;
      return;
    }
    if (isReady) {
      setIsRunning(true);
      pendingStartRef.current = false;
      worker.postMessage({ type: 'start' } satisfies WorkerCommand);
      return;
    }
    pendingStartRef.current = true;
  }, [isReady]);
  
  const pause = useCallback(() => {
    const worker = workerRef.current;
    if (worker) {
      worker.postMessage({ type: 'pause' } satisfies WorkerCommand);
    }
  }, []);
  
  const reset = useCallback(() => {
    const worker = workerRef.current;
    if (worker) {
      setIsRunning(false);
      pendingStartRef.current = false;
      clearHistory();
      worker.postMessage({ type: 'reset' } satisfies WorkerCommand);
    }
  }, [clearHistory]);
  
  const step = useCallback(() => {
    const worker = workerRef.current;
    if (worker && isReady && !isRunning) {
      worker.postMessage({ type: 'step' } satisfies WorkerCommand);
    }
  }, [isReady, isRunning]);
  
  return {
    state,
    history,
    isRunning,
    isReady,
    error,
    start,
    pause,
    reset,
    step,
  };
}

export default useOptimizer;

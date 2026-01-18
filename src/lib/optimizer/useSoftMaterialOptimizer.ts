/**
 * React hook for soft material topology optimization
 *
 * Similar to useOptimizer but with stress constraint support
 * for soft materials like silicones and TPU.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  SoftMaterialOptimizer,
  SoftMaterialConfig,
  SoftMaterialOptimizationState,
  DEFAULT_SOFT_CONFIG,
} from './soft-material-optimizer';
import type { SoftMaterial, StressAnalysisSummary } from '../soft-materials';
import type { HistoryPoint } from './useOptimizer';

export interface UseSoftMaterialOptimizerConfig {
  config: Partial<SoftMaterialConfig>;
  forces: Float64Array;
  fixedDofs: number[];
}

export interface SoftMaterialHistoryPoint extends HistoryPoint {
  maxStress: number;
  safetyMargin: number;
}

export interface UseSoftMaterialOptimizerReturn {
  state: SoftMaterialOptimizationState;
  history: SoftMaterialHistoryPoint[];
  stressSummary: StressAnalysisSummary;
  isRunning: boolean;
  isReady: boolean;
  error: string | null;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setMaterial: (material: SoftMaterial) => void;
  setSafetyFactor: (factor: number) => void;
  setMinWallThickness: (thickness: number) => void;
}

const initialState: SoftMaterialOptimizationState = {
  densities: new Float64Array(0),
  strainEnergy: new Float64Array(0),
  compliance: 0,
  volume: 0,
  iteration: 0,
  converged: false,
  change: 1,
  stressResults: [],
  stressSummary: {
    maxVonMises: 0,
    avgVonMises: 0,
    minSafetyMargin: 2.0,
    elementsAtRisk: 0,
    passesConstraint: true,
    recommendation: 'Ready to optimize.',
  },
  ruptureRisk: new Float64Array(0),
  minDensityField: new Float64Array(0),
  meetsStressConstraint: true,
  wallThicknessValid: true,
};

const initialHistory: SoftMaterialHistoryPoint[] = [];

/**
 * Hook for soft material topology optimization with stress constraints
 */
export function useSoftMaterialOptimizer(
  optimizerConfig: UseSoftMaterialOptimizerConfig | null
): UseSoftMaterialOptimizerReturn {
  const [state, setState] = useState<SoftMaterialOptimizationState>(initialState);
  const [history, setHistory] = useState<SoftMaterialHistoryPoint[]>(initialHistory);
  const [isRunning, setIsRunning] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optimizerRef = useRef<SoftMaterialOptimizer | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize optimizer when config changes
  useEffect(() => {
    if (!optimizerConfig) {
      setIsReady(false);
      return;
    }

    try {
      const optimizer = new SoftMaterialOptimizer(optimizerConfig.config);
      optimizer.setForces(optimizerConfig.forces);
      optimizer.setFixedDofs(optimizerConfig.fixedDofs);

      optimizerRef.current = optimizer;
      setIsReady(true);
      setError(null);

      // Reset state
      setState(optimizer.getState());
      setHistory(initialHistory);
      setIsRunning(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initialize optimizer');
      setIsReady(false);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [optimizerConfig]);

  // Animation loop for optimization
  const runOptimizationStep = useCallback(() => {
    if (!optimizerRef.current || !isRunning) return;

    const newState = optimizerRef.current.step();
    setState(newState);

    // Update history
    setHistory(prev => [
      ...prev,
      {
        iteration: newState.iteration,
        compliance: newState.compliance,
        volume: newState.volume,
        change: newState.change,
        maxStress: newState.stressSummary.maxVonMises,
        safetyMargin: newState.stressSummary.minSafetyMargin,
      },
    ]);

    if (!newState.converged) {
      animationFrameRef.current = requestAnimationFrame(runOptimizationStep);
    } else {
      setIsRunning(false);
    }
  }, [isRunning]);

  useEffect(() => {
    if (isRunning && isReady) {
      animationFrameRef.current = requestAnimationFrame(runOptimizationStep);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning, isReady, runOptimizationStep]);

  const start = useCallback(() => {
    if (isReady && !isRunning) {
      setIsRunning(true);
    }
  }, [isReady, isRunning]);

  const pause = useCallback(() => {
    setIsRunning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (optimizerRef.current) {
      optimizerRef.current.reset();
      setState(optimizerRef.current.getState());
      setHistory(initialHistory);
    }
  }, []);

  const setMaterial = useCallback((material: SoftMaterial) => {
    if (optimizerRef.current) {
      optimizerRef.current.setMaterial(material);
    }
  }, []);

  const setSafetyFactor = useCallback((factor: number) => {
    if (optimizerRef.current) {
      optimizerRef.current.setSafetyFactor(factor);
    }
  }, []);

  const setMinWallThickness = useCallback((thickness: number) => {
    if (optimizerRef.current) {
      optimizerRef.current.setMinWallThickness(thickness);
    }
  }, []);

  return {
    state,
    history,
    stressSummary: state.stressSummary,
    isRunning,
    isReady,
    error,
    start,
    pause,
    reset,
    setMaterial,
    setSafetyFactor,
    setMinWallThickness,
  };
}

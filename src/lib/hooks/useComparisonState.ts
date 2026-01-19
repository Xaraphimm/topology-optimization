/**
 * Hook for managing two independent topology optimizers side-by-side
 * 
 * Provides state and controls for comparison view where users can
 * run two optimizations with different parameters and compare results.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useOptimizer, type UseOptimizerConfig, type UseOptimizerState, type HistoryPoint } from '@/lib/optimizer/useOptimizer';
import { PRESETS, RESOLUTIONS, getMeshDimensions, getPreset } from '@/lib/presets';
import type { SIMPConfig } from '@/lib/optimizer/simp';

const configResetKey = (config: ComparisonConfig) => JSON.stringify(config);

/**
 * Configuration for a single comparison panel
 */
export interface ComparisonConfig {
  presetId: string;
  resolutionId: string;
  volumeFraction: number;
}

/**
 * Return type for the useComparisonState hook
 */
export interface UseComparisonStateReturn {
  // Configuration for each panel
  configA: ComparisonConfig;
  configB: ComparisonConfig;
  
  // Optimizer state for each panel
  stateA: UseOptimizerState;
  stateB: UseOptimizerState;
  
  // History for convergence graphs
  historyA: HistoryPoint[];
  historyB: HistoryPoint[];
  
  // Running status
  isRunningA: boolean;
  isRunningB: boolean;
  
  // Ready status
  isReadyA: boolean;
  isReadyB: boolean;
  
  // Errors
  errorA: string | null;
  errorB: string | null;
  
  // Boundary condition data for visualization
  bcDataA: BcData;
  bcDataB: BcData;
  
  // Mesh dimensions
  meshA: { nelx: number; nely: number };
  meshB: { nelx: number; nely: number };
  
  // Has the optimization started (for showing progress)
  hasStartedA: boolean;
  hasStartedB: boolean;
  
  // Control functions for individual panels
  setConfigA: (config: Partial<ComparisonConfig>) => void;
  setConfigB: (config: Partial<ComparisonConfig>) => void;
  startA: () => void;
  startB: () => void;
  pauseA: () => void;
  pauseB: () => void;
  resetA: () => void;
  resetB: () => void;
  
  // Control functions for both panels
  startBoth: () => void;
  pauseBoth: () => void;
  resetBoth: () => void;
  
  // Sync functions
  syncFromA: () => void;
  syncFromB: () => void;
}

interface BcData {
  supports: { x: number; y: number; type: 'pin' | 'roller-x' | 'roller-y' }[];
  loads: { x: number; y: number; dx: number; dy: number }[];
}

const DEFAULT_CONFIG: ComparisonConfig = {
  presetId: PRESETS[0].id,
  resolutionId: RESOLUTIONS[0].id,
  volumeFraction: 0.5,
};

/**
 * Build optimizer config from comparison config
 */
function buildOptimizerConfig(config: ComparisonConfig): { 
  optimizerConfig: UseOptimizerConfig; 
  bcData: BcData;
  mesh: { nelx: number; nely: number };
} {
  const preset = getPreset(config.presetId) || PRESETS[0];
  const resolution = RESOLUTIONS.find(r => r.id === config.resolutionId) || RESOLUTIONS[0];
  const { nelx, nely } = getMeshDimensions(preset, resolution);
  
  const { forces, fixedDofs, supports, loads } = preset.setup(nelx, nely);
  
  return {
    optimizerConfig: {
      config: {
        nelx,
        nely,
        volfrac: config.volumeFraction,
        penal: 3.0,
        rmin: Math.max(1.5, nelx / 40),
        maxIter: 200,
        tolx: 0.01,
      } as Partial<SIMPConfig>,
      forces,
      fixedDofs,
    },
    bcData: { supports, loads },
    mesh: { nelx, nely },
  };
}

/**
 * Hook to manage two independent optimizer instances for comparison view
 */
export function useComparisonState(): UseComparisonStateReturn {
  // Configuration state for each panel
  const [configA, setConfigAState] = useState<ComparisonConfig>(DEFAULT_CONFIG);
  const [configB, setConfigBState] = useState<ComparisonConfig>({
    ...DEFAULT_CONFIG,
    volumeFraction: 0.3, // Different default for panel B
  });
  
  // Track if optimization has started for each panel
  const [hasStartedA, setHasStartedA] = useState(false);
  const [hasStartedB, setHasStartedB] = useState(false);
  
  // Build optimizer configs and BC data
  const { optimizerConfig: optimizerConfigA, bcData: bcDataA, mesh: meshA } = useMemo(
    () => buildOptimizerConfig(configA),
    [configA]
  );
  
  const { optimizerConfig: optimizerConfigB, bcData: bcDataB, mesh: meshB } = useMemo(
    () => buildOptimizerConfig(configB),
    [configB]
  );
  
  // Use optimizer hooks
  const optimizerA = useOptimizer(optimizerConfigA);
  const optimizerB = useOptimizer(optimizerConfigB);
  
  const resetKeyA = useMemo(() => configResetKey(configA), [configA]);
  const resetKeyB = useMemo(() => configResetKey(configB), [configB]);

  // Reset hasStarted when config changes
  useEffect(() => {
    setHasStartedA(false);
  }, [resetKeyA]);
  
  useEffect(() => {
    setHasStartedB(false);
  }, [resetKeyB]);
  
  // Config setters with partial update support
  const setConfigA = useCallback((updates: Partial<ComparisonConfig>) => {
    setConfigAState(prev => ({ ...prev, ...updates }));
  }, []);
  
  const setConfigB = useCallback((updates: Partial<ComparisonConfig>) => {
    setConfigBState(prev => ({ ...prev, ...updates }));
  }, []);
  
  // Individual panel controls
  const startA = useCallback(() => {
    setHasStartedA(true);
    optimizerA.start();
  }, [optimizerA]);
  
  const startB = useCallback(() => {
    setHasStartedB(true);
    optimizerB.start();
  }, [optimizerB]);
  
  const pauseA = useCallback(() => {
    optimizerA.pause();
  }, [optimizerA]);
  
  const pauseB = useCallback(() => {
    optimizerB.pause();
  }, [optimizerB]);
  
  const resetA = useCallback(() => {
    setHasStartedA(false);
    optimizerA.reset();
  }, [optimizerA]);
  
  const resetB = useCallback(() => {
    setHasStartedB(false);
    optimizerB.reset();
  }, [optimizerB]);
  
  // Combined controls
  const startBoth = useCallback(() => {
    setHasStartedA(true);
    setHasStartedB(true);
    optimizerA.start();
    optimizerB.start();
  }, [optimizerA, optimizerB]);
  
  const pauseBoth = useCallback(() => {
    optimizerA.pause();
    optimizerB.pause();
  }, [optimizerA, optimizerB]);
  
  const resetBoth = useCallback(() => {
    setHasStartedA(false);
    setHasStartedB(false);
    optimizerA.reset();
    optimizerB.reset();
  }, [optimizerA, optimizerB]);
  
  // Sync functions
  const syncFromA = useCallback(() => {
    setConfigBState({ ...configA });
  }, [configA]);
  
  const syncFromB = useCallback(() => {
    setConfigAState({ ...configB });
  }, [configB]);
  
  return {
    // Configuration
    configA,
    configB,
    
    // State
    stateA: optimizerA.state,
    stateB: optimizerB.state,
    
    // History
    historyA: optimizerA.history,
    historyB: optimizerB.history,
    
    // Running status
    isRunningA: optimizerA.isRunning,
    isRunningB: optimizerB.isRunning,
    
    // Ready status
    isReadyA: optimizerA.isReady,
    isReadyB: optimizerB.isReady,
    
    // Errors
    errorA: optimizerA.error,
    errorB: optimizerB.error,
    
    // BC data
    bcDataA,
    bcDataB,
    
    // Mesh dimensions
    meshA,
    meshB,
    
    // Has started
    hasStartedA,
    hasStartedB,
    
    // Individual controls
    setConfigA,
    setConfigB,
    startA,
    startB,
    pauseA,
    pauseB,
    resetA,
    resetB,
    
    // Combined controls
    startBoth,
    pauseBoth,
    resetBoth,
    
    // Sync
    syncFromA,
    syncFromB,
  };
}

export default useComparisonState;

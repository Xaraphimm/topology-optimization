'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Canvas, ViewMode } from './Canvas';
import { Controls } from './Controls';
import { ProgressInfo } from './ProgressInfo';
import { ColorLegend } from './ColorLegend';
import { ConvergenceGraphs } from './ConvergenceGraphs';
import { useOptimizer, type UseOptimizerConfig } from '@/lib/optimizer/useOptimizer';
import { PRESETS, RESOLUTIONS, getMeshDimensions, getPreset } from '@/lib/presets';

interface TopologyVisualizerProps {
  className?: string;
}

/**
 * Main topology optimization visualizer component
 * Orchestrates the optimizer, controls, and canvas
 * 
 * Now uses Web Worker for optimization to keep UI responsive.
 * Displays boundary conditions immediately on load (no grey box).
 */
export function TopologyVisualizer({ className = '' }: TopologyVisualizerProps) {
  // Selection state
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0].id);
  const [selectedResolution, setSelectedResolution] = useState(RESOLUTIONS[0].id);
  const [volumeFraction, setVolumeFraction] = useState(0.5);
  const [viewMode, setViewMode] = useState<ViewMode>('material');
  
  // Track if optimization has started (for showing view toggle and progress)
  const [hasStarted, setHasStarted] = useState(false);
  
  // Get current mesh dimensions and preset
  const preset = getPreset(selectedPreset) || PRESETS[0];
  const resolution = RESOLUTIONS.find(r => r.id === selectedResolution) || RESOLUTIONS[0];
  const { nelx, nely } = getMeshDimensions(preset, resolution);
  
  // Boundary condition visualization data
  const [bcData, setBcData] = useState<{
    supports: { x: number; y: number; type: 'pin' | 'roller-x' | 'roller-y' }[];
    loads: { x: number; y: number; dx: number; dy: number }[];
  }>({ supports: [], loads: [] });
  
  // Memoize optimizer configuration to prevent unnecessary re-initializations
  const optimizerConfig = useMemo<UseOptimizerConfig | null>(() => {
    const currentPreset = getPreset(selectedPreset) || PRESETS[0];
    const currentResolution = RESOLUTIONS.find(r => r.id === selectedResolution) || RESOLUTIONS[0];
    const dims = getMeshDimensions(currentPreset, currentResolution);
    
    // Set up problem
    const { forces, fixedDofs, supports, loads } = currentPreset.setup(dims.nelx, dims.nely);
    
    // Update BC data for visualization (side effect, but needed for Canvas)
    // This is safe because it's derived from the same inputs
    setBcData({ supports, loads });
    
    return {
      config: {
        nelx: dims.nelx,
        nely: dims.nely,
        volfrac: volumeFraction,
        penal: 3.0,
        rmin: Math.max(1.5, dims.nelx / 40),
        maxIter: 200,
        tolx: 0.01,
      },
      forces,
      fixedDofs,
    };
  }, [selectedPreset, selectedResolution, volumeFraction]);
  
  // Use the Web Worker-based optimizer hook
  const {
    state,
    history,
    isRunning,
    isReady,
    error,
    start,
    pause,
    reset,
  } = useOptimizer(optimizerConfig);
  
  // Reset hasStarted when config changes
  useEffect(() => {
    setHasStarted(false);
    setViewMode('material');
  }, [selectedPreset, selectedResolution, volumeFraction]);
  
  // Handlers
  const handleStart = useCallback(() => {
    setHasStarted(true);
    start();
  }, [start]);
  
  const handlePause = useCallback(() => {
    pause();
  }, [pause]);
  
  const handleReset = useCallback(() => {
    setHasStarted(false);
    setViewMode('material');
    reset();
  }, [reset]);
  
  const handlePresetChange = useCallback((presetId: string) => {
    if (isRunning) pause();
    setSelectedPreset(presetId);
  }, [isRunning, pause]);
  
  const handleResolutionChange = useCallback((resolutionId: string) => {
    if (isRunning) pause();
    setSelectedResolution(resolutionId);
  }, [isRunning, pause]);
  
  const handleVolumeFractionChange = useCallback((value: number) => {
    setVolumeFraction(value);
  }, []);
  
  // Determine what densities to show
  // - Before start: show uniform density at volume fraction (preview)
  // - After start: show actual optimization state
  const displayDensities = hasStarted && state.densities.length > 0 ? state.densities : null;
  const displayStrainEnergy = hasStarted && state.strainEnergy.length > 0 ? state.strainEnergy : null;
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200 text-sm">
          Error: {error}
        </div>
      )}
      
      {/* Canvas with view toggle */}
      <div className="border border-border rounded-lg overflow-hidden bg-muted/50">
        {/* View toggle header - only shows after optimization starts */}
        {hasStarted && (
          <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode('material')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === 'material'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                Material
              </button>
              <button
                onClick={() => setViewMode('stress')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === 'stress'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                Stress
              </button>
            </div>
            <ColorLegend viewMode={viewMode} />
          </div>
        )}
        
        <div className="relative">
          <Canvas
            densities={displayDensities}
            strainEnergy={displayStrainEnergy}
            nelx={nelx}
            nely={nely}
            viewMode={viewMode}
            supports={bcData.supports}
            loads={bcData.loads}
            initialVolumeFraction={volumeFraction}
          />
          
          {/* Loading indicator when worker is initializing */}
          {!isReady && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <div className="text-sm text-muted-foreground">Initializing...</div>
            </div>
          )}
        </div>
      </div>
      
      {/* Progress Info */}
      <ProgressInfo
        iteration={state.iteration}
        maxIterations={200}
        compliance={state.compliance}
        volume={state.volume}
        change={state.change}
        converged={state.converged}
        isRunning={isRunning}
      />
      
      {/* Convergence Graphs - only show after optimization has started */}
      {hasStarted && (
        <ConvergenceGraphs
          history={history}
          isRunning={isRunning}
        />
      )}
      
      {/* Controls */}
      <Controls
        selectedPreset={selectedPreset}
        onPresetChange={handlePresetChange}
        presets={PRESETS.map(p => ({ id: p.id, name: p.name }))}
        selectedResolution={selectedResolution}
        onResolutionChange={handleResolutionChange}
        resolutions={RESOLUTIONS.map(r => ({ id: r.id, label: r.label }))}
        volumeFraction={volumeFraction}
        onVolumeFractionChange={handleVolumeFractionChange}
        isRunning={isRunning}
        onStart={handleStart}
        onPause={handlePause}
        onReset={handleReset}
        disabled={hasStarted}
      />
    </div>
  );
}

export default TopologyVisualizer;

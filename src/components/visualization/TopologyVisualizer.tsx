'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Canvas, ViewMode } from './Canvas';
import { Controls } from './Controls';
import { ProgressInfo } from './ProgressInfo';
import { ColorLegend } from './ColorLegend';
import { SIMPOptimizer } from '@/lib/optimizer/simp';
import { PRESETS, RESOLUTIONS, getMeshDimensions, getPreset } from '@/lib/presets';
import type { OptimizationState } from '@/lib/optimizer/types';

interface TopologyVisualizerProps {
  className?: string;
}

/**
 * Main topology optimization visualizer component
 * Orchestrates the optimizer, controls, and canvas
 */
export function TopologyVisualizer({ className = '' }: TopologyVisualizerProps) {
  // Selection state
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0].id);
  const [selectedResolution, setSelectedResolution] = useState(RESOLUTIONS[0].id);
  const [volumeFraction, setVolumeFraction] = useState(0.5);
  const [viewMode, setViewMode] = useState<ViewMode>('material');
  
  // Optimization state
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [state, setState] = useState<OptimizationState>({
    densities: new Float64Array(0),
    strainEnergy: new Float64Array(0),
    compliance: Infinity,
    volume: 0.5,
    iteration: 0,
    converged: false,
    change: 1.0,
  });
  
  // Refs
  const optimizerRef = useRef<SIMPOptimizer | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Get current mesh dimensions
  const preset = getPreset(selectedPreset) || PRESETS[0];
  const resolution = RESOLUTIONS.find(r => r.id === selectedResolution) || RESOLUTIONS[0];
  const { nelx, nely } = getMeshDimensions(preset, resolution);
  
  // Get boundary condition visualization data
  const [bcData, setBcData] = useState<{
    supports: { x: number; y: number; type: 'pin' | 'roller-x' | 'roller-y' }[];
    loads: { x: number; y: number; dx: number; dy: number }[];
  }>({ supports: [], loads: [] });
  
  // Initialize or reset optimizer
  const initializeOptimizer = useCallback(() => {
    const preset = getPreset(selectedPreset) || PRESETS[0];
    const resolution = RESOLUTIONS.find(r => r.id === selectedResolution) || RESOLUTIONS[0];
    const { nelx, nely } = getMeshDimensions(preset, resolution);
    
    // Create optimizer
    const optimizer = new SIMPOptimizer({
      nelx,
      nely,
      volfrac: volumeFraction,
      penal: 3.0,
      rmin: Math.max(1.5, nelx / 40), // Scale filter with resolution
      maxIter: 200,
      tolx: 0.01,
    });
    
    // Set up problem
    const { forces, fixedDofs, supports, loads } = preset.setup(nelx, nely);
    optimizer.setForces(forces);
    optimizer.setFixedDofs(fixedDofs);
    
    optimizerRef.current = optimizer;
    setBcData({ supports, loads });
    
    // Reset state
    const initialState = optimizer.getState();
    setState({
      densities: new Float64Array(initialState.densities),
      strainEnergy: new Float64Array(initialState.strainEnergy),
      compliance: Infinity,
      volume: volumeFraction,
      iteration: 0,
      converged: false,
      change: 1.0,
    });
    
    setHasStarted(false);
    setViewMode('material'); // Reset to material view
  }, [selectedPreset, selectedResolution, volumeFraction]);
  
  // Initialize on mount and when settings change
  useEffect(() => {
    initializeOptimizer();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [initializeOptimizer]);
  
  // Animation loop
  const runOptimization = useCallback(() => {
    const optimizer = optimizerRef.current;
    if (!optimizer || !isRunning) return;
    
    // Run one iteration
    const newState = optimizer.step();
    setState({
      densities: new Float64Array(newState.densities), // Copy to trigger re-render
      strainEnergy: new Float64Array(newState.strainEnergy),
      compliance: newState.compliance,
      volume: newState.volume,
      iteration: newState.iteration,
      converged: newState.converged,
      change: newState.change,
    });
    
    // Continue if not converged
    if (!newState.converged && isRunning) {
      animationRef.current = requestAnimationFrame(runOptimization);
    } else if (newState.converged) {
      setIsRunning(false);
    }
  }, [isRunning]);
  
  // Start/stop optimization
  useEffect(() => {
    if (isRunning) {
      animationRef.current = requestAnimationFrame(runOptimization);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, runOptimization]);
  
  // Handlers
  const handleStart = () => {
    setIsRunning(true);
    setHasStarted(true);
  };
  
  const handlePause = () => {
    setIsRunning(false);
  };
  
  const handleReset = () => {
    setIsRunning(false);
    initializeOptimizer();
  };
  
  const handlePresetChange = (presetId: string) => {
    setIsRunning(false);
    setSelectedPreset(presetId);
  };
  
  const handleResolutionChange = (resolutionId: string) => {
    setIsRunning(false);
    setSelectedResolution(resolutionId);
  };
  
  const handleVolumeFractionChange = (value: number) => {
    setVolumeFraction(value);
    if (!isRunning) {
      // Reinitialize with new volume fraction
      setTimeout(() => {
        initializeOptimizer();
      }, 0);
    }
  };
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Canvas with view toggle */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
        {/* View toggle header - only shows after optimization starts */}
        {hasStarted && (
          <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode('material')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === 'material'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Material
              </button>
              <button
                onClick={() => setViewMode('stress')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === 'stress'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Stress
              </button>
            </div>
            <ColorLegend viewMode={viewMode} />
          </div>
        )}
        
        <Canvas
          densities={hasStarted ? state.densities : null}
          strainEnergy={hasStarted ? state.strainEnergy : null}
          nelx={nelx}
          nely={nely}
          viewMode={viewMode}
          supports={bcData.supports}
          loads={bcData.loads}
        />
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

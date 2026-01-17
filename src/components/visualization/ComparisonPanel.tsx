'use client';

import { useState, useCallback } from 'react';
import { Canvas, ViewMode } from './Canvas';
import { ProgressInfo } from './ProgressInfo';
import { ConvergenceGraphs } from './ConvergenceGraphs';
import { ColorLegend } from './ColorLegend';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Pause, RotateCcw } from 'lucide-react';
import type { UseOptimizerState, HistoryPoint } from '@/lib/optimizer/useOptimizer';
import type { ComparisonConfig } from '@/lib/hooks/useComparisonState';
import { PRESETS, RESOLUTIONS } from '@/lib/presets';

interface Support {
  x: number;
  y: number;
  type: 'pin' | 'roller-x' | 'roller-y';
}

interface Load {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

interface ComparisonPanelProps {
  /** Panel label (e.g., "Configuration A" or "Configuration B") */
  label: string;
  
  /** Current configuration */
  config: ComparisonConfig;
  
  /** Optimizer state */
  state: UseOptimizerState;
  
  /** History for convergence graphs */
  history: HistoryPoint[];
  
  /** Whether optimization is running */
  isRunning: boolean;
  
  /** Whether optimizer is ready */
  isReady: boolean;
  
  /** Whether optimization has started (for UI display) */
  hasStarted: boolean;
  
  /** Error message if any */
  error: string | null;
  
  /** Boundary condition data */
  bcData: {
    supports: Support[];
    loads: Load[];
  };
  
  /** Mesh dimensions */
  mesh: {
    nelx: number;
    nely: number;
  };
  
  /** Callback when configuration changes */
  onConfigChange: (config: Partial<ComparisonConfig>) => void;
  
  /** Start optimization */
  onStart: () => void;
  
  /** Pause optimization */
  onPause: () => void;
  
  /** Reset optimization */
  onReset: () => void;
}

/**
 * A single comparison panel containing canvas, controls, and progress info
 */
export function ComparisonPanel({
  label,
  config,
  state,
  history,
  isRunning,
  isReady,
  hasStarted,
  error,
  bcData,
  mesh,
  onConfigChange,
  onStart,
  onPause,
  onReset,
}: ComparisonPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('material');
  
  // Get display densities
  const displayDensities = hasStarted && state.densities.length > 0 ? state.densities : null;
  const displayStrainEnergy = hasStarted && state.strainEnergy.length > 0 ? state.strainEnergy : null;
  
  // Handle config changes
  const handlePresetChange = useCallback((presetId: string) => {
    if (isRunning) return;
    onConfigChange({ presetId });
  }, [isRunning, onConfigChange]);
  
  const handleResolutionChange = useCallback((resolutionId: string) => {
    if (isRunning) return;
    onConfigChange({ resolutionId });
  }, [isRunning, onConfigChange]);
  
  const handleVolumeFractionChange = useCallback((value: number) => {
    onConfigChange({ volumeFraction: value });
  }, [onConfigChange]);
  
  return (
    <div className="flex flex-col h-full border border-border rounded-xl overflow-hidden bg-card shadow-sm dark:shadow-none dark:ring-1 dark:ring-white/5">
      {/* Panel Header */}
      <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
      </div>
      
      {/* Error display */}
      {error && (
        <div className="mx-3 mt-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-red-800 dark:text-red-200 text-xs">
          Error: {error}
        </div>
      )}
      
      {/* Canvas Section */}
      <div className="relative border-b border-border bg-muted/30">
        {/* View toggle - only shows after optimization starts */}
        {hasStarted && (
          <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-b border-border">
            <div className="flex items-center gap-0.5 p-0.5 bg-muted/50 rounded-md">
              <button
                onClick={() => setViewMode('material')}
                className={`px-2 py-1 text-xs font-medium rounded transition-all duration-200 ${
                  viewMode === 'material'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Material
              </button>
              <button
                onClick={() => setViewMode('stress')}
                className={`px-2 py-1 text-xs font-medium rounded transition-all duration-200 ${
                  viewMode === 'stress'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Stress
              </button>
            </div>
            <ColorLegend viewMode={viewMode} />
          </div>
        )}
        
        <Canvas
          densities={displayDensities}
          strainEnergy={displayStrainEnergy}
          nelx={mesh.nelx}
          nely={mesh.nely}
          viewMode={viewMode}
          supports={bcData.supports}
          loads={bcData.loads}
          initialVolumeFraction={config.volumeFraction}
        />
        
        {/* Loading indicator */}
        {!isReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="text-xs text-muted-foreground">Initializing...</div>
          </div>
        )}
      </div>
      
      {/* Progress Info */}
      <div className="px-3 py-2 border-b border-border">
        <ProgressInfo
          iteration={state.iteration}
          maxIterations={200}
          compliance={state.compliance}
          volume={state.volume}
          change={state.change}
          converged={state.converged}
          isRunning={isRunning}
        />
      </div>
      
      {/* Controls Section */}
      <div className="p-3 space-y-3 flex-1">
        {/* Preset Selection */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Problem
          </label>
          <Tabs value={config.presetId} onValueChange={handlePresetChange}>
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${PRESETS.length}, 1fr)` }}>
              {PRESETS.map((preset) => (
                <TabsTrigger
                  key={preset.id}
                  value={preset.id}
                  disabled={hasStarted && isRunning}
                  className="text-xs px-1"
                >
                  {preset.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        
        {/* Resolution Selection */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Resolution
          </label>
          <Tabs value={config.resolutionId} onValueChange={handleResolutionChange}>
            <TabsList>
              {RESOLUTIONS.map((res) => (
                <TabsTrigger
                  key={res.id}
                  value={res.id}
                  disabled={hasStarted && isRunning}
                  className="text-xs px-2"
                >
                  {res.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        
        {/* Volume Fraction Slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-foreground">
              Material to keep
            </label>
            <span className="text-xs font-mono text-muted-foreground">
              {Math.round(config.volumeFraction * 100)}%
            </span>
          </div>
          <Slider
            value={[config.volumeFraction * 100]}
            onValueChange={([value]) => handleVolumeFractionChange(value / 100)}
            min={10}
            max={80}
            step={5}
            disabled={hasStarted && isRunning}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
            <span>Less</span>
            <span>More</span>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          {isRunning ? (
            <Button onClick={onPause} variant="outline" size="sm" className="flex-1 gap-1">
              <Pause className="w-3 h-3" />
              Pause
            </Button>
          ) : (
            <Button onClick={onStart} size="sm" className="flex-1 gap-1">
              <Play className="w-3 h-3" />
              {hasStarted ? 'Continue' : 'Start'}
            </Button>
          )}
          <Button onClick={onReset} variant="outline" size="sm" className="gap-1">
            <RotateCcw className="w-3 h-3" />
          </Button>
        </div>
      </div>
      
      {/* Convergence Graphs (collapsed by default) */}
      {hasStarted && (
        <div className="border-t border-border">
          <ConvergenceGraphs
            history={history}
            isRunning={isRunning}
            className="rounded-none border-0"
          />
        </div>
      )}
    </div>
  );
}

export default ComparisonPanel;

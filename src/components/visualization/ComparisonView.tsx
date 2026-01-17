'use client';

import { Button } from '@/components/ui/button';
import { ComparisonPanel } from './ComparisonPanel';
import { useComparisonState } from '@/lib/hooks/useComparisonState';
import {
  Play,
  Pause,
  RotateCcw,
  X,
  ArrowRight,
} from 'lucide-react';

interface ComparisonViewProps {
  /** Callback to exit comparison mode */
  onExitComparison: () => void;
}

/**
 * Main comparison container with two side-by-side optimizer panels
 * 
 * Features:
 * - Two independent ComparisonPanel components
 * - Responsive layout (stack vertically on mobile)
 * - Combined controls for starting/pausing/resetting both
 * - Sync buttons to copy settings between panels
 */
export function ComparisonView({ onExitComparison }: ComparisonViewProps) {
  const {
    configA,
    configB,
    stateA,
    stateB,
    historyA,
    historyB,
    isRunningA,
    isRunningB,
    isReadyA,
    isReadyB,
    errorA,
    errorB,
    bcDataA,
    bcDataB,
    meshA,
    meshB,
    hasStartedA,
    hasStartedB,
    setConfigA,
    setConfigB,
    startA,
    startB,
    pauseA,
    pauseB,
    resetA,
    resetB,
    startBoth,
    pauseBoth,
    resetBoth,
    syncFromA,
    syncFromB,
  } = useComparisonState();
  
  const isEitherRunning = isRunningA || isRunningB;
  const areBothReady = isReadyA && isReadyB;
  
  return (
    <div className="space-y-4">
      {/* Header with Exit button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Comparison Mode</h2>
          <p className="text-sm text-muted-foreground">
            Run two optimizations side-by-side with different parameters
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={onExitComparison}
          className="gap-2"
        >
          <X className="w-4 h-4" />
          Exit Comparison
        </Button>
      </div>
      
      {/* Two panels side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ComparisonPanel
          label="Configuration A"
          config={configA}
          state={stateA}
          history={historyA}
          isRunning={isRunningA}
          isReady={isReadyA}
          hasStarted={hasStartedA}
          error={errorA}
          bcData={bcDataA}
          mesh={meshA}
          onConfigChange={setConfigA}
          onStart={startA}
          onPause={pauseA}
          onReset={resetA}
        />
        
        <ComparisonPanel
          label="Configuration B"
          config={configB}
          state={stateB}
          history={historyB}
          isRunning={isRunningB}
          isReady={isReadyB}
          hasStarted={hasStartedB}
          error={errorB}
          bcData={bcDataB}
          mesh={meshB}
          onConfigChange={setConfigB}
          onStart={startB}
          onPause={pauseB}
          onReset={resetB}
        />
      </div>
      
      {/* Footer with combined controls */}
      <div className="flex flex-wrap items-center justify-center gap-3 p-4 bg-card border border-border rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-white/5">
        {/* Combined Start/Pause/Reset */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground mr-2">Both:</span>
          {isEitherRunning ? (
            <Button 
              onClick={pauseBoth} 
              variant="outline" 
              className="gap-2"
            >
              <Pause className="w-4 h-4" />
              Pause Both
            </Button>
          ) : (
            <Button 
              onClick={startBoth} 
              className="gap-2"
              disabled={!areBothReady}
            >
              <Play className="w-4 h-4" />
              Start Both
            </Button>
          )}
          <Button 
            onClick={resetBoth} 
            variant="outline" 
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Both
          </Button>
        </div>
        
        {/* Divider */}
        <div className="hidden sm:block w-px h-8 bg-border" />
        
        {/* Sync buttons */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground mr-2">Sync:</span>
          <Button 
            onClick={syncFromA} 
            variant="outline"
            size="sm"
            className="gap-1"
            title="Copy settings from A to B"
          >
            A <ArrowRight className="w-3 h-3" /> B
          </Button>
          <Button 
            onClick={syncFromB} 
            variant="outline"
            size="sm"
            className="gap-1"
            title="Copy settings from B to A"
          >
            B <ArrowRight className="w-3 h-3" /> A
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ComparisonView;

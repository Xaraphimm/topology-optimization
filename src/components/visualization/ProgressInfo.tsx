'use client';

interface ProgressInfoProps {
  iteration: number;
  maxIterations: number;
  compliance: number;
  volume: number;
  change: number;
  converged: boolean;
  isRunning: boolean;
}

/**
 * Display optimization progress information
 */
export function ProgressInfo({
  iteration,
  maxIterations,
  compliance,
  volume,
  change,
  converged,
  isRunning,
}: ProgressInfoProps) {
  const progress = Math.min(100, (iteration / maxIterations) * 100);
  
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 py-3 border border-border/50">
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">Iteration:</span>
        <span className="font-mono tabular-nums">{iteration}</span>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">Material:</span>
        <span className="font-mono tabular-nums">{(volume * 100).toFixed(1)}%</span>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">Compliance:</span>
        <span className="font-mono tabular-nums">{compliance < Infinity ? compliance.toFixed(2) : '—'}</span>
      </div>
      
      <div className="flex-1 min-w-[150px]">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${converged ? 'bg-emerald-500' : 'bg-primary'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground min-w-[80px]">
            {converged ? (
              <span className="text-emerald-500 font-medium">Converged</span>
            ) : isRunning ? (
              <span className="animate-pulse">Optimizing...</span>
            ) : (
              'Ready'
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ProgressInfo;

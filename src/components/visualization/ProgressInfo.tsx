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
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
      <div className="flex items-center gap-2">
        <span className="font-medium">Iteration:</span>
        <span className="font-mono">{iteration}</span>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="font-medium">Material:</span>
        <span className="font-mono">{(volume * 100).toFixed(1)}%</span>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="font-medium">Compliance:</span>
        <span className="font-mono">{compliance < Infinity ? compliance.toFixed(2) : '—'}</span>
      </div>
      
      <div className="flex-1 min-w-[150px]">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${converged ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 min-w-[80px]">
            {converged ? (
              <span className="text-green-600 font-medium">Converged</span>
            ) : isRunning ? (
              'Optimizing...'
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

'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChevronDown, ChevronUp, TrendingDown, Activity, Layers } from 'lucide-react';
import type { HistoryPoint } from '@/lib/optimizer/useOptimizer';

interface ConvergenceGraphsProps {
  history: HistoryPoint[];
  isRunning: boolean;
  className?: string;
}

/**
 * Custom tooltip component for consistent styling
 */
function CustomTooltip({ 
  active, 
  payload, 
  label,
  valueFormatter,
  valueName,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: number;
  valueFormatter: (value: number) => string;
  valueName: string;
}) {
  if (!active || !payload || !payload.length) return null;
  
  return (
    <div className="bg-popover border border-border rounded-md shadow-lg px-3 py-2 text-sm">
      <p className="text-muted-foreground mb-1">Iteration {label}</p>
      <p className="font-medium text-foreground">
        {valueName}: {valueFormatter(payload[0].value)}
      </p>
    </div>
  );
}

/**
 * Individual chart card component
 */
function ChartCard({
  title,
  icon: Icon,
  data,
  dataKey,
  color,
  valueFormatter,
  yAxisFormatter,
  domain,
  currentValue,
}: {
  title: string;
  icon: React.ElementType;
  data: HistoryPoint[];
  dataKey: keyof HistoryPoint;
  color: string;
  valueFormatter: (value: number) => string;
  yAxisFormatter?: (value: number) => string;
  domain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax'];
  currentValue?: string;
}) {
  return (
    <div className="bg-muted/30 border border-border/50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" style={{ color }} />
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        {currentValue && (
          <span className="text-sm font-mono text-muted-foreground tabular-nums">{currentValue}</span>
        )}
      </div>
      
      <div className="h-[160px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="var(--border)" 
                opacity={0.5}
              />
              <XAxis 
                dataKey="iteration"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                tickLine={{ stroke: 'var(--border)' }}
                axisLine={{ stroke: 'var(--border)' }}
                tickMargin={4}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                tickLine={{ stroke: 'var(--border)' }}
                axisLine={{ stroke: 'var(--border)' }}
                tickFormatter={yAxisFormatter}
                width={45}
                domain={domain}
              />
              <Tooltip 
                content={
                  <CustomTooltip 
                    valueFormatter={valueFormatter} 
                    valueName={title}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: color }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Start optimization to see data
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Convergence graphs component showing optimization progress
 * Displays compliance, density change, and volume fraction over iterations
 */
export function ConvergenceGraphs({ 
  history, 
  isRunning,
  className = '' 
}: ConvergenceGraphsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Get latest values for display
  const latestPoint = history.length > 0 ? history[history.length - 1] : null;
  
  // Format compliance with appropriate precision
  const formatCompliance = (value: number) => {
    if (value >= 1000) return value.toFixed(0);
    if (value >= 100) return value.toFixed(1);
    return value.toFixed(2);
  };
  
  // Format change as percentage
  const formatChange = (value: number) => {
    return (value * 100).toFixed(2) + '%';
  };
  
  // Format volume as percentage
  const formatVolume = (value: number) => {
    return (value * 100).toFixed(1) + '%';
  };
  
  // Y-axis formatter for change (shows as percentage)
  const yAxisChangeFormatter = (value: number) => {
    return (value * 100).toFixed(0) + '%';
  };
  
  // Y-axis formatter for volume (shows as percentage)
  const yAxisVolumeFormatter = (value: number) => {
    return (value * 100).toFixed(0) + '%';
  };
  
  return (
    <div className={`border border-border rounded-xl overflow-hidden bg-card shadow-sm dark:shadow-none dark:ring-1 dark:ring-white/5 ${className}`}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Convergence Graphs</span>
          {isRunning && (
            <span className="text-xs text-muted-foreground animate-pulse">
              (updating...)
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {latestPoint && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {history.length} iterations
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>
      
      {/* Charts - collapsible */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 pt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Compliance Chart */}
          <ChartCard
            title="Compliance"
            icon={TrendingDown}
            data={history}
            dataKey="compliance"
            color="hsl(221, 83%, 53%)"
            valueFormatter={formatCompliance}
            currentValue={latestPoint ? formatCompliance(latestPoint.compliance) : undefined}
          />
          
          {/* Density Change Chart */}
          <ChartCard
            title="Density Change"
            icon={Activity}
            data={history}
            dataKey="change"
            color="hsl(173, 80%, 40%)"
            valueFormatter={formatChange}
            yAxisFormatter={yAxisChangeFormatter}
            domain={[0, 'auto']}
            currentValue={latestPoint ? formatChange(latestPoint.change) : undefined}
          />
          
          {/* Volume Fraction Chart */}
          <ChartCard
            title="Volume"
            icon={Layers}
            data={history}
            dataKey="volume"
            color="hsl(45, 93%, 47%)"
            valueFormatter={formatVolume}
            yAxisFormatter={yAxisVolumeFormatter}
            domain={[0, 1]}
            currentValue={latestPoint ? formatVolume(latestPoint.volume) : undefined}
          />
        </div>
        
        {/* Legend / explanation */}
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground">
            <strong>Compliance</strong> measures structural flexibility (lower is stiffer). 
            <strong> Change</strong> shows convergence progress (approaches zero). 
            <strong> Volume</strong> tracks material usage.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ConvergenceGraphs;

'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Slider } from '@/components/ui/slider';
import { Callout } from './Callout';

/**
 * Generate data points for the SIMP power law curve: E = ρ^p
 */
function generateCurveData(penal: number, numPoints: number = 50) {
  const data = [];
  for (let i = 0; i <= numPoints; i++) {
    const density = i / numPoints;
    data.push({
      density,
      stiffness: Math.pow(density, penal),
      linear: density, // Reference line for p=1
    });
  }
  return data;
}

/**
 * Custom tooltip for the chart
 */
function ChartTooltip({ 
  active, 
  payload, 
  penal 
}: { 
  active?: boolean; 
  payload?: Array<{ payload: { density: number; stiffness: number } }>; 
  penal: number;
}) {
  if (!active || !payload || !payload.length) return null;
  
  const { density, stiffness } = payload[0].payload;
  
  return (
    <div className="bg-popover border border-border rounded-md shadow-lg px-3 py-2 text-sm">
      <p className="text-muted-foreground">
        Density: <span className="font-mono font-medium text-foreground">{(density * 100).toFixed(0)}%</span>
      </p>
      <p className="text-muted-foreground">
        Stiffness: <span className="font-mono font-medium text-foreground">{(stiffness * 100).toFixed(1)}%</span>
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        E = ρ<sup>{penal.toFixed(1)}</sup> = {stiffness.toFixed(3)}
      </p>
    </div>
  );
}

/**
 * Interactive SIMP Material Model Explainer
 * 
 * Visualizes the core concept behind SIMP topology optimization:
 * the penalization power law E = ρ^p that makes intermediate
 * densities inefficient, pushing designs toward 0/1.
 */
export function SIMPExplainer() {
  const [penal, setPenal] = useState(3.0);
  
  // Generate curve data
  const curveData = useMemo(() => generateCurveData(penal), [penal]);
  
  // Calculate efficiency at 50% density
  const halfDensityEfficiency = Math.pow(0.5, penal);
  const linearEfficiency = 0.5;
  const efficiencyLoss = ((linearEfficiency - halfDensityEfficiency) / linearEfficiency) * 100;
  
  return (
    <div className="my-8">
      <h3 className="text-xl font-semibold text-foreground mb-3">
        The SIMP Material Model
      </h3>
      
      <p className="text-muted-foreground mb-4">
        The algorithm uses a clever mathematical trick called <strong className="text-foreground">penalization</strong>. 
        Instead of a linear relationship between material density and stiffness, SIMP uses a power law: 
        <span className="font-mono bg-muted px-1.5 py-0.5 rounded mx-1">E = ρ<sup>p</sup></span>
        where <em>p</em> is typically 3.
      </p>
      
      {/* Interactive Chart */}
      <div className="bg-card border border-border rounded-lg p-4 mb-4">
        <div className="h-[240px] mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={curveData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
              <defs>
                <linearGradient id="stiffnessGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="var(--border)" 
                opacity={0.5}
              />
              
              <XAxis 
                dataKey="density"
                type="number"
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={{ stroke: 'var(--border)' }}
                label={{ 
                  value: 'Material Density (ρ)', 
                  position: 'bottom', 
                  offset: 0,
                  style: { fontSize: 12, fill: 'var(--muted-foreground)' }
                }}
              />
              
              <YAxis 
                type="number"
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={{ stroke: 'var(--border)' }}
                label={{ 
                  value: 'Relative Stiffness (E)', 
                  angle: -90, 
                  position: 'insideLeft',
                  offset: 10,
                  style: { fontSize: 12, fill: 'var(--muted-foreground)', textAnchor: 'middle' }
                }}
                width={50}
              />
              
              {/* Reference line for linear (p=1) */}
              <ReferenceLine
                segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                stroke="var(--muted-foreground)"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                opacity={0.7}
              />
              
              {/* Reference line at 50% density */}
              <ReferenceLine
                x={0.5}
                stroke="var(--muted-foreground)"
                strokeDasharray="3 3"
                strokeWidth={1}
                opacity={0.5}
              />
              
              <Tooltip content={<ChartTooltip penal={penal} />} />
              
              {/* SIMP curve */}
              <Area
                type="monotone"
                dataKey="stiffness"
                stroke="hsl(221, 83%, 53%)"
                strokeWidth={2.5}
                fill="url(#stiffnessGradient)"
                isAnimationActive={true}
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm mb-4 text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-blue-500 rounded" />
            <span>SIMP (p = {penal.toFixed(1)})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 border-t-2 border-dashed border-muted-foreground opacity-70" />
            <span>Linear (p = 1)</span>
          </div>
        </div>
        
        {/* Penalization Slider */}
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground">
              Penalization Power (p)
            </label>
            <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {penal.toFixed(1)}
            </span>
          </div>
          <Slider
            value={[penal]}
            onValueChange={([value]) => setPenal(value)}
            min={1}
            max={5}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>1 (linear)</span>
            <span>3 (typical)</span>
            <span>5 (aggressive)</span>
          </div>
        </div>
      </div>
      
      {/* Dynamic Insight Box */}
      <Callout 
        title={`At 50% density with p = ${penal.toFixed(1)}`}
        type={penal >= 2.5 ? 'info' : 'warning'}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <div>
            Linear would give: <span className="font-mono font-medium">50% stiffness</span>
          </div>
          <div>
            SIMP gives: <span className="font-mono font-medium">{(halfDensityEfficiency * 100).toFixed(1)}% stiffness</span>
          </div>
        </div>
        <p>
          {penal >= 2.5 ? (
            <>
              That&apos;s a <strong>{efficiencyLoss.toFixed(0)}% efficiency penalty</strong> for using 
              &quot;gray&quot; material — forcing the optimizer to commit to solid (black) or void (white).
            </>
          ) : (
            <>
              With p &lt; 2.5, the penalty is weak ({efficiencyLoss.toFixed(0)}% loss). 
              The optimizer may produce blurry, hard-to-manufacture designs. 
              <strong> Try increasing p to see crisper results.</strong>
            </>
          )}
        </p>
      </Callout>
      
      <p className="text-sm text-muted-foreground mt-4">
        <strong className="text-foreground">Try it:</strong> Drag the slider to see how different penalty values 
        change the material model. Higher values of <em>p</em> create more contrast between solid and void regions, 
        producing cleaner, more manufacturable designs.
      </p>
    </div>
  );
}

export default SIMPExplainer;

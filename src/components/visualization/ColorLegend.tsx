'use client';

import type { ViewMode } from './Canvas';

interface ColorLegendProps {
  viewMode: ViewMode;
}

/**
 * Color scale legend for the visualization
 * Shows what colors mean in each view mode
 */
export function ColorLegend({ viewMode }: ColorLegendProps) {
  if (viewMode === 'material') {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>Void</span>
        <div 
          className="w-20 h-3 rounded-sm"
          style={{
            background: 'linear-gradient(to right, #ffffff, #000000)',
            border: '1px solid #e5e7eb',
          }}
        />
        <span>Solid</span>
      </div>
    );
  }
  
  // Stress view legend
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span>Low</span>
      <div 
        className="w-20 h-3 rounded-sm"
        style={{
          background: 'linear-gradient(to right, #3b82f6, #ffffff, #ef4444)',
          border: '1px solid #e5e7eb',
        }}
      />
      <span>High</span>
    </div>
  );
}

export default ColorLegend;

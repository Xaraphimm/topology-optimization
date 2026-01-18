'use client';

import { COLORMAPS, generateGradientStops, type Colormap } from '@/lib/colormaps';

interface ColorPaletteSelectorProps {
  selectedColormap: string;
  onColormapChange: (colormapId: string) => void;
  className?: string;
}

/**
 * Dropdown selector for stress view colormap/palette
 */
export function ColorPaletteSelector({
  selectedColormap,
  onColormapChange,
  className = '',
}: ColorPaletteSelectorProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-xs text-muted-foreground whitespace-nowrap">
        Palette:
      </label>
      <div className="relative">
        <select
          value={selectedColormap}
          onChange={(e) => onColormapChange(e.target.value)}
          className="appearance-none bg-muted/50 border border-border rounded-md px-2 py-1 pr-7 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
        >
          {COLORMAPS.map((colormap) => (
            <option key={colormap.id} value={colormap.id}>
              {colormap.name}
            </option>
          ))}
        </select>
        <svg 
          className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

/**
 * Colormap preview bar
 */
export function ColormapPreview({
  colormap,
  className = '',
}: {
  colormap: Colormap;
  className?: string;
}) {
  const gradient = generateGradientStops(colormap, 20);
  
  return (
    <div 
      className={`h-3 rounded-sm ${className}`}
      style={{
        background: `linear-gradient(to right, ${gradient})`,
      }}
    />
  );
}

export default ColorPaletteSelector;

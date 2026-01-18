/**
 * Colormaps for stress visualization
 * 
 * Provides scientifically accurate colormaps for FEA stress visualization.
 * - Thermal: Classic red-orange-yellow heat map (default)
 * - Viridis: Perceptually uniform, colorblind-friendly (scientific standard)
 */

/**
 * RGB color tuple [0-255]
 */
export type RGB = [number, number, number];

/**
 * Colormap definition
 */
export interface Colormap {
  id: string;
  name: string;
  description: string;
  /** Map value [0-1] to RGB color */
  lookup: (t: number) => RGB;
}

/**
 * Thermal colormap (red-orange-yellow)
 * Classic FEA heat map style
 */
function thermalLookup(t: number): RGB {
  // Clamp to [0, 1]
  t = Math.max(0, Math.min(1, t));
  
  // Low stress: blue/cyan
  // Medium stress: green/yellow  
  // High stress: orange/red
  
  let r: number, g: number, b: number;
  
  if (t < 0.25) {
    // Blue to cyan
    const s = t / 0.25;
    r = 0;
    g = Math.round(s * 200);
    b = Math.round(200 - s * 50);
  } else if (t < 0.5) {
    // Cyan to green/yellow
    const s = (t - 0.25) / 0.25;
    r = Math.round(s * 180);
    g = Math.round(200 + s * 55);
    b = Math.round(150 - s * 150);
  } else if (t < 0.75) {
    // Yellow to orange
    const s = (t - 0.5) / 0.25;
    r = Math.round(180 + s * 75);
    g = Math.round(255 - s * 100);
    b = 0;
  } else {
    // Orange to red
    const s = (t - 0.75) / 0.25;
    r = 255;
    g = Math.round(155 - s * 155);
    b = Math.round(s * 50);
  }
  
  return [r, g, b];
}

/**
 * Viridis colormap
 * Perceptually uniform, colorblind-friendly
 * Based on matplotlib's viridis
 */
const VIRIDIS_DATA: RGB[] = [
  [68, 1, 84],
  [72, 26, 108],
  [71, 47, 125],
  [65, 68, 135],
  [57, 86, 140],
  [49, 104, 142],
  [42, 120, 142],
  [35, 136, 142],
  [31, 152, 139],
  [34, 168, 132],
  [53, 183, 121],
  [84, 197, 104],
  [122, 209, 81],
  [165, 219, 54],
  [210, 226, 27],
  [253, 231, 37],
];

function viridisLookup(t: number): RGB {
  // Clamp to [0, 1]
  t = Math.max(0, Math.min(1, t));
  
  // Interpolate between data points
  const idx = t * (VIRIDIS_DATA.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  
  if (i >= VIRIDIS_DATA.length - 1) {
    return VIRIDIS_DATA[VIRIDIS_DATA.length - 1];
  }
  
  const c0 = VIRIDIS_DATA[i];
  const c1 = VIRIDIS_DATA[i + 1];
  
  return [
    Math.round(c0[0] + f * (c1[0] - c0[0])),
    Math.round(c0[1] + f * (c1[1] - c0[1])),
    Math.round(c0[2] + f * (c1[2] - c0[2])),
  ];
}

/**
 * Available colormaps
 */
export const COLORMAPS: Colormap[] = [
  {
    id: 'thermal',
    name: 'Thermal',
    description: 'Classic heat map (blue to red)',
    lookup: thermalLookup,
  },
  {
    id: 'viridis',
    name: 'Viridis',
    description: 'Perceptually uniform, colorblind-friendly',
    lookup: viridisLookup,
  },
];

/**
 * Get colormap by ID
 */
export function getColormap(id: string): Colormap | undefined {
  return COLORMAPS.find(c => c.id === id);
}

/**
 * Get default colormap
 */
export function getDefaultColormap(): Colormap {
  return COLORMAPS[0]; // Thermal
}

/**
 * Convert RGB to CSS color string
 */
export function rgbToCSS(rgb: RGB): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/**
 * Convert RGB to hex color string
 */
export function rgbToHex(rgb: RGB): string {
  return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate gradient stops for CSS gradient
 */
export function generateGradientStops(colormap: Colormap, steps: number = 10): string {
  const stops: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const rgb = colormap.lookup(t);
    stops.push(`${rgbToCSS(rgb)} ${(t * 100).toFixed(0)}%`);
  }
  return stops.join(', ');
}

/**
 * Apply colormap to normalized stress value
 * Returns CSS color string
 */
export function stressToColor(
  normalizedStress: number,
  colormap: Colormap = getDefaultColormap()
): string {
  const rgb = colormap.lookup(normalizedStress);
  return rgbToCSS(rgb);
}

/**
 * Create a color lookup table (LUT) for fast rendering
 * Returns an array of 256 RGB values
 */
export function createLUT(colormap: Colormap): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const rgb = colormap.lookup(t);
    lut[i * 3] = rgb[0];
    lut[i * 3 + 1] = rgb[1];
    lut[i * 3 + 2] = rgb[2];
  }
  return lut;
}

/**
 * Apply LUT to get RGB for a normalized value [0-1]
 */
export function applyLUT(lut: Uint8Array, t: number): RGB {
  const idx = Math.max(0, Math.min(255, Math.round(t * 255)));
  return [
    lut[idx * 3],
    lut[idx * 3 + 1],
    lut[idx * 3 + 2],
  ];
}

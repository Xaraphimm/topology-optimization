/**
 * Density field upsampling utilities
 * 
 * Provides bilinear and bicubic interpolation for creating high-resolution
 * output from low-resolution topology optimization results.
 * 
 * These are essential for:
 * - High-resolution PNG export
 * - Smooth visualization for presentations
 * - Publication-quality images
 */

/**
 * Clamp value to a range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get density value at integer coordinates with boundary handling
 * Uses clamped indexing to handle edge cases
 */
function getDensityAt(
  densities: Float64Array,
  nelx: number,
  nely: number,
  x: number,
  y: number
): number {
  const clampedX = clamp(x, 0, nelx - 1);
  const clampedY = clamp(y, 0, nely - 1);
  const idx = clampedX * nely + clampedY;
  return densities[idx];
}

/**
 * Bilinear interpolation between 4 corner values
 * 
 * @param v00 - Value at (0,0)
 * @param v10 - Value at (1,0)
 * @param v01 - Value at (0,1)
 * @param v11 - Value at (1,1)
 * @param tx - Interpolation factor in x (0-1)
 * @param ty - Interpolation factor in y (0-1)
 */
function bilinearInterpolate(
  v00: number,
  v10: number,
  v01: number,
  v11: number,
  tx: number,
  ty: number
): number {
  // Interpolate along x for both rows
  const v0 = v00 + tx * (v10 - v00);
  const v1 = v01 + tx * (v11 - v01);
  // Interpolate along y
  return v0 + ty * (v1 - v0);
}

/**
 * Cubic interpolation kernel (Catmull-Rom spline)
 * Produces smooth curves that pass through control points
 * 
 * @param t - Parameter in [0, 1]
 * @param v0 - Value at t=-1
 * @param v1 - Value at t=0
 * @param v2 - Value at t=1
 * @param v3 - Value at t=2
 */
function cubicInterpolate(
  t: number,
  v0: number,
  v1: number,
  v2: number,
  v3: number
): number {
  // Catmull-Rom spline coefficients
  const t2 = t * t;
  const t3 = t2 * t;
  
  // Catmull-Rom basis functions
  const c0 = -0.5 * t3 + t2 - 0.5 * t;
  const c1 = 1.5 * t3 - 2.5 * t2 + 1;
  const c2 = -1.5 * t3 + 2 * t2 + 0.5 * t;
  const c3 = 0.5 * t3 - 0.5 * t2;
  
  return c0 * v0 + c1 * v1 + c2 * v2 + c3 * v3;
}

/**
 * Bicubic interpolation for a single point
 * Uses 16 surrounding points for smooth interpolation
 * 
 * @param densities - Source density array
 * @param nelx - Number of elements in x
 * @param nely - Number of elements in y
 * @param x - Floating-point x coordinate
 * @param y - Floating-point y coordinate
 */
function bicubicInterpolateAt(
  densities: Float64Array,
  nelx: number,
  nely: number,
  x: number,
  y: number
): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  
  // Get 4x4 neighborhood of values
  const rows: number[] = [];
  for (let j = -1; j <= 2; j++) {
    const v0 = getDensityAt(densities, nelx, nely, x0 - 1, y0 + j);
    const v1 = getDensityAt(densities, nelx, nely, x0, y0 + j);
    const v2 = getDensityAt(densities, nelx, nely, x0 + 1, y0 + j);
    const v3 = getDensityAt(densities, nelx, nely, x0 + 2, y0 + j);
    
    rows.push(cubicInterpolate(tx, v0, v1, v2, v3));
  }
  
  // Interpolate along y using the 4 row values
  return clamp(cubicInterpolate(ty, rows[0], rows[1], rows[2], rows[3]), 0, 1);
}

/**
 * Interpolation method for upsampling
 */
export type InterpolationMethod = 'nearest' | 'bilinear' | 'bicubic';

/**
 * Options for upsampling
 */
export interface UpsamplingOptions {
  /** Upsampling scale factor (e.g., 4 = 4x resolution) */
  scale: number;
  /** Interpolation method */
  method: InterpolationMethod;
}

/**
 * Default upsampling options
 */
export const DEFAULT_UPSAMPLING_OPTIONS: UpsamplingOptions = {
  scale: 4,
  method: 'bicubic',
};

/**
 * Upsample a density field to higher resolution
 * 
 * @param densities - Source density array (nelx * nely)
 * @param nelx - Number of elements in x direction
 * @param nely - Number of elements in y direction
 * @param options - Upsampling options
 * @returns Upsampled density array at new resolution
 */
export function upsampleDensities(
  densities: Float64Array,
  nelx: number,
  nely: number,
  options: Partial<UpsamplingOptions> = {}
): { data: Float64Array; width: number; height: number } {
  const opts = { ...DEFAULT_UPSAMPLING_OPTIONS, ...options };
  const { scale, method } = opts;
  
  // Validate inputs
  if (scale < 1) {
    throw new Error('Scale must be >= 1');
  }
  if (densities.length !== nelx * nely) {
    throw new Error(`Density array size (${densities.length}) doesn't match dimensions (${nelx}x${nely})`);
  }
  
  const newWidth = nelx * scale;
  const newHeight = nely * scale;
  const upsampled = new Float64Array(newWidth * newHeight);
  
  if (method === 'nearest') {
    // Nearest neighbor - fastest, but pixelated
    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const srcX = Math.floor(x / scale);
        const srcY = Math.floor(y / scale);
        const srcIdx = srcX * nely + srcY;
        upsampled[x * newHeight + y] = densities[srcIdx];
      }
    }
  } else if (method === 'bilinear') {
    // Bilinear interpolation - good balance of quality and speed
    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        // Map to source coordinates (offset by 0.5 for center-to-center mapping)
        const srcX = (x + 0.5) / scale - 0.5;
        const srcY = (y + 0.5) / scale - 0.5;
        
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const tx = srcX - x0;
        const ty = srcY - y0;
        
        const v00 = getDensityAt(densities, nelx, nely, x0, y0);
        const v10 = getDensityAt(densities, nelx, nely, x0 + 1, y0);
        const v01 = getDensityAt(densities, nelx, nely, x0, y0 + 1);
        const v11 = getDensityAt(densities, nelx, nely, x0 + 1, y0 + 1);
        
        upsampled[x * newHeight + y] = bilinearInterpolate(v00, v10, v01, v11, tx, ty);
      }
    }
  } else if (method === 'bicubic') {
    // Bicubic interpolation - highest quality, smooth curves
    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        // Map to source coordinates
        const srcX = (x + 0.5) / scale - 0.5;
        const srcY = (y + 0.5) / scale - 0.5;
        
        upsampled[x * newHeight + y] = bicubicInterpolateAt(
          densities,
          nelx,
          nely,
          srcX,
          srcY
        );
      }
    }
  }
  
  return {
    data: upsampled,
    width: newWidth,
    height: newHeight,
  };
}

/**
 * Sample a single point from density field with interpolation
 * Useful for contour extraction and other per-point sampling
 * 
 * @param densities - Source density array
 * @param nelx - Number of elements in x
 * @param nely - Number of elements in y
 * @param x - X coordinate (can be fractional)
 * @param y - Y coordinate (can be fractional)
 * @param method - Interpolation method
 */
export function sampleDensity(
  densities: Float64Array,
  nelx: number,
  nely: number,
  x: number,
  y: number,
  method: InterpolationMethod = 'bilinear'
): number {
  if (method === 'nearest') {
    return getDensityAt(densities, nelx, nely, Math.floor(x), Math.floor(y));
  } else if (method === 'bilinear') {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    
    const v00 = getDensityAt(densities, nelx, nely, x0, y0);
    const v10 = getDensityAt(densities, nelx, nely, x0 + 1, y0);
    const v01 = getDensityAt(densities, nelx, nely, x0, y0 + 1);
    const v11 = getDensityAt(densities, nelx, nely, x0 + 1, y0 + 1);
    
    return bilinearInterpolate(v00, v10, v01, v11, tx, ty);
  } else {
    return bicubicInterpolateAt(densities, nelx, nely, x, y);
  }
}

/**
 * Calculate the gradient of the density field at a point
 * Used for normal calculation in contour extraction
 * 
 * @param densities - Source density array
 * @param nelx - Number of elements in x
 * @param nely - Number of elements in y
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Gradient vector [dρ/dx, dρ/dy]
 */
export function calculateGradient(
  densities: Float64Array,
  nelx: number,
  nely: number,
  x: number,
  y: number
): [number, number] {
  const epsilon = 0.5;
  
  // Central difference approximation
  const dxPlus = sampleDensity(densities, nelx, nely, x + epsilon, y, 'bilinear');
  const dxMinus = sampleDensity(densities, nelx, nely, x - epsilon, y, 'bilinear');
  const dyPlus = sampleDensity(densities, nelx, nely, x, y + epsilon, 'bilinear');
  const dyMinus = sampleDensity(densities, nelx, nely, x, y - epsilon, 'bilinear');
  
  return [
    (dxPlus - dxMinus) / (2 * epsilon),
    (dyPlus - dyMinus) / (2 * epsilon),
  ];
}

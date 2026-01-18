/**
 * High-resolution image export for topology optimization results
 * 
 * Provides PNG and JPEG export with configurable:
 * - Resolution upsampling (bicubic/bilinear)
 * - Color schemes (grayscale, stress colormap)
 * - Background color
 * - Quality settings
 */

import { upsampleDensities, InterpolationMethod } from './upsampling';

/**
 * Color scheme for export
 */
export type ColorScheme = 'grayscale' | 'stress';

/**
 * Export format
 */
export type ExportFormat = 'png' | 'jpeg';

/**
 * Options for image export
 */
export interface ImageExportOptions {
  /** Upsampling scale factor (e.g., 4 = 4x resolution) */
  scale: number;
  /** Interpolation method for upsampling */
  interpolation: InterpolationMethod;
  /** Color scheme to use */
  colorScheme: ColorScheme;
  /** Background color (CSS color string) */
  backgroundColor: string;
  /** Output format */
  format: ExportFormat;
  /** Quality for JPEG (0-1) */
  quality: number;
  /** Apply gamma correction */
  gammaCorrection: boolean;
  /** Apply contrast enhancement */
  contrastEnhancement: boolean;
}

/**
 * Default export options
 */
export const DEFAULT_IMAGE_EXPORT_OPTIONS: ImageExportOptions = {
  scale: 4,
  interpolation: 'bicubic',
  colorScheme: 'grayscale',
  backgroundColor: '#ffffff',
  format: 'png',
  quality: 0.95,
  gammaCorrection: true,
  contrastEnhancement: true,
};

/**
 * Apply gamma correction
 */
function applyGamma(value: number, gamma: number = 2.2): number {
  return Math.pow(Math.max(0, Math.min(1, value)), 1 / gamma);
}

/**
 * Apply contrast enhancement using smoothstep-like function
 */
function enhanceContrast(value: number, low: number = 0.08, high: number = 0.92): number {
  if (value <= low) return 0;
  if (value >= high) return 1;
  const t = (value - low) / (high - low);
  return t * t * (3 - 2 * t); // Smoothstep
}

/**
 * Convert density to grayscale with optional enhancements
 */
function densityToGrayscale(
  density: number,
  gammaCorrection: boolean,
  contrastEnhancement: boolean
): number {
  let value = density;
  
  if (gammaCorrection) {
    value = applyGamma(value);
  }
  
  if (contrastEnhancement) {
    value = enhanceContrast(value);
  }
  
  // Invert: 0 (void) = white, 1 (solid) = black
  return 1 - value;
}

/**
 * Smoothstep function for color interpolation
 */
function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/**
 * Convert density to stress colormap (blue-white-red)
 * Matches the WebGL shader output
 */
function densityToStressColor(
  density: number,
  gammaCorrection: boolean
): [number, number, number] {
  const t = Math.max(0, Math.min(1, density));
  
  // Colors in linear space
  const blue = [0.231, 0.510, 0.965];
  const white = [1.0, 1.0, 1.0];
  const red = [0.937, 0.267, 0.267];
  
  let color: number[];
  
  if (t < 0.5) {
    const s = smoothstep(t * 2);
    color = [
      blue[0] + s * (white[0] - blue[0]),
      blue[1] + s * (white[1] - blue[1]),
      blue[2] + s * (white[2] - blue[2]),
    ];
  } else {
    const s = smoothstep((t - 0.5) * 2);
    color = [
      white[0] + s * (red[0] - white[0]),
      white[1] + s * (red[1] - white[1]),
      white[2] + s * (red[2] - white[2]),
    ];
  }
  
  if (gammaCorrection) {
    color = color.map(c => applyGamma(c));
  }
  
  return [
    Math.round(color[0] * 255),
    Math.round(color[1] * 255),
    Math.round(color[2] * 255),
  ];
}

/**
 * Parse CSS color to RGB values
 */
function parseColor(color: string): [number, number, number] {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    } else if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
  }
  
  // Handle rgb() and rgba()
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1]),
      parseInt(rgbMatch[2]),
      parseInt(rgbMatch[3]),
    ];
  }
  
  // Default to white
  return [255, 255, 255];
}

/**
 * Render density data to a canvas
 * 
 * @param densities - Density array
 * @param width - Canvas width (number of elements in x)
 * @param height - Canvas height (number of elements in y)
 * @param options - Export options
 * @returns HTMLCanvasElement with rendered data
 */
export function renderToCanvas(
  densities: Float64Array,
  width: number,
  height: number,
  options: Partial<ImageExportOptions> = {}
): HTMLCanvasElement {
  const opts = { ...DEFAULT_IMAGE_EXPORT_OPTIONS, ...options };
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }
  
  // Fill background
  const bgColor = parseColor(opts.backgroundColor);
  ctx.fillStyle = `rgb(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]})`;
  ctx.fillRect(0, 0, width, height);
  
  // Get image data for direct pixel manipulation
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  
  // Render each pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Flip Y coordinate (density array has Y=0 at bottom, canvas has Y=0 at top)
      const srcIdx = x * height + (height - 1 - y);
      const density = densities[srcIdx];
      
      const pixelIdx = (y * width + x) * 4;
      
      if (opts.colorScheme === 'grayscale') {
        const gray = densityToGrayscale(
          density,
          opts.gammaCorrection,
          opts.contrastEnhancement
        );
        const grayByte = Math.round(gray * 255);
        pixels[pixelIdx] = grayByte;     // R
        pixels[pixelIdx + 1] = grayByte; // G
        pixels[pixelIdx + 2] = grayByte; // B
        pixels[pixelIdx + 3] = 255;      // A
      } else {
        // Stress colormap
        const [r, g, b] = densityToStressColor(density, opts.gammaCorrection);
        pixels[pixelIdx] = r;
        pixels[pixelIdx + 1] = g;
        pixels[pixelIdx + 2] = b;
        pixels[pixelIdx + 3] = 255;
      }
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Export density data as a high-resolution image
 * 
 * @param densities - Source density array (nelx * nely)
 * @param nelx - Number of elements in x direction
 * @param nely - Number of elements in y direction
 * @param options - Export options
 * @returns Promise resolving to Blob containing image data
 */
export async function exportImage(
  densities: Float64Array,
  nelx: number,
  nely: number,
  options: Partial<ImageExportOptions> = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_IMAGE_EXPORT_OPTIONS, ...options };
  
  // Validate inputs
  if (densities.length !== nelx * nely) {
    throw new Error(`Density array size (${densities.length}) doesn't match dimensions (${nelx}x${nely})`);
  }
  
  // Upsample the density field
  const { data: upsampled, width, height } = upsampleDensities(
    densities,
    nelx,
    nely,
    { scale: opts.scale, method: opts.interpolation }
  );
  
  // Render to canvas
  const canvas = renderToCanvas(upsampled, width, height, opts);
  
  // Export as blob
  return new Promise((resolve, reject) => {
    const mimeType = opts.format === 'png' ? 'image/png' : 'image/jpeg';
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create image blob'));
        }
      },
      mimeType,
      opts.format === 'jpeg' ? opts.quality : undefined
    );
  });
}

/**
 * Export density data as a data URL
 * Useful for preview or direct embedding
 * 
 * @param densities - Source density array
 * @param nelx - Number of elements in x
 * @param nely - Number of elements in y
 * @param options - Export options
 * @returns Data URL string
 */
export function exportImageDataURL(
  densities: Float64Array,
  nelx: number,
  nely: number,
  options: Partial<ImageExportOptions> = {}
): string {
  const opts = { ...DEFAULT_IMAGE_EXPORT_OPTIONS, ...options };
  
  // Upsample the density field
  const { data: upsampled, width, height } = upsampleDensities(
    densities,
    nelx,
    nely,
    { scale: opts.scale, method: opts.interpolation }
  );
  
  // Render to canvas
  const canvas = renderToCanvas(upsampled, width, height, opts);
  
  // Convert to data URL
  const mimeType = opts.format === 'png' ? 'image/png' : 'image/jpeg';
  return canvas.toDataURL(mimeType, opts.format === 'jpeg' ? opts.quality : undefined);
}

/**
 * Trigger download of an image
 * 
 * @param blob - Image blob to download
 * @param filename - Filename for download
 */
export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export and download a high-resolution image
 * Convenience function that combines export and download
 * 
 * @param densities - Source density array
 * @param nelx - Number of elements in x
 * @param nely - Number of elements in y
 * @param filename - Filename for download
 * @param options - Export options
 */
export async function exportAndDownloadImage(
  densities: Float64Array,
  nelx: number,
  nely: number,
  filename: string,
  options: Partial<ImageExportOptions> = {}
): Promise<void> {
  const blob = await exportImage(densities, nelx, nely, options);
  downloadImage(blob, filename);
}

/**
 * Get recommended filename based on export options
 */
export function getRecommendedFilename(
  baseName: string,
  options: Partial<ImageExportOptions> = {}
): string {
  const opts = { ...DEFAULT_IMAGE_EXPORT_OPTIONS, ...options };
  const extension = opts.format === 'png' ? 'png' : 'jpg';
  const suffix = opts.scale > 1 ? `_${opts.scale}x` : '';
  return `${baseName}${suffix}.${extension}`;
}

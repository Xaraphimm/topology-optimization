/**
 * Export module - provides high-resolution image and vector export
 * 
 * Features:
 * - PNG/JPEG export with configurable upsampling
 * - SVG vector export with Marching Squares contour extraction
 * - Bilinear and bicubic interpolation
 * - Spline smoothing for vector contours
 */

// Upsampling utilities
export {
  upsampleDensities,
  sampleDensity,
  calculateGradient,
  type InterpolationMethod,
  type UpsamplingOptions,
  DEFAULT_UPSAMPLING_OPTIONS,
} from './upsampling';

// Image export (PNG/JPEG)
export {
  exportImage,
  exportImageDataURL,
  exportAndDownloadImage,
  downloadImage,
  renderToCanvas,
  getRecommendedFilename,
  type ColorScheme,
  type ExportFormat,
  type ImageExportOptions,
  DEFAULT_IMAGE_EXPORT_OPTIONS,
} from './image-export';

// SVG vector export
export {
  generateSVG,
  exportSVG,
  exportAndDownloadSVG,
  downloadSVG,
  getSVGDataURL,
  extractContours,
  smoothContour,
  type Point,
  type Contour,
  type SVGExportOptions,
  DEFAULT_SVG_EXPORT_OPTIONS,
} from './svg-export';

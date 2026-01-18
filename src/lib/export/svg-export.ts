/**
 * SVG vector export for topology optimization results
 * 
 * Uses Marching Squares algorithm to extract smooth contours from the
 * density field and exports them as scalable vector graphics.
 * 
 * Features:
 * - Isodensity contour extraction at configurable threshold
 * - Catmull-Rom spline smoothing for curves
 * - Multiple contour support (handles holes and islands)
 * - Configurable SVG styling
 */

import { sampleDensity } from './upsampling';

/**
 * 2D point
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * A closed contour (polygon)
 */
export type Contour = Point[];

/**
 * Options for SVG export
 */
export interface SVGExportOptions {
  /** Density threshold for contour (0.5 = solid/void boundary) */
  threshold: number;
  /** Apply spline smoothing to contours */
  smoothing: boolean;
  /** Number of interpolation points per segment for smoothing */
  smoothingResolution: number;
  /** Fill color for solid regions */
  fillColor: string;
  /** Stroke color for contour lines (empty for no stroke) */
  strokeColor: string;
  /** Stroke width */
  strokeWidth: number;
  /** Background color (empty for transparent) */
  backgroundColor: string;
  /** Scale factor for output SVG dimensions */
  scale: number;
  /** Add padding around the design */
  padding: number;
}

/**
 * Default SVG export options
 */
export const DEFAULT_SVG_EXPORT_OPTIONS: SVGExportOptions = {
  threshold: 0.5,
  smoothing: true,
  smoothingResolution: 4,
  fillColor: '#000000',
  strokeColor: '',
  strokeWidth: 0,
  backgroundColor: '#ffffff',
  scale: 10,
  padding: 0,
};

/**
 * Marching Squares edge table
 * Maps each of the 16 cell configurations to the edges crossed by the contour
 * Edges: 0=bottom, 1=right, 2=top, 3=left
 */
const EDGE_TABLE: number[][] = [
  [],           // 0: all below
  [3, 0],       // 1: bottom-left above
  [0, 1],       // 2: bottom-right above
  [3, 1],       // 3: bottom above
  [1, 2],       // 4: top-right above
  [3, 0, 1, 2], // 5: saddle (bottom-left, top-right above)
  [0, 2],       // 6: right above
  [3, 2],       // 7: not top-left
  [2, 3],       // 8: top-left above
  [2, 0],       // 9: left above
  [0, 1, 2, 3], // 10: saddle (bottom-right, top-left above)
  [2, 1],       // 11: not top-right
  [1, 3],       // 12: top above
  [1, 0],       // 13: not bottom-right
  [0, 3],       // 14: not bottom-left
  [],           // 15: all above
];

/**
 * Get the cell configuration based on corner values
 * Returns a number 0-15 representing which corners are above threshold
 */
function getCellConfig(
  v00: number, // bottom-left
  v10: number, // bottom-right
  v11: number, // top-right
  v01: number, // top-left
  threshold: number
): number {
  let config = 0;
  if (v00 >= threshold) config |= 1;
  if (v10 >= threshold) config |= 2;
  if (v11 >= threshold) config |= 4;
  if (v01 >= threshold) config |= 8;
  return config;
}

/**
 * Linear interpolation to find where the contour crosses an edge
 */
function interpolateEdge(
  v1: number,
  v2: number,
  threshold: number
): number {
  if (Math.abs(v2 - v1) < 1e-10) return 0.5;
  return (threshold - v1) / (v2 - v1);
}

/**
 * Get the point where the contour crosses a specific edge
 * Edge: 0=bottom, 1=right, 2=top, 3=left
 */
function getEdgePoint(
  x: number,
  y: number,
  edge: number,
  v00: number,
  v10: number,
  v11: number,
  v01: number,
  threshold: number
): Point {
  let t: number;
  switch (edge) {
    case 0: // bottom edge
      t = interpolateEdge(v00, v10, threshold);
      return { x: x + t, y: y };
    case 1: // right edge
      t = interpolateEdge(v10, v11, threshold);
      return { x: x + 1, y: y + t };
    case 2: // top edge
      t = interpolateEdge(v01, v11, threshold);
      return { x: x + t, y: y + 1 };
    case 3: // left edge
      t = interpolateEdge(v00, v01, threshold);
      return { x: x, y: y + t };
    default:
      return { x: x + 0.5, y: y + 0.5 };
  }
}

/**
 * Extract contours from density field using Marching Squares
 * 
 * @param densities - Density array
 * @param nelx - Number of elements in x
 * @param nely - Number of elements in y
 * @param threshold - Density threshold for contour
 * @returns Array of contours (each contour is an array of points)
 */
export function extractContours(
  densities: Float64Array,
  nelx: number,
  nely: number,
  threshold: number = 0.5
): Contour[] {
  // Build a map of edges to trace
  type EdgeKey = string;
  const edgeMap = new Map<EdgeKey, { p: Point; next: EdgeKey | null }>();
  
  // Helper to create edge key
  const makeKey = (x: number, y: number, edge: number): EdgeKey => 
    `${x},${y},${edge}`;
  
  // Helper to get opposite edge
  const getOppositeEdge = (edge: number): number => (edge + 2) % 4;
  
  // Helper to get next cell and edge when crossing an edge
  const getNextCell = (x: number, y: number, edge: number): [number, number, number] => {
    switch (edge) {
      case 0: return [x, y - 1, 2];     // bottom -> cell below's top
      case 1: return [x + 1, y, 3];     // right -> cell right's left
      case 2: return [x, y + 1, 0];     // top -> cell above's bottom
      case 3: return [x - 1, y, 1];     // left -> cell left's right
      default: return [x, y, edge];
    }
  };
  
  // Helper to get density at grid point
  const getDensity = (x: number, y: number): number => {
    if (x < 0 || x >= nelx || y < 0 || y >= nely) return 0;
    return densities[x * nely + y];
  };
  
  // Process each cell
  for (let x = 0; x < nelx - 1; x++) {
    for (let y = 0; y < nely - 1; y++) {
      // Get corner values
      const v00 = getDensity(x, y);
      const v10 = getDensity(x + 1, y);
      const v11 = getDensity(x + 1, y + 1);
      const v01 = getDensity(x, y + 1);
      
      const config = getCellConfig(v00, v10, v11, v01, threshold);
      const edges = EDGE_TABLE[config];
      
      if (edges.length === 0) continue;
      
      // Handle normal cases (2 edges)
      if (edges.length === 2) {
        const [e1, e2] = edges;
        const p1 = getEdgePoint(x, y, e1, v00, v10, v11, v01, threshold);
        const p2 = getEdgePoint(x, y, e2, v00, v10, v11, v01, threshold);
        
        const key1 = makeKey(x, y, e1);
        const key2 = makeKey(x, y, e2);
        const [nx1, ny1, ne1] = getNextCell(x, y, e1);
        const [nx2, ny2, ne2] = getNextCell(x, y, e2);
        const nextKey1 = makeKey(nx1, ny1, ne1);
        const nextKey2 = makeKey(nx2, ny2, ne2);
        
        edgeMap.set(key1, { p: p1, next: nextKey2 });
        edgeMap.set(key2, { p: p2, next: nextKey1 });
      }
      // Handle saddle cases (4 edges)
      else if (edges.length === 4) {
        // Resolve saddle ambiguity using center value
        const center = (v00 + v10 + v11 + v01) / 4;
        const [e1, e2, e3, e4] = edges;
        
        let pairs: [number, number][];
        if (center >= threshold) {
          // Connect diagonally opposite
          pairs = [[e1, e3], [e2, e4]];
        } else {
          // Connect adjacent
          pairs = [[e1, e2], [e3, e4]];
        }
        
        for (const [ea, eb] of pairs) {
          const pa = getEdgePoint(x, y, ea, v00, v10, v11, v01, threshold);
          const pb = getEdgePoint(x, y, eb, v00, v10, v11, v01, threshold);
          
          const keyA = makeKey(x, y, ea);
          const keyB = makeKey(x, y, eb);
          const [nxa, nya, nea] = getNextCell(x, y, ea);
          const [nxb, nyb, neb] = getNextCell(x, y, eb);
          
          edgeMap.set(keyA, { p: pa, next: makeKey(nxb, nyb, neb) });
          edgeMap.set(keyB, { p: pb, next: makeKey(nxa, nya, nea) });
        }
      }
    }
  }
  
  // Trace contours
  const contours: Contour[] = [];
  const visited = new Set<EdgeKey>();
  
  for (const [startKey, startData] of edgeMap) {
    if (visited.has(startKey)) continue;
    
    const contour: Contour = [];
    let currentKey: EdgeKey | null = startKey;
    
    while (currentKey && !visited.has(currentKey)) {
      visited.add(currentKey);
      const data = edgeMap.get(currentKey);
      if (!data) break;
      
      contour.push(data.p);
      currentKey = data.next;
      
      // Check if we've completed the loop
      if (currentKey === startKey) break;
    }
    
    if (contour.length >= 3) {
      contours.push(contour);
    }
  }
  
  return contours;
}

/**
 * Catmull-Rom spline interpolation
 * Creates smooth curves through control points
 */
function catmullRomSpline(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  
  // Catmull-Rom basis functions
  const c0 = -0.5 * t3 + t2 - 0.5 * t;
  const c1 = 1.5 * t3 - 2.5 * t2 + 1;
  const c2 = -1.5 * t3 + 2 * t2 + 0.5 * t;
  const c3 = 0.5 * t3 - 0.5 * t2;
  
  return {
    x: c0 * p0.x + c1 * p1.x + c2 * p2.x + c3 * p3.x,
    y: c0 * p0.y + c1 * p1.y + c2 * p2.y + c3 * p3.y,
  };
}

/**
 * Smooth a contour using Catmull-Rom splines
 * 
 * @param contour - Input contour points
 * @param resolution - Number of interpolated points per segment
 * @returns Smoothed contour
 */
export function smoothContour(contour: Contour, resolution: number = 4): Contour {
  if (contour.length < 3) return contour;
  
  const smoothed: Contour = [];
  const n = contour.length;
  
  for (let i = 0; i < n; i++) {
    const p0 = contour[(i - 1 + n) % n];
    const p1 = contour[i];
    const p2 = contour[(i + 1) % n];
    const p3 = contour[(i + 2) % n];
    
    for (let j = 0; j < resolution; j++) {
      const t = j / resolution;
      smoothed.push(catmullRomSpline(p0, p1, p2, p3, t));
    }
  }
  
  return smoothed;
}

/**
 * Convert a contour to SVG path data
 * 
 * @param contour - Contour points
 * @param scale - Scale factor
 * @param offsetX - X offset
 * @param offsetY - Y offset
 * @param height - Total height (for Y flipping)
 * @returns SVG path data string
 */
function contourToPathData(
  contour: Contour,
  scale: number,
  offsetX: number,
  offsetY: number,
  height: number
): string {
  if (contour.length === 0) return '';
  
  const points = contour.map(p => ({
    x: (p.x + offsetX) * scale,
    y: (height - p.y + offsetY) * scale, // Flip Y for SVG coordinates
  }));
  
  // Start with moveto
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  
  // Add line segments
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
  }
  
  // Close the path
  d += ' Z';
  
  return d;
}

/**
 * Generate SVG string from density field
 * 
 * @param densities - Density array
 * @param nelx - Number of elements in x
 * @param nely - Number of elements in y
 * @param options - Export options
 * @returns SVG string
 */
export function generateSVG(
  densities: Float64Array,
  nelx: number,
  nely: number,
  options: Partial<SVGExportOptions> = {}
): string {
  const opts = { ...DEFAULT_SVG_EXPORT_OPTIONS, ...options };
  
  // Extract contours
  let contours = extractContours(densities, nelx, nely, opts.threshold);
  
  // Smooth contours if requested
  if (opts.smoothing) {
    contours = contours.map(c => smoothContour(c, opts.smoothingResolution));
  }
  
  // Calculate SVG dimensions
  const width = (nelx + opts.padding * 2) * opts.scale;
  const height = (nely + opts.padding * 2) * opts.scale;
  
  // Build SVG
  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg width="${width}" height="${height}" `;
  svg += `viewBox="0 0 ${width} ${height}" `;
  svg += `xmlns="http://www.w3.org/2000/svg">\n`;
  
  // Add title and description
  svg += `  <title>Topology Optimization Result</title>\n`;
  svg += `  <desc>Generated from topology optimization density field</desc>\n`;
  
  // Background
  if (opts.backgroundColor) {
    svg += `  <rect width="100%" height="100%" fill="${opts.backgroundColor}"/>\n`;
  }
  
  // Combine all contours into a single path using fill-rule="evenodd"
  // This correctly handles nested contours (holes)
  if (contours.length > 0) {
    const allPaths = contours.map(c => 
      contourToPathData(c, opts.scale, opts.padding, opts.padding, nely)
    ).join(' ');
    
    let pathAttrs = `d="${allPaths}"`;
    pathAttrs += ` fill="${opts.fillColor}"`;
    pathAttrs += ` fill-rule="evenodd"`;
    
    if (opts.strokeColor && opts.strokeWidth > 0) {
      pathAttrs += ` stroke="${opts.strokeColor}"`;
      pathAttrs += ` stroke-width="${opts.strokeWidth}"`;
      pathAttrs += ` stroke-linejoin="round"`;
    } else {
      pathAttrs += ` stroke="none"`;
    }
    
    svg += `  <path ${pathAttrs}/>\n`;
  }
  
  svg += `</svg>`;
  
  return svg;
}

/**
 * Export density field as SVG blob
 * 
 * @param densities - Density array
 * @param nelx - Number of elements in x
 * @param nely - Number of elements in y
 * @param options - Export options
 * @returns Blob containing SVG data
 */
export function exportSVG(
  densities: Float64Array,
  nelx: number,
  nely: number,
  options: Partial<SVGExportOptions> = {}
): Blob {
  const svgString = generateSVG(densities, nelx, nely, options);
  return new Blob([svgString], { type: 'image/svg+xml' });
}

/**
 * Download SVG file
 * 
 * @param blob - SVG blob
 * @param filename - Filename for download
 */
export function downloadSVG(blob: Blob, filename: string): void {
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
 * Export and download SVG
 * Convenience function that combines export and download
 * 
 * @param densities - Density array
 * @param nelx - Number of elements in x
 * @param nely - Number of elements in y
 * @param filename - Filename for download
 * @param options - Export options
 */
export function exportAndDownloadSVG(
  densities: Float64Array,
  nelx: number,
  nely: number,
  filename: string,
  options: Partial<SVGExportOptions> = {}
): void {
  const blob = exportSVG(densities, nelx, nely, options);
  downloadSVG(blob, filename);
}

/**
 * Get SVG as data URL
 * Useful for preview or direct embedding
 */
export function getSVGDataURL(
  densities: Float64Array,
  nelx: number,
  nely: number,
  options: Partial<SVGExportOptions> = {}
): string {
  const svgString = generateSVG(densities, nelx, nely, options);
  return `data:image/svg+xml;base64,${btoa(svgString)}`;
}

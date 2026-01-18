/**
 * Preview Pattern Generator
 * 
 * Creates a ghosted topology-like preview pattern for the canvas
 * before optimization starts. The pattern gives a visual hint of
 * what the optimized structure might look like.
 * 
 * Patterns are deterministic based on:
 * - Preset type (MBB, Cantilever, Bridge)
 * - Mesh dimensions (nelx, nely)
 * - Volume fraction
 */

import type { Support, Load } from './presets';

/**
 * Generate a ghosted preview density field
 * 
 * Creates a smooth, organic-looking pattern that hints at the
 * expected topology result without showing the actual solution.
 * 
 * @param nelx - Number of elements in X direction
 * @param nely - Number of elements in Y direction
 * @param presetId - ID of the preset ('mbb', 'cantilever', 'bridge')
 * @param volumeFraction - Target volume fraction (0-1)
 * @param supports - Support locations for pattern generation
 * @param loads - Load locations for pattern generation
 * @returns Float64Array of density values for each element
 */
export function createPreviewPattern(
  nelx: number,
  nely: number,
  presetId: string,
  volumeFraction: number,
  supports: Support[],
  loads: Load[]
): Float64Array {
  const densities = new Float64Array(nelx * nely);
  
  // Base density slightly below volume fraction for ghosted look
  const baseDensity = volumeFraction * 0.3;
  const maxDensity = volumeFraction * 0.7;
  
  // Fill with base density
  densities.fill(baseDensity);
  
  // Generate pattern based on preset type
  switch (presetId) {
    case 'mbb':
      generateMBBPattern(densities, nelx, nely, baseDensity, maxDensity, supports, loads);
      break;
    case 'cantilever':
      generateCantileverPattern(densities, nelx, nely, baseDensity, maxDensity, supports, loads);
      break;
    case 'bridge':
      generateBridgePattern(densities, nelx, nely, baseDensity, maxDensity, supports, loads);
      break;
    default:
      // Generic pattern for unknown presets
      generateGenericPattern(densities, nelx, nely, baseDensity, maxDensity);
  }
  
  return densities;
}

/**
 * MBB Beam pattern - diagonal truss-like structure
 */
function generateMBBPattern(
  densities: Float64Array,
  nelx: number,
  nely: number,
  baseDensity: number,
  maxDensity: number,
  supports: Support[],
  loads: Load[]
): void {
  // MBB produces diagonal struts from load to supports
  // Create gentle diagonal bands
  
  for (let x = 0; x < nelx; x++) {
    for (let y = 0; y < nely; y++) {
      const idx = x * nely + y;
      
      // Normalized coordinates [0, 1]
      const nx = x / (nelx - 1);
      const ny = y / (nely - 1);
      
      // Top and bottom edge emphasis (flanges)
      const edgeFactor = Math.max(
        smoothFalloff(ny, 0, 0.15),      // Bottom edge
        smoothFalloff(ny, 1, 0.15)       // Top edge
      );
      
      // Diagonal strut pattern (web members)
      // Primary diagonal from top-left to bottom-right
      const diag1 = Math.abs(nx - (1 - ny));
      const diag1Factor = smoothFalloff(diag1, 0, 0.12);
      
      // Secondary diagonals creating X-brace pattern
      const numBraces = 3;
      let braceFactor = 0;
      for (let i = 0; i < numBraces; i++) {
        const offset = (i + 0.5) / numBraces;
        const localDiag = Math.abs((nx - offset) - (ny - 0.5) * 0.5);
        braceFactor = Math.max(braceFactor, smoothFalloff(localDiag, 0, 0.08) * 0.5);
      }
      
      // Left edge (load path from top-left)
      const leftEdge = smoothFalloff(nx, 0, 0.1) * smoothFalloff(ny, 1, 0.3);
      
      // Combine factors
      const factor = Math.max(edgeFactor * 0.8, diag1Factor * 0.6, braceFactor, leftEdge);
      
      densities[idx] = baseDensity + factor * (maxDensity - baseDensity);
    }
  }
}

/**
 * Cantilever pattern - curved top/bottom with tapered shape
 */
function generateCantileverPattern(
  densities: Float64Array,
  nelx: number,
  nely: number,
  baseDensity: number,
  maxDensity: number,
  supports: Support[],
  loads: Load[]
): void {
  // Cantilever produces material along top and bottom edges,
  // tapering toward the free end
  
  for (let x = 0; x < nelx; x++) {
    for (let y = 0; y < nely; y++) {
      const idx = x * nely + y;
      
      // Normalized coordinates [0, 1]
      const nx = x / (nelx - 1);
      const ny = y / (nely - 1);
      
      // Taper factor - more material at fixed end (left)
      const taperWidth = 0.15 + (1 - nx) * 0.15;
      
      // Top edge (tension flange)
      const topFactor = smoothFalloff(ny, 1, taperWidth);
      
      // Bottom edge (compression flange) 
      const bottomFactor = smoothFalloff(ny, 0, taperWidth);
      
      // Fixed edge (left side)
      const fixedEdge = smoothFalloff(nx, 0, 0.15);
      
      // Curved web connecting top and bottom
      const centerY = 0.5;
      const webCurve = Math.sin(nx * Math.PI) * 0.3;
      const webY = centerY + webCurve * (ny - 0.5);
      const webFactor = smoothFalloff(Math.abs(ny - centerY), 0, 0.1) * (1 - nx) * 0.4;
      
      // Combine factors
      const factor = Math.max(
        topFactor * (0.5 + (1 - nx) * 0.5),
        bottomFactor * (0.5 + (1 - nx) * 0.5),
        fixedEdge * 0.7,
        webFactor
      );
      
      densities[idx] = baseDensity + factor * (maxDensity - baseDensity);
    }
  }
}

/**
 * Bridge pattern - arch with tie and vertical members
 */
function generateBridgePattern(
  densities: Float64Array,
  nelx: number,
  nely: number,
  baseDensity: number,
  maxDensity: number,
  supports: Support[],
  loads: Load[]
): void {
  // Bridge produces an arch on top, tie on bottom, with verticals
  
  for (let x = 0; x < nelx; x++) {
    for (let y = 0; y < nely; y++) {
      const idx = x * nely + y;
      
      // Normalized coordinates [0, 1]
      const nx = x / (nelx - 1);
      const ny = y / (nely - 1);
      
      // Symmetric around center
      const symX = Math.abs(nx - 0.5) * 2; // 0 at center, 1 at edges
      
      // Arch curve (parabolic, higher in center)
      const archHeight = 0.7 + (1 - symX * symX) * 0.25;
      const archFactor = smoothFalloff(ny, archHeight, 0.12);
      
      // Bottom tie beam
      const tieFactor = smoothFalloff(ny, 0.05, 0.1);
      
      // Vertical members at supports
      const leftSupport = smoothFalloff(nx, 0, 0.08) * smoothFalloff(ny, 0.5, 0.5);
      const rightSupport = smoothFalloff(nx, 1, 0.08) * smoothFalloff(ny, 0.5, 0.5);
      
      // Diagonal web members connecting arch to tie
      const numDiags = 4;
      let diagFactor = 0;
      for (let i = 1; i < numDiags; i++) {
        const diagX = i / numDiags;
        const diagDist = Math.abs(nx - diagX);
        if (diagDist < 0.1) {
          // Diagonal from arch down to tie
          const localArchY = 0.7 + (1 - Math.pow(Math.abs(diagX - 0.5) * 2, 2)) * 0.25;
          const expectedY = localArchY - (localArchY - 0.05) * (1 - (ny - 0.05) / (localArchY - 0.05));
          const onDiag = smoothFalloff(diagDist, 0, 0.05);
          diagFactor = Math.max(diagFactor, onDiag * 0.5);
        }
      }
      
      // Combine factors
      const factor = Math.max(
        archFactor * 0.8,
        tieFactor * 0.7,
        leftSupport * 0.6,
        rightSupport * 0.6,
        diagFactor
      );
      
      densities[idx] = baseDensity + factor * (maxDensity - baseDensity);
    }
  }
}

/**
 * Generic pattern - simple gradient with edge emphasis
 */
function generateGenericPattern(
  densities: Float64Array,
  nelx: number,
  nely: number,
  baseDensity: number,
  maxDensity: number
): void {
  for (let x = 0; x < nelx; x++) {
    for (let y = 0; y < nely; y++) {
      const idx = x * nely + y;
      
      const nx = x / (nelx - 1);
      const ny = y / (nely - 1);
      
      // Edge emphasis
      const edgeFactor = Math.max(
        smoothFalloff(nx, 0, 0.1),
        smoothFalloff(nx, 1, 0.1),
        smoothFalloff(ny, 0, 0.1),
        smoothFalloff(ny, 1, 0.1)
      );
      
      densities[idx] = baseDensity + edgeFactor * 0.5 * (maxDensity - baseDensity);
    }
  }
}

/**
 * Smooth falloff function for creating soft edges
 * Returns 1 at target, falls off smoothly to 0 beyond width
 */
function smoothFalloff(value: number, target: number, width: number): number {
  const dist = Math.abs(value - target);
  if (dist >= width) return 0;
  const t = dist / width;
  // Smoothstep falloff
  return 1 - t * t * (3 - 2 * t);
}

/**
 * Check if preview pattern should be used
 * Returns true if densities is null or empty
 */
export function shouldUsePreview(densities: Float64Array | null): boolean {
  return !densities || densities.length === 0;
}

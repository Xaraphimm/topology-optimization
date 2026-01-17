/**
 * Preset problem definitions for topology optimization demos
 * 
 * Each preset defines a structural problem with:
 * - Boundary conditions (fixed supports)
 * - Applied loads
 * - Recommended mesh aspect ratio
 */

import { getNodeIndex, getTotalDOFs } from './optimizer/fem';

export interface Support {
  x: number;
  y: number;
  type: 'pin' | 'roller-x' | 'roller-y';
}

export interface Load {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export interface PresetResult {
  forces: Float64Array;
  fixedDofs: number[];
  supports: Support[];
  loads: Load[];
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  aspectRatio: number;  // width:height ratio (e.g., 3 means 3:1)
  setup: (nelx: number, nely: number) => PresetResult;
}

/**
 * MBB Beam (Messerschmitt-Bolkow-Blohm)
 * 
 * Classic benchmark problem. Uses half the beam with symmetry boundary conditions.
 * - Left edge: roller support (x fixed) - represents symmetry plane
 * - Bottom right corner: vertical support (y fixed)
 * - Load: downward force at top-left corner
 * 
 * This produces the famous "truss-like" optimal structure.
 */
export const MBB_BEAM: Preset = {
  id: 'mbb',
  name: 'MBB Beam',
  description: 'A simply supported beam with a central load. This classic problem shows how material naturally forms diagonal braces to carry the load efficiently.',
  aspectRatio: 3,
  setup: (nelx: number, nely: number): PresetResult => {
    const nDofs = getTotalDOFs(nelx, nely);
    const forces = new Float64Array(nDofs);
    const fixedDofs: number[] = [];
    const supports: Support[] = [];
    const loads: Load[] = [];
    
    // Left edge: roller support (fix x only - symmetry condition)
    for (let y = 0; y <= nely; y++) {
      const nodeIdx = getNodeIndex(0, y, nely);
      fixedDofs.push(2 * nodeIdx); // x DOF only
    }
    supports.push({ x: 0, y: nely / 2, type: 'roller-x' });
    
    // Bottom right corner: pin support (fix y only)
    const bottomRightNode = getNodeIndex(nelx, 0, nely);
    fixedDofs.push(2 * bottomRightNode + 1); // y DOF only
    supports.push({ x: nelx, y: 0, type: 'roller-y' });
    
    // Load at top-left corner (downward)
    const topLeftNode = getNodeIndex(0, nely, nely);
    forces[2 * topLeftNode + 1] = -1;
    loads.push({ x: 0, y: nely, dx: 0, dy: -1 });
    
    return { forces, fixedDofs, supports, loads };
  },
};

/**
 * Cantilever Beam
 * 
 * A beam fixed on one end with a load on the other end.
 * - Left edge: fully fixed (both x and y)
 * - Load: downward force at middle-right
 * 
 * This is one of the simplest structural problems and produces
 * a characteristic curved shape with material concentrated at the edges.
 */
export const CANTILEVER: Preset = {
  id: 'cantilever',
  name: 'Cantilever',
  description: 'A beam fixed on one end with a load pulling down on the other. Watch how material concentrates along the top and bottom edges where stresses are highest.',
  aspectRatio: 2,
  setup: (nelx: number, nely: number): PresetResult => {
    const nDofs = getTotalDOFs(nelx, nely);
    const forces = new Float64Array(nDofs);
    const fixedDofs: number[] = [];
    const supports: Support[] = [];
    const loads: Load[] = [];
    
    // Left edge: fully fixed (x and y)
    for (let y = 0; y <= nely; y++) {
      const nodeIdx = getNodeIndex(0, y, nely);
      fixedDofs.push(2 * nodeIdx);     // x DOF
      fixedDofs.push(2 * nodeIdx + 1); // y DOF
    }
    supports.push({ x: 0, y: nely / 2, type: 'pin' });
    
    // Load at middle of right edge (downward)
    const midY = Math.floor(nely / 2);
    const rightNode = getNodeIndex(nelx, midY, nely);
    forces[2 * rightNode + 1] = -1;
    loads.push({ x: nelx, y: midY, dx: 0, dy: -1 });
    
    return { forces, fixedDofs, supports, loads };
  },
};

/**
 * Bridge
 * 
 * A beam supported at both ends with a distributed load on top.
 * - Bottom left corner: pin support (x and y fixed)
 * - Bottom right corner: roller support (y fixed only)
 * - Load: distributed downward force along top edge
 * 
 * This produces the classic arch-and-tie bridge structure.
 */
export const BRIDGE: Preset = {
  id: 'bridge',
  name: 'Bridge',
  description: 'A structure supported at both ends with weight distributed along the top. This creates the familiar arch shape that bridges use to transfer loads to the supports.',
  aspectRatio: 3,
  setup: (nelx: number, nely: number): PresetResult => {
    const nDofs = getTotalDOFs(nelx, nely);
    const forces = new Float64Array(nDofs);
    const fixedDofs: number[] = [];
    const supports: Support[] = [];
    const loads: Load[] = [];
    
    // Bottom left corner: pin support (x and y fixed)
    const bottomLeftNode = getNodeIndex(0, 0, nely);
    fixedDofs.push(2 * bottomLeftNode);     // x DOF
    fixedDofs.push(2 * bottomLeftNode + 1); // y DOF
    supports.push({ x: 0, y: 0, type: 'pin' });
    
    // Bottom right corner: roller support (y fixed only)
    const bottomRightNode = getNodeIndex(nelx, 0, nely);
    fixedDofs.push(2 * bottomRightNode + 1); // y DOF only
    supports.push({ x: nelx, y: 0, type: 'roller-y' });
    
    // Distributed load along top edge
    const loadPerNode = -1 / (nelx + 1);
    for (let x = 0; x <= nelx; x++) {
      const topNode = getNodeIndex(x, nely, nely);
      forces[2 * topNode + 1] = loadPerNode;
    }
    // Show load arrow at center of top edge
    loads.push({ x: nelx / 2, y: nely, dx: 0, dy: -1 });
    
    return { forces, fixedDofs, supports, loads };
  },
};

/**
 * All available presets
 */
export const PRESETS: Preset[] = [MBB_BEAM, CANTILEVER, BRIDGE];

/**
 * Get a preset by ID
 */
export function getPreset(id: string): Preset | undefined {
  return PRESETS.find(p => p.id === id);
}

/**
 * Mesh resolution options
 */
export interface Resolution {
  id: string;
  label: string;
  baseNelx: number;  // Base width for aspect ratio 1
}

export const RESOLUTIONS: Resolution[] = [
  { id: 'low', label: '60x20', baseNelx: 60 },
  { id: 'medium', label: '90x30', baseNelx: 90 },
  { id: 'high', label: '120x40', baseNelx: 120 },
];

/**
 * Calculate mesh dimensions for a given preset and resolution
 */
export function getMeshDimensions(preset: Preset, resolution: Resolution): { nelx: number; nely: number } {
  const nelx = resolution.baseNelx;
  const nely = Math.round(nelx / preset.aspectRatio);
  return { nelx, nely };
}

/**
 * SIMP (Solid Isotropic Material with Penalization) Topology Optimization
 * 
 * Main optimizer class that orchestrates the topology optimization process.
 * Based on Sigmund's 99-line MATLAB code with improvements for browser performance.
 */

import { computeElementStiffness, getElementDOFs, getTotalDOFs, getNodeIndex } from './fem';
import { assembleStiffnessMatrix, applyBoundaryConditions, conjugateGradient, CSRMatrix } from './solver';
import { prepareFilter, applySensitivityFilter, FilterData } from './filter';
import type { OptimizationState, ProblemDefinition } from './types';

/**
 * Configuration for the optimizer
 */
export interface SIMPConfig {
  nelx: number;           // Elements in x direction
  nely: number;           // Elements in y direction
  volfrac: number;        // Target volume fraction (0-1)
  penal: number;          // Penalization power (typically 3)
  rmin: number;           // Filter radius (in elements)
  maxIter: number;        // Maximum iterations
  tolx: number;           // Convergence tolerance for density change
  Emin: number;           // Minimum Young's modulus
  E0: number;             // Solid material Young's modulus
  nu: number;             // Poisson's ratio
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: SIMPConfig = {
  nelx: 60,
  nely: 20,
  volfrac: 0.5,
  penal: 3.0,
  rmin: 1.5,
  maxIter: 200,
  tolx: 0.01,
  Emin: 1e-9,
  E0: 1.0,
  nu: 0.3,
};

/**
 * Main SIMP Topology Optimizer
 */
export class SIMPOptimizer {
  private config: SIMPConfig;
  private densities: Float64Array;
  private filterData: FilterData;
  private forces: Float64Array;
  private fixedDofs: number[];
  private KE: Float64Array;
  
  // State tracking
  private iteration: number = 0;
  private compliance: number = Infinity;
  private volume: number;
  private change: number = 1.0;
  private converged: boolean = false;
  
  // Cached arrays for performance
  private u: Float64Array;
  private dc: Float64Array;
  private xold: Float64Array;
  private strainEnergy: Float64Array;  // Strain energy per element (for stress visualization)
  
  constructor(config: Partial<SIMPConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    const { nelx, nely, volfrac, rmin, nu } = this.config;
    const nelem = nelx * nely;
    const nDofs = getTotalDOFs(nelx, nely);
    
    // Initialize densities to volume fraction
    this.densities = new Float64Array(nelem).fill(volfrac);
    this.volume = volfrac;
    
    // Prepare filter
    this.filterData = prepareFilter(nelx, nely, rmin);
    
    // Precompute element stiffness matrix
    this.KE = computeElementStiffness(1.0, nu);
    
    // Initialize arrays
    this.forces = new Float64Array(nDofs);
    this.fixedDofs = [];
    this.u = new Float64Array(nDofs);
    this.dc = new Float64Array(nelem);
    this.xold = new Float64Array(nelem);
    this.strainEnergy = new Float64Array(nelem);
  }
  
  /**
   * Set up the problem from a definition
   */
  setupProblem(problem: ProblemDefinition): void {
    const { nelx, nely } = this.config;
    const nDofs = getTotalDOFs(nelx, nely);
    
    // Reset forces
    this.forces.fill(0);
    this.fixedDofs = [];
    
    // Scale positions from problem definition to current mesh
    const scaleX = nelx / problem.nelx;
    const scaleY = nely / problem.nely;
    
    // Apply fixed boundary conditions
    for (const fix of problem.fixedNodes) {
      const nodeX = Math.round(fix.x * scaleX);
      const nodeY = Math.round(fix.y * scaleY);
      const nodeIdx = getNodeIndex(nodeX, nodeY, nely);
      
      if (fix.dof === 'x' || fix.dof === 'both') {
        this.fixedDofs.push(2 * nodeIdx);
      }
      if (fix.dof === 'y' || fix.dof === 'both') {
        this.fixedDofs.push(2 * nodeIdx + 1);
      }
    }
    
    // Apply loads
    for (const load of problem.loads) {
      const nodeX = Math.round(load.x * scaleX);
      const nodeY = Math.round(load.y * scaleY);
      const nodeIdx = getNodeIndex(nodeX, nodeY, nely);
      
      if (load.fx !== 0) {
        this.forces[2 * nodeIdx] = load.fx;
      }
      if (load.fy !== 0) {
        this.forces[2 * nodeIdx + 1] = load.fy;
      }
    }
  }
  
  /**
   * Set forces directly (for custom problems)
   */
  setForces(forces: Float64Array): void {
    this.forces = forces;
  }
  
  /**
   * Set fixed DOFs directly (for custom problems)
   */
  setFixedDofs(fixedDofs: number[]): void {
    this.fixedDofs = fixedDofs;
  }
  
  /**
   * Reset the optimization
   */
  reset(): void {
    const { volfrac } = this.config;
    const nelem = this.config.nelx * this.config.nely;
    
    this.densities.fill(volfrac);
    this.iteration = 0;
    this.compliance = Infinity;
    this.volume = volfrac;
    this.change = 1.0;
    this.converged = false;
    this.u.fill(0);
  }
  
  /**
   * Perform a single optimization iteration
   * Returns the current state
   */
  step(): OptimizationState {
    if (this.converged) {
      return this.getState();
    }
    
    const { nelx, nely, penal, Emin, E0, nu, volfrac, tolx } = this.config;
    const nelem = nelx * nely;
    const nDofs = getTotalDOFs(nelx, nely);
    
    // Store old densities for convergence check
    for (let i = 0; i < nelem; i++) {
      this.xold[i] = this.densities[i];
    }
    
    // FE Analysis: Assemble K and solve Ku = f
    const K = assembleStiffnessMatrix(nelx, nely, this.densities, penal, Emin, E0, nu);
    const fMod = applyBoundaryConditions(K, this.forces, this.fixedDofs);
    
    // Solve using CG
    this.u.fill(0); // Reset initial guess for cleaner solve
    const solveResult = conjugateGradient(K, fMod, this.u, 1e-8, 10000);
    this.u = solveResult.x;
    
    // Compute objective (compliance) and sensitivities
    let c = 0;
    for (let elx = 0; elx < nelx; elx++) {
      for (let ely = 0; ely < nely; ely++) {
        const elemIdx = elx * nely + ely;
        const dofs = getElementDOFs(elx, ely, nelx, nely);
        
        // Extract element displacements and compute strain energy
        let ue_Ke_ue = 0;
        for (let i = 0; i < 8; i++) {
          for (let j = 0; j < 8; j++) {
            ue_Ke_ue += this.u[dofs[i]] * this.KE[i * 8 + j] * this.u[dofs[j]];
          }
        }
        
        // Store strain energy for visualization (this is what drives material removal)
        this.strainEnergy[elemIdx] = ue_Ke_ue;
        
        // SIMP interpolation
        const rho = this.densities[elemIdx];
        const Ee = Emin + Math.pow(rho, penal) * (E0 - Emin);
        
        // Compliance contribution
        c += Ee * ue_Ke_ue;
        
        // Sensitivity (derivative of compliance w.r.t. density)
        this.dc[elemIdx] = -penal * Math.pow(rho, penal - 1) * (E0 - Emin) * ue_Ke_ue;
      }
    }
    
    this.compliance = c;
    
    // Apply sensitivity filter
    const dcFiltered = applySensitivityFilter(this.filterData, this.densities, this.dc);
    
    // Optimality Criteria update
    this.updateDensities(dcFiltered);
    
    // Compute change
    let maxChange = 0;
    for (let i = 0; i < nelem; i++) {
      maxChange = Math.max(maxChange, Math.abs(this.densities[i] - this.xold[i]));
    }
    this.change = maxChange;
    
    // Compute actual volume
    let vol = 0;
    for (let i = 0; i < nelem; i++) {
      vol += this.densities[i];
    }
    this.volume = vol / nelem;
    
    this.iteration++;
    
    // Check convergence
    if (this.change < tolx || this.iteration >= this.config.maxIter) {
      this.converged = true;
    }
    
    return this.getState();
  }
  
  /**
   * Optimality Criteria (OC) update
   * Updates densities to minimize compliance subject to volume constraint
   */
  private updateDensities(dc: Float64Array): void {
    const { nelx, nely, volfrac } = this.config;
    const nelem = nelx * nely;
    const move = 0.2; // Move limit
    
    // Bisection to find Lagrange multiplier
    let l1 = 0;
    let l2 = 1e9;
    
    while ((l2 - l1) / (l1 + l2) > 1e-3) {
      const lmid = 0.5 * (l2 + l1);
      
      // Compute new densities
      let volNew = 0;
      for (let i = 0; i < nelem; i++) {
        const xold = this.xold[i];
        
        // OC update formula
        const Be = -dc[i] / lmid;
        let xnew = xold * Math.sqrt(Be);
        
        // Apply move limits
        xnew = Math.max(Math.max(0.0, xold - move), Math.min(Math.min(1.0, xold + move), xnew));
        
        // Clamp to [0, 1]
        xnew = Math.max(0.001, Math.min(1.0, xnew));
        
        this.densities[i] = xnew;
        volNew += xnew;
      }
      
      // Adjust bisection bounds
      if (volNew / nelem > volfrac) {
        l1 = lmid;
      } else {
        l2 = lmid;
      }
    }
  }
  
  /**
   * Get the current optimization state
   */
  getState(): OptimizationState {
    return {
      densities: this.densities,
      strainEnergy: this.strainEnergy,
      compliance: this.compliance,
      volume: this.volume,
      iteration: this.iteration,
      converged: this.converged,
      change: this.change,
    };
  }
  
  /**
   * Get the current densities (for visualization)
   */
  getDensities(): Float64Array {
    return this.densities;
  }
  
  /**
   * Get configuration
   */
  getConfig(): SIMPConfig {
    return { ...this.config };
  }
  
  /**
   * Update configuration (requires reset)
   */
  updateConfig(newConfig: Partial<SIMPConfig>): void {
    const needsReset = 
      newConfig.nelx !== undefined ||
      newConfig.nely !== undefined ||
      newConfig.rmin !== undefined;
    
    this.config = { ...this.config, ...newConfig };
    
    if (needsReset) {
      const { nelx, nely, rmin, volfrac, nu } = this.config;
      const nelem = nelx * nely;
      const nDofs = getTotalDOFs(nelx, nely);
      
      this.densities = new Float64Array(nelem).fill(volfrac);
      this.filterData = prepareFilter(nelx, nely, rmin);
      this.KE = computeElementStiffness(1.0, nu);
      this.forces = new Float64Array(nDofs);
      this.fixedDofs = [];
      this.u = new Float64Array(nDofs);
      this.dc = new Float64Array(nelem);
      this.xold = new Float64Array(nelem);
      this.strainEnergy = new Float64Array(nelem);
    }
    
    this.reset();
  }
  
  /**
   * Run multiple iterations
   */
  runIterations(n: number): OptimizationState {
    let state = this.getState();
    for (let i = 0; i < n && !state.converged; i++) {
      state = this.step();
    }
    return state;
  }
  
  /**
   * Check if the optimization has converged
   */
  isConverged(): boolean {
    return this.converged;
  }
}

/**
 * Create a simple cantilever beam problem
 */
export function createCantileverProblem(nelx: number, nely: number): { forces: Float64Array; fixedDofs: number[] } {
  const nDofs = getTotalDOFs(nelx, nely);
  const forces = new Float64Array(nDofs);
  const fixedDofs: number[] = [];
  
  // Fix left edge
  for (let y = 0; y <= nely; y++) {
    const nodeIdx = getNodeIndex(0, y, nely);
    fixedDofs.push(2 * nodeIdx);     // x DOF
    fixedDofs.push(2 * nodeIdx + 1); // y DOF
  }
  
  // Apply downward force at middle of right edge
  const midY = Math.floor(nely / 2);
  const rightNode = getNodeIndex(nelx, midY, nely);
  forces[2 * rightNode + 1] = -1; // Downward force
  
  return { forces, fixedDofs };
}

/**
 * Create an MBB beam problem (half beam with symmetry)
 */
export function createMBBProblem(nelx: number, nely: number): { forces: Float64Array; fixedDofs: number[] } {
  const nDofs = getTotalDOFs(nelx, nely);
  const forces = new Float64Array(nDofs);
  const fixedDofs: number[] = [];
  
  // MBB beam: symmetry condition on left, roller support on bottom-right
  
  // Left edge: fix only x (symmetry)
  for (let y = 0; y <= nely; y++) {
    const nodeIdx = getNodeIndex(0, y, nely);
    fixedDofs.push(2 * nodeIdx); // Only x DOF (roller/symmetry)
  }
  
  // Bottom-right corner: fix y
  const bottomRightNode = getNodeIndex(nelx, 0, nely);
  fixedDofs.push(2 * bottomRightNode + 1); // Only y DOF
  
  // Apply downward force at top-left corner
  const topLeftNode = getNodeIndex(0, nely, nely);
  forces[2 * topLeftNode + 1] = -1; // Downward force
  
  return { forces, fixedDofs };
}

/**
 * Create a bridge problem
 */
export function createBridgeProblem(nelx: number, nely: number): { forces: Float64Array; fixedDofs: number[] } {
  const nDofs = getTotalDOFs(nelx, nely);
  const forces = new Float64Array(nDofs);
  const fixedDofs: number[] = [];
  
  // Two point supports at bottom corners
  const bottomLeftNode = getNodeIndex(0, 0, nely);
  const bottomRightNode = getNodeIndex(nelx, 0, nely);
  
  // Fix left support in both directions
  fixedDofs.push(2 * bottomLeftNode);     // x
  fixedDofs.push(2 * bottomLeftNode + 1); // y
  
  // Fix right support only in y (roller)
  fixedDofs.push(2 * bottomRightNode + 1); // y only
  
  // Apply distributed load along top edge
  const loadPerNode = -1 / (nelx + 1);
  for (let x = 0; x <= nelx; x++) {
    const topNode = getNodeIndex(x, nely, nely);
    forces[2 * topNode + 1] = loadPerNode;
  }
  
  return { forces, fixedDofs };
}

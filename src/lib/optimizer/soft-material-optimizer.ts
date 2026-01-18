/**
 * Soft Material Topology Optimizer
 *
 * Extends the standard SIMP optimizer with stress constraints
 * specifically designed for soft/hyperelastic materials like those
 * used in artificial muscles.
 *
 * Key additions:
 * - Stress constraints to prevent material rupture
 * - Minimum wall thickness enforcement
 * - Support for soft material properties
 * - Fatigue-aware optimization option
 */

import { computeElementStiffness, getElementDOFs, getTotalDOFs, getNodeIndex } from './fem';
import { prepareFilter, applySensitivityFilter, FilterData } from './filter';
import {
  precomputeMeshConnectivity,
  createSolverScratch,
  solveFEMOptimized,
  type MeshConnectivity,
  type SolverScratch,
} from './optimized-solver';
import type { OptimizationState, ProblemDefinition } from './types';
import {
  SoftMaterial,
  calculateAllowableStress,
  calculateMinimumDensity,
  analyzeStressField,
  summarizeStressAnalysis,
  type StressAnalysisSummary,
  type ElementStressResult,
} from '../soft-materials';

/**
 * Extended configuration for soft material optimization
 */
export interface SoftMaterialConfig {
  // Standard SIMP parameters
  nelx: number;
  nely: number;
  volfrac: number;
  penal: number;
  rmin: number;
  maxIter: number;
  tolx: number;
  Emin: number;
  E0: number;
  nu: number;

  // Soft material specific
  material: SoftMaterial;
  safetyFactor: number;          // Safety factor for stress (typically 1.5-3.0)
  minWallThickness: number;      // mm - minimum manufacturable wall thickness
  elementSize: number;           // mm - physical size of each element
  enableStressConstraint: boolean;
  useFatigueLimit: boolean;      // Use fatigue limit instead of ultimate stress

  // Pressure loading (for pneumatic muscles)
  internalPressure?: number;     // MPa - for hollow structures
}

/**
 * Default configuration for soft materials
 */
export const DEFAULT_SOFT_CONFIG: SoftMaterialConfig = {
  nelx: 60,
  nely: 20,
  volfrac: 0.5,
  penal: 3.0,
  rmin: 1.5,
  maxIter: 200,
  tolx: 0.01,
  Emin: 1e-9,
  E0: 1.0,
  nu: 0.45, // Higher Poisson's ratio for elastomers (nearly incompressible)

  material: {
    id: 'ecoflex-0030',
    name: 'Ecoflex 00-30',
    category: 'elastomer',
    density: 1070,
    shoreHardness: 30,
    ultimateStress: 1.4,
    ultimateTensileStrain: 9.0,
    tearStrength: 6.5,
    youngsModulus: 0.069,
    shearModulus: 0.023,
    hyperelasticModel: 'neo-hookean',
    c10: 0.017,
    fatigueLimit: 0.2,
    maxCycles: 100000,
    costPerKg: 45,
    printable: false,
    moldable: true,
    description: 'Ultra-soft platinum-cure silicone',
    applications: ['Pneumatic muscles'],
  },
  safetyFactor: 2.0,
  minWallThickness: 1.0,   // 1mm minimum wall
  elementSize: 1.0,        // 1mm elements
  enableStressConstraint: true,
  useFatigueLimit: false,
};

/**
 * Extended optimization state for soft materials
 */
export interface SoftMaterialOptimizationState extends OptimizationState {
  stressResults: ElementStressResult[];
  stressSummary: StressAnalysisSummary;
  ruptureRisk: Float64Array;     // 0-1 per element
  minDensityField: Float64Array; // Minimum density required per element
  meetsStressConstraint: boolean;
  wallThicknessValid: boolean;
}

/**
 * Soft Material SIMP Topology Optimizer
 */
export class SoftMaterialOptimizer {
  private config: SoftMaterialConfig;
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

  // Cached arrays
  private u: Float64Array;
  private dc: Float64Array;
  private xold: Float64Array;
  private strainEnergy: Float64Array;

  // Stress constraint fields
  private minDensityField: Float64Array;  // Minimum density per element
  private ruptureRisk: Float64Array;      // Rupture risk per element
  private stressResults: ElementStressResult[] = [];
  private stressSummary: StressAnalysisSummary;

  // Optimized solver infrastructure
  private useOptimizedSolver: boolean = true;
  private meshConnectivity: MeshConnectivity | null = null;
  private solverScratch: SolverScratch | null = null;
  private csrValues: Float64Array | null = null;

  constructor(config: Partial<SoftMaterialConfig> = {}) {
    this.config = { ...DEFAULT_SOFT_CONFIG, ...config };

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

    // Stress constraint arrays
    this.minDensityField = new Float64Array(nelem);
    this.ruptureRisk = new Float64Array(nelem);

    // Initialize stress summary
    this.stressSummary = {
      maxVonMises: 0,
      avgVonMises: 0,
      minSafetyMargin: this.config.safetyFactor,
      elementsAtRisk: 0,
      passesConstraint: true,
      recommendation: 'Ready to optimize.',
    };

    // Initialize optimized solver
    this.initOptimizedSolver();
  }

  private initOptimizedSolver(): void {
    try {
      const { nelx, nely, nu } = this.config;
      const nDofs = getTotalDOFs(nelx, nely);

      this.meshConnectivity = precomputeMeshConnectivity(nelx, nely, nu);
      this.solverScratch = createSolverScratch(nDofs);
      this.csrValues = new Float64Array(this.meshConnectivity.nnz);
      this.useOptimizedSolver = true;
    } catch (error) {
      console.warn('Failed to initialize optimized solver:', error);
      this.useOptimizedSolver = false;
    }
  }

  /**
   * Set up the problem from a definition
   */
  setupProblem(problem: ProblemDefinition): void {
    const { nelx, nely } = this.config;

    this.forces.fill(0);
    this.fixedDofs = [];

    const scaleX = nelx / problem.nelx;
    const scaleY = nely / problem.nely;

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

  setForces(forces: Float64Array): void {
    this.forces = forces;
  }

  setFixedDofs(fixedDofs: number[]): void {
    this.fixedDofs = fixedDofs;
  }

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
    this.minDensityField.fill(0);
    this.ruptureRisk.fill(0);
    this.stressResults = [];
  }

  /**
   * Perform a single optimization iteration with stress constraints
   */
  step(): SoftMaterialOptimizationState {
    if (this.converged) {
      return this.getState();
    }

    const { nelx, nely, penal, Emin, E0, nu, tolx } = this.config;
    const nelem = nelx * nely;

    // Store old densities
    for (let i = 0; i < nelem; i++) {
      this.xold[i] = this.densities[i];
    }

    // FE Analysis
    if (this.useOptimizedSolver && this.meshConnectivity && this.solverScratch && this.csrValues) {
      this.u.fill(0);
      solveFEMOptimized(
        this.meshConnectivity,
        this.densities,
        this.forces,
        this.fixedDofs,
        this.u,
        this.solverScratch,
        this.csrValues,
        penal,
        Emin,
        E0
      );
    } else {
      // Fallback to basic solver would go here
      console.warn('Optimized solver not available');
    }

    // Compute compliance and sensitivities
    let c = 0;
    for (let elx = 0; elx < nelx; elx++) {
      for (let ely = 0; ely < nely; ely++) {
        const elemIdx = elx * nely + ely;
        const dofs = getElementDOFs(elx, ely, nelx, nely);

        let ue_Ke_ue = 0;
        for (let i = 0; i < 8; i++) {
          for (let j = 0; j < 8; j++) {
            ue_Ke_ue += this.u[dofs[i]] * this.KE[i * 8 + j] * this.u[dofs[j]];
          }
        }

        this.strainEnergy[elemIdx] = ue_Ke_ue;

        const rho = this.densities[elemIdx];
        const Ee = Emin + Math.pow(rho, penal) * (E0 - Emin);

        c += Ee * ue_Ke_ue;
        this.dc[elemIdx] = -penal * Math.pow(rho, penal - 1) * (E0 - Emin) * ue_Ke_ue;
      }
    }

    this.compliance = c;

    // Apply sensitivity filter
    const dcFiltered = applySensitivityFilter(this.filterData, this.densities, this.dc);

    // Compute stress field and update minimum density constraints
    if (this.config.enableStressConstraint) {
      this.updateStressConstraints();
    }

    // Optimality Criteria update with stress constraints
    this.updateDensitiesWithStressConstraint(dcFiltered);

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
   * Update stress constraints based on current strain energy field
   */
  private updateStressConstraints(): void {
    const { material, safetyFactor, elementSize, useFatigueLimit } = this.config;

    // Element volume in mm³
    const elementVolume = elementSize * elementSize * elementSize;

    // Calculate stress field
    this.stressResults = analyzeStressField(
      this.strainEnergy,
      this.densities,
      material,
      elementVolume,
      safetyFactor
    );

    // Generate summary
    this.stressSummary = summarizeStressAnalysis(
      this.stressResults,
      material,
      safetyFactor
    );

    // Calculate allowable stress
    const allowableStress = calculateAllowableStress(material, safetyFactor, useFatigueLimit);

    // Update minimum density and rupture risk fields
    for (let i = 0; i < this.stressResults.length; i++) {
      const result = this.stressResults[i];
      this.ruptureRisk[i] = result.ruptureRisk;

      // Calculate minimum density to keep stress below limit
      if (result.vonMises > 0) {
        this.minDensityField[i] = calculateMinimumDensity(
          result.vonMises * this.densities[i], // Scale back to reference stress
          allowableStress,
          this.config.penal
        );
      } else {
        this.minDensityField[i] = 0;
      }
    }
  }

  /**
   * OC update with stress constraint enforcement
   */
  private updateDensitiesWithStressConstraint(dc: Float64Array): void {
    const { nelx, nely, volfrac, minWallThickness, elementSize, enableStressConstraint } = this.config;
    const nelem = nelx * nely;
    const move = 0.2;

    // Minimum density for wall thickness constraint
    const minDensityWall = minWallThickness / elementSize;

    // Bisection for Lagrange multiplier
    let l1 = 0;
    let l2 = 1e9;

    while ((l2 - l1) / (l1 + l2) > 1e-3) {
      const lmid = 0.5 * (l2 + l1);

      let volNew = 0;
      for (let i = 0; i < nelem; i++) {
        const xold = this.xold[i];

        // OC update formula
        const Be = -dc[i] / lmid;
        let xnew = xold * Math.sqrt(Be);

        // Apply move limits
        xnew = Math.max(Math.max(0.0, xold - move), Math.min(Math.min(1.0, xold + move), xnew));

        // Clamp to [0.001, 1]
        xnew = Math.max(0.001, Math.min(1.0, xnew));

        // Apply stress constraint: enforce minimum density where needed
        if (enableStressConstraint) {
          const stressMinDensity = this.minDensityField[i];
          if (xnew > 0.1 && xnew < stressMinDensity) {
            // Only enforce in "solid" regions to avoid filling voids
            xnew = Math.max(xnew, stressMinDensity);
          }
        }

        // Apply wall thickness constraint for regions that are "mostly solid"
        if (xnew > 0.3 && xnew < minDensityWall) {
          xnew = Math.max(xnew, minDensityWall);
        }

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
   * Get the current optimization state with stress information
   */
  getState(): SoftMaterialOptimizationState {
    const { minWallThickness, elementSize } = this.config;
    const minDensityWall = minWallThickness / elementSize;

    // Check wall thickness
    let wallThicknessValid = true;
    for (let i = 0; i < this.densities.length; i++) {
      if (this.densities[i] > 0.3 && this.densities[i] < minDensityWall) {
        wallThicknessValid = false;
        break;
      }
    }

    return {
      densities: this.densities,
      strainEnergy: this.strainEnergy,
      compliance: this.compliance,
      volume: this.volume,
      iteration: this.iteration,
      converged: this.converged,
      change: this.change,
      stressResults: this.stressResults,
      stressSummary: this.stressSummary,
      ruptureRisk: this.ruptureRisk,
      minDensityField: this.minDensityField,
      meetsStressConstraint: this.stressSummary.passesConstraint,
      wallThicknessValid,
    };
  }

  getConfig(): SoftMaterialConfig {
    return { ...this.config };
  }

  getDensities(): Float64Array {
    return this.densities;
  }

  getRuptureRisk(): Float64Array {
    return this.ruptureRisk;
  }

  getStressSummary(): StressAnalysisSummary {
    return this.stressSummary;
  }

  updateConfig(newConfig: Partial<SoftMaterialConfig>): void {
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
      this.minDensityField = new Float64Array(nelem);
      this.ruptureRisk = new Float64Array(nelem);

      this.initOptimizedSolver();
    }

    this.reset();
  }

  runIterations(n: number): SoftMaterialOptimizationState {
    let state = this.getState();
    for (let i = 0; i < n && !state.converged; i++) {
      state = this.step();
    }
    return state;
  }

  isConverged(): boolean {
    return this.converged;
  }

  /**
   * Update material selection
   */
  setMaterial(material: SoftMaterial): void {
    this.config.material = material;
  }

  /**
   * Update safety factor
   */
  setSafetyFactor(factor: number): void {
    this.config.safetyFactor = Math.max(1.0, Math.min(5.0, factor));
  }

  /**
   * Update minimum wall thickness
   */
  setMinWallThickness(thickness: number): void {
    this.config.minWallThickness = Math.max(0.1, thickness);
  }
}

/**
 * Create a pneumatic muscle problem (hollow cylinder with internal pressure)
 */
export function createPneumaticMuscleProblem(
  nelx: number,
  nely: number,
  innerRadiusFraction: number = 0.3 // Inner hole as fraction of width
): { forces: Float64Array; fixedDofs: number[]; initialDensities: Float64Array } {
  const nDofs = getTotalDOFs(nelx, nely);
  const nelem = nelx * nely;
  const forces = new Float64Array(nDofs);
  const fixedDofs: number[] = [];
  const initialDensities = new Float64Array(nelem);

  const centerX = nelx / 2;
  const centerY = nely / 2;
  const innerRadius = Math.min(nelx, nely) * innerRadiusFraction / 2;
  const outerRadius = Math.min(nelx, nely) / 2;

  // Initialize densities: 1 for wall material, 0.001 for inner cavity
  for (let elx = 0; elx < nelx; elx++) {
    for (let ely = 0; ely < nely; ely++) {
      const elemIdx = elx * nely + ely;
      const x = elx + 0.5;
      const y = ely + 0.5;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

      if (dist < innerRadius) {
        initialDensities[elemIdx] = 0.001; // Void (cavity)
      } else if (dist < outerRadius) {
        initialDensities[elemIdx] = 1.0; // Solid wall
      } else {
        initialDensities[elemIdx] = 0.001; // Outside
      }
    }
  }

  // Fix one end (left edge)
  for (let y = 0; y <= nely; y++) {
    const nodeIdx = getNodeIndex(0, y, nely);
    fixedDofs.push(2 * nodeIdx);     // x
    fixedDofs.push(2 * nodeIdx + 1); // y
  }

  // Apply internal pressure (radial forces on inner surface)
  const pressure = 0.1; // Normalized pressure
  for (let elx = 0; elx < nelx; elx++) {
    for (let ely = 0; ely <= nely; ely++) {
      const x = elx;
      const y = ely;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

      if (Math.abs(dist - innerRadius) < 0.5) {
        const nodeIdx = getNodeIndex(elx, ely, nely);
        const dx = (x - centerX) / dist;
        const dy = (y - centerY) / dist;
        forces[2 * nodeIdx] += pressure * dx;
        forces[2 * nodeIdx + 1] += pressure * dy;
      }
    }
  }

  return { forces, fixedDofs, initialDensities };
}

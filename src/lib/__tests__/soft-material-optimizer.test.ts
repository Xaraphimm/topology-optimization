/**
 * Tests for Soft Material Topology Optimizer
 */

import { describe, it, expect } from 'vitest';
import {
  SoftMaterialOptimizer,
  DEFAULT_SOFT_CONFIG,
  createPneumaticMuscleProblem,
} from '../optimizer/soft-material-optimizer';
import { getSoftMaterial } from '../soft-materials';
import { createCantileverProblem, createMBBProblem } from '../optimizer/simp';

describe('SoftMaterialOptimizer', () => {
  describe('initialization', () => {
    it('should initialize with default config', () => {
      const optimizer = new SoftMaterialOptimizer();
      const config = optimizer.getConfig();

      expect(config.nelx).toBe(DEFAULT_SOFT_CONFIG.nelx);
      expect(config.nely).toBe(DEFAULT_SOFT_CONFIG.nely);
      expect(config.volfrac).toBe(DEFAULT_SOFT_CONFIG.volfrac);
      expect(config.material.id).toBe('ecoflex-0030');
      expect(config.safetyFactor).toBe(2.0);
    });

    it('should initialize densities to volume fraction', () => {
      const optimizer = new SoftMaterialOptimizer({ nelx: 10, nely: 5, volfrac: 0.4 });
      const densities = optimizer.getDensities();

      expect(densities.length).toBe(50);
      for (let i = 0; i < densities.length; i++) {
        expect(densities[i]).toBe(0.4);
      }
    });

    it('should accept custom material', () => {
      const material = getSoftMaterial('dragon-skin-30')!;
      const optimizer = new SoftMaterialOptimizer({ material });
      const config = optimizer.getConfig();

      expect(config.material.id).toBe('dragon-skin-30');
      expect(config.material.ultimateStress).toBe(3.4);
    });

    it('should accept custom safety factor', () => {
      const optimizer = new SoftMaterialOptimizer({ safetyFactor: 3.0 });
      const config = optimizer.getConfig();

      expect(config.safetyFactor).toBe(3.0);
    });
  });

  describe('state management', () => {
    it('should reset to initial state', () => {
      const optimizer = new SoftMaterialOptimizer({ nelx: 10, nely: 5, volfrac: 0.5 });

      const { forces, fixedDofs } = createCantileverProblem(10, 5);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);
      optimizer.step();
      optimizer.step();

      optimizer.reset();
      const state = optimizer.getState();

      expect(state.iteration).toBe(0);
      expect(state.converged).toBe(false);

      const densities = optimizer.getDensities();
      for (let i = 0; i < densities.length; i++) {
        expect(densities[i]).toBe(0.5);
      }
    });

    it('should track rupture risk array', () => {
      const optimizer = new SoftMaterialOptimizer({ nelx: 10, nely: 5 });
      const { forces, fixedDofs } = createCantileverProblem(10, 5);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);

      optimizer.step();
      const ruptureRisk = optimizer.getRuptureRisk();

      expect(ruptureRisk.length).toBe(50);
      for (let i = 0; i < ruptureRisk.length; i++) {
        expect(ruptureRisk[i]).toBeGreaterThanOrEqual(0);
        expect(ruptureRisk[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('optimization behavior', () => {
    it('should decrease compliance over iterations', () => {
      const optimizer = new SoftMaterialOptimizer({
        nelx: 20,
        nely: 10,
        volfrac: 0.5,
        enableStressConstraint: false, // Disable for basic compliance test
      });
      const { forces, fixedDofs } = createCantileverProblem(20, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);

      const state1 = optimizer.step();
      const c1 = state1.compliance;

      const state10 = optimizer.runIterations(9);
      const c10 = state10.compliance;

      expect(c10).toBeLessThanOrEqual(c1 * 1.01);
    });

    it('should maintain volume constraint', () => {
      const volfrac = 0.4;
      const optimizer = new SoftMaterialOptimizer({
        nelx: 20,
        nely: 10,
        volfrac,
      });
      const { forces, fixedDofs } = createCantileverProblem(20, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);

      optimizer.runIterations(20);
      const state = optimizer.getState();

      expect(state.volume).toBeCloseTo(volfrac, 1);
    });

    it('should produce densities between 0 and 1', () => {
      const optimizer = new SoftMaterialOptimizer({ nelx: 20, nely: 10 });
      const { forces, fixedDofs } = createCantileverProblem(20, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);

      optimizer.runIterations(30);
      const densities = optimizer.getDensities();

      for (let i = 0; i < densities.length; i++) {
        expect(densities[i]).toBeGreaterThanOrEqual(0);
        expect(densities[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('stress constraint behavior', () => {
    it('should compute stress summary', () => {
      const optimizer = new SoftMaterialOptimizer({
        nelx: 20,
        nely: 10,
        enableStressConstraint: true,
      });
      const { forces, fixedDofs } = createCantileverProblem(20, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);

      optimizer.runIterations(10);
      const summary = optimizer.getStressSummary();

      expect(summary.maxVonMises).toBeGreaterThanOrEqual(0);
      expect(summary.avgVonMises).toBeGreaterThanOrEqual(0);
      expect(summary.minSafetyMargin).toBeGreaterThan(0);
      expect(typeof summary.passesConstraint).toBe('boolean');
      expect(summary.recommendation.length).toBeGreaterThan(0);
    });

    it('should track elements at risk', () => {
      const optimizer = new SoftMaterialOptimizer({
        nelx: 20,
        nely: 10,
        enableStressConstraint: true,
      });
      const { forces, fixedDofs } = createCantileverProblem(20, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);

      optimizer.runIterations(20);
      const summary = optimizer.getStressSummary();

      expect(summary.elementsAtRisk).toBeGreaterThanOrEqual(0);
    });

    it('should include stress results in state', () => {
      const optimizer = new SoftMaterialOptimizer({
        nelx: 10,
        nely: 5,
        enableStressConstraint: true,
      });
      const { forces, fixedDofs } = createCantileverProblem(10, 5);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);

      optimizer.step();
      const state = optimizer.getState();

      expect(state.stressResults.length).toBe(50);
      expect(state.ruptureRisk.length).toBe(50);
      expect(state.minDensityField.length).toBe(50);
    });
  });

  describe('material and parameter updates', () => {
    it('should update material selection', () => {
      const optimizer = new SoftMaterialOptimizer();
      const newMaterial = getSoftMaterial('tpu-95a')!;

      optimizer.setMaterial(newMaterial);
      const config = optimizer.getConfig();

      expect(config.material.id).toBe('tpu-95a');
    });

    it('should update safety factor within bounds', () => {
      const optimizer = new SoftMaterialOptimizer();

      optimizer.setSafetyFactor(3.5);
      expect(optimizer.getConfig().safetyFactor).toBe(3.5);

      optimizer.setSafetyFactor(0.5); // Below minimum
      expect(optimizer.getConfig().safetyFactor).toBe(1.0);

      optimizer.setSafetyFactor(10); // Above maximum
      expect(optimizer.getConfig().safetyFactor).toBe(5.0);
    });

    it('should update minimum wall thickness', () => {
      const optimizer = new SoftMaterialOptimizer();

      optimizer.setMinWallThickness(2.0);
      expect(optimizer.getConfig().minWallThickness).toBe(2.0);

      optimizer.setMinWallThickness(0.05); // Below minimum
      expect(optimizer.getConfig().minWallThickness).toBe(0.1);
    });
  });

  describe('config updates', () => {
    it('should resize arrays when mesh changes', () => {
      const optimizer = new SoftMaterialOptimizer({ nelx: 10, nely: 5 });

      optimizer.updateConfig({ nelx: 20, nely: 10 });

      const densities = optimizer.getDensities();
      expect(densities.length).toBe(200);

      const ruptureRisk = optimizer.getRuptureRisk();
      expect(ruptureRisk.length).toBe(200);
    });
  });
});

describe('Pneumatic Muscle Problem', () => {
  it('should create valid problem setup', () => {
    const { forces, fixedDofs, initialDensities } = createPneumaticMuscleProblem(20, 20);

    expect(forces.length).toBeGreaterThan(0);
    expect(fixedDofs.length).toBeGreaterThan(0);
    expect(initialDensities.length).toBe(400);
  });

  it('should create hollow initial structure', () => {
    const { initialDensities } = createPneumaticMuscleProblem(20, 20, 0.3);

    // Should have some void (cavity) regions
    let hasVoid = false;
    let hasSolid = false;
    for (const d of initialDensities) {
      if (d < 0.01) hasVoid = true;
      if (d > 0.99) hasSolid = true;
    }

    expect(hasVoid).toBe(true);
    expect(hasSolid).toBe(true);
  });

  it('should fix left edge', () => {
    const nely = 10;
    const { fixedDofs } = createPneumaticMuscleProblem(20, nely);

    // Left edge should have (nely+1) * 2 DOFs fixed
    expect(fixedDofs.length).toBe((nely + 1) * 2);
  });
});

describe('Integration with MBB problem', () => {
  it('should work with MBB beam problem', () => {
    const optimizer = new SoftMaterialOptimizer({
      nelx: 30,
      nely: 10,
      volfrac: 0.5,
    });

    const { forces, fixedDofs } = createMBBProblem(30, 10);
    optimizer.setForces(forces);
    optimizer.setFixedDofs(fixedDofs);

    const state = optimizer.runIterations(30);

    expect(state.compliance).toBeGreaterThan(0);
    expect(state.compliance).toBeLessThan(Infinity);
    expect(state.volume).toBeCloseTo(0.5, 1);
  });
});

describe('Soft Material Optimizer Benchmark', () => {
  it('should converge for standard problem with stress constraints', () => {
    const optimizer = new SoftMaterialOptimizer({
      nelx: 30,
      nely: 10,
      volfrac: 0.5,
      material: getSoftMaterial('dragon-skin-30')!, // Stronger material
      safetyFactor: 2.0,
      enableStressConstraint: true,
      maxIter: 100,
      tolx: 0.01,
    });

    const { forces, fixedDofs } = createMBBProblem(30, 10);
    optimizer.setForces(forces);
    optimizer.setFixedDofs(fixedDofs);

    let state = optimizer.getState();
    while (!state.converged && state.iteration < 100) {
      state = optimizer.step();
    }

    expect(state.converged).toBe(true);
    expect(state.change).toBeLessThan(0.02);
  });
});

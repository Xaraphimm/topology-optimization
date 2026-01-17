import { describe, it, expect, beforeEach } from 'vitest';
import {
  SIMPOptimizer,
  DEFAULT_CONFIG,
  createCantileverProblem,
  createMBBProblem,
  createBridgeProblem,
} from '../optimizer/simp';

describe('SIMPOptimizer', () => {
  describe('initialization', () => {
    it('should initialize with default config', () => {
      const optimizer = new SIMPOptimizer();
      const config = optimizer.getConfig();
      
      expect(config.nelx).toBe(DEFAULT_CONFIG.nelx);
      expect(config.nely).toBe(DEFAULT_CONFIG.nely);
      expect(config.volfrac).toBe(DEFAULT_CONFIG.volfrac);
    });

    it('should initialize densities to volume fraction', () => {
      const optimizer = new SIMPOptimizer({ nelx: 10, nely: 5, volfrac: 0.4 });
      const densities = optimizer.getDensities();
      
      expect(densities.length).toBe(50); // 10 * 5
      for (let i = 0; i < densities.length; i++) {
        expect(densities[i]).toBe(0.4);
      }
    });

    it('should accept custom configuration', () => {
      const optimizer = new SIMPOptimizer({
        nelx: 30,
        nely: 10,
        volfrac: 0.3,
        penal: 4.0,
      });
      const config = optimizer.getConfig();
      
      expect(config.nelx).toBe(30);
      expect(config.nely).toBe(10);
      expect(config.volfrac).toBe(0.3);
      expect(config.penal).toBe(4.0);
    });
  });

  describe('state management', () => {
    it('should reset to initial state', () => {
      const optimizer = new SIMPOptimizer({ nelx: 10, nely: 5, volfrac: 0.5 });
      
      // Run a few iterations
      const { forces, fixedDofs } = createCantileverProblem(10, 5);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);
      optimizer.step();
      optimizer.step();
      
      // Reset
      optimizer.reset();
      const state = optimizer.getState();
      
      expect(state.iteration).toBe(0);
      expect(state.converged).toBe(false);
      expect(state.change).toBe(1.0);
      
      // All densities should be back to volfrac
      const densities = optimizer.getDensities();
      for (let i = 0; i < densities.length; i++) {
        expect(densities[i]).toBe(0.5);
      }
    });

    it('should track iteration count', () => {
      const optimizer = new SIMPOptimizer({ nelx: 10, nely: 5 });
      const { forces, fixedDofs } = createCantileverProblem(10, 5);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);
      
      expect(optimizer.getState().iteration).toBe(0);
      
      optimizer.step();
      expect(optimizer.getState().iteration).toBe(1);
      
      optimizer.step();
      expect(optimizer.getState().iteration).toBe(2);
    });
  });

  describe('optimization behavior', () => {
    it('should decrease compliance over iterations', () => {
      const optimizer = new SIMPOptimizer({ 
        nelx: 20, 
        nely: 10, 
        volfrac: 0.5,
        penal: 3.0,
      });
      const { forces, fixedDofs } = createCantileverProblem(20, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);
      
      // First iteration
      const state1 = optimizer.step();
      const c1 = state1.compliance;
      
      // Run more iterations
      const state10 = optimizer.runIterations(9);
      const c10 = state10.compliance;
      
      // Compliance should decrease (or stay same if converged)
      expect(c10).toBeLessThanOrEqual(c1 * 1.01); // Allow 1% tolerance for numerical noise
    });

    it('should maintain volume constraint', () => {
      const volfrac = 0.4;
      const optimizer = new SIMPOptimizer({ 
        nelx: 20, 
        nely: 10, 
        volfrac,
      });
      const { forces, fixedDofs } = createCantileverProblem(20, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);
      
      // Run iterations
      optimizer.runIterations(20);
      const state = optimizer.getState();
      
      // Volume should be close to target
      expect(state.volume).toBeCloseTo(volfrac, 1);
    });

    it('should converge for a simple problem', () => {
      const optimizer = new SIMPOptimizer({ 
        nelx: 30, 
        nely: 10, 
        volfrac: 0.5,
        maxIter: 100,
        tolx: 0.01,
      });
      const { forces, fixedDofs } = createMBBProblem(30, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);
      
      // Run until convergence or max iterations
      let state = optimizer.getState();
      while (!state.converged) {
        state = optimizer.step();
      }
      
      expect(state.converged).toBe(true);
      expect(state.change).toBeLessThan(0.02); // Should be less than tolerance
    });

    it('should produce densities between 0 and 1', () => {
      const optimizer = new SIMPOptimizer({ nelx: 20, nely: 10 });
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

  describe('problem definitions', () => {
    it('should handle cantilever problem', () => {
      const optimizer = new SIMPOptimizer({ nelx: 20, nely: 10, volfrac: 0.5 });
      const { forces, fixedDofs } = createCantileverProblem(20, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);
      
      const state = optimizer.runIterations(30);
      
      expect(state.compliance).toBeGreaterThan(0);
      expect(state.compliance).toBeLessThan(Infinity);
    });

    it('should handle MBB beam problem', () => {
      const optimizer = new SIMPOptimizer({ nelx: 30, nely: 10, volfrac: 0.5 });
      const { forces, fixedDofs } = createMBBProblem(30, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);
      
      const state = optimizer.runIterations(30);
      
      expect(state.compliance).toBeGreaterThan(0);
      expect(state.compliance).toBeLessThan(Infinity);
    });

    it('should handle bridge problem', () => {
      const optimizer = new SIMPOptimizer({ nelx: 30, nely: 10, volfrac: 0.5 });
      const { forces, fixedDofs } = createBridgeProblem(30, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);
      
      const state = optimizer.runIterations(30);
      
      expect(state.compliance).toBeGreaterThan(0);
      expect(state.compliance).toBeLessThan(Infinity);
    });
  });

  describe('config updates', () => {
    it('should update volfrac and reset', () => {
      const optimizer = new SIMPOptimizer({ nelx: 10, nely: 5, volfrac: 0.5 });
      const { forces, fixedDofs } = createCantileverProblem(10, 5);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);
      
      optimizer.runIterations(5);
      
      // Update volfrac
      optimizer.updateConfig({ volfrac: 0.3 });
      
      const densities = optimizer.getDensities();
      for (let i = 0; i < densities.length; i++) {
        expect(densities[i]).toBe(0.3);
      }
    });

    it('should resize arrays when mesh changes', () => {
      const optimizer = new SIMPOptimizer({ nelx: 10, nely: 5 });
      
      optimizer.updateConfig({ nelx: 20, nely: 10 });
      
      const densities = optimizer.getDensities();
      expect(densities.length).toBe(200); // 20 * 10
    });
  });
});

describe('Problem creation helpers', () => {
  describe('createCantileverProblem', () => {
    it('should create valid forces and fixed dofs', () => {
      const { forces, fixedDofs } = createCantileverProblem(10, 5);
      
      expect(forces.length).toBeGreaterThan(0);
      expect(fixedDofs.length).toBeGreaterThan(0);
      
      // Should have some non-zero force
      let hasForce = false;
      for (let i = 0; i < forces.length; i++) {
        if (forces[i] !== 0) hasForce = true;
      }
      expect(hasForce).toBe(true);
    });

    it('should fix the left edge', () => {
      const { fixedDofs } = createCantileverProblem(10, 5);
      
      // Left edge has 6 nodes (nely+1), each with 2 DOFs
      expect(fixedDofs.length).toBe(12); // (5+1) * 2
    });
  });

  describe('createMBBProblem', () => {
    it('should create valid forces and fixed dofs', () => {
      const { forces, fixedDofs } = createMBBProblem(30, 10);
      
      expect(forces.length).toBeGreaterThan(0);
      expect(fixedDofs.length).toBeGreaterThan(0);
    });

    it('should apply symmetry condition on left edge', () => {
      const { fixedDofs } = createMBBProblem(30, 10);
      
      // Left edge: 11 nodes with x DOF fixed + 1 y DOF at bottom right
      expect(fixedDofs.length).toBe(12);
    });
  });

  describe('createBridgeProblem', () => {
    it('should create valid forces and fixed dofs', () => {
      const { forces, fixedDofs } = createBridgeProblem(30, 10);
      
      expect(forces.length).toBeGreaterThan(0);
      expect(fixedDofs.length).toBeGreaterThan(0);
    });

    it('should have distributed load on top', () => {
      const nelx = 30;
      const nely = 10;
      const { forces } = createBridgeProblem(nelx, nely);
      
      // Count non-zero forces
      let forceCount = 0;
      for (let i = 0; i < forces.length; i++) {
        if (forces[i] !== 0) forceCount++;
      }
      
      // Should have load on each node along top edge
      expect(forceCount).toBe(nelx + 1);
    });
  });
});

// Benchmark test - this verifies the algorithm produces expected results
describe('MBB Beam Benchmark', () => {
  it('should produce compliance in expected range for standard MBB problem', () => {
    // Standard test case: 60x20 mesh, volfrac=0.5
    const optimizer = new SIMPOptimizer({
      nelx: 60,
      nely: 20,
      volfrac: 0.5,
      penal: 3.0,
      rmin: 1.5,
      maxIter: 100,
    });
    
    const { forces, fixedDofs } = createMBBProblem(60, 20);
    optimizer.setForces(forces);
    optimizer.setFixedDofs(fixedDofs);
    
    // Run to convergence
    let state = optimizer.getState();
    while (!state.converged && state.iteration < 100) {
      state = optimizer.step();
    }
    
    // The compliance for this standard problem should be in a known range
    // Based on literature, the optimal compliance for MBB 60x20 with volfrac=0.5
    // is approximately 200-250 (depends on exact formulation)
    expect(state.compliance).toBeGreaterThan(100);
    expect(state.compliance).toBeLessThan(400);
    
    // Volume should be maintained
    expect(state.volume).toBeCloseTo(0.5, 1);
  });
});

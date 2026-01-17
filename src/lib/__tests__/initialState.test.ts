import { describe, it, expect } from 'vitest';
import { SIMPOptimizer, createMBBProblem, createCantileverProblem } from '../optimizer/simp';
import { PRESETS, getMeshDimensions, RESOLUTIONS } from '../presets';

describe('Initial State Rendering', () => {
  describe('Uniform Density Initialization', () => {
    it('should initialize all densities to volume fraction', () => {
      const volfrac = 0.5;
      const optimizer = new SIMPOptimizer({ 
        nelx: 30, 
        nely: 10, 
        volfrac 
      });
      
      const state = optimizer.getState();
      const densities = state.densities;
      
      // All densities should equal volume fraction
      for (let i = 0; i < densities.length; i++) {
        expect(densities[i]).toBe(volfrac);
      }
    });
    
    it('should initialize with correct array size', () => {
      const nelx = 40;
      const nely = 15;
      const optimizer = new SIMPOptimizer({ nelx, nely });
      
      const state = optimizer.getState();
      expect(state.densities.length).toBe(nelx * nely);
      expect(state.strainEnergy.length).toBe(nelx * nely);
    });
    
    it('should initialize with zero iteration count', () => {
      const optimizer = new SIMPOptimizer({ nelx: 20, nely: 10 });
      const state = optimizer.getState();
      
      expect(state.iteration).toBe(0);
      expect(state.converged).toBe(false);
    });
    
    it('should have Infinity compliance before first step', () => {
      const optimizer = new SIMPOptimizer({ nelx: 20, nely: 10 });
      const state = optimizer.getState();
      
      expect(state.compliance).toBe(Infinity);
    });
    
    it('should have zero strain energy before first step', () => {
      const optimizer = new SIMPOptimizer({ nelx: 20, nely: 10 });
      const state = optimizer.getState();
      
      // Strain energy should be all zeros initially
      let allZero = true;
      for (let i = 0; i < state.strainEnergy.length; i++) {
        if (state.strainEnergy[i] !== 0) {
          allZero = false;
          break;
        }
      }
      expect(allZero).toBe(true);
    });
  });
  
  describe('Boundary Condition Data Structure', () => {
    it('should return valid support data from preset setup', () => {
      const preset = PRESETS[0]; // MBB Beam
      const { nelx, nely } = getMeshDimensions(preset, RESOLUTIONS[0]);
      const { supports } = preset.setup(nelx, nely);
      
      expect(Array.isArray(supports)).toBe(true);
      expect(supports.length).toBeGreaterThan(0);
      
      // Each support should have required properties
      for (const support of supports) {
        expect(typeof support.x).toBe('number');
        expect(typeof support.y).toBe('number');
        expect(['pin', 'roller-x', 'roller-y']).toContain(support.type);
      }
    });
    
    it('should return valid load data from preset setup', () => {
      const preset = PRESETS[0]; // MBB Beam
      const { nelx, nely } = getMeshDimensions(preset, RESOLUTIONS[0]);
      const { loads } = preset.setup(nelx, nely);
      
      expect(Array.isArray(loads)).toBe(true);
      expect(loads.length).toBeGreaterThan(0);
      
      // Each load should have required properties
      for (const load of loads) {
        expect(typeof load.x).toBe('number');
        expect(typeof load.y).toBe('number');
        expect(typeof load.dx).toBe('number');
        expect(typeof load.dy).toBe('number');
      }
    });
    
    it('should return valid forces and fixedDofs arrays', () => {
      const preset = PRESETS[0];
      const { nelx, nely } = getMeshDimensions(preset, RESOLUTIONS[0]);
      const { forces, fixedDofs } = preset.setup(nelx, nely);
      
      expect(forces).toBeInstanceOf(Float64Array);
      expect(forces.length).toBeGreaterThan(0);
      
      expect(Array.isArray(fixedDofs)).toBe(true);
      expect(fixedDofs.length).toBeGreaterThan(0);
      
      // All fixedDofs should be valid indices
      for (const dof of fixedDofs) {
        expect(dof).toBeGreaterThanOrEqual(0);
        expect(dof).toBeLessThan(forces.length);
      }
    });
  });
  
  describe('All Presets Generate Valid Initial State', () => {
    for (const preset of PRESETS) {
      it(`should generate valid initial state for ${preset.name}`, () => {
        const { nelx, nely } = getMeshDimensions(preset, RESOLUTIONS[0]);
        const { forces, fixedDofs, supports } = preset.setup(nelx, nely);
        
        const optimizer = new SIMPOptimizer({ nelx, nely, volfrac: 0.5 });
        optimizer.setForces(forces);
        optimizer.setFixedDofs(fixedDofs);
        
        const state = optimizer.getState();
        
        // Verify state is valid
        expect(state.densities.length).toBe(nelx * nely);
        expect(state.iteration).toBe(0);
        expect(state.converged).toBe(false);
        
        // Verify boundary conditions exist
        expect(supports.length).toBeGreaterThan(0);
        expect(forces.some(f => f !== 0)).toBe(true);
      });
    }
  });
  
  describe('State After First Step', () => {
    it('should have non-zero strain energy after first step', () => {
      const optimizer = new SIMPOptimizer({ nelx: 20, nely: 10, volfrac: 0.5 });
      const { forces, fixedDofs } = createMBBProblem(20, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);
      
      const state = optimizer.step();
      
      // At least some elements should have non-zero strain energy
      let hasNonZero = false;
      for (let i = 0; i < state.strainEnergy.length; i++) {
        if (state.strainEnergy[i] > 0) {
          hasNonZero = true;
          break;
        }
      }
      expect(hasNonZero).toBe(true);
    });
    
    it('should have finite compliance after first step', () => {
      const optimizer = new SIMPOptimizer({ nelx: 20, nely: 10, volfrac: 0.5 });
      const { forces, fixedDofs } = createCantileverProblem(20, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);
      
      const state = optimizer.step();
      
      expect(state.compliance).toBeGreaterThan(0);
      expect(state.compliance).toBeLessThan(Infinity);
    });
    
    it('should increment iteration count after step', () => {
      const optimizer = new SIMPOptimizer({ nelx: 20, nely: 10 });
      const { forces, fixedDofs } = createMBBProblem(20, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);
      
      expect(optimizer.getState().iteration).toBe(0);
      
      optimizer.step();
      expect(optimizer.getState().iteration).toBe(1);
      
      optimizer.step();
      expect(optimizer.getState().iteration).toBe(2);
    });
  });
  
  describe('Preview Density Rendering', () => {
    it('should support different volume fractions for preview', () => {
      const testVolfracs = [0.3, 0.4, 0.5, 0.6, 0.7];
      
      for (const volfrac of testVolfracs) {
        const optimizer = new SIMPOptimizer({ 
          nelx: 10, 
          nely: 5, 
          volfrac 
        });
        
        const state = optimizer.getState();
        
        // All densities should match volume fraction
        for (const density of state.densities) {
          expect(density).toBeCloseTo(volfrac, 10);
        }
      }
    });
    
    it('should maintain correct volume after reset', () => {
      const optimizer = new SIMPOptimizer({ nelx: 20, nely: 10, volfrac: 0.4 });
      const { forces, fixedDofs } = createMBBProblem(20, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);
      
      // Run a few iterations
      optimizer.step();
      optimizer.step();
      optimizer.step();
      
      // Reset
      optimizer.reset();
      
      const state = optimizer.getState();
      
      // All densities should be back to volume fraction
      for (const density of state.densities) {
        expect(density).toBe(0.4);
      }
      
      expect(state.iteration).toBe(0);
      expect(state.converged).toBe(false);
    });
  });
});

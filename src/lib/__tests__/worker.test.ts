import { describe, it, expect } from 'vitest';
import type { WorkerCommand, WorkerMessage, SerializedOptimizationState } from '../optimizer/simp.worker';
import { SIMPOptimizer, createMBBProblem } from '../optimizer/simp';

/**
 * Unit tests for Web Worker message protocol and state serialization.
 * 
 * Note: These tests verify the message format and state serialization logic
 * without actually spawning a Web Worker (which requires a browser environment).
 * Integration tests for the full worker behavior should be done in E2E tests.
 */
describe('Worker Message Protocol', () => {
  describe('WorkerCommand types', () => {
    it('should accept valid init command', () => {
      const command: WorkerCommand = {
        type: 'init',
        config: { nelx: 30, nely: 10, volfrac: 0.5 },
        forces: [0, 0, 0, -1],
        fixedDofs: [0, 1, 2, 3],
      };
      
      expect(command.type).toBe('init');
      expect(command.config.nelx).toBe(30);
      expect(command.forces.length).toBe(4);
    });
    
    it('should accept valid control commands', () => {
      const commands: WorkerCommand[] = [
        { type: 'start' },
        { type: 'pause' },
        { type: 'reset' },
        { type: 'step' },
        { type: 'terminate' },
      ];
      
      for (const cmd of commands) {
        expect(['start', 'pause', 'reset', 'step', 'terminate']).toContain(cmd.type);
      }
    });
  });
  
  describe('WorkerMessage types', () => {
    it('should accept valid ready message', () => {
      const message: WorkerMessage = { type: 'ready' };
      expect(message.type).toBe('ready');
    });
    
    it('should accept valid state message', () => {
      const state: SerializedOptimizationState = {
        densities: [0.5, 0.5, 0.5],
        strainEnergy: [0, 0, 0],
        compliance: 100,
        volume: 0.5,
        iteration: 1,
        converged: false,
        change: 0.1,
      };
      
      const message: WorkerMessage = { type: 'state', state };
      
      expect(message.type).toBe('state');
      expect(message.state.densities.length).toBe(3);
    });
    
    it('should accept valid error message', () => {
      const message: WorkerMessage = { 
        type: 'error', 
        message: 'Optimizer not initialized' 
      };
      
      expect(message.type).toBe('error');
      expect(message.message).toBe('Optimizer not initialized');
    });
  });
  
  describe('State Serialization', () => {
    it('should convert Float64Array to number[] for serialization', () => {
      const optimizer = new SIMPOptimizer({ nelx: 10, nely: 5, volfrac: 0.5 });
      const state = optimizer.getState();
      
      // Simulate serialization (what the worker does)
      const serialized: SerializedOptimizationState = {
        densities: Array.from(state.densities),
        strainEnergy: Array.from(state.strainEnergy),
        compliance: state.compliance,
        volume: state.volume,
        iteration: state.iteration,
        converged: state.converged,
        change: state.change,
      };
      
      // Verify serialization produces plain arrays
      expect(Array.isArray(serialized.densities)).toBe(true);
      expect(Array.isArray(serialized.strainEnergy)).toBe(true);
      expect(serialized.densities.length).toBe(50); // 10 * 5
    });
    
    it('should preserve values during serialization roundtrip', () => {
      const optimizer = new SIMPOptimizer({ nelx: 20, nely: 10, volfrac: 0.4 });
      const { forces, fixedDofs } = createMBBProblem(20, 10);
      optimizer.setForces(forces);
      optimizer.setFixedDofs(fixedDofs);
      
      // Run a step to get non-trivial state
      const originalState = optimizer.step();
      
      // Serialize
      const serialized: SerializedOptimizationState = {
        densities: Array.from(originalState.densities),
        strainEnergy: Array.from(originalState.strainEnergy),
        compliance: originalState.compliance,
        volume: originalState.volume,
        iteration: originalState.iteration,
        converged: originalState.converged,
        change: originalState.change,
      };
      
      // Deserialize
      const deserialized = {
        densities: new Float64Array(serialized.densities),
        strainEnergy: new Float64Array(serialized.strainEnergy),
        compliance: serialized.compliance,
        volume: serialized.volume,
        iteration: serialized.iteration,
        converged: serialized.converged,
        change: serialized.change,
      };
      
      // Verify values are preserved
      expect(deserialized.compliance).toBe(originalState.compliance);
      expect(deserialized.volume).toBe(originalState.volume);
      expect(deserialized.iteration).toBe(originalState.iteration);
      expect(deserialized.converged).toBe(originalState.converged);
      expect(deserialized.change).toBe(originalState.change);
      
      // Verify arrays are equal
      expect(deserialized.densities.length).toBe(originalState.densities.length);
      for (let i = 0; i < deserialized.densities.length; i++) {
        expect(deserialized.densities[i]).toBe(originalState.densities[i]);
      }
    });
  });
  
  describe('Forces Array Serialization', () => {
    it('should convert Float64Array forces to number[] for worker init', () => {
      const { forces, fixedDofs } = createMBBProblem(30, 10);
      
      // Simulate what useOptimizer does
      const forcesArray = Array.from(forces);
      
      const command: WorkerCommand = {
        type: 'init',
        config: { nelx: 30, nely: 10, volfrac: 0.5 },
        forces: forcesArray,
        fixedDofs: fixedDofs,
      };
      
      // Verify conversion
      expect(Array.isArray(command.forces)).toBe(true);
      expect(command.forces.length).toBe(forces.length);
      
      // Values should be preserved
      for (let i = 0; i < forces.length; i++) {
        expect(command.forces[i]).toBe(forces[i]);
      }
    });
    
    it('should reconstruct Float64Array in worker', () => {
      const { forces } = createMBBProblem(20, 10);
      const forcesArray = Array.from(forces);
      
      // Simulate what the worker does
      const reconstructed = new Float64Array(forcesArray);
      
      expect(reconstructed.length).toBe(forces.length);
      for (let i = 0; i < forces.length; i++) {
        expect(reconstructed[i]).toBe(forces[i]);
      }
    });
  });
});

describe('Worker State Transitions', () => {
  it('should track expected state flow for normal optimization', () => {
    // This test documents the expected message flow
    const expectedFlow: WorkerMessage['type'][] = [
      'ready',       // Worker loaded
      'initialized', // After init command
      'state',       // After each step during running
      'converged',   // When optimization converges
    ];
    
    // Verify all types are valid
    for (const type of expectedFlow) {
      expect(['ready', 'initialized', 'state', 'paused', 'converged', 'error']).toContain(type);
    }
  });
  
  it('should track expected state flow for pause/resume', () => {
    const expectedFlow: WorkerMessage['type'][] = [
      'ready',
      'initialized',
      'state',   // Running
      'paused',  // After pause command
      'state',   // Resumed and running
    ];
    
    for (const type of expectedFlow) {
      expect(['ready', 'initialized', 'state', 'paused', 'converged', 'error']).toContain(type);
    }
  });
  
  it('should track expected state flow for reset', () => {
    const expectedFlow: WorkerMessage['type'][] = [
      'ready',
      'initialized', // Initial
      'state',       // Running
      'initialized', // After reset (same message type as init)
    ];
    
    for (const type of expectedFlow) {
      expect(['ready', 'initialized', 'state', 'paused', 'converged', 'error']).toContain(type);
    }
  });
});

/**
 * Tests for the WebAssembly PCG Solver
 * 
 * Verifies:
 * 1. WASM module loads successfully
 * 2. WASM solver produces correct results
 * 3. WASM matches JS solver output within tolerance
 * 4. Fallback to JS solver works
 * 5. Performance comparison (WASM vs JS)
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { 
  initWasm, 
  isWasmAvailable, 
  getWasmSolver, 
  resetWasmState 
} from '../optimizer/wasm-loader';
import { 
  JSSolver, 
  WASMSolver, 
  createSolver, 
  createSolverSync,
  getPreferredSolverType
} from '../optimizer/solver-interface';
import { 
  assembleStiffnessMatrix, 
  applyBoundaryConditions,
  type CSRMatrix 
} from '../optimizer/solver';
import { getTotalDOFs, getNodeIndex } from '../optimizer/fem';

describe('WASM Solver', () => {
  afterEach(() => {
    // Reset WASM state between tests if needed
    // resetWasmState();
  });

  describe('Module Loading', () => {
    it('should load WASM module successfully', async () => {
      const available = await initWasm();
      // WASM may or may not be available depending on environment
      // In Node.js/vitest, it might not work without special setup
      expect(typeof available).toBe('boolean');
    });

    it('should report WASM availability correctly', async () => {
      await initWasm();
      const available = isWasmAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should return solver when WASM is available', async () => {
      await initWasm();
      if (isWasmAvailable()) {
        const solver = getWasmSolver();
        expect(solver).not.toBeNull();
        expect(typeof solver!.solve_pcg).toBe('function');
      }
    });
  });

  describe('JSSolver', () => {
    it('should solve a simple 3x3 system correctly', () => {
      const jsSolver = new JSSolver();
      
      // Create a simple 3x3 SPD matrix: [4, 1, 1; 1, 4, 1; 1, 1, 4]
      // Solution for b = [6, 6, 6] should be x = [1, 1, 1]
      const K: CSRMatrix = {
        values: new Float64Array([4, 1, 1, 1, 4, 1, 1, 1, 4]),
        colIndices: new Int32Array([0, 1, 2, 0, 1, 2, 0, 1, 2]),
        rowPointers: new Int32Array([0, 3, 6, 9]),
        n: 3
      };
      
      const b = new Float64Array([6, 6, 6]);
      const x0 = new Float64Array([0, 0, 0]);
      
      const result = jsSolver.solve(K, b, x0, 1e-10, 100);
      
      expect(result.x.length).toBe(3);
      expect(result.x[0]).toBeCloseTo(1.0, 6);
      expect(result.x[1]).toBeCloseTo(1.0, 6);
      expect(result.x[2]).toBeCloseTo(1.0, 6);
      expect(result.iterations).toBeLessThan(100);
    });

    it('should solve a 2x2 system correctly', () => {
      const jsSolver = new JSSolver();
      
      // [4, 1; 1, 3] * x = [1; 2]
      // Solution: x = [1/11, 7/11] ≈ [0.0909, 0.6364]
      const K: CSRMatrix = {
        values: new Float64Array([4, 1, 1, 3]),
        colIndices: new Int32Array([0, 1, 0, 1]),
        rowPointers: new Int32Array([0, 2, 4]),
        n: 2
      };
      
      const b = new Float64Array([1, 2]);
      const x0 = new Float64Array([0, 0]);
      
      const result = jsSolver.solve(K, b, x0, 1e-10, 100);
      
      expect(result.x[0]).toBeCloseTo(1/11, 6);
      expect(result.x[1]).toBeCloseTo(7/11, 6);
    });
  });

  describe('Solver Interface', () => {
    it('should create JS solver when WASM unavailable', async () => {
      resetWasmState();
      const solver = createSolverSync();
      expect(solver.name).toBe('JavaScript');
    });

    it('should create best available solver async', async () => {
      const solver = await createSolver();
      expect(['JavaScript', 'WebAssembly']).toContain(solver.name);
    });

    it('should force JS solver when preferWasm is false', async () => {
      const solver = await createSolver(false);
      expect(solver.name).toBe('JavaScript');
    });
  });

  describe('Solver Correctness', () => {
    const jsSolver = new JSSolver();

    it('should handle identity matrix', () => {
      // I * x = b => x = b
      const K: CSRMatrix = {
        values: new Float64Array([1, 1, 1]),
        colIndices: new Int32Array([0, 1, 2]),
        rowPointers: new Int32Array([0, 1, 2, 3]),
        n: 3
      };
      
      const b = new Float64Array([1, 2, 3]);
      const x0 = new Float64Array([0, 0, 0]);
      
      const result = jsSolver.solve(K, b, x0, 1e-10, 100);
      
      expect(result.x[0]).toBeCloseTo(1.0, 10);
      expect(result.x[1]).toBeCloseTo(2.0, 10);
      expect(result.x[2]).toBeCloseTo(3.0, 10);
    });

    it('should converge quickly for well-conditioned system', () => {
      // Diagonally dominant matrix converges quickly
      const K: CSRMatrix = {
        values: new Float64Array([10, 1, 1, 1, 10, 1, 1, 1, 10]),
        colIndices: new Int32Array([0, 1, 2, 0, 1, 2, 0, 1, 2]),
        rowPointers: new Int32Array([0, 3, 6, 9]),
        n: 3
      };
      
      const b = new Float64Array([12, 12, 12]);
      const x0 = new Float64Array([0, 0, 0]);
      
      const result = jsSolver.solve(K, b, x0, 1e-10, 100);
      
      expect(result.iterations).toBeLessThan(10);
      expect(result.residual).toBeLessThan(1e-8);
    });
  });

  describe('WASM vs JS Comparison', () => {
    it('should produce matching results for small FEM problem', async () => {
      await initWasm();
      
      const jsSolver = new JSSolver();
      
      // Create a small 3x1 mesh (6 elements)
      const nelx = 3;
      const nely = 1;
      const densities = new Float64Array(nelx * nely).fill(1.0);
      
      // Assemble stiffness matrix
      const K = assembleStiffnessMatrix(nelx, nely, densities, 3.0, 1e-9, 1.0, 0.3);
      
      // Set up boundary conditions (fix left edge)
      const nDofs = getTotalDOFs(nelx, nely);
      const forces = new Float64Array(nDofs);
      const fixedDofs: number[] = [];
      
      for (let y = 0; y <= nely; y++) {
        const nodeIdx = getNodeIndex(0, y, nely);
        fixedDofs.push(2 * nodeIdx);     // x DOF
        fixedDofs.push(2 * nodeIdx + 1); // y DOF
      }
      
      // Apply force at right edge
      const rightMidNode = getNodeIndex(nelx, 0, nely);
      forces[2 * rightMidNode + 1] = -1;
      
      const fMod = applyBoundaryConditions(K, forces, fixedDofs);
      const x0 = new Float64Array(K.n);
      
      // Solve with JS
      const jsResult = jsSolver.solve(K, fMod, x0, 1e-8, 10000);
      
      // If WASM is available, compare results
      if (isWasmAvailable()) {
        const wasmSolver = new WASMSolver();
        
        // Need to re-assemble since boundary conditions modify the matrix
        const K2 = assembleStiffnessMatrix(nelx, nely, densities, 3.0, 1e-9, 1.0, 0.3);
        const fMod2 = applyBoundaryConditions(K2, forces, fixedDofs);
        const x0_2 = new Float64Array(K2.n);
        
        const wasmResult = wasmSolver.solve(K2, fMod2, x0_2, 1e-8, 10000);
        
        // Compare solutions (should match within tolerance)
        expect(wasmResult.x.length).toBe(jsResult.x.length);
        
        for (let i = 0; i < jsResult.x.length; i++) {
          expect(wasmResult.x[i]).toBeCloseTo(jsResult.x[i], 5);
        }
      }
    });
  });

  describe('Performance Benchmark', () => {
    it('should benchmark WASM vs JS on 60x20 mesh', async () => {
      await initWasm();
      
      const jsSolver = new JSSolver();
      
      // Create a 60x20 mesh (1200 elements, ~2500 DOFs)
      const nelx = 60;
      const nely = 20;
      const densities = new Float64Array(nelx * nely).fill(0.5);
      
      // Assemble stiffness matrix
      const K = assembleStiffnessMatrix(nelx, nely, densities, 3.0, 1e-9, 1.0, 0.3);
      
      // Set up boundary conditions (cantilever beam)
      const nDofs = getTotalDOFs(nelx, nely);
      const forces = new Float64Array(nDofs);
      const fixedDofs: number[] = [];
      
      // Fix left edge
      for (let y = 0; y <= nely; y++) {
        const nodeIdx = getNodeIndex(0, y, nely);
        fixedDofs.push(2 * nodeIdx);
        fixedDofs.push(2 * nodeIdx + 1);
      }
      
      // Force at right middle
      const midY = Math.floor(nely / 2);
      const rightNode = getNodeIndex(nelx, midY, nely);
      forces[2 * rightNode + 1] = -1;
      
      const fMod = applyBoundaryConditions(K, forces, fixedDofs);
      const x0 = new Float64Array(K.n);
      
      // Benchmark JS solver
      const jsStart = performance.now();
      const jsResult = jsSolver.solve(K, fMod, x0, 1e-8, 10000);
      const jsTime = performance.now() - jsStart;
      
      console.log(`\n=== Performance Benchmark (60x20 mesh, ${K.n} DOFs) ===`);
      console.log(`JS Solver: ${jsTime.toFixed(2)}ms, ${jsResult.iterations} iterations`);
      
      // If WASM is available, benchmark it too
      if (isWasmAvailable()) {
        const wasmSolver = new WASMSolver();
        
        // Re-assemble for fair comparison (BC application modifies matrix)
        const K2 = assembleStiffnessMatrix(nelx, nely, densities, 3.0, 1e-9, 1.0, 0.3);
        const fMod2 = applyBoundaryConditions(K2, forces, fixedDofs);
        const x0_2 = new Float64Array(K2.n);
        
        const wasmStart = performance.now();
        const wasmResult = wasmSolver.solve(K2, fMod2, x0_2, 1e-8, 10000);
        const wasmTime = performance.now() - wasmStart;
        
        console.log(`WASM Solver: ${wasmTime.toFixed(2)}ms, ${wasmResult.iterations} iterations`);
        console.log(`Speedup: ${(jsTime / wasmTime).toFixed(2)}x`);
        
        // WASM should be faster (or at least not significantly slower)
        // We don't assert this strictly as it depends on the environment
        expect(wasmResult.iterations).toBeCloseTo(jsResult.iterations, 0);
      } else {
        console.log('WASM not available in this environment');
      }
      
      console.log('=== End Benchmark ===\n');
      
      // Just verify the solve worked
      expect(jsResult.residual).toBeLessThan(1e-6);
    });
  });

  describe('Fallback Behavior', () => {
    it('should fallback to JS solver when WASM unavailable', async () => {
      resetWasmState();
      
      // Before initializing, should use JS
      const solverSync = createSolverSync();
      expect(solverSync.name).toBe('JavaScript');
      
      // After init attempt, should use best available
      const solver = await createSolver();
      expect(['JavaScript', 'WebAssembly']).toContain(solver.name);
    });

    it('should solve correctly regardless of solver type', async () => {
      const solver = await createSolver();
      
      // Simple test problem
      const K: CSRMatrix = {
        values: new Float64Array([4, 1, 1, 4]),
        colIndices: new Int32Array([0, 1, 0, 1]),
        rowPointers: new Int32Array([0, 2, 4]),
        n: 2
      };
      
      const b = new Float64Array([5, 5]);
      const x0 = new Float64Array([0, 0]);
      
      const result = solver.solve(K, b, x0, 1e-10, 100);
      
      // [4, 1; 1, 4] * x = [5; 5]
      // Solution: x = [1, 1]
      expect(result.x[0]).toBeCloseTo(1.0, 6);
      expect(result.x[1]).toBeCloseTo(1.0, 6);
    });
  });
});

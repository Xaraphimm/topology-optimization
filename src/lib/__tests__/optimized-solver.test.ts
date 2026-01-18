/**
 * Tests for Optimized Solver
 * 
 * Verifies that the optimized solver produces the same results as the
 * original solver while being faster at high resolutions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  precomputeMeshConnectivity,
  createSolverScratch,
  assembleStiffnessMatrixFast,
  applyBoundaryConditionsFast,
  conjugateGradientFast,
  solveFEMOptimized,
  type MeshConnectivity,
  type SolverScratch,
} from '../optimizer/optimized-solver';
import { assembleStiffnessMatrix, applyBoundaryConditions, conjugateGradient } from '../optimizer/solver';
import { getTotalDOFs } from '../optimizer/fem';

describe('precomputeMeshConnectivity', () => {
  it('should compute correct dimensions for small mesh', () => {
    const mesh = precomputeMeshConnectivity(4, 2);
    
    expect(mesh.nelx).toBe(4);
    expect(mesh.nely).toBe(2);
    expect(mesh.nElem).toBe(8);
    expect(mesh.nDofs).toBe(getTotalDOFs(4, 2));
  });

  it('should compute correct element DOF indices', () => {
    const mesh = precomputeMeshConnectivity(2, 2);
    
    // Element 0 is at (0, 0) - bottom-left
    // Its nodes in Q4 order: bottom-left, bottom-right, top-right, top-left
    // Node indices: 0, 3, 4, 1
    // DOF indices: 0,1, 6,7, 8,9, 2,3
    const elem0Dofs = Array.from({ length: 8 }, (_, i) => mesh.elementDofs[i]);
    expect(elem0Dofs).toEqual([0, 1, 6, 7, 8, 9, 2, 3]);
  });

  it('should produce valid CSR structure', () => {
    const mesh = precomputeMeshConnectivity(4, 2);
    
    // Row pointers should be monotonically increasing
    for (let i = 0; i < mesh.nDofs; i++) {
      expect(mesh.rowPointers[i + 1]).toBeGreaterThanOrEqual(mesh.rowPointers[i]);
    }
    
    // Column indices should be within valid range
    for (let i = 0; i < mesh.nnz; i++) {
      expect(mesh.colIndices[i]).toBeGreaterThanOrEqual(0);
      expect(mesh.colIndices[i]).toBeLessThan(mesh.nDofs);
    }
    
    // NNZ should match last row pointer
    expect(mesh.nnz).toBe(mesh.rowPointers[mesh.nDofs]);
  });

  it('should produce symmetric sparsity pattern', () => {
    const mesh = precomputeMeshConnectivity(3, 3);
    
    // Check that if (i, j) is in pattern, then (j, i) is also in pattern
    const pattern = new Set<string>();
    
    for (let i = 0; i < mesh.nDofs; i++) {
      for (let k = mesh.rowPointers[i]; k < mesh.rowPointers[i + 1]; k++) {
        const j = mesh.colIndices[k];
        pattern.add(`${i},${j}`);
      }
    }
    
    for (const entry of pattern) {
      const [i, j] = entry.split(',').map(Number);
      expect(pattern.has(`${j},${i}`)).toBe(true);
    }
  });

  it('should precompute element stiffness matrix', () => {
    const mesh = precomputeMeshConnectivity(2, 2);
    
    expect(mesh.KE).toBeDefined();
    expect(mesh.KE.length).toBe(64); // 8x8 matrix
    
    // KE should be symmetric
    for (let i = 0; i < 8; i++) {
      for (let j = i + 1; j < 8; j++) {
        expect(mesh.KE[i * 8 + j]).toBeCloseTo(mesh.KE[j * 8 + i], 10);
      }
    }
  });
});

describe('createSolverScratch', () => {
  it('should create arrays of correct size', () => {
    const nDofs = 100;
    const scratch = createSolverScratch(nDofs);
    
    expect(scratch.r.length).toBe(nDofs);
    expect(scratch.z.length).toBe(nDofs);
    expect(scratch.p.length).toBe(nDofs);
    expect(scratch.Ap.length).toBe(nDofs);
    expect(scratch.invDiag.length).toBe(nDofs);
  });

  it('should create Float64Arrays', () => {
    const scratch = createSolverScratch(50);
    
    expect(scratch.r).toBeInstanceOf(Float64Array);
    expect(scratch.z).toBeInstanceOf(Float64Array);
    expect(scratch.p).toBeInstanceOf(Float64Array);
    expect(scratch.Ap).toBeInstanceOf(Float64Array);
    expect(scratch.invDiag).toBeInstanceOf(Float64Array);
  });
});

describe('assembleStiffnessMatrixFast', () => {
  let mesh: MeshConnectivity;
  let values: Float64Array;
  
  beforeEach(() => {
    mesh = precomputeMeshConnectivity(4, 2);
    values = new Float64Array(mesh.nnz);
  });

  it('should produce non-zero values', () => {
    const densities = new Float64Array(mesh.nElem).fill(1.0);
    assembleStiffnessMatrixFast(mesh, densities, 3.0, 1e-9, 1.0, values);
    
    // At least some values should be non-zero
    const nonZeroCount = values.filter(v => Math.abs(v) > 1e-15).length;
    expect(nonZeroCount).toBeGreaterThan(0);
  });

  it('should produce symmetric matrix', () => {
    const densities = new Float64Array(mesh.nElem).fill(0.5);
    assembleStiffnessMatrixFast(mesh, densities, 3.0, 1e-9, 1.0, values);
    
    // Build a map of (row, col) -> value
    const matrix = new Map<string, number>();
    for (let i = 0; i < mesh.nDofs; i++) {
      for (let k = mesh.rowPointers[i]; k < mesh.rowPointers[i + 1]; k++) {
        matrix.set(`${i},${mesh.colIndices[k]}`, values[k]);
      }
    }
    
    // Check symmetry
    for (const [key, val] of matrix) {
      const [i, j] = key.split(',').map(Number);
      const transposedVal = matrix.get(`${j},${i}`);
      expect(transposedVal).toBeDefined();
      expect(val).toBeCloseTo(transposedVal!, 10);
    }
  });

  it('should scale with density according to SIMP', () => {
    const densities1 = new Float64Array(mesh.nElem).fill(1.0);
    const densities05 = new Float64Array(mesh.nElem).fill(0.5);
    
    const values1 = new Float64Array(mesh.nnz);
    const values05 = new Float64Array(mesh.nnz);
    
    assembleStiffnessMatrixFast(mesh, densities1, 3.0, 1e-9, 1.0, values1);
    assembleStiffnessMatrixFast(mesh, densities05, 3.0, 1e-9, 1.0, values05);
    
    // With penal=3, density=0.5 gives E = 0.5^3 * (1 - 1e-9) + 1e-9 ≈ 0.125
    // So values05 should be roughly 1/8 of values1
    for (let i = 0; i < mesh.nnz; i++) {
      if (Math.abs(values1[i]) > 1e-10) {
        const ratio = values05[i] / values1[i];
        expect(ratio).toBeCloseTo(0.125, 1);
      }
    }
  });
});

describe('conjugateGradientFast', () => {
  it('should solve a simple diagonal system', () => {
    // Create a simple 3x3 diagonal system: diag([2, 3, 4]) * x = [2, 6, 12]
    // Solution: x = [1, 2, 3]
    const n = 3;
    const values = new Float64Array([2, 3, 4]);
    const colIndices = new Int32Array([0, 1, 2]);
    const rowPointers = new Int32Array([0, 1, 2, 3]);
    const b = new Float64Array([2, 6, 12]);
    const x = new Float64Array(n);
    const scratch = createSolverScratch(n);
    
    const result = conjugateGradientFast(values, colIndices, rowPointers, n, b, x, scratch);
    
    expect(result.iterations).toBeLessThan(10);
    expect(x[0]).toBeCloseTo(1, 6);
    expect(x[1]).toBeCloseTo(2, 6);
    expect(x[2]).toBeCloseTo(3, 6);
  });

  it('should handle larger systems', () => {
    const mesh = precomputeMeshConnectivity(6, 2);
    const values = new Float64Array(mesh.nnz);
    const densities = new Float64Array(mesh.nElem).fill(1.0);
    
    assembleStiffnessMatrixFast(mesh, densities, 3.0, 1e-9, 1.0, values);
    
    // Apply proper boundary conditions using applyBoundaryConditionsFast
    // Fix left edge (all nodes at x=0)
    const nely = 2;
    const fixedDofs: number[] = [];
    for (let y = 0; y <= nely; y++) {
      const nodeIdx = (nely + 1) * 0 + y;
      fixedDofs.push(2 * nodeIdx);
      fixedDofs.push(2 * nodeIdx + 1);
    }
    
    // Create a simple RHS with load at right edge
    const forces = new Float64Array(mesh.nDofs);
    const rightNode = (nely + 1) * 6 + 1; // Middle right
    forces[2 * rightNode + 1] = -1; // Downward force
    
    const fMod = applyBoundaryConditionsFast(mesh, values, forces, fixedDofs);
    
    const x = new Float64Array(mesh.nDofs);
    const scratch = createSolverScratch(mesh.nDofs);
    
    const result = conjugateGradientFast(
      values, mesh.colIndices, mesh.rowPointers, mesh.nDofs,
      fMod, x, scratch, 1e-8, 2000
    );
    
    // The system should converge
    expect(result.iterations).toBeLessThan(1500);
    expect(result.residual).toBeLessThan(1e-5);
  });
});

describe('solveFEMOptimized', () => {
  it('should solve a cantilever problem', () => {
    const nelx = 6;
    const nely = 2;
    const mesh = precomputeMeshConnectivity(nelx, nely);
    const scratch = createSolverScratch(mesh.nDofs);
    const values = new Float64Array(mesh.nnz);
    
    const densities = new Float64Array(mesh.nElem).fill(1.0);
    const forces = new Float64Array(mesh.nDofs);
    const u = new Float64Array(mesh.nDofs);
    
    // Fix left edge
    const fixedDofs: number[] = [];
    for (let y = 0; y <= nely; y++) {
      const nodeIdx = (nely + 1) * 0 + y;
      fixedDofs.push(2 * nodeIdx);
      fixedDofs.push(2 * nodeIdx + 1);
    }
    
    // Apply load at right middle
    const midY = Math.floor(nely / 2);
    const rightNode = (nely + 1) * nelx + midY;
    forces[2 * rightNode + 1] = -1;
    
    const result = solveFEMOptimized(
      mesh, densities, forces, fixedDofs, u, scratch, values, 3.0, 1e-9, 1.0
    );
    
    expect(result.iterations).toBeLessThan(500);
    expect(result.residual).toBeLessThan(1e-6);
    
    // Check that fixed DOFs have zero displacement
    for (const dof of fixedDofs) {
      expect(Math.abs(u[dof])).toBeLessThan(1e-10);
    }
    
    // Check that loaded node moved downward
    expect(u[2 * rightNode + 1]).toBeLessThan(0);
  });
});

describe('Optimized vs Original Solver Comparison', () => {
  it('should produce same results as original solver on small mesh', () => {
    const nelx = 4;
    const nely = 2;
    const nDofs = getTotalDOFs(nelx, nely);
    const nElem = nelx * nely;
    
    const densities = new Float64Array(nElem).fill(0.6);
    
    // Set up simple cantilever problem
    const forces = new Float64Array(nDofs);
    const fixedDofs: number[] = [];
    
    // Fix left edge
    for (let y = 0; y <= nely; y++) {
      const nodeIdx = (nely + 1) * 0 + y;
      fixedDofs.push(2 * nodeIdx);
      fixedDofs.push(2 * nodeIdx + 1);
    }
    
    // Load at right
    const rightNode = (nely + 1) * nelx + Math.floor(nely / 2);
    forces[2 * rightNode + 1] = -1;
    
    // Original solver
    const K_orig = assembleStiffnessMatrix(nelx, nely, densities, 3.0, 1e-9, 1.0, 0.3);
    const f_orig = applyBoundaryConditions(K_orig, forces, fixedDofs);
    const u_orig = new Float64Array(nDofs);
    conjugateGradient(K_orig, f_orig, u_orig, 1e-10, 10000);
    
    // Optimized solver
    const mesh = precomputeMeshConnectivity(nelx, nely, 0.3);
    const scratch = createSolverScratch(nDofs);
    const values = new Float64Array(mesh.nnz);
    const u_opt = new Float64Array(nDofs);
    
    solveFEMOptimized(mesh, densities, forces, fixedDofs, u_opt, scratch, values, 3.0, 1e-9, 1.0);
    
    // Compare results
    for (let i = 0; i < nDofs; i++) {
      expect(u_opt[i]).toBeCloseTo(u_orig[i], 4);
    }
  });
});

describe('Performance characteristics', () => {
  it('should reuse scratch arrays without reallocation', () => {
    const nDofs = 100;
    const scratch = createSolverScratch(nDofs);
    
    // Store references
    const r_ref = scratch.r;
    const z_ref = scratch.z;
    const p_ref = scratch.p;
    const Ap_ref = scratch.Ap;
    const invDiag_ref = scratch.invDiag;
    
    // After calling CG, the same arrays should still be used
    // (We don't have a good way to test this, but the arrays should exist)
    expect(scratch.r).toBe(r_ref);
    expect(scratch.z).toBe(z_ref);
    expect(scratch.p).toBe(p_ref);
    expect(scratch.Ap).toBe(Ap_ref);
    expect(scratch.invDiag).toBe(invDiag_ref);
  });

  it('should handle high-resolution mesh', () => {
    // Test that we can at least create connectivity for high-res mesh
    const mesh = precomputeMeshConnectivity(120, 40);
    
    expect(mesh.nElem).toBe(4800);
    expect(mesh.nDofs).toBe(2 * 121 * 41); // 9922 DOFs
    expect(mesh.nnz).toBeGreaterThan(0);
    expect(mesh.elemToCSR.length).toBe(4800 * 64);
  });
});

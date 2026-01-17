import { describe, it, expect } from 'vitest';
import {
  CSRMatrix,
  csrMatVec,
  dot,
  axpby,
  copyVec,
  conjugateGradient,
  assembleStiffnessMatrix,
  applyBoundaryConditions,
  solveFEM,
} from '../optimizer/solver';
import { getTotalDOFs, getNodeIndex } from '../optimizer/fem';

describe('dot product', () => {
  it('should compute correct dot product', () => {
    const a = new Float64Array([1, 2, 3]);
    const b = new Float64Array([4, 5, 6]);
    expect(dot(a, b)).toBe(1*4 + 2*5 + 3*6); // 32
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = new Float64Array([1, 0, 0]);
    const b = new Float64Array([0, 1, 0]);
    expect(dot(a, b)).toBe(0);
  });

  it('should compute norm squared for same vector', () => {
    const a = new Float64Array([3, 4]);
    expect(dot(a, a)).toBe(25); // 3^2 + 4^2
  });
});

describe('axpby', () => {
  it('should compute y = a*x + b*y correctly', () => {
    const x = new Float64Array([1, 2, 3]);
    const y = new Float64Array([4, 5, 6]);
    axpby(2, x, 3, y);
    expect(y[0]).toBe(2*1 + 3*4); // 14
    expect(y[1]).toBe(2*2 + 3*5); // 19
    expect(y[2]).toBe(2*3 + 3*6); // 24
  });
});

describe('copyVec', () => {
  it('should copy vector correctly', () => {
    const x = new Float64Array([1, 2, 3]);
    const y = new Float64Array(3);
    copyVec(x, y);
    expect(y[0]).toBe(1);
    expect(y[1]).toBe(2);
    expect(y[2]).toBe(3);
  });
});

describe('csrMatVec', () => {
  it('should multiply identity matrix correctly', () => {
    // 3x3 identity matrix in CSR
    const A: CSRMatrix = {
      values: new Float64Array([1, 1, 1]),
      colIndices: new Int32Array([0, 1, 2]),
      rowPointers: new Int32Array([0, 1, 2, 3]),
      n: 3,
    };
    const x = new Float64Array([1, 2, 3]);
    const y = new Float64Array(3);
    
    csrMatVec(A, x, y);
    
    expect(y[0]).toBe(1);
    expect(y[1]).toBe(2);
    expect(y[2]).toBe(3);
  });

  it('should multiply dense matrix correctly', () => {
    // Matrix: [[1, 2], [3, 4]]
    const A: CSRMatrix = {
      values: new Float64Array([1, 2, 3, 4]),
      colIndices: new Int32Array([0, 1, 0, 1]),
      rowPointers: new Int32Array([0, 2, 4]),
      n: 2,
    };
    const x = new Float64Array([1, 1]);
    const y = new Float64Array(2);
    
    csrMatVec(A, x, y);
    
    expect(y[0]).toBe(3); // 1*1 + 2*1
    expect(y[1]).toBe(7); // 3*1 + 4*1
  });
});

describe('conjugateGradient', () => {
  it('should solve identity system exactly', () => {
    // I * x = b  =>  x = b
    const A: CSRMatrix = {
      values: new Float64Array([1, 1, 1]),
      colIndices: new Int32Array([0, 1, 2]),
      rowPointers: new Int32Array([0, 1, 2, 3]),
      n: 3,
    };
    const b = new Float64Array([1, 2, 3]);
    const x0 = new Float64Array(3);
    
    const result = conjugateGradient(A, b, x0);
    
    expect(result.x[0]).toBeCloseTo(1, 6);
    expect(result.x[1]).toBeCloseTo(2, 6);
    expect(result.x[2]).toBeCloseTo(3, 6);
    expect(result.iterations).toBeLessThanOrEqual(3);
  });

  it('should solve simple SPD system', () => {
    // Matrix: [[4, 1], [1, 3]] (SPD)
    // Solving for x where A*x = [1, 2]
    // Solution: x = [1/11, 7/11] = [0.0909, 0.6364]
    const A: CSRMatrix = {
      values: new Float64Array([4, 1, 1, 3]),
      colIndices: new Int32Array([0, 1, 0, 1]),
      rowPointers: new Int32Array([0, 2, 4]),
      n: 2,
    };
    const b = new Float64Array([1, 2]);
    const x0 = new Float64Array(2);
    
    const result = conjugateGradient(A, b, x0);
    
    expect(result.x[0]).toBeCloseTo(1/11, 6);
    expect(result.x[1]).toBeCloseTo(7/11, 6);
  });

  it('should converge for larger SPD system', () => {
    // Tridiagonal system (common in FEM): diag=4, off-diag=-1
    const n = 10;
    const values: number[] = [];
    const colIndices: number[] = [];
    const rowPointers: number[] = [0];
    
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        values.push(-1);
        colIndices.push(i - 1);
      }
      values.push(4);
      colIndices.push(i);
      if (i < n - 1) {
        values.push(-1);
        colIndices.push(i + 1);
      }
      rowPointers.push(values.length);
    }
    
    const A: CSRMatrix = {
      values: new Float64Array(values),
      colIndices: new Int32Array(colIndices),
      rowPointers: new Int32Array(rowPointers),
      n,
    };
    
    // RHS = all ones
    const b = new Float64Array(n).fill(1);
    const x0 = new Float64Array(n);
    
    const result = conjugateGradient(A, b, x0);
    
    // Verify solution by computing A*x and comparing to b
    const Ax = new Float64Array(n);
    csrMatVec(A, result.x, Ax);
    
    for (let i = 0; i < n; i++) {
      expect(Ax[i]).toBeCloseTo(b[i], 6);
    }
    
    expect(result.residual).toBeLessThan(1e-6);
  });

  it('should return initial guess if already solved', () => {
    const A: CSRMatrix = {
      values: new Float64Array([1, 1]),
      colIndices: new Int32Array([0, 1]),
      rowPointers: new Int32Array([0, 1, 2]),
      n: 2,
    };
    const b = new Float64Array([0, 0]);
    const x0 = new Float64Array([0, 0]); // Already the solution
    
    const result = conjugateGradient(A, b, x0);
    
    expect(result.iterations).toBe(0);
  });
});

describe('assembleStiffnessMatrix', () => {
  it('should create a matrix of correct size', () => {
    const nelx = 3;
    const nely = 2;
    const nelem = nelx * nely;
    const densities = new Float64Array(nelem).fill(1.0);
    
    const K = assembleStiffnessMatrix(nelx, nely, densities);
    
    const expectedDofs = getTotalDOFs(nelx, nely);
    expect(K.n).toBe(expectedDofs);
  });

  it('should produce a symmetric matrix', () => {
    const nelx = 2;
    const nely = 2;
    const densities = new Float64Array(4).fill(1.0);
    
    const K = assembleStiffnessMatrix(nelx, nely, densities);
    
    // Convert CSR to dense for symmetry check
    const dense = new Float64Array(K.n * K.n);
    for (let i = 0; i < K.n; i++) {
      for (let j = K.rowPointers[i]; j < K.rowPointers[i + 1]; j++) {
        dense[i * K.n + K.colIndices[j]] = K.values[j];
      }
    }
    
    // Check symmetry
    for (let i = 0; i < K.n; i++) {
      for (let j = i + 1; j < K.n; j++) {
        const diff = Math.abs(dense[i * K.n + j] - dense[j * K.n + i]);
        expect(diff).toBeLessThan(1e-10);
      }
    }
  });

  it('should scale with density (SIMP)', () => {
    const nelx = 2;
    const nely = 2;
    
    // All elements full density
    const densities1 = new Float64Array(4).fill(1.0);
    const K1 = assembleStiffnessMatrix(nelx, nely, densities1, 3.0);
    
    // All elements half density: E = Emin + 0.5^3 * (1 - Emin) ≈ 0.125
    const densities2 = new Float64Array(4).fill(0.5);
    const K2 = assembleStiffnessMatrix(nelx, nely, densities2, 3.0);
    
    // Sum of all matrix values should be roughly 0.125 times K1
    let sum1 = 0, sum2 = 0;
    for (let i = 0; i < K1.values.length; i++) sum1 += Math.abs(K1.values[i]);
    for (let i = 0; i < K2.values.length; i++) sum2 += Math.abs(K2.values[i]);
    
    // With penal=3, ratio should be approximately 0.5^3 = 0.125
    const ratio = sum2 / sum1;
    expect(ratio).toBeCloseTo(0.125, 1);
  });
});

describe('solveFEM', () => {
  it('should solve a simple cantilever beam problem', () => {
    // 2x1 mesh (2 elements)
    // Fixed on left, load on right
    const nelx = 2;
    const nely = 1;
    const nDofs = getTotalDOFs(nelx, nely);
    
    // All elements solid
    const densities = new Float64Array(2).fill(1.0);
    
    // Force: downward on right edge
    const forces = new Float64Array(nDofs).fill(0);
    const rightBottomNode = getNodeIndex(nelx, 0, nely);
    forces[2 * rightBottomNode + 1] = -1; // Downward force
    
    // Fixed DOFs: left edge (both nodes, both DOFs)
    const fixedDofs: number[] = [];
    for (let y = 0; y <= nely; y++) {
      const nodeIdx = getNodeIndex(0, y, nely);
      fixedDofs.push(2 * nodeIdx);     // x DOF
      fixedDofs.push(2 * nodeIdx + 1); // y DOF
    }
    
    const u = solveFEM(nelx, nely, densities, forces, fixedDofs);
    
    // Displacement at fixed nodes should be zero
    for (const dof of fixedDofs) {
      expect(Math.abs(u[dof])).toBeLessThan(1e-10);
    }
    
    // Right edge should have non-zero displacement
    const rightDisp = u[2 * rightBottomNode + 1];
    expect(rightDisp).toBeLessThan(0); // Should move downward (negative y)
  });

  it('should give larger displacement for lower density', () => {
    const nelx = 4;
    const nely = 2;
    const nDofs = getTotalDOFs(nelx, nely);
    
    // Force on right
    const forces = new Float64Array(nDofs).fill(0);
    const rightNode = getNodeIndex(nelx, nely / 2, nely);
    forces[2 * rightNode + 1] = -1;
    
    // Fixed on left
    const fixedDofs: number[] = [];
    for (let y = 0; y <= nely; y++) {
      const nodeIdx = getNodeIndex(0, y, nely);
      fixedDofs.push(2 * nodeIdx);
      fixedDofs.push(2 * nodeIdx + 1);
    }
    
    // Solve with full density
    const densities1 = new Float64Array(nelx * nely).fill(1.0);
    const u1 = solveFEM(nelx, nely, densities1, forces, fixedDofs);
    
    // Solve with half density
    const densities2 = new Float64Array(nelx * nely).fill(0.5);
    const u2 = solveFEM(nelx, nely, densities2, forces, fixedDofs);
    
    // Lower density should give larger displacement magnitude
    const disp1 = Math.abs(u1[2 * rightNode + 1]);
    const disp2 = Math.abs(u2[2 * rightNode + 1]);
    
    expect(disp2).toBeGreaterThan(disp1);
  });
});

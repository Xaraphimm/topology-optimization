/**
 * Optimized Solver for High-Resolution Topology Optimization
 * 
 * Key optimizations:
 * 1. Precompute CSR sparsity pattern once per mesh (avoid Map overhead)
 * 2. Reuse scratch arrays for CG iterations (avoid allocations)
 * 3. Direct element-to-global DOF mapping with precomputed indices
 * 4. Efficient boundary condition application with precomputed masks
 */

import { getElementDOFs, computeElementStiffness, getTotalDOFs } from './fem';

/**
 * Precomputed mesh connectivity data
 * Created once when mesh dimensions change
 */
export interface MeshConnectivity {
  nelx: number;
  nely: number;
  nDofs: number;
  nElem: number;
  
  // Element DOF indices for all elements (nElem x 8)
  elementDofs: Int32Array;
  
  // CSR sparsity pattern (structure only, values filled per iteration)
  rowPointers: Int32Array;
  colIndices: Int32Array;
  nnz: number;
  
  // Mapping from (element, local_i, local_j) to CSR value index
  // elemToCSR[elem * 64 + i * 8 + j] = index into values array
  elemToCSR: Int32Array;
  
  // Unit element stiffness matrix (8x8)
  KE: Float64Array;
}

/**
 * Reusable scratch arrays for CG solver
 * Allocated once and reused across iterations
 */
export interface SolverScratch {
  r: Float64Array;    // Residual
  z: Float64Array;    // Preconditioned residual
  p: Float64Array;    // Search direction
  Ap: Float64Array;   // A * p
  invDiag: Float64Array; // Jacobi preconditioner
}

/**
 * CSR matrix with preallocated structure
 */
export interface OptimizedCSRMatrix {
  values: Float64Array;
  colIndices: Int32Array;
  rowPointers: Int32Array;
  n: number;
}

/**
 * Precompute mesh connectivity and CSR sparsity pattern
 * This is the expensive operation that we only do once per mesh size
 */
export function precomputeMeshConnectivity(
  nelx: number,
  nely: number,
  nu: number = 0.3
): MeshConnectivity {
  const nDofs = getTotalDOFs(nelx, nely);
  const nElem = nelx * nely;
  
  // Precompute element stiffness matrix
  const KE = computeElementStiffness(1.0, nu);
  
  // Precompute element DOF indices for all elements
  const elementDofs = new Int32Array(nElem * 8);
  for (let elx = 0; elx < nelx; elx++) {
    for (let ely = 0; ely < nely; ely++) {
      const elemIdx = elx * nely + ely;
      const dofs = getElementDOFs(elx, ely, nelx, nely);
      for (let i = 0; i < 8; i++) {
        elementDofs[elemIdx * 8 + i] = dofs[i];
      }
    }
  }
  
  // Build CSR sparsity pattern
  // First pass: count entries per row using a Set to track unique columns
  const rowSets: Set<number>[] = Array.from({ length: nDofs }, () => new Set());
  
  for (let elem = 0; elem < nElem; elem++) {
    const baseIdx = elem * 8;
    for (let i = 0; i < 8; i++) {
      const row = elementDofs[baseIdx + i];
      for (let j = 0; j < 8; j++) {
        const col = elementDofs[baseIdx + j];
        rowSets[row].add(col);
      }
    }
  }
  
  // Convert to CSR structure
  const rowPointers = new Int32Array(nDofs + 1);
  let nnz = 0;
  for (let i = 0; i < nDofs; i++) {
    rowPointers[i] = nnz;
    nnz += rowSets[i].size;
  }
  rowPointers[nDofs] = nnz;
  
  const colIndices = new Int32Array(nnz);
  const colToIdx: Map<number, number>[] = Array.from({ length: nDofs }, () => new Map());
  
  for (let i = 0; i < nDofs; i++) {
    const cols = Array.from(rowSets[i]).sort((a, b) => a - b);
    let idx = rowPointers[i];
    for (const col of cols) {
      colIndices[idx] = col;
      colToIdx[i].set(col, idx);
      idx++;
    }
  }
  
  // Build element-to-CSR mapping
  const elemToCSR = new Int32Array(nElem * 64);
  for (let elem = 0; elem < nElem; elem++) {
    const baseIdx = elem * 8;
    for (let i = 0; i < 8; i++) {
      const row = elementDofs[baseIdx + i];
      for (let j = 0; j < 8; j++) {
        const col = elementDofs[baseIdx + j];
        const csrIdx = colToIdx[row].get(col)!;
        elemToCSR[elem * 64 + i * 8 + j] = csrIdx;
      }
    }
  }
  
  return {
    nelx,
    nely,
    nDofs,
    nElem,
    elementDofs,
    rowPointers,
    colIndices,
    nnz,
    elemToCSR,
    KE,
  };
}

/**
 * Create reusable scratch arrays for CG solver
 */
export function createSolverScratch(nDofs: number): SolverScratch {
  return {
    r: new Float64Array(nDofs),
    z: new Float64Array(nDofs),
    p: new Float64Array(nDofs),
    Ap: new Float64Array(nDofs),
    invDiag: new Float64Array(nDofs),
  };
}

/**
 * Fast stiffness matrix assembly using precomputed connectivity
 * Directly fills CSR values array without Map overhead
 */
export function assembleStiffnessMatrixFast(
  mesh: MeshConnectivity,
  densities: Float64Array,
  penal: number,
  Emin: number,
  E0: number,
  values: Float64Array
): void {
  const { nElem, KE, elemToCSR } = mesh;
  
  // Zero the values array
  values.fill(0);
  
  // Accumulate element contributions
  for (let elem = 0; elem < nElem; elem++) {
    const density = densities[elem];
    const Ee = Emin + Math.pow(density, penal) * (E0 - Emin);
    
    const elemBase = elem * 64;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const csrIdx = elemToCSR[elemBase + i * 8 + j];
        values[csrIdx] += KE[i * 8 + j] * Ee;
      }
    }
  }
}

/**
 * Apply boundary conditions to CSR matrix and RHS
 * Modifies values in place, returns modified RHS
 */
export function applyBoundaryConditionsFast(
  mesh: MeshConnectivity,
  values: Float64Array,
  f: Float64Array,
  fixedDofs: number[]
): Float64Array {
  const { nDofs, rowPointers, colIndices } = mesh;
  const fMod = new Float64Array(f);
  const isFixed = new Set(fixedDofs);
  
  // For each fixed DOF, zero its row and set diagonal to 1
  for (const dof of fixedDofs) {
    fMod[dof] = 0;
    
    for (let j = rowPointers[dof]; j < rowPointers[dof + 1]; j++) {
      if (colIndices[j] === dof) {
        values[j] = 1.0;
      } else {
        values[j] = 0.0;
      }
    }
  }
  
  // Zero columns of fixed DOFs
  for (let i = 0; i < nDofs; i++) {
    if (isFixed.has(i)) continue;
    
    for (let j = rowPointers[i]; j < rowPointers[i + 1]; j++) {
      if (isFixed.has(colIndices[j])) {
        values[j] = 0.0;
      }
    }
  }
  
  return fMod;
}

/**
 * Sparse matrix-vector multiplication: y = A * x
 */
function csrMatVec(
  values: Float64Array,
  colIndices: Int32Array,
  rowPointers: Int32Array,
  n: number,
  x: Float64Array,
  y: Float64Array
): void {
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = rowPointers[i]; j < rowPointers[i + 1]; j++) {
      sum += values[j] * x[colIndices[j]];
    }
    y[i] = sum;
  }
}

/**
 * Compute Jacobi preconditioner (inverse diagonal)
 */
function computeJacobiPreconditioner(
  values: Float64Array,
  colIndices: Int32Array,
  rowPointers: Int32Array,
  n: number,
  invDiag: Float64Array
): void {
  for (let i = 0; i < n; i++) {
    for (let j = rowPointers[i]; j < rowPointers[i + 1]; j++) {
      if (colIndices[j] === i) {
        invDiag[i] = values[j] !== 0 ? 1 / values[j] : 1;
        break;
      }
    }
  }
}

/**
 * Dot product
 */
function dot(a: Float64Array, b: Float64Array, n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Optimized Preconditioned Conjugate Gradient solver
 * Reuses scratch arrays to avoid allocations
 */
export function conjugateGradientFast(
  values: Float64Array,
  colIndices: Int32Array,
  rowPointers: Int32Array,
  n: number,
  b: Float64Array,
  x: Float64Array,
  scratch: SolverScratch,
  tol: number = 1e-8,
  maxIter: number = 10000
): { iterations: number; residual: number } {
  const { r, z, p, Ap, invDiag } = scratch;
  
  // Compute preconditioner
  computeJacobiPreconditioner(values, colIndices, rowPointers, n, invDiag);
  
  // Initial residual: r = b - A*x
  csrMatVec(values, colIndices, rowPointers, n, x, r);
  for (let i = 0; i < n; i++) {
    r[i] = b[i] - r[i];
  }
  
  // Check if already converged
  let rnorm = Math.sqrt(dot(r, r, n));
  const bnorm = Math.sqrt(dot(b, b, n));
  const threshold = tol * Math.max(bnorm, 1);
  
  if (rnorm < threshold) {
    return { iterations: 0, residual: rnorm };
  }
  
  // z = M^{-1} * r
  for (let i = 0; i < n; i++) {
    z[i] = invDiag[i] * r[i];
  }
  
  // p = z
  for (let i = 0; i < n; i++) {
    p[i] = z[i];
  }
  
  // rz = r^T * z
  let rz = dot(r, z, n);
  
  let iter = 0;
  for (iter = 0; iter < maxIter; iter++) {
    // Ap = A * p
    csrMatVec(values, colIndices, rowPointers, n, p, Ap);
    
    // alpha = rz / (p^T * Ap)
    const pAp = dot(p, Ap, n);
    if (Math.abs(pAp) < 1e-30) break;
    const alpha = rz / pAp;
    
    // x = x + alpha * p
    // r = r - alpha * Ap
    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i];
      r[i] -= alpha * Ap[i];
    }
    
    // Check convergence
    rnorm = Math.sqrt(dot(r, r, n));
    if (rnorm < threshold) break;
    
    // z = M^{-1} * r
    for (let i = 0; i < n; i++) {
      z[i] = invDiag[i] * r[i];
    }
    
    // beta = (r_new^T * z_new) / (r_old^T * z_old)
    const rzNew = dot(r, z, n);
    const beta = rzNew / rz;
    rz = rzNew;
    
    // p = z + beta * p
    for (let i = 0; i < n; i++) {
      p[i] = z[i] + beta * p[i];
    }
  }
  
  return { iterations: iter + 1, residual: rnorm };
}

/**
 * Complete optimized FEM solve
 * Uses precomputed mesh connectivity and reusable scratch arrays
 */
export function solveFEMOptimized(
  mesh: MeshConnectivity,
  densities: Float64Array,
  forces: Float64Array,
  fixedDofs: number[],
  u: Float64Array,
  scratch: SolverScratch,
  values: Float64Array,
  penal: number = 3.0,
  Emin: number = 1e-9,
  E0: number = 1.0
): { iterations: number; residual: number } {
  // Assemble stiffness matrix
  assembleStiffnessMatrixFast(mesh, densities, penal, Emin, E0, values);
  
  // Apply boundary conditions
  const fMod = applyBoundaryConditionsFast(mesh, values, forces, fixedDofs);
  
  // Reset solution vector
  u.fill(0);
  
  // Solve
  return conjugateGradientFast(
    values,
    mesh.colIndices,
    mesh.rowPointers,
    mesh.nDofs,
    fMod,
    u,
    scratch,
    1e-8,
    10000
  );
}

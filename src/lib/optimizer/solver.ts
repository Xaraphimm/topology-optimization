/**
 * Linear system solvers for topology optimization
 * 
 * Implements Preconditioned Conjugate Gradient (PCG) method
 * which is efficient for large sparse symmetric positive definite systems
 */

import { getElementDOFs, computeElementStiffness, getTotalDOFs } from './fem';

/**
 * Sparse matrix in CSR (Compressed Sparse Row) format
 * This format is efficient for matrix-vector multiplication
 */
export interface CSRMatrix {
  values: Float64Array;     // Non-zero values
  colIndices: Int32Array;   // Column index for each value
  rowPointers: Int32Array;  // Index into values/colIndices for each row start
  n: number;                // Matrix dimension (n x n)
}

/**
 * Assemble the global stiffness matrix in CSR format
 * 
 * Uses the SIMP material interpolation: E(ρ) = E_min + ρ^p * (E_0 - E_min)
 * 
 * @param nelx - Number of elements in x
 * @param nely - Number of elements in y  
 * @param densities - Element densities (nelx * nely elements)
 * @param penal - Penalization power
 * @param Emin - Minimum stiffness (to avoid singularity)
 * @param E0 - Solid material stiffness
 * @param nu - Poisson's ratio
 */
export function assembleStiffnessMatrix(
  nelx: number,
  nely: number,
  densities: Float64Array,
  penal: number = 3.0,
  Emin: number = 1e-9,
  E0: number = 1.0,
  nu: number = 0.3
): CSRMatrix {
  const nDofs = getTotalDOFs(nelx, nely);
  const KE = computeElementStiffness(1.0, nu); // Unit stiffness matrix
  
  // First pass: count non-zeros per row (for pre-allocation)
  // Use a map to accumulate values at each (i,j) position
  const triplets: Map<number, number> = new Map();
  
  for (let elx = 0; elx < nelx; elx++) {
    for (let ely = 0; ely < nely; ely++) {
      const elemIdx = elx * nely + ely;
      const density = densities[elemIdx];
      
      // SIMP interpolation
      const Ee = Emin + Math.pow(density, penal) * (E0 - Emin);
      
      const dofs = getElementDOFs(elx, ely, nelx, nely);
      
      // Add element contributions to global matrix
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const globalI = dofs[i];
          const globalJ = dofs[j];
          const key = globalI * nDofs + globalJ;
          const val = KE[i * 8 + j] * Ee;
          
          const existing = triplets.get(key) || 0;
          triplets.set(key, existing + val);
        }
      }
    }
  }
  
  // Convert to CSR format
  // First, organize by rows
  const rowData: { col: number; val: number }[][] = Array.from({ length: nDofs }, () => []);
  
  for (const [key, val] of triplets) {
    const row = Math.floor(key / nDofs);
    const col = key % nDofs;
    if (Math.abs(val) > 1e-15) { // Skip near-zero values
      rowData[row].push({ col, val });
    }
  }
  
  // Sort each row by column index
  for (const row of rowData) {
    row.sort((a, b) => a.col - b.col);
  }
  
  // Count total non-zeros
  let nnz = 0;
  for (const row of rowData) {
    nnz += row.length;
  }
  
  // Build CSR arrays
  const values = new Float64Array(nnz);
  const colIndices = new Int32Array(nnz);
  const rowPointers = new Int32Array(nDofs + 1);
  
  let idx = 0;
  for (let i = 0; i < nDofs; i++) {
    rowPointers[i] = idx;
    for (const entry of rowData[i]) {
      values[idx] = entry.val;
      colIndices[idx] = entry.col;
      idx++;
    }
  }
  rowPointers[nDofs] = nnz;
  
  return { values, colIndices, rowPointers, n: nDofs };
}

/**
 * Sparse matrix-vector multiplication: y = A * x
 */
export function csrMatVec(A: CSRMatrix, x: Float64Array, y: Float64Array): void {
  for (let i = 0; i < A.n; i++) {
    let sum = 0;
    for (let j = A.rowPointers[i]; j < A.rowPointers[i + 1]; j++) {
      sum += A.values[j] * x[A.colIndices[j]];
    }
    y[i] = sum;
  }
}

/**
 * Dot product of two vectors
 */
export function dot(a: Float64Array, b: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Vector operations: y = a*x + b*y
 */
export function axpby(a: number, x: Float64Array, b: number, y: Float64Array): void {
  for (let i = 0; i < x.length; i++) {
    y[i] = a * x[i] + b * y[i];
  }
}

/**
 * Copy vector: y = x
 */
export function copyVec(x: Float64Array, y: Float64Array): void {
  for (let i = 0; i < x.length; i++) {
    y[i] = x[i];
  }
}

/**
 * Jacobi preconditioner: M = diag(A)
 * Returns the inverse diagonal for easy application
 */
export function jacobiPreconditioner(A: CSRMatrix): Float64Array {
  const invDiag = new Float64Array(A.n);
  
  for (let i = 0; i < A.n; i++) {
    // Find diagonal element
    for (let j = A.rowPointers[i]; j < A.rowPointers[i + 1]; j++) {
      if (A.colIndices[j] === i) {
        invDiag[i] = A.values[j] !== 0 ? 1 / A.values[j] : 1;
        break;
      }
    }
  }
  
  return invDiag;
}

/**
 * Apply Jacobi preconditioner: z = M^{-1} * r
 */
export function applyJacobi(invDiag: Float64Array, r: Float64Array, z: Float64Array): void {
  for (let i = 0; i < r.length; i++) {
    z[i] = invDiag[i] * r[i];
  }
}

/**
 * Apply boundary conditions by zeroing rows/columns and setting diagonal to 1
 * Modifies the matrix in place and returns the modified RHS
 */
export function applyBoundaryConditions(
  A: CSRMatrix,
  f: Float64Array,
  fixedDofs: number[]
): Float64Array {
  const fMod = new Float64Array(f);
  const isFixed = new Set(fixedDofs);
  
  // For each fixed DOF, zero out its row and column, set diagonal to 1
  for (const dof of fixedDofs) {
    // Zero RHS for fixed DOFs
    fMod[dof] = 0;
    
    // Zero the row (set diagonal to 1)
    for (let j = A.rowPointers[dof]; j < A.rowPointers[dof + 1]; j++) {
      if (A.colIndices[j] === dof) {
        A.values[j] = 1.0;
      } else {
        A.values[j] = 0.0;
      }
    }
  }
  
  // Zero columns of fixed DOFs and adjust RHS
  for (let i = 0; i < A.n; i++) {
    if (isFixed.has(i)) continue;
    
    for (let j = A.rowPointers[i]; j < A.rowPointers[i + 1]; j++) {
      const col = A.colIndices[j];
      if (isFixed.has(col)) {
        // This would contribute to RHS if u[col] != 0, but we enforce u[col] = 0
        A.values[j] = 0.0;
      }
    }
  }
  
  return fMod;
}

/**
 * Preconditioned Conjugate Gradient solver
 * Solves A * x = b for symmetric positive definite A
 * 
 * @param A - Sparse matrix in CSR format
 * @param b - Right-hand side vector
 * @param x0 - Initial guess (modified in place to store solution)
 * @param tol - Convergence tolerance
 * @param maxIter - Maximum iterations
 * @returns Object with solution, iterations, and final residual
 */
export function conjugateGradient(
  A: CSRMatrix,
  b: Float64Array,
  x0: Float64Array,
  tol: number = 1e-8,
  maxIter: number = 10000
): { x: Float64Array; iterations: number; residual: number } {
  const n = A.n;
  const x = x0; // Modify in place
  
  // Allocate work vectors
  const r = new Float64Array(n);   // Residual
  const z = new Float64Array(n);   // Preconditioned residual
  const p = new Float64Array(n);   // Search direction
  const Ap = new Float64Array(n);  // A * p
  
  // Compute preconditioner
  const invDiag = jacobiPreconditioner(A);
  
  // Initial residual: r = b - A*x
  csrMatVec(A, x, r);
  for (let i = 0; i < n; i++) {
    r[i] = b[i] - r[i];
  }
  
  // Check if already converged
  let rnorm = Math.sqrt(dot(r, r));
  const bnorm = Math.sqrt(dot(b, b));
  const threshold = tol * Math.max(bnorm, 1);
  
  if (rnorm < threshold) {
    return { x, iterations: 0, residual: rnorm };
  }
  
  // z = M^{-1} * r
  applyJacobi(invDiag, r, z);
  
  // p = z
  copyVec(z, p);
  
  // rz = r^T * z
  let rz = dot(r, z);
  
  let iter = 0;
  for (iter = 0; iter < maxIter; iter++) {
    // Ap = A * p
    csrMatVec(A, p, Ap);
    
    // alpha = rz / (p^T * Ap)
    const pAp = dot(p, Ap);
    if (Math.abs(pAp) < 1e-30) {
      // Matrix might be singular or p is in null space
      break;
    }
    const alpha = rz / pAp;
    
    // x = x + alpha * p
    axpby(alpha, p, 1, x);
    
    // r = r - alpha * Ap
    axpby(-alpha, Ap, 1, r);
    
    // Check convergence
    rnorm = Math.sqrt(dot(r, r));
    if (rnorm < threshold) {
      break;
    }
    
    // z = M^{-1} * r
    applyJacobi(invDiag, r, z);
    
    // beta = (r_new^T * z_new) / (r_old^T * z_old)
    const rzNew = dot(r, z);
    const beta = rzNew / rz;
    rz = rzNew;
    
    // p = z + beta * p
    for (let i = 0; i < n; i++) {
      p[i] = z[i] + beta * p[i];
    }
  }
  
  return { x, iterations: iter + 1, residual: rnorm };
}

/**
 * Solve the FEM system K*u = f with boundary conditions
 * This is the main entry point for solving the structural problem
 */
export function solveFEM(
  nelx: number,
  nely: number,
  densities: Float64Array,
  forces: Float64Array,
  fixedDofs: number[],
  penal: number = 3.0,
  Emin: number = 1e-9,
  E0: number = 1.0,
  nu: number = 0.3
): Float64Array {
  // Assemble stiffness matrix
  const K = assembleStiffnessMatrix(nelx, nely, densities, penal, Emin, E0, nu);
  
  // Apply boundary conditions
  const fMod = applyBoundaryConditions(K, forces, fixedDofs);
  
  // Initial guess (zeros)
  const u = new Float64Array(K.n);
  
  // Solve
  const result = conjugateGradient(K, fMod, u, 1e-8, 10000);
  
  return result.x;
}

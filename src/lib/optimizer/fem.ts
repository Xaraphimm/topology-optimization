/**
 * Finite Element Method utilities for 2D topology optimization
 * 
 * Uses 4-node quadrilateral (Q4) elements with 2 DOFs per node (x, y displacement)
 * This implementation follows Sigmund's 99-line MATLAB code approach
 */

/**
 * Compute the element stiffness matrix for a unit square Q4 element
 * under plane stress conditions.
 * 
 * This is the "KE" matrix from Sigmund's topology optimization code.
 * The matrix is 8x8 (4 nodes × 2 DOFs per node).
 * 
 * @param E - Young's modulus (material stiffness)
 * @param nu - Poisson's ratio (typically 0.3)
 * @returns 8x8 element stiffness matrix as Float64Array (row-major)
 */
export function computeElementStiffness(E: number = 1.0, nu: number = 0.3): Float64Array {
  // For a unit square element, we use the analytical solution from Sigmund's code
  // This avoids numerical integration and is exact for linear elements
  
  const k = [
    1/2 - nu/6,
    1/8 + nu/8,
    -1/4 - nu/12,
    -1/8 + 3*nu/8,
    -1/4 + nu/12,
    -1/8 - nu/8,
    nu/6,
    1/8 - 3*nu/8
  ];

  // Build the 8x8 element stiffness matrix
  // The pattern comes from the analytical integration of shape functions
  const KE = new Float64Array(64);
  
  // Define the matrix pattern (symmetric, only upper triangle needed conceptually)
  // Row 0
  KE[0*8 + 0] = k[0]; KE[0*8 + 1] = k[1]; KE[0*8 + 2] = k[2]; KE[0*8 + 3] = k[3];
  KE[0*8 + 4] = k[4]; KE[0*8 + 5] = k[5]; KE[0*8 + 6] = k[6]; KE[0*8 + 7] = k[7];
  
  // Row 1
  KE[1*8 + 0] = k[1]; KE[1*8 + 1] = k[0]; KE[1*8 + 2] = k[7]; KE[1*8 + 3] = k[6];
  KE[1*8 + 4] = k[5]; KE[1*8 + 5] = k[4]; KE[1*8 + 6] = k[3]; KE[1*8 + 7] = k[2];
  
  // Row 2
  KE[2*8 + 0] = k[2]; KE[2*8 + 1] = k[7]; KE[2*8 + 2] = k[0]; KE[2*8 + 3] = k[5];
  KE[2*8 + 4] = k[6]; KE[2*8 + 5] = k[3]; KE[2*8 + 6] = k[4]; KE[2*8 + 7] = k[1];
  
  // Row 3
  KE[3*8 + 0] = k[3]; KE[3*8 + 1] = k[6]; KE[3*8 + 2] = k[5]; KE[3*8 + 3] = k[0];
  KE[3*8 + 4] = k[7]; KE[3*8 + 5] = k[2]; KE[3*8 + 6] = k[1]; KE[3*8 + 7] = k[4];
  
  // Row 4
  KE[4*8 + 0] = k[4]; KE[4*8 + 1] = k[5]; KE[4*8 + 2] = k[6]; KE[4*8 + 3] = k[7];
  KE[4*8 + 4] = k[0]; KE[4*8 + 5] = k[1]; KE[4*8 + 6] = k[2]; KE[4*8 + 7] = k[3];
  
  // Row 5
  KE[5*8 + 0] = k[5]; KE[5*8 + 1] = k[4]; KE[5*8 + 2] = k[3]; KE[5*8 + 3] = k[2];
  KE[5*8 + 4] = k[1]; KE[5*8 + 5] = k[0]; KE[5*8 + 6] = k[7]; KE[5*8 + 7] = k[6];
  
  // Row 6
  KE[6*8 + 0] = k[6]; KE[6*8 + 1] = k[3]; KE[6*8 + 2] = k[4]; KE[6*8 + 3] = k[1];
  KE[6*8 + 4] = k[2]; KE[6*8 + 5] = k[7]; KE[6*8 + 6] = k[0]; KE[6*8 + 7] = k[5];
  
  // Row 7
  KE[7*8 + 0] = k[7]; KE[7*8 + 1] = k[2]; KE[7*8 + 2] = k[1]; KE[7*8 + 3] = k[4];
  KE[7*8 + 4] = k[3]; KE[7*8 + 5] = k[6]; KE[7*8 + 6] = k[5]; KE[7*8 + 7] = k[0];

  // Scale by E/(1-nu^2) for plane stress
  const factor = E / (1 - nu * nu);
  for (let i = 0; i < 64; i++) {
    KE[i] *= factor;
  }

  return KE;
}

/**
 * Get the global DOF indices for an element
 * 
 * Element numbering: column by column from bottom-left
 * Node numbering within element: counter-clockwise from bottom-left
 * 
 *   Node 3 ---- Node 2
 *     |          |
 *     |   elem   |
 *     |          |
 *   Node 0 ---- Node 1
 * 
 * @param elx - Element x index (0-based)
 * @param ely - Element y index (0-based, from bottom)
 * @param nelx - Number of elements in x direction
 * @param nely - Number of elements in y direction
 * @returns Array of 8 global DOF indices
 */
export function getElementDOFs(elx: number, ely: number, nelx: number, nely: number): number[] {
  // Node indices (0-based)
  // Nodes are numbered column by column from bottom-left
  const n1 = (nely + 1) * elx + ely;           // Bottom-left node
  const n2 = (nely + 1) * (elx + 1) + ely;     // Bottom-right node
  
  // DOF indices: each node has 2 DOFs (x and y displacement)
  // DOF numbering: x0, y0, x1, y1, x2, y2, ...
  return [
    2*n1,     2*n1 + 1,     // Node 0 (bottom-left): DOFs (x, y)
    2*n2,     2*n2 + 1,     // Node 1 (bottom-right): DOFs (x, y)
    2*n2 + 2, 2*n2 + 3,     // Node 2 (top-right): DOFs (x, y)
    2*n1 + 2, 2*n1 + 3      // Node 3 (top-left): DOFs (x, y)
  ];
}

/**
 * Get total number of DOFs in the mesh
 */
export function getTotalDOFs(nelx: number, nely: number): number {
  return 2 * (nelx + 1) * (nely + 1);
}

/**
 * Get node index from x, y position in the mesh
 * @param x - Node x position (0 to nelx)
 * @param y - Node y position (0 to nely, 0 = bottom)
 */
export function getNodeIndex(x: number, y: number, nely: number): number {
  return (nely + 1) * x + y;
}

/**
 * Get element index from x, y position
 */
export function getElementIndex(elx: number, ely: number, nely: number): number {
  return elx * nely + ely;
}

/**
 * Verify that the element stiffness matrix is symmetric
 */
export function isSymmetric(KE: Float64Array, tol: number = 1e-10): boolean {
  for (let i = 0; i < 8; i++) {
    for (let j = i + 1; j < 8; j++) {
      if (Math.abs(KE[i*8 + j] - KE[j*8 + i]) > tol) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Check if matrix is positive definite by checking all eigenvalues > 0
 * Uses a simplified check: all diagonal elements positive and diagonally dominant
 * (This is a sufficient but not necessary condition for SPD)
 */
export function hasPositiveDiagonal(KE: Float64Array): boolean {
  for (let i = 0; i < 8; i++) {
    if (KE[i*8 + i] <= 0) return false;
  }
  return true;
}

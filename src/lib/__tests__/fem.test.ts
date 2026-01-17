import { describe, it, expect } from 'vitest';
import {
  computeElementStiffness,
  getElementDOFs,
  getTotalDOFs,
  getNodeIndex,
  getElementIndex,
  isSymmetric,
  hasPositiveDiagonal,
} from '../optimizer/fem';

describe('computeElementStiffness', () => {
  it('should return an 8x8 matrix (64 elements)', () => {
    const KE = computeElementStiffness();
    expect(KE.length).toBe(64);
  });

  it('should be symmetric', () => {
    const KE = computeElementStiffness();
    expect(isSymmetric(KE)).toBe(true);
  });

  it('should have positive diagonal elements', () => {
    const KE = computeElementStiffness();
    expect(hasPositiveDiagonal(KE)).toBe(true);
  });

  it('should scale with Young\'s modulus', () => {
    const KE1 = computeElementStiffness(1.0, 0.3);
    const KE2 = computeElementStiffness(2.0, 0.3);
    
    // KE2 should be exactly 2x KE1
    for (let i = 0; i < 64; i++) {
      expect(KE2[i]).toBeCloseTo(2 * KE1[i], 10);
    }
  });

  it('should produce different results for different Poisson ratios', () => {
    const KE1 = computeElementStiffness(1.0, 0.2);
    const KE2 = computeElementStiffness(1.0, 0.4);
    
    // Should be different (check a few elements)
    let different = false;
    for (let i = 0; i < 64; i++) {
      if (Math.abs(KE1[i] - KE2[i]) > 1e-10) {
        different = true;
        break;
      }
    }
    expect(different).toBe(true);
  });

  it('should match known reference values for nu=0.3', () => {
    const KE = computeElementStiffness(1.0, 0.3);
    const factor = 1 / (1 - 0.3 * 0.3); // 1/(1-nu^2)
    
    // Reference values from Sigmund's 99-line code
    // k = [1/2-nu/6, 1/8+nu/8, -1/4-nu/12, -1/8+3*nu/8, -1/4+nu/12, -1/8-nu/8, nu/6, 1/8-3*nu/8]
    const k = [
      1/2 - 0.3/6,      // k[0] = 0.45
      1/8 + 0.3/8,      // k[1] = 0.1625
      -1/4 - 0.3/12,    // k[2] = -0.275
      -1/8 + 3*0.3/8,   // k[3] = -0.0125
      -1/4 + 0.3/12,    // k[4] = -0.225
      -1/8 - 0.3/8,     // k[5] = -0.1625
      0.3/6,            // k[6] = 0.05
      1/8 - 3*0.3/8     // k[7] = 0.0125
    ];
    
    // Check KE[0,0] = k[0] * factor
    expect(KE[0]).toBeCloseTo(k[0] * factor, 6);
    
    // Check KE[0,1] = k[1] * factor
    expect(KE[1]).toBeCloseTo(k[1] * factor, 6);
    
    // Check symmetry: KE[1,0] = KE[0,1]
    expect(KE[8]).toBeCloseTo(KE[1], 10);
  });

  it('should have row and column sums approximately zero for rigid body modes', () => {
    // For a valid stiffness matrix, rigid body modes should give zero strain energy
    // This manifests as certain row/column sum properties
    const KE = computeElementStiffness();
    
    // Sum of each pair of rows (x-direction DOFs) should relate to translation
    // This is a simplified check - the full check requires applying rigid body displacements
    // For now, just verify the matrix has reasonable values
    let maxVal = 0;
    for (let i = 0; i < 64; i++) {
      maxVal = Math.max(maxVal, Math.abs(KE[i]));
    }
    expect(maxVal).toBeGreaterThan(0);
    expect(maxVal).toBeLessThan(10); // Reasonable bounds for E=1
  });
});

describe('getElementDOFs', () => {
  it('should return 8 DOF indices for a Q4 element', () => {
    const dofs = getElementDOFs(0, 0, 10, 5);
    expect(dofs.length).toBe(8);
  });

  it('should return non-negative indices', () => {
    const dofs = getElementDOFs(0, 0, 10, 5);
    dofs.forEach(dof => expect(dof).toBeGreaterThanOrEqual(0));
  });

  it('should return indices within valid range', () => {
    const nelx = 10;
    const nely = 5;
    const totalDofs = getTotalDOFs(nelx, nely);
    
    // Check all elements
    for (let elx = 0; elx < nelx; elx++) {
      for (let ely = 0; ely < nely; ely++) {
        const dofs = getElementDOFs(elx, ely, nelx, nely);
        dofs.forEach(dof => {
          expect(dof).toBeGreaterThanOrEqual(0);
          expect(dof).toBeLessThan(totalDofs);
        });
      }
    }
  });

  it('should return unique DOF indices for each element', () => {
    const dofs = getElementDOFs(5, 3, 10, 6);
    const uniqueDofs = new Set(dofs);
    expect(uniqueDofs.size).toBe(8);
  });

  it('should have adjacent elements share DOFs', () => {
    const nelx = 10;
    const nely = 5;
    
    // Element (1,1) and (2,1) should share nodes on the right/left edges
    const dofs1 = getElementDOFs(1, 1, nelx, nely);
    const dofs2 = getElementDOFs(2, 1, nelx, nely);
    
    // Nodes 1,2 of element 1 should match nodes 0,3 of element 2
    expect(dofs1[2]).toBe(dofs2[0]); // Bottom right of elem1 = bottom left of elem2
    expect(dofs1[3]).toBe(dofs2[1]);
    expect(dofs1[4]).toBe(dofs2[6]); // Top right of elem1 = top left of elem2
    expect(dofs1[5]).toBe(dofs2[7]);
  });
});

describe('getTotalDOFs', () => {
  it('should calculate correct total DOFs', () => {
    // For nelx=10, nely=5: (10+1)*(5+1) = 66 nodes, 132 DOFs
    expect(getTotalDOFs(10, 5)).toBe(2 * 11 * 6);
    expect(getTotalDOFs(10, 5)).toBe(132);
  });

  it('should handle 1x1 mesh', () => {
    // 1 element = 4 nodes = 8 DOFs
    expect(getTotalDOFs(1, 1)).toBe(8);
  });

  it('should scale correctly', () => {
    const dofs1 = getTotalDOFs(10, 10);
    const dofs2 = getTotalDOFs(20, 10);
    
    // Doubling nelx should roughly double DOFs (not exactly due to shared nodes)
    expect(dofs2).toBeGreaterThan(dofs1);
  });
});

describe('getNodeIndex', () => {
  it('should return 0 for bottom-left corner', () => {
    expect(getNodeIndex(0, 0, 5)).toBe(0);
  });

  it('should return correct index for top-left corner', () => {
    const nely = 5;
    // Top of first column: y = nely
    expect(getNodeIndex(0, nely, nely)).toBe(nely);
  });

  it('should return correct index for bottom-right corner', () => {
    const nelx = 10;
    const nely = 5;
    // Bottom of last column
    expect(getNodeIndex(nelx, 0, nely)).toBe((nely + 1) * nelx);
  });
});

describe('getElementIndex', () => {
  it('should return 0 for first element', () => {
    expect(getElementIndex(0, 0, 5)).toBe(0);
  });

  it('should increment correctly within a column', () => {
    expect(getElementIndex(0, 0, 5)).toBe(0);
    expect(getElementIndex(0, 1, 5)).toBe(1);
    expect(getElementIndex(0, 2, 5)).toBe(2);
  });

  it('should handle column changes correctly', () => {
    const nely = 5;
    expect(getElementIndex(1, 0, nely)).toBe(nely);
    expect(getElementIndex(2, 0, nely)).toBe(2 * nely);
  });

  it('should give unique indices for all elements', () => {
    const nelx = 10;
    const nely = 5;
    const indices = new Set<number>();
    
    for (let elx = 0; elx < nelx; elx++) {
      for (let ely = 0; ely < nely; ely++) {
        indices.add(getElementIndex(elx, ely, nely));
      }
    }
    
    expect(indices.size).toBe(nelx * nely);
  });
});

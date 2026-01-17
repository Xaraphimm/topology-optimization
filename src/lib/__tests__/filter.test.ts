import { describe, it, expect } from 'vitest';
import {
  prepareFilter,
  applySensitivityFilter,
  applyDensityFilter,
  verifyFilterWeights,
  getNeighborCounts,
  FilterData,
} from '../optimizer/filter';

describe('prepareFilter', () => {
  it('should create filter data for a simple mesh', () => {
    const filter = prepareFilter(3, 2, 1.5);
    
    expect(filter.nelx).toBe(3);
    expect(filter.nely).toBe(2);
    expect(filter.rmin).toBe(1.5);
    expect(filter.neighborIndices.length).toBe(6); // 3*2 elements
    expect(filter.neighborWeights.length).toBe(6);
  });

  it('should have weights that sum to 1 for each element', () => {
    const filter = prepareFilter(5, 4, 2.0);
    expect(verifyFilterWeights(filter)).toBe(true);
  });

  it('should include the element itself as a neighbor', () => {
    const filter = prepareFilter(3, 3, 1.0);
    
    // Central element (index 4 in a 3x3 mesh with column-major ordering)
    // Column-major: element (1,1) = 1*3 + 1 = 4
    const centralElem = 1 * 3 + 1;
    const neighbors = filter.neighborIndices[centralElem];
    
    // The element should include itself
    let includesSelf = false;
    for (let i = 0; i < neighbors.length; i++) {
      if (neighbors[i] === centralElem) {
        includesSelf = true;
        break;
      }
    }
    expect(includesSelf).toBe(true);
  });

  it('should have more neighbors for interior elements than corner elements', () => {
    const filter = prepareFilter(5, 5, 2.0);
    const counts = getNeighborCounts(filter);
    
    // Corner element (0,0) = index 0
    const cornerCount = counts[0];
    
    // Interior element (2,2) = 2*5 + 2 = 12
    const interiorCount = counts[12];
    
    expect(interiorCount).toBeGreaterThan(cornerCount);
  });

  it('should have exactly 1 neighbor when rmin is very small', () => {
    // With rmin = 0.1, only the element itself should be included
    const filter = prepareFilter(3, 3, 0.1);
    const counts = getNeighborCounts(filter);
    
    for (let i = 0; i < counts.length; i++) {
      expect(counts[i]).toBe(1); // Only self
    }
  });

  it('should have more neighbors with larger rmin', () => {
    const filter1 = prepareFilter(5, 5, 1.5);
    const filter2 = prepareFilter(5, 5, 3.0);
    
    const counts1 = getNeighborCounts(filter1);
    const counts2 = getNeighborCounts(filter2);
    
    // Sum of neighbors should be larger for larger rmin
    const sum1 = counts1.reduce((a, b) => a + b, 0);
    const sum2 = counts2.reduce((a, b) => a + b, 0);
    
    expect(sum2).toBeGreaterThan(sum1);
  });
});

describe('applyDensityFilter', () => {
  it('should return the same values when all densities are equal', () => {
    const filter = prepareFilter(3, 3, 1.5);
    const densities = new Float64Array(9).fill(0.5);
    
    const filtered = applyDensityFilter(filter, densities);
    
    // All values should remain 0.5 (since weighted average of 0.5 is 0.5)
    for (let i = 0; i < filtered.length; i++) {
      expect(filtered[i]).toBeCloseTo(0.5, 10);
    }
  });

  it('should smooth out a single high-density element', () => {
    const filter = prepareFilter(5, 5, 2.0);
    const densities = new Float64Array(25).fill(0);
    
    // Set central element to 1
    const centerIdx = 2 * 5 + 2; // (2,2)
    densities[centerIdx] = 1.0;
    
    const filtered = applyDensityFilter(filter, densities);
    
    // Central element should be reduced (spread to neighbors)
    expect(filtered[centerIdx]).toBeLessThan(1.0);
    expect(filtered[centerIdx]).toBeGreaterThan(0.0);
    
    // Neighbors should have increased from 0
    const neighborIdx = 2 * 5 + 1; // (2,1)
    expect(filtered[neighborIdx]).toBeGreaterThan(0);
  });

  it('should preserve total mass (sum of densities)', () => {
    const filter = prepareFilter(4, 4, 1.5);
    const densities = new Float64Array(16);
    
    // Random-ish pattern
    for (let i = 0; i < 16; i++) {
      densities[i] = (i % 3) / 3 + 0.1;
    }
    
    const filtered = applyDensityFilter(filter, densities);
    
    // Sum should be approximately preserved (not exactly due to boundary effects)
    const sumBefore = densities.reduce((a, b) => a + b, 0);
    const sumAfter = filtered.reduce((a, b) => a + b, 0);
    
    // Should be close (within 5% for this test)
    expect(Math.abs(sumAfter - sumBefore) / sumBefore).toBeLessThan(0.05);
  });

  it('should not change a uniform field', () => {
    const filter = prepareFilter(6, 4, 2.5);
    const densities = new Float64Array(24).fill(0.7);
    
    const filtered = applyDensityFilter(filter, densities);
    
    for (let i = 0; i < 24; i++) {
      expect(filtered[i]).toBeCloseTo(0.7, 10);
    }
  });
});

describe('applySensitivityFilter', () => {
  it('should return the same values when all are equal', () => {
    const filter = prepareFilter(3, 3, 1.5);
    const densities = new Float64Array(9).fill(1.0);
    const sensitivities = new Float64Array(9).fill(-5.0);
    
    const filtered = applySensitivityFilter(filter, densities, sensitivities);
    
    // Should return approximately the same value
    for (let i = 0; i < filtered.length; i++) {
      expect(filtered[i]).toBeCloseTo(-5.0, 6);
    }
  });

  it('should smooth sensitivity gradients', () => {
    const filter = prepareFilter(5, 1, 2.0);
    const densities = new Float64Array(5).fill(1.0);
    
    // Sharp gradient in sensitivities
    const sensitivities = new Float64Array([0, 0, -10, 0, 0]);
    
    const filtered = applySensitivityFilter(filter, densities, sensitivities);
    
    // Central sensitivity should be reduced
    expect(Math.abs(filtered[2])).toBeLessThan(10);
    
    // Neighbors should have increased (in magnitude)
    expect(Math.abs(filtered[1])).toBeGreaterThan(0);
    expect(Math.abs(filtered[3])).toBeGreaterThan(0);
  });

  it('should handle low-density elements gracefully', () => {
    const filter = prepareFilter(3, 3, 1.5);
    
    // Some very low densities
    const densities = new Float64Array(9);
    densities.fill(0.001);
    densities[4] = 1.0; // Center is full
    
    const sensitivities = new Float64Array(9).fill(-1);
    
    // Should not throw or produce NaN
    const filtered = applySensitivityFilter(filter, densities, sensitivities);
    
    for (let i = 0; i < filtered.length; i++) {
      expect(Number.isFinite(filtered[i])).toBe(true);
    }
  });
});

describe('getNeighborCounts', () => {
  it('should return correct array length', () => {
    const filter = prepareFilter(4, 3, 1.5);
    const counts = getNeighborCounts(filter);
    
    expect(counts.length).toBe(12); // 4 * 3
  });

  it('should have at least 1 neighbor for every element', () => {
    const filter = prepareFilter(10, 8, 1.5);
    const counts = getNeighborCounts(filter);
    
    for (let i = 0; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(1);
    }
  });

  it('should have symmetric neighbor counts for symmetric positions', () => {
    const filter = prepareFilter(5, 5, 2.0);
    const counts = getNeighborCounts(filter);
    
    // Corners should have same count
    expect(counts[0]).toBe(counts[4]); // (0,0) vs (0,4)
    expect(counts[0]).toBe(counts[20]); // (0,0) vs (4,0)
    expect(counts[0]).toBe(counts[24]); // (0,0) vs (4,4)
  });
});

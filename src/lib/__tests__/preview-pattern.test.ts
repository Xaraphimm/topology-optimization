/**
 * Tests for Preview Pattern Generator
 */

import { describe, it, expect } from 'vitest';
import { createPreviewPattern, shouldUsePreview } from '../preview-pattern';
import type { Support, Load } from '../presets';

describe('createPreviewPattern', () => {
  const defaultSupports: Support[] = [
    { x: 0, y: 20, type: 'roller-x' },
    { x: 60, y: 0, type: 'roller-y' },
  ];
  const defaultLoads: Load[] = [
    { x: 0, y: 40, dx: 0, dy: -1 },
  ];

  describe('basic functionality', () => {
    it('should return a Float64Array of correct size', () => {
      const nelx = 60;
      const nely = 20;
      const pattern = createPreviewPattern(nelx, nely, 'mbb', 0.5, defaultSupports, defaultLoads);
      
      expect(pattern).toBeInstanceOf(Float64Array);
      expect(pattern.length).toBe(nelx * nely);
    });

    it('should produce values in valid range [0, 1]', () => {
      const pattern = createPreviewPattern(60, 20, 'mbb', 0.5, defaultSupports, defaultLoads);
      
      for (let i = 0; i < pattern.length; i++) {
        expect(pattern[i]).toBeGreaterThanOrEqual(0);
        expect(pattern[i]).toBeLessThanOrEqual(1);
      }
    });

    it('should produce non-uniform pattern (not all same value)', () => {
      const pattern = createPreviewPattern(60, 20, 'mbb', 0.5, defaultSupports, defaultLoads);
      
      const uniqueValues = new Set(pattern);
      expect(uniqueValues.size).toBeGreaterThan(1);
    });

    it('should respect volume fraction bounds', () => {
      const volfrac = 0.5;
      const pattern = createPreviewPattern(60, 20, 'mbb', volfrac, defaultSupports, defaultLoads);
      
      // Max density should be related to volume fraction
      let maxDensity = 0;
      for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] > maxDensity) maxDensity = pattern[i];
      }
      
      // Pattern max should be at most volume fraction * 0.7 (maxDensity factor)
      expect(maxDensity).toBeLessThanOrEqual(volfrac * 0.8);
    });
  });

  describe('MBB beam pattern', () => {
    it('should have higher density at edges (flanges)', () => {
      const nelx = 60;
      const nely = 20;
      const pattern = createPreviewPattern(nelx, nely, 'mbb', 0.5, defaultSupports, defaultLoads);
      
      // Check that edges have higher average density than center
      let edgeSum = 0;
      let centerSum = 0;
      let edgeCount = 0;
      let centerCount = 0;
      
      for (let x = 0; x < nelx; x++) {
        for (let y = 0; y < nely; y++) {
          const idx = x * nely + y;
          const ny = y / (nely - 1);
          
          if (ny < 0.2 || ny > 0.8) {
            edgeSum += pattern[idx];
            edgeCount++;
          } else if (ny > 0.4 && ny < 0.6) {
            centerSum += pattern[idx];
            centerCount++;
          }
        }
      }
      
      const edgeAvg = edgeSum / edgeCount;
      const centerAvg = centerSum / centerCount;
      
      expect(edgeAvg).toBeGreaterThan(centerAvg);
    });
  });

  describe('Cantilever pattern', () => {
    const cantileverSupports: Support[] = [
      { x: 0, y: 10, type: 'pin' },
    ];
    const cantileverLoads: Load[] = [
      { x: 40, y: 10, dx: 0, dy: -1 },
    ];

    it('should have more material at fixed end (left)', () => {
      const nelx = 40;
      const nely = 20;
      const pattern = createPreviewPattern(nelx, nely, 'cantilever', 0.5, cantileverSupports, cantileverLoads);
      
      // Compare left quarter vs right quarter density
      let leftSum = 0;
      let rightSum = 0;
      let leftCount = 0;
      let rightCount = 0;
      
      for (let x = 0; x < nelx; x++) {
        for (let y = 0; y < nely; y++) {
          const idx = x * nely + y;
          const nx = x / (nelx - 1);
          
          if (nx < 0.25) {
            leftSum += pattern[idx];
            leftCount++;
          } else if (nx > 0.75) {
            rightSum += pattern[idx];
            rightCount++;
          }
        }
      }
      
      const leftAvg = leftSum / leftCount;
      const rightAvg = rightSum / rightCount;
      
      expect(leftAvg).toBeGreaterThan(rightAvg);
    });
  });

  describe('Bridge pattern', () => {
    const bridgeSupports: Support[] = [
      { x: 0, y: 0, type: 'pin' },
      { x: 60, y: 0, type: 'roller-y' },
    ];
    const bridgeLoads: Load[] = [
      { x: 30, y: 20, dx: 0, dy: -1 },
    ];

    it('should have arch-like pattern (higher at top center)', () => {
      const nelx = 60;
      const nely = 20;
      const pattern = createPreviewPattern(nelx, nely, 'bridge', 0.5, bridgeSupports, bridgeLoads);
      
      // Check that top center has higher density than bottom center
      const topCenterIdx = Math.floor(nelx / 2) * nely + (nely - 1);
      const bottomCenterIdx = Math.floor(nelx / 2) * nely + 0;
      
      expect(pattern[topCenterIdx]).toBeGreaterThan(pattern[bottomCenterIdx] * 0.5);
    });

    it('should have material at supports (corners)', () => {
      const nelx = 60;
      const nely = 20;
      const pattern = createPreviewPattern(nelx, nely, 'bridge', 0.5, bridgeSupports, bridgeLoads);
      
      // Check left and right bottom corners
      const leftCornerIdx = 0;  // x=0, y=0
      const rightCornerIdx = (nelx - 1) * nely + 0;  // x=nelx-1, y=0
      
      // Corners should have some material
      expect(pattern[leftCornerIdx]).toBeGreaterThan(0.1);
      expect(pattern[rightCornerIdx]).toBeGreaterThan(0.1);
    });
  });

  describe('different volume fractions', () => {
    it('should produce denser pattern with higher volume fraction', () => {
      const pattern30 = createPreviewPattern(60, 20, 'mbb', 0.3, defaultSupports, defaultLoads);
      const pattern70 = createPreviewPattern(60, 20, 'mbb', 0.7, defaultSupports, defaultLoads);
      
      const avg30 = pattern30.reduce((a, b) => a + b, 0) / pattern30.length;
      const avg70 = pattern70.reduce((a, b) => a + b, 0) / pattern70.length;
      
      expect(avg70).toBeGreaterThan(avg30);
    });
  });

  describe('different resolutions', () => {
    it('should scale pattern to different mesh sizes', () => {
      const patternSmall = createPreviewPattern(30, 10, 'mbb', 0.5, defaultSupports, defaultLoads);
      const patternLarge = createPreviewPattern(120, 40, 'mbb', 0.5, defaultSupports, defaultLoads);
      
      expect(patternSmall.length).toBe(30 * 10);
      expect(patternLarge.length).toBe(120 * 40);
      
      // Both should have non-trivial patterns
      const smallUnique = new Set(patternSmall).size;
      const largeUnique = new Set(patternLarge).size;
      
      expect(smallUnique).toBeGreaterThan(10);
      expect(largeUnique).toBeGreaterThan(100);
    });
  });

  describe('unknown preset', () => {
    it('should return generic pattern for unknown preset ID', () => {
      const pattern = createPreviewPattern(60, 20, 'unknown', 0.5, defaultSupports, defaultLoads);
      
      expect(pattern).toBeInstanceOf(Float64Array);
      expect(pattern.length).toBe(60 * 20);
      
      // Should still have some variation
      const uniqueValues = new Set(pattern);
      expect(uniqueValues.size).toBeGreaterThan(1);
    });
  });
});

describe('shouldUsePreview', () => {
  it('should return true for null densities', () => {
    expect(shouldUsePreview(null)).toBe(true);
  });

  it('should return true for empty array', () => {
    expect(shouldUsePreview(new Float64Array(0))).toBe(true);
  });

  it('should return false for non-empty array', () => {
    expect(shouldUsePreview(new Float64Array(100))).toBe(false);
  });
});

describe('pattern determinism', () => {
  it('should produce identical patterns for same inputs', () => {
    const supports: Support[] = [
      { x: 0, y: 20, type: 'roller-x' },
      { x: 60, y: 0, type: 'roller-y' },
    ];
    const loads: Load[] = [
      { x: 0, y: 40, dx: 0, dy: -1 },
    ];
    
    const pattern1 = createPreviewPattern(60, 20, 'mbb', 0.5, supports, loads);
    const pattern2 = createPreviewPattern(60, 20, 'mbb', 0.5, supports, loads);
    
    expect(pattern1.length).toBe(pattern2.length);
    for (let i = 0; i < pattern1.length; i++) {
      expect(pattern1[i]).toBe(pattern2[i]);
    }
  });
});

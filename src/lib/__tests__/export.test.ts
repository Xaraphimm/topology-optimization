/**
 * Comprehensive tests for the export module
 * 
 * Tests cover:
 * - Upsampling (bilinear, bicubic, nearest neighbor)
 * - Marching Squares contour extraction
 * - SVG generation
 * - Data validation
 */

import { describe, it, expect } from 'vitest';
import {
  upsampleDensities,
  sampleDensity,
  calculateGradient,
  type InterpolationMethod,
} from '../export/upsampling';
import {
  extractContours,
  smoothContour,
  generateSVG,
  type SVGExportOptions,
} from '../export/svg-export';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a simple test pattern (vertical split: left=0, right=1)
 */
function createVerticalSplitPattern(nelx: number, nely: number): Float64Array {
  const densities = new Float64Array(nelx * nely);
  const midX = Math.floor(nelx / 2);
  
  for (let x = 0; x < nelx; x++) {
    for (let y = 0; y < nely; y++) {
      const idx = x * nely + y;
      densities[idx] = x < midX ? 0 : 1;
    }
  }
  
  return densities;
}

/**
 * Create a horizontal split pattern (bottom=0, top=1)
 */
function createHorizontalSplitPattern(nelx: number, nely: number): Float64Array {
  const densities = new Float64Array(nelx * nely);
  const midY = Math.floor(nely / 2);
  
  for (let x = 0; x < nelx; x++) {
    for (let y = 0; y < nely; y++) {
      const idx = x * nely + y;
      densities[idx] = y < midY ? 0 : 1;
    }
  }
  
  return densities;
}

/**
 * Create a circular pattern (center=1, edges=0)
 */
function createCircularPattern(nelx: number, nely: number, radius: number = 0.35): Float64Array {
  const densities = new Float64Array(nelx * nely);
  const cx = nelx / 2;
  const cy = nely / 2;
  const r = Math.min(nelx, nely) * radius;
  
  for (let x = 0; x < nelx; x++) {
    for (let y = 0; y < nely; y++) {
      const idx = x * nely + y;
      const dist = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2);
      densities[idx] = dist < r ? 1 : 0;
    }
  }
  
  return densities;
}

/**
 * Create a uniform density field
 */
function createUniformPattern(nelx: number, nely: number, value: number): Float64Array {
  const densities = new Float64Array(nelx * nely);
  densities.fill(value);
  return densities;
}

/**
 * Create a gradient pattern (0 at left, 1 at right)
 */
function createGradientPattern(nelx: number, nely: number): Float64Array {
  const densities = new Float64Array(nelx * nely);
  
  for (let x = 0; x < nelx; x++) {
    for (let y = 0; y < nely; y++) {
      const idx = x * nely + y;
      densities[idx] = x / (nelx - 1);
    }
  }
  
  return densities;
}

// ============================================================================
// Upsampling Tests
// ============================================================================

describe('Upsampling', () => {
  describe('upsampleDensities', () => {
    it('should increase resolution by scale factor', () => {
      const densities = createUniformPattern(10, 5, 0.5);
      const { data, width, height } = upsampleDensities(densities, 10, 5, { scale: 2 });
      
      expect(width).toBe(20);
      expect(height).toBe(10);
      expect(data.length).toBe(200);
    });

    it('should preserve uniform density with all interpolation methods', () => {
      const methods: InterpolationMethod[] = ['nearest', 'bilinear', 'bicubic'];
      
      for (const method of methods) {
        const densities = createUniformPattern(10, 5, 0.7);
        const { data } = upsampleDensities(densities, 10, 5, { scale: 4, method });
        
        // All values should be close to 0.7
        for (let i = 0; i < data.length; i++) {
          expect(data[i]).toBeCloseTo(0.7, 4);
        }
      }
    });

    it('should throw error for invalid scale', () => {
      const densities = createUniformPattern(10, 5, 0.5);
      expect(() => upsampleDensities(densities, 10, 5, { scale: 0 })).toThrow();
    });

    it('should throw error for mismatched dimensions', () => {
      const densities = createUniformPattern(10, 5, 0.5);
      expect(() => upsampleDensities(densities, 20, 10)).toThrow();
    });
  });

  describe('Nearest neighbor interpolation', () => {
    it('should preserve sharp edges', () => {
      const densities = createVerticalSplitPattern(10, 5);
      const { data, width, height } = upsampleDensities(densities, 10, 5, {
        scale: 2,
        method: 'nearest',
      });
      
      // Check that each upsampled pixel matches its source
      // Left half should be 0, right half should be 1
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          const srcX = Math.floor(x / 2);
          const expected = srcX < 5 ? 0 : 1;
          expect(data[x * height + y]).toBe(expected);
        }
      }
    });
  });

  describe('Bilinear interpolation', () => {
    it('should produce smooth gradients', () => {
      const densities = createVerticalSplitPattern(10, 5);
      const { data, width, height } = upsampleDensities(densities, 10, 5, {
        scale: 4,
        method: 'bilinear',
      });
      
      // Check for intermediate values near the boundary
      const boundaryX = Math.floor(width / 2);
      let hasIntermediate = false;
      
      for (let y = 0; y < height; y++) {
        const value = data[boundaryX * height + y];
        if (value > 0.01 && value < 0.99) {
          hasIntermediate = true;
          break;
        }
      }
      
      expect(hasIntermediate).toBe(true);
    });

    it('should produce values in [0, 1] range', () => {
      const densities = createGradientPattern(10, 5);
      const { data } = upsampleDensities(densities, 10, 5, {
        scale: 4,
        method: 'bilinear',
      });
      
      for (let i = 0; i < data.length; i++) {
        expect(data[i]).toBeGreaterThanOrEqual(0);
        expect(data[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Bicubic interpolation', () => {
    it('should produce smoother results than bilinear', () => {
      const densities = createGradientPattern(10, 5);
      
      const bilinear = upsampleDensities(densities, 10, 5, {
        scale: 4,
        method: 'bilinear',
      });
      
      const bicubic = upsampleDensities(densities, 10, 5, {
        scale: 4,
        method: 'bicubic',
      });
      
      // Calculate smoothness (sum of squared differences between adjacent pixels)
      const calcSmoothness = (data: Float64Array, w: number, h: number) => {
        let sum = 0;
        for (let x = 1; x < w; x++) {
          for (let y = 0; y < h; y++) {
            const diff = data[x * h + y] - data[(x - 1) * h + y];
            sum += diff * diff;
          }
        }
        return sum;
      };
      
      const smoothnessBilinear = calcSmoothness(bilinear.data, bilinear.width, bilinear.height);
      const smoothnessBicubic = calcSmoothness(bicubic.data, bicubic.width, bicubic.height);
      
      // Bicubic should be at least as smooth as bilinear
      expect(smoothnessBicubic).toBeLessThanOrEqual(smoothnessBilinear * 1.1);
    });

    it('should clamp output values to [0, 1]', () => {
      const densities = createCircularPattern(10, 5);
      const { data } = upsampleDensities(densities, 10, 5, {
        scale: 4,
        method: 'bicubic',
      });
      
      for (let i = 0; i < data.length; i++) {
        expect(data[i]).toBeGreaterThanOrEqual(0);
        expect(data[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('sampleDensity', () => {
    it('should return exact values at integer coordinates', () => {
      const densities = createGradientPattern(10, 5);
      
      for (let x = 0; x < 10; x++) {
        const value = sampleDensity(densities, 10, 5, x, 2, 'nearest');
        expect(value).toBeCloseTo(x / 9, 4);
      }
    });

    it('should interpolate between values', () => {
      const densities = createVerticalSplitPattern(10, 5);
      
      // Sample at the boundary (x=4.5)
      const value = sampleDensity(densities, 10, 5, 4.5, 2, 'bilinear');
      
      // Should be between 0 and 1
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(1);
    });
  });

  describe('calculateGradient', () => {
    it('should detect horizontal density change', () => {
      const densities = createVerticalSplitPattern(10, 5);
      
      // At the boundary (x=4.5)
      const [dx, dy] = calculateGradient(densities, 10, 5, 4.5, 2);
      
      // Should have strong horizontal gradient
      expect(Math.abs(dx)).toBeGreaterThan(0.1);
      // Vertical gradient should be small
      expect(Math.abs(dy)).toBeLessThan(Math.abs(dx));
    });

    it('should detect vertical density change', () => {
      const densities = createHorizontalSplitPattern(10, 5);
      
      // At the boundary (y=2)
      const [dx, dy] = calculateGradient(densities, 10, 5, 5, 2);
      
      // Should have strong vertical gradient
      expect(Math.abs(dy)).toBeGreaterThan(0.1);
      // Horizontal gradient should be small
      expect(Math.abs(dx)).toBeLessThan(Math.abs(dy));
    });

    it('should return near-zero gradient for uniform field', () => {
      const densities = createUniformPattern(10, 5, 0.5);
      
      const [dx, dy] = calculateGradient(densities, 10, 5, 5, 2);
      
      expect(Math.abs(dx)).toBeLessThan(0.01);
      expect(Math.abs(dy)).toBeLessThan(0.01);
    });
  });
});

// ============================================================================
// Marching Squares Tests
// ============================================================================

describe('Marching Squares Contour Extraction', () => {
  describe('extractContours', () => {
    it('should extract a single contour for simple split pattern', () => {
      const densities = createVerticalSplitPattern(10, 5);
      const contours = extractContours(densities, 10, 5, 0.5);
      
      // Should have at least one contour
      expect(contours.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract closed contour for circular pattern', () => {
      const densities = createCircularPattern(20, 20, 0.3);
      const contours = extractContours(densities, 20, 20, 0.5);
      
      // Should have at least one contour
      expect(contours.length).toBeGreaterThanOrEqual(1);
      
      // All contours should have multiple points
      for (const contour of contours) {
        expect(contour.length).toBeGreaterThan(3);
      }
      
      // Total points across all contours should form a circle-ish shape
      const totalPoints = contours.reduce((sum, c) => sum + c.length, 0);
      expect(totalPoints).toBeGreaterThan(10);
    });

    it('should return empty for uniform pattern above threshold', () => {
      const densities = createUniformPattern(10, 5, 1.0);
      const contours = extractContours(densities, 10, 5, 0.5);
      
      expect(contours.length).toBe(0);
    });

    it('should return empty for uniform pattern below threshold', () => {
      const densities = createUniformPattern(10, 5, 0.0);
      const contours = extractContours(densities, 10, 5, 0.5);
      
      expect(contours.length).toBe(0);
    });

    it('should respect threshold parameter', () => {
      const densities = createGradientPattern(10, 5);
      
      const contours25 = extractContours(densities, 10, 5, 0.25);
      const contours75 = extractContours(densities, 10, 5, 0.75);
      
      // Both should produce contours
      expect(contours25.length).toBeGreaterThan(0);
      expect(contours75.length).toBeGreaterThan(0);
    });

    it('should produce contour points within domain bounds', () => {
      const densities = createCircularPattern(20, 20);
      const contours = extractContours(densities, 20, 20, 0.5);
      
      for (const contour of contours) {
        for (const point of contour) {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(20);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(20);
        }
      }
    });
  });

  describe('smoothContour', () => {
    it('should increase number of points', () => {
      const densities = createCircularPattern(20, 20);
      const contours = extractContours(densities, 20, 20, 0.5);
      
      if (contours.length > 0) {
        const original = contours[0];
        const smoothed = smoothContour(original, 4);
        
        // Smoothed should have more points
        expect(smoothed.length).toBeGreaterThan(original.length);
      }
    });

    it('should produce valid coordinates', () => {
      const densities = createCircularPattern(20, 20);
      const contours = extractContours(densities, 20, 20, 0.5);
      
      if (contours.length > 0) {
        const smoothed = smoothContour(contours[0], 4);
        
        for (const point of smoothed) {
          expect(isFinite(point.x)).toBe(true);
          expect(isFinite(point.y)).toBe(true);
        }
      }
    });

    it('should handle short contours gracefully', () => {
      const shortContour = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
      const smoothed = smoothContour(shortContour, 4);
      
      // Should return original for too-short contours
      expect(smoothed.length).toBe(2);
    });
  });
});

// ============================================================================
// SVG Generation Tests
// ============================================================================

describe('SVG Generation', () => {
  describe('generateSVG', () => {
    it('should produce valid SVG markup', () => {
      const densities = createCircularPattern(20, 20);
      const svg = generateSVG(densities, 20, 20);
      
      // Check for SVG structure
      expect(svg).toContain('<?xml');
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it('should include title and description', () => {
      const densities = createCircularPattern(20, 20);
      const svg = generateSVG(densities, 20, 20);
      
      expect(svg).toContain('<title>');
      expect(svg).toContain('<desc>');
    });

    it('should include background rect when specified', () => {
      const densities = createCircularPattern(20, 20);
      const svg = generateSVG(densities, 20, 20, {
        backgroundColor: '#ffffff',
      });
      
      expect(svg).toContain('<rect');
      expect(svg).toContain('#ffffff');
    });

    it('should scale dimensions correctly', () => {
      const densities = createCircularPattern(20, 20);
      const svg = generateSVG(densities, 20, 20, { scale: 5 });
      
      // Width and height should be 20 * 5 = 100
      expect(svg).toContain('width="100"');
      expect(svg).toContain('height="100"');
    });

    it('should include path for non-empty contours', () => {
      const densities = createCircularPattern(20, 20);
      const svg = generateSVG(densities, 20, 20);
      
      expect(svg).toContain('<path');
      expect(svg).toContain('fill=');
    });

    it('should not include path for uniform patterns', () => {
      const densities = createUniformPattern(20, 20, 0.0);
      const svg = generateSVG(densities, 20, 20);
      
      // Should not have a path element (no contours)
      expect(svg).not.toContain('<path');
    });

    it('should apply stroke settings when specified', () => {
      const densities = createCircularPattern(20, 20);
      const svg = generateSVG(densities, 20, 20, {
        strokeColor: '#ff0000',
        strokeWidth: 2,
      });
      
      expect(svg).toContain('stroke="#ff0000"');
      expect(svg).toContain('stroke-width="2"');
    });

    it('should use evenodd fill rule for proper holes', () => {
      const densities = createCircularPattern(20, 20);
      const svg = generateSVG(densities, 20, 20);
      
      if (svg.includes('<path')) {
        expect(svg).toContain('fill-rule="evenodd"');
      }
    });
  });

  describe('SVG options', () => {
    it('should respect custom fill color', () => {
      const densities = createCircularPattern(20, 20);
      const svg = generateSVG(densities, 20, 20, {
        fillColor: '#123456',
      });
      
      expect(svg).toContain('#123456');
    });

    it('should add padding when specified', () => {
      const densities = createCircularPattern(20, 20);
      const svg = generateSVG(densities, 20, 20, {
        scale: 10,
        padding: 2,
      });
      
      // Width should be (20 + 2*2) * 10 = 240
      expect(svg).toContain('width="240"');
      expect(svg).toContain('height="240"');
    });

    it('should produce smoother paths with smoothing enabled', () => {
      const densities = createCircularPattern(20, 20);
      
      const unsmoothed = generateSVG(densities, 20, 20, {
        smoothing: false,
      });
      
      const smoothed = generateSVG(densities, 20, 20, {
        smoothing: true,
        smoothingResolution: 4,
      });
      
      // Smoothed SVG should have a longer path (more points)
      const countPoints = (svg: string) => (svg.match(/[LM]\s/g) || []).length;
      
      expect(countPoints(smoothed)).toBeGreaterThan(countPoints(unsmoothed));
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Export Integration', () => {
  it('should produce consistent results across multiple calls', () => {
    const densities = createCircularPattern(20, 20);
    
    const svg1 = generateSVG(densities, 20, 20, { smoothing: false });
    const svg2 = generateSVG(densities, 20, 20, { smoothing: false });
    
    // Deterministic - same input should produce same output
    expect(svg1).toBe(svg2);
  });

  it('should handle realistic topology optimization pattern', () => {
    // Create a more realistic pattern (MBB-like)
    const nelx = 60;
    const nely = 20;
    const densities = new Float64Array(nelx * nely);
    
    // Create a simple arch-like pattern
    for (let x = 0; x < nelx; x++) {
      for (let y = 0; y < nely; y++) {
        const idx = x * nely + y;
        const nx = x / nelx;
        const ny = y / nely;
        
        // Simple arch pattern
        const arch = Math.sin(nx * Math.PI) * 0.4;
        const bottom = ny < 0.15 ? 1 : 0;
        const top = ny > 0.85 ? 0.8 : 0;
        
        densities[idx] = Math.min(1, Math.max(0, bottom + top + (ny < arch + 0.2 && ny > arch - 0.2 ? 0.8 : 0)));
      }
    }
    
    // Should successfully generate SVG
    const svg = generateSVG(densities, nelx, nely);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    
    // Should successfully upsample
    const { data, width, height } = upsampleDensities(densities, nelx, nely, { scale: 4 });
    expect(width).toBe(240);
    expect(height).toBe(80);
    expect(data.length).toBe(240 * 80);
  });
});

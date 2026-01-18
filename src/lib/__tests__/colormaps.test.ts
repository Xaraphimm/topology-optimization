/**
 * Tests for Colormaps
 */

import { describe, it, expect } from 'vitest';
import {
  COLORMAPS,
  getColormap,
  getDefaultColormap,
  rgbToCSS,
  rgbToHex,
  generateGradientStops,
  stressToColor,
  createLUT,
  applyLUT,
  type RGB,
  type Colormap,
} from '../colormaps';

describe('COLORMAPS', () => {
  it('should have at least 3 colormaps', () => {
    expect(COLORMAPS.length).toBeGreaterThanOrEqual(3);
  });

  it('should have thermal, viridis, and rupture colormaps', () => {
    const ids = COLORMAPS.map(c => c.id);
    expect(ids).toContain('thermal');
    expect(ids).toContain('viridis');
    expect(ids).toContain('rupture');
  });

  it('should have unique IDs', () => {
    const ids = COLORMAPS.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have all required properties', () => {
    for (const colormap of COLORMAPS) {
      expect(typeof colormap.id).toBe('string');
      expect(typeof colormap.name).toBe('string');
      expect(typeof colormap.description).toBe('string');
      expect(typeof colormap.lookup).toBe('function');
    }
  });
});

describe('getColormap', () => {
  it('should return colormap by ID', () => {
    const thermal = getColormap('thermal');
    expect(thermal).toBeDefined();
    expect(thermal?.id).toBe('thermal');
  });

  it('should return undefined for unknown ID', () => {
    const unknown = getColormap('nonexistent');
    expect(unknown).toBeUndefined();
  });
});

describe('getDefaultColormap', () => {
  it('should return thermal as default', () => {
    const defaultMap = getDefaultColormap();
    expect(defaultMap.id).toBe('thermal');
  });
});

describe('Colormap lookup functions', () => {
  it('should return valid RGB for thermal colormap', () => {
    const thermal = getColormap('thermal')!;
    
    for (let t = 0; t <= 1; t += 0.1) {
      const rgb = thermal.lookup(t);
      expect(rgb).toHaveLength(3);
      expect(rgb[0]).toBeGreaterThanOrEqual(0);
      expect(rgb[0]).toBeLessThanOrEqual(255);
      expect(rgb[1]).toBeGreaterThanOrEqual(0);
      expect(rgb[1]).toBeLessThanOrEqual(255);
      expect(rgb[2]).toBeGreaterThanOrEqual(0);
      expect(rgb[2]).toBeLessThanOrEqual(255);
    }
  });

  it('should return valid RGB for viridis colormap', () => {
    const viridis = getColormap('viridis')!;
    
    for (let t = 0; t <= 1; t += 0.1) {
      const rgb = viridis.lookup(t);
      expect(rgb).toHaveLength(3);
      expect(rgb[0]).toBeGreaterThanOrEqual(0);
      expect(rgb[0]).toBeLessThanOrEqual(255);
      expect(rgb[1]).toBeGreaterThanOrEqual(0);
      expect(rgb[1]).toBeLessThanOrEqual(255);
      expect(rgb[2]).toBeGreaterThanOrEqual(0);
      expect(rgb[2]).toBeLessThanOrEqual(255);
    }
  });

  it('should clamp values outside [0, 1]', () => {
    const thermal = getColormap('thermal')!;
    
    // Should not throw and should return valid colors
    const rgbNeg = thermal.lookup(-0.5);
    const rgbOver = thermal.lookup(1.5);
    
    expect(rgbNeg).toHaveLength(3);
    expect(rgbOver).toHaveLength(3);
    
    // Clamped to 0 and 1
    expect(rgbNeg).toEqual(thermal.lookup(0));
    expect(rgbOver).toEqual(thermal.lookup(1));
  });

  it('should produce different colors at different values', () => {
    const thermal = getColormap('thermal')!;
    
    const rgb0 = thermal.lookup(0);
    const rgb05 = thermal.lookup(0.5);
    const rgb1 = thermal.lookup(1);
    
    // Should not all be the same
    expect(rgb0).not.toEqual(rgb05);
    expect(rgb05).not.toEqual(rgb1);
    expect(rgb0).not.toEqual(rgb1);
  });
});

describe('rgbToCSS', () => {
  it('should format RGB as CSS string', () => {
    const rgb: RGB = [255, 128, 64];
    const css = rgbToCSS(rgb);
    expect(css).toBe('rgb(255, 128, 64)');
  });

  it('should handle zero values', () => {
    const rgb: RGB = [0, 0, 0];
    const css = rgbToCSS(rgb);
    expect(css).toBe('rgb(0, 0, 0)');
  });
});

describe('rgbToHex', () => {
  it('should format RGB as hex string', () => {
    const rgb: RGB = [255, 128, 64];
    const hex = rgbToHex(rgb);
    expect(hex).toBe('#ff8040');
  });

  it('should pad single-digit hex values', () => {
    const rgb: RGB = [0, 15, 1];
    const hex = rgbToHex(rgb);
    expect(hex).toBe('#000f01');
  });

  it('should handle black', () => {
    const rgb: RGB = [0, 0, 0];
    const hex = rgbToHex(rgb);
    expect(hex).toBe('#000000');
  });

  it('should handle white', () => {
    const rgb: RGB = [255, 255, 255];
    const hex = rgbToHex(rgb);
    expect(hex).toBe('#ffffff');
  });
});

describe('generateGradientStops', () => {
  it('should generate gradient stops for colormap', () => {
    const thermal = getColormap('thermal')!;
    const gradient = generateGradientStops(thermal, 5);
    
    expect(typeof gradient).toBe('string');
    expect(gradient).toContain('rgb(');
    expect(gradient).toContain('0%');
    expect(gradient).toContain('100%');
  });

  it('should have correct number of stops', () => {
    const thermal = getColormap('thermal')!;
    const gradient = generateGradientStops(thermal, 10);
    
    // Should have 11 stops (0, 10, 20, ..., 100%)
    const stopCount = (gradient.match(/rgb\(/g) || []).length;
    expect(stopCount).toBe(11);
  });
});

describe('stressToColor', () => {
  it('should use default colormap', () => {
    const color = stressToColor(0.5);
    expect(color).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });

  it('should use specified colormap', () => {
    const viridis = getColormap('viridis')!;
    const color = stressToColor(0.5, viridis);
    expect(color).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });

  it('should produce different colors for different values', () => {
    const color0 = stressToColor(0);
    const color1 = stressToColor(1);
    expect(color0).not.toBe(color1);
  });
});

describe('createLUT and applyLUT', () => {
  it('should create a 256-entry LUT', () => {
    const thermal = getColormap('thermal')!;
    const lut = createLUT(thermal);
    
    expect(lut).toBeInstanceOf(Uint8Array);
    expect(lut.length).toBe(256 * 3);
  });

  it('should match direct lookup', () => {
    const thermal = getColormap('thermal')!;
    const lut = createLUT(thermal);
    
    // Test a few values
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const direct = thermal.lookup(t);
      const fromLut = applyLUT(lut, t);
      
      // Allow rounding differences due to integer indexing
      expect(Math.abs(fromLut[0] - direct[0])).toBeLessThan(5);
      expect(Math.abs(fromLut[1] - direct[1])).toBeLessThan(5);
      expect(Math.abs(fromLut[2] - direct[2])).toBeLessThan(5);
    }
  });

  it('should clamp out-of-range values', () => {
    const thermal = getColormap('thermal')!;
    const lut = createLUT(thermal);
    
    const rgbNeg = applyLUT(lut, -0.5);
    const rgbOver = applyLUT(lut, 1.5);
    const rgb0 = applyLUT(lut, 0);
    const rgb1 = applyLUT(lut, 1);
    
    expect(rgbNeg).toEqual(rgb0);
    expect(rgbOver).toEqual(rgb1);
  });
});

describe('Thermal colormap visual characteristics', () => {
  it('should have blue tones at low values', () => {
    const thermal = getColormap('thermal')!;
    const rgb = thermal.lookup(0);
    
    // Blue channel should be significant at t=0
    expect(rgb[2]).toBeGreaterThan(100);
  });

  it('should have red tones at high values', () => {
    const thermal = getColormap('thermal')!;
    const rgb = thermal.lookup(1);
    
    // Red channel should be high at t=1
    expect(rgb[0]).toBeGreaterThan(200);
  });
});

describe('Viridis colormap visual characteristics', () => {
  it('should have purple tones at low values', () => {
    const viridis = getColormap('viridis')!;
    const rgb = viridis.lookup(0);
    
    // Purple = high blue, medium-low red, low green
    expect(rgb[2]).toBeGreaterThan(50); // Some blue
    expect(rgb[0]).toBeGreaterThan(50); // Some red
  });

  it('should have yellow tones at high values', () => {
    const viridis = getColormap('viridis')!;
    const rgb = viridis.lookup(1);
    
    // Yellow = high red, high green, low blue
    expect(rgb[0]).toBeGreaterThan(200);
    expect(rgb[1]).toBeGreaterThan(200);
    expect(rgb[2]).toBeLessThan(100);
  });

  it('should transition through green in the middle', () => {
    const viridis = getColormap('viridis')!;
    const rgb = viridis.lookup(0.5);

    // Mid-range should have significant green
    expect(rgb[1]).toBeGreaterThan(100);
  });
});

describe('Rupture colormap visual characteristics', () => {
  it('should have green tones at low values (safe)', () => {
    const rupture = getColormap('rupture')!;
    const rgb = rupture.lookup(0);

    // Green = low red, high green, low blue
    expect(rgb[1]).toBeGreaterThan(150); // High green
    expect(rgb[0]).toBeLessThan(100);    // Low red
  });

  it('should have red tones at high values (rupture risk)', () => {
    const rupture = getColormap('rupture')!;
    const rgb = rupture.lookup(1);

    // Dark red = high red relative to green and blue
    expect(rgb[0]).toBeGreaterThan(rgb[1]); // Red > green
    expect(rgb[0]).toBeGreaterThan(rgb[2]); // Red > blue
  });

  it('should have yellow/orange tones in the middle', () => {
    const rupture = getColormap('rupture')!;
    const rgb = rupture.lookup(0.5);

    // Yellow = high red, high green, low blue
    expect(rgb[0]).toBeGreaterThan(150);
    expect(rgb[1]).toBeGreaterThan(150);
    expect(rgb[2]).toBeLessThan(100);
  });

  it('should return valid RGB for all values', () => {
    const rupture = getColormap('rupture')!;

    for (let t = 0; t <= 1; t += 0.1) {
      const rgb = rupture.lookup(t);
      expect(rgb).toHaveLength(3);
      expect(rgb[0]).toBeGreaterThanOrEqual(0);
      expect(rgb[0]).toBeLessThanOrEqual(255);
      expect(rgb[1]).toBeGreaterThanOrEqual(0);
      expect(rgb[1]).toBeLessThanOrEqual(255);
      expect(rgb[2]).toBeGreaterThanOrEqual(0);
      expect(rgb[2]).toBeLessThanOrEqual(255);
    }
  });

  it('should clamp values outside [0, 1]', () => {
    const rupture = getColormap('rupture')!;

    const rgbNeg = rupture.lookup(-0.5);
    const rgbOver = rupture.lookup(1.5);

    // Should be clamped to endpoints
    expect(rgbNeg).toEqual(rupture.lookup(0));
    expect(rgbOver).toEqual(rupture.lookup(1));
  });

  it('should create valid LUT', () => {
    const rupture = getColormap('rupture')!;
    const lut = createLUT(rupture);

    expect(lut).toBeInstanceOf(Uint8Array);
    expect(lut.length).toBe(256 * 3);

    // First entry should be greenish
    expect(lut[1]).toBeGreaterThan(lut[0]); // G > R at start

    // Last entry should be reddish
    const lastIdx = 255 * 3;
    expect(lut[lastIdx]).toBeGreaterThan(lut[lastIdx + 1]); // R > G at end
  });
});

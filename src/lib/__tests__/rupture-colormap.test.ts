/**
 * Tests for Rupture Risk Colormap
 */

import { describe, it, expect } from 'vitest';
import {
  RUPTURE_RISK_COLORMAP,
  SAFETY_MARGIN_COLORMAP,
  interpolateColor,
  rgbToHex,
  getRuptureRiskColor,
  getSafetyMarginColor,
  generateRuptureRiskLUT,
  getRuptureRiskClass,
  getRuptureRiskLabel,
  getSafetyMarginLabel,
} from '../rupture-colormap';

describe('Colormaps', () => {
  describe('RUPTURE_RISK_COLORMAP', () => {
    it('should have correct number of stops', () => {
      expect(RUPTURE_RISK_COLORMAP.stops.length).toBeGreaterThanOrEqual(4);
    });

    it('should start at 0 and end at 1', () => {
      const stops = RUPTURE_RISK_COLORMAP.stops;
      expect(stops[0].value).toBe(0);
      expect(stops[stops.length - 1].value).toBe(1);
    });

    it('should have valid RGB values', () => {
      for (const stop of RUPTURE_RISK_COLORMAP.stops) {
        expect(stop.color[0]).toBeGreaterThanOrEqual(0);
        expect(stop.color[0]).toBeLessThanOrEqual(255);
        expect(stop.color[1]).toBeGreaterThanOrEqual(0);
        expect(stop.color[1]).toBeLessThanOrEqual(255);
        expect(stop.color[2]).toBeGreaterThanOrEqual(0);
        expect(stop.color[2]).toBeLessThanOrEqual(255);
      }
    });

    it('should have increasing values', () => {
      const stops = RUPTURE_RISK_COLORMAP.stops;
      for (let i = 1; i < stops.length; i++) {
        expect(stops[i].value).toBeGreaterThan(stops[i - 1].value);
      }
    });
  });

  describe('SAFETY_MARGIN_COLORMAP', () => {
    it('should have correct number of stops', () => {
      expect(SAFETY_MARGIN_COLORMAP.stops.length).toBeGreaterThanOrEqual(4);
    });

    it('should have valid RGB values', () => {
      for (const stop of SAFETY_MARGIN_COLORMAP.stops) {
        expect(stop.color[0]).toBeGreaterThanOrEqual(0);
        expect(stop.color[0]).toBeLessThanOrEqual(255);
        expect(stop.color[1]).toBeGreaterThanOrEqual(0);
        expect(stop.color[1]).toBeLessThanOrEqual(255);
        expect(stop.color[2]).toBeGreaterThanOrEqual(0);
        expect(stop.color[2]).toBeLessThanOrEqual(255);
      }
    });
  });
});

describe('interpolateColor', () => {
  it('should return exact color at stop values', () => {
    const color0 = interpolateColor(0, RUPTURE_RISK_COLORMAP);
    expect(color0).toEqual([34, 197, 94]); // Green at 0

    const color1 = interpolateColor(1, RUPTURE_RISK_COLORMAP);
    expect(color1).toEqual([127, 29, 29]); // Dark red at 1
  });

  it('should interpolate between stops', () => {
    const color = interpolateColor(0.15, RUPTURE_RISK_COLORMAP);

    // Should be between green (0) and light green (0.3)
    expect(color[0]).toBeGreaterThanOrEqual(34);
    expect(color[0]).toBeLessThanOrEqual(74);
    expect(color[1]).toBeGreaterThanOrEqual(197);
    expect(color[2]).toBeGreaterThanOrEqual(94);
  });

  it('should clamp values below minimum', () => {
    const color = interpolateColor(-0.5, RUPTURE_RISK_COLORMAP);
    expect(color).toEqual([34, 197, 94]); // Should return first stop color
  });

  it('should clamp values above maximum', () => {
    const color = interpolateColor(1.5, RUPTURE_RISK_COLORMAP);
    expect(color).toEqual([127, 29, 29]); // Should return last stop color
  });
});

describe('rgbToHex', () => {
  it('should convert RGB to hex string', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
    expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });

  it('should pad single digit values', () => {
    expect(rgbToHex(1, 2, 3)).toBe('#010203');
    expect(rgbToHex(15, 15, 15)).toBe('#0f0f0f');
  });
});

describe('getRuptureRiskColor', () => {
  it('should return green for low risk', () => {
    const color = getRuptureRiskColor(0);
    expect(color).toBe('#22c55e'); // Green
  });

  it('should return red-ish for high risk', () => {
    const color = getRuptureRiskColor(1);
    expect(color).toBe('#7f1d1d'); // Dark red
  });

  it('should return valid hex colors', () => {
    const colors = [0, 0.25, 0.5, 0.75, 1].map(getRuptureRiskColor);
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('getSafetyMarginColor', () => {
  it('should return green for high safety margin', () => {
    const color = getSafetyMarginColor(3.0);
    expect(color).toBe('#22c55e'); // Green
  });

  it('should return red for low safety margin', () => {
    const color = getSafetyMarginColor(0);
    expect(color).toBe('#7f1d1d'); // Dark red
  });

  it('should return valid hex colors', () => {
    const colors = [0, 1, 2, 3].map(getSafetyMarginColor);
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('generateRuptureRiskLUT', () => {
  it('should generate 256x1 RGBA array', () => {
    const lut = generateRuptureRiskLUT();
    expect(lut.length).toBe(256 * 4);
  });

  it('should have valid RGBA values', () => {
    const lut = generateRuptureRiskLUT();
    for (let i = 0; i < lut.length; i++) {
      expect(lut[i]).toBeGreaterThanOrEqual(0);
      expect(lut[i]).toBeLessThanOrEqual(255);
    }
  });

  it('should have full opacity for all pixels', () => {
    const lut = generateRuptureRiskLUT();
    for (let i = 0; i < 256; i++) {
      expect(lut[i * 4 + 3]).toBe(255); // Alpha channel
    }
  });

  it('should start with green color', () => {
    const lut = generateRuptureRiskLUT();
    // First pixel should be greenish
    expect(lut[0]).toBe(34);  // R
    expect(lut[1]).toBe(197); // G
    expect(lut[2]).toBe(94);  // B
  });

  it('should end with dark red color', () => {
    const lut = generateRuptureRiskLUT();
    const lastIdx = 255 * 4;
    // Last pixel should be dark red
    expect(lut[lastIdx]).toBe(127);     // R
    expect(lut[lastIdx + 1]).toBe(29);  // G
    expect(lut[lastIdx + 2]).toBe(29);  // B
  });
});

describe('getRuptureRiskClass', () => {
  it('should return critical class for high risk', () => {
    const cls = getRuptureRiskClass(0.9);
    expect(cls).toContain('text-red');
    expect(cls).toContain('font-bold');
  });

  it('should return warning class for medium-high risk', () => {
    const cls = getRuptureRiskClass(0.75);
    expect(cls).toContain('text-orange');
    expect(cls).toContain('font-semibold');
  });

  it('should return caution class for medium risk', () => {
    const cls = getRuptureRiskClass(0.6);
    expect(cls).toContain('text-yellow');
  });

  it('should return safe class for low risk', () => {
    const cls = getRuptureRiskClass(0.2);
    expect(cls).toContain('text-green');
  });
});

describe('getRuptureRiskLabel', () => {
  it('should return critical label for very high risk', () => {
    const label = getRuptureRiskLabel(0.9);
    expect(label).toContain('CRITICAL');
    expect(label).toContain('Rupture');
  });

  it('should return high risk label', () => {
    const label = getRuptureRiskLabel(0.75);
    expect(label).toContain('HIGH RISK');
  });

  it('should return caution label for medium risk', () => {
    const label = getRuptureRiskLabel(0.55);
    expect(label).toContain('CAUTION');
  });

  it('should return moderate label for low-medium risk', () => {
    const label = getRuptureRiskLabel(0.35);
    expect(label).toContain('MODERATE');
  });

  it('should return safe label for low risk', () => {
    const label = getRuptureRiskLabel(0.1);
    expect(label).toContain('SAFE');
  });
});

describe('getSafetyMarginLabel', () => {
  it('should return excellent label for high safety', () => {
    const label = getSafetyMarginLabel(3.5);
    expect(label).toContain('Excellent');
    expect(label).toContain('3x+');
  });

  it('should return good label for good safety', () => {
    const label = getSafetyMarginLabel(2.5);
    expect(label).toContain('Good');
    expect(label).toContain('2x+');
  });

  it('should return acceptable label for acceptable safety', () => {
    const label = getSafetyMarginLabel(1.7);
    expect(label).toContain('Acceptable');
    expect(label).toContain('1.5x');
  });

  it('should return at limit label for marginal safety', () => {
    const label = getSafetyMarginLabel(1.2);
    expect(label).toContain('At limit');
    expect(label).toContain('1x');
  });

  it('should return failure label for below limit', () => {
    const label = getSafetyMarginLabel(0.8);
    expect(label).toContain('FAILURE');
  });
});

describe('Color Transitions', () => {
  it('should have smooth transitions in rupture risk colormap', () => {
    const colors: [number, number, number][] = [];
    for (let i = 0; i <= 10; i++) {
      colors.push(interpolateColor(i / 10, RUPTURE_RISK_COLORMAP));
    }

    // Check that transitions are gradual (no big jumps)
    for (let i = 1; i < colors.length; i++) {
      const prev = colors[i - 1];
      const curr = colors[i];

      // Each channel should not jump more than 100
      expect(Math.abs(curr[0] - prev[0])).toBeLessThanOrEqual(100);
      expect(Math.abs(curr[1] - prev[1])).toBeLessThanOrEqual(100);
      expect(Math.abs(curr[2] - prev[2])).toBeLessThanOrEqual(100);
    }
  });

  it('should transition from green to red as risk increases', () => {
    const lowRiskColor = interpolateColor(0, RUPTURE_RISK_COLORMAP);
    const highRiskColor = interpolateColor(1, RUPTURE_RISK_COLORMAP);

    // Low risk should have more green than red
    expect(lowRiskColor[1]).toBeGreaterThan(lowRiskColor[0]);

    // High risk should have more red than green
    expect(highRiskColor[0]).toBeGreaterThan(highRiskColor[1]);
  });
});

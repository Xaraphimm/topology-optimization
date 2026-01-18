/**
 * Tests for rendering enhancements (Phase 1)
 * 
 * Tests cover:
 * - WebGL texture filtering options
 * - Gamma correction and contrast enhancement
 * - Shader visual quality improvements
 */

import { describe, it, expect } from 'vitest';
import {
  materialFragmentShaderSource,
  stressFragmentShaderSource,
  stressFragmentShaderSourceLegacy,
  stressToRGB,
} from '../webgl/shaders';

describe('Material Fragment Shader Enhancements', () => {
  describe('Shader contains required components', () => {
    it('should have gamma correction constant', () => {
      expect(materialFragmentShaderSource).toContain('GAMMA');
      expect(materialFragmentShaderSource).toContain('INV_GAMMA');
    });

    it('should have contrast enhancement parameters', () => {
      expect(materialFragmentShaderSource).toContain('CONTRAST_CENTER');
      expect(materialFragmentShaderSource).toContain('CONTRAST_LOW');
      expect(materialFragmentShaderSource).toContain('CONTRAST_HIGH');
    });

    it('should use smoothstep for contrast enhancement', () => {
      expect(materialFragmentShaderSource).toContain('smoothstep');
    });

    it('should apply gamma correction with pow function', () => {
      expect(materialFragmentShaderSource).toContain('pow(');
    });

    it('should use highp precision for better quality', () => {
      expect(materialFragmentShaderSource).toContain('precision highp float');
    });
  });

  describe('Shader parameters are reasonable', () => {
    it('should have standard gamma value of 2.2', () => {
      expect(materialFragmentShaderSource).toContain('2.2');
    });

    it('should have contrast thresholds that preserve most of the range', () => {
      // CONTRAST_LOW should be small (< 0.2)
      const lowMatch = materialFragmentShaderSource.match(/CONTRAST_LOW\s*=\s*([\d.]+)/);
      expect(lowMatch).not.toBeNull();
      const lowValue = parseFloat(lowMatch![1]);
      expect(lowValue).toBeLessThan(0.2);
      expect(lowValue).toBeGreaterThan(0);

      // CONTRAST_HIGH should be high (> 0.8)
      const highMatch = materialFragmentShaderSource.match(/CONTRAST_HIGH\s*=\s*([\d.]+)/);
      expect(highMatch).not.toBeNull();
      const highValue = parseFloat(highMatch![1]);
      expect(highValue).toBeGreaterThan(0.8);
      expect(highValue).toBeLessThan(1.0);
    });
  });
});

describe('Stress Fragment Shader Enhancements', () => {
  describe('LUT-based shader (current)', () => {
    it('should use highp precision for better quality', () => {
      expect(stressFragmentShaderSource).toContain('precision highp float');
    });

    it('should apply sqrt for stress distribution', () => {
      expect(stressFragmentShaderSource).toContain('sqrt(');
    });

    it('should sample from colormap LUT texture', () => {
      expect(stressFragmentShaderSource).toContain('u_colormapLUT');
      expect(stressFragmentShaderSource).toContain('texture2D(u_colormapLUT');
    });

    it('should have stress texture uniform', () => {
      expect(stressFragmentShaderSource).toContain('u_stressTexture');
    });

    it('should clamp normalized value to valid range', () => {
      expect(stressFragmentShaderSource).toContain('clamp(');
    });
  });

  describe('Legacy shader (hardcoded colormap)', () => {
    it('should have gamma correction', () => {
      expect(stressFragmentShaderSourceLegacy).toContain('GAMMA');
      expect(stressFragmentShaderSourceLegacy).toContain('INV_GAMMA');
    });

    it('should use smoothstep for color transitions', () => {
      expect(stressFragmentShaderSourceLegacy).toContain('smoothstep');
    });

    it('should have improved color definitions', () => {
      // Blue color (Tailwind blue-500)
      expect(stressFragmentShaderSourceLegacy).toContain('0.231');
      expect(stressFragmentShaderSourceLegacy).toContain('0.510');
      expect(stressFragmentShaderSourceLegacy).toContain('0.965');
      
      // Red color (Tailwind red-500)
      expect(stressFragmentShaderSourceLegacy).toContain('0.937');
      expect(stressFragmentShaderSourceLegacy).toContain('0.267');
    });
  });
});

describe('stressToRGB Color Quality', () => {
  describe('Perceptual uniformity', () => {
    it('should produce smoothly varying colors', () => {
      // Sample colors at regular intervals
      const samples: [number, number, number][] = [];
      for (let t = 0; t <= 1; t += 0.1) {
        samples.push(stressToRGB(t));
      }

      // Check that RGB values change smoothly (no large jumps)
      for (let i = 1; i < samples.length; i++) {
        const [r1, g1, b1] = samples[i - 1];
        const [r2, g2, b2] = samples[i];
        
        // Maximum change per step should be reasonable (< 50 per channel for 0.1 step)
        expect(Math.abs(r2 - r1)).toBeLessThan(50);
        expect(Math.abs(g2 - g1)).toBeLessThan(50);
        expect(Math.abs(b2 - b1)).toBeLessThan(50);
      }
    });

    it('should produce perceptually distinct colors at key points', () => {
      const blue = stressToRGB(0);
      const white = stressToRGB(0.5);
      const red = stressToRGB(1);

      // Blue should have high B channel
      expect(blue[2]).toBeGreaterThan(blue[0]);
      expect(blue[2]).toBeGreaterThan(blue[1]);

      // White should have all channels equal
      expect(white[0]).toBe(white[1]);
      expect(white[1]).toBe(white[2]);
      expect(white[0]).toBe(255);

      // Red should have high R channel
      expect(red[0]).toBeGreaterThan(red[1]);
      expect(red[0]).toBeGreaterThan(red[2]);
    });
  });

  describe('Gamma correction effects', () => {
    it('should produce brighter blues due to gamma correction', () => {
      const [r, g, b] = stressToRGB(0);
      // Original blue without gamma: [59, 130, 246]
      // With gamma correction, should be brighter
      expect(r).toBeGreaterThan(59);
      expect(g).toBeGreaterThan(130);
    });

    it('should produce lighter reds (less saturated) due to gamma correction', () => {
      const [r, g, b] = stressToRGB(1);
      // Original red without gamma would have g=0, b=38
      // With gamma correction and new red color, values should be higher
      expect(g).toBeGreaterThan(0);
      expect(b).toBeGreaterThan(38);
    });
  });

  describe('Smoothstep interpolation effects', () => {
    it('should have slower change near boundaries (smoothstep characteristic)', () => {
      // Compare linear vs smoothstep behavior
      // At t=0.1 (near blue), change should be slower
      const at0 = stressToRGB(0);
      const at01 = stressToRGB(0.1);
      const at02 = stressToRGB(0.2);

      // Change from 0->0.1 should be less than linear (smoothstep starts slow)
      const change1 = Math.abs(at01[0] - at0[0]) + Math.abs(at01[1] - at0[1]) + Math.abs(at01[2] - at0[2]);
      const change2 = Math.abs(at02[0] - at01[0]) + Math.abs(at02[1] - at01[1]) + Math.abs(at02[2] - at01[2]);

      // Due to smoothstep, early changes should be smaller than middle changes
      // This is a characteristic of the s-curve
      expect(change1).toBeLessThanOrEqual(change2 * 1.5); // Allow some tolerance
    });
  });
});

describe('Color consistency between WebGL and Canvas2D', () => {
  it('stressToRGB should produce valid RGB values for all inputs', () => {
    // Test across full range including edge cases
    const testValues = [-1, -0.5, 0, 0.1, 0.25, 0.5, 0.75, 0.9, 1, 1.5, 2];
    
    for (const t of testValues) {
      const [r, g, b] = stressToRGB(t);
      
      // All values should be valid integers in [0, 255]
      expect(Number.isInteger(r)).toBe(true);
      expect(Number.isInteger(g)).toBe(true);
      expect(Number.isInteger(b)).toBe(true);
      
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(255);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    }
  });
});

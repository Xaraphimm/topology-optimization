import { describe, it, expect } from 'vitest';
import {
  vertexShaderSource,
  materialFragmentShaderSource,
  stressFragmentShaderSource,
  stressFragmentShaderSourceLegacy,
  validateShaderSource,
  stressToRGB,
  packDensitiesToTexture,
  packStressToTexture,
} from '../webgl/shaders';
import { WebGLRenderer } from '../webgl/WebGLRenderer';
import { createLUT, getColormap, getDefaultColormap, COLORMAPS } from '../colormaps';

describe('WebGL Shaders', () => {
  describe('validateShaderSource', () => {
    it('should validate vertex shader source', () => {
      const errors = validateShaderSource(vertexShaderSource);
      expect(errors).toHaveLength(0);
    });

    it('should validate material fragment shader source', () => {
      const errors = validateShaderSource(materialFragmentShaderSource);
      expect(errors).toHaveLength(0);
    });

    it('should validate stress fragment shader source', () => {
      const errors = validateShaderSource(stressFragmentShaderSource);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing main function', () => {
      const badShader = `
        precision mediump float;
        varying vec2 v_texCoord;
        // Missing main()
      `;
      const errors = validateShaderSource(badShader);
      expect(errors).toContain('Missing main() function');
    });

    it('should detect mismatched braces', () => {
      const badShader = `
        void main() {
          gl_FragColor = vec4(1.0);
        // Missing closing brace
      `;
      const errors = validateShaderSource(badShader);
      expect(errors.some(e => e.includes('Mismatched braces'))).toBe(true);
    });

    it('should detect mismatched parentheses', () => {
      const badShader = `
        void main() {
          gl_FragColor = vec4(1.0, 1.0, 1.0;
        }
      `;
      const errors = validateShaderSource(badShader);
      expect(errors.some(e => e.includes('Mismatched parentheses'))).toBe(true);
    });
  });

  describe('shader source content', () => {
    it('vertex shader should have position and texCoord attributes', () => {
      expect(vertexShaderSource).toContain('attribute vec2 a_position');
      expect(vertexShaderSource).toContain('attribute vec2 a_texCoord');
    });

    it('vertex shader should set gl_Position', () => {
      expect(vertexShaderSource).toContain('gl_Position');
    });

    it('material shader should sample density texture', () => {
      expect(materialFragmentShaderSource).toContain('u_densityTexture');
      expect(materialFragmentShaderSource).toContain('texture2D');
    });

    it('stress shader should have max stress uniform', () => {
      expect(stressFragmentShaderSource).toContain('u_maxStress');
      expect(stressFragmentShaderSource).toContain('u_stressTexture');
    });

    it('stress shader should have colormap LUT uniform', () => {
      expect(stressFragmentShaderSource).toContain('u_colormapLUT');
    });

    it('stress shader should sample from LUT texture', () => {
      expect(stressFragmentShaderSource).toContain('texture2D(u_colormapLUT');
    });

    it('legacy stress shader should have stressColor function', () => {
      expect(stressFragmentShaderSourceLegacy).toContain('vec3 stressColor');
    });

    it('legacy stress shader should validate', () => {
      const errors = validateShaderSource(stressFragmentShaderSourceLegacy);
      expect(errors).toHaveLength(0);
    });
  });
});

describe('stressToRGB', () => {
  // Note: stressToRGB now uses gamma correction (1/2.2) and smoothstep interpolation
  // for perceptually uniform color output matching the WebGL shader
  
  it('should return gamma-corrected blue at t=0', () => {
    const [r, g, b] = stressToRGB(0);
    // Blue [0.231, 0.510, 0.965] with gamma correction produces ~[131, 191, 250]
    // Allow small tolerance for floating point variations
    expect(r).toBeGreaterThanOrEqual(128);
    expect(r).toBeLessThanOrEqual(135);
    expect(g).toBeGreaterThanOrEqual(188);
    expect(g).toBeLessThanOrEqual(195);
    expect(b).toBeGreaterThanOrEqual(247);
    expect(b).toBeLessThanOrEqual(253);
  });

  it('should return white at t=0.5', () => {
    const [r, g, b] = stressToRGB(0.5);
    // White remains white after gamma correction
    expect(r).toBe(255);
    expect(g).toBe(255);
    expect(b).toBe(255);
  });

  it('should return gamma-corrected red at t=1', () => {
    const [r, g, b] = stressToRGB(1);
    // Red [0.937, 0.267, 0.267] with gamma correction produces ~[248, 138, 138]
    expect(r).toBeGreaterThanOrEqual(245);
    expect(r).toBeLessThanOrEqual(250);
    expect(g).toBeGreaterThanOrEqual(135);
    expect(g).toBeLessThanOrEqual(142);
    expect(b).toBeGreaterThanOrEqual(135);
    expect(b).toBeLessThanOrEqual(142);
  });

  it('should interpolate between blue and white', () => {
    const [r, g, b] = stressToRGB(0.25);
    const [blueR] = stressToRGB(0);
    // Should be between blue and white (with smoothstep interpolation)
    expect(r).toBeGreaterThan(blueR);
    expect(r).toBeLessThan(255);
    expect(g).toBeGreaterThan(190);
    expect(g).toBeLessThan(255);
    // Blue component should be high
    expect(b).toBeGreaterThanOrEqual(250);
    expect(b).toBeLessThanOrEqual(255);
  });

  it('should interpolate between white and red', () => {
    const [r, g, b] = stressToRGB(0.75);
    const [redR, redG] = stressToRGB(1);
    // Should be between white and red (with smoothstep interpolation)
    // R should be high (between white and red)
    expect(r).toBeGreaterThanOrEqual(248);
    expect(r).toBeLessThanOrEqual(255);
    // G should be between white (255) and red (~138)
    expect(g).toBeGreaterThan(redG);
    expect(g).toBeLessThan(255);
    // B should be between white (255) and red (~138)
    expect(b).toBeGreaterThan(redG);
    expect(b).toBeLessThan(255);
  });

  it('should clamp values below 0', () => {
    const [r, g, b] = stressToRGB(-0.5);
    const [blueR, blueG, blueB] = stressToRGB(0);
    // Should be same as t=0 (blue)
    expect(r).toBe(blueR);
    expect(g).toBe(blueG);
    expect(b).toBe(blueB);
  });

  it('should clamp values above 1', () => {
    const [r, g, b] = stressToRGB(1.5);
    const [redR, redG, redB] = stressToRGB(1);
    // Should be same as t=1 (red)
    expect(r).toBe(redR);
    expect(g).toBe(redG);
    expect(b).toBe(redB);
  });

  it('should return integer RGB values', () => {
    for (let t = 0; t <= 1; t += 0.1) {
      const [r, g, b] = stressToRGB(t);
      expect(Number.isInteger(r)).toBe(true);
      expect(Number.isInteger(g)).toBe(true);
      expect(Number.isInteger(b)).toBe(true);
    }
  });

  it('should return values in valid RGB range', () => {
    for (let t = 0; t <= 1; t += 0.1) {
      const [r, g, b] = stressToRGB(t);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(255);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    }
  });
});

describe('packDensitiesToTexture', () => {
  it('should return Float32Array of correct size', () => {
    const nelx = 10;
    const nely = 5;
    const densities = new Float64Array(nelx * nely);
    densities.fill(0.5);

    const textureData = packDensitiesToTexture(densities, nelx, nely);

    expect(textureData).toBeInstanceOf(Float32Array);
    expect(textureData.length).toBe(nelx * nely);
  });

  it('should preserve density values', () => {
    const nelx = 4;
    const nely = 3;
    const densities = new Float64Array(nelx * nely);
    
    // Fill with specific values
    for (let i = 0; i < densities.length; i++) {
      densities[i] = i / (densities.length - 1);
    }

    const textureData = packDensitiesToTexture(densities, nelx, nely);

    // Check that min and max are preserved
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < textureData.length; i++) {
      min = Math.min(min, textureData[i]);
      max = Math.max(max, textureData[i]);
    }

    expect(min).toBeCloseTo(0, 5);
    expect(max).toBeCloseTo(1, 5);
  });

  it('should flip Y coordinate correctly', () => {
    const nelx = 2;
    const nely = 3;
    const densities = new Float64Array(nelx * nely);
    
    // Set bottom-left element (x=0, y=0) to 1.0
    // In column-major: index = x * nely + y = 0 * 3 + 0 = 0
    densities[0] = 1.0;
    
    // All other elements are 0
    const textureData = packDensitiesToTexture(densities, nelx, nely);

    // After Y-flip, this should be at top-left in texture
    // Texture is row-major: index = x + (nely - 1 - y) * nelx
    // For x=0, y=0: index = 0 + (3 - 1 - 0) * 2 = 4
    expect(textureData[4]).toBe(1.0);
    
    // The original texture position (0,0) which is bottom-left in texture should be different
    // In row-major at bottom-left (x=0, y=nely-1): index = 0 + (3 - 1 - 2) * 2 = 0
    expect(textureData[0]).toBe(0.0);
  });

  it('should handle uniform densities', () => {
    const nelx = 5;
    const nely = 5;
    const densities = new Float64Array(nelx * nely);
    densities.fill(0.7);

    const textureData = packDensitiesToTexture(densities, nelx, nely);

    for (let i = 0; i < textureData.length; i++) {
      expect(textureData[i]).toBeCloseTo(0.7, 5);
    }
  });
});

describe('packStressToTexture', () => {
  it('should return Float32Array of correct size', () => {
    const nelx = 10;
    const nely = 5;
    const stress = new Float64Array(nelx * nely);
    stress.fill(100);

    const textureData = packStressToTexture(stress, 200, nelx, nely);

    expect(textureData).toBeInstanceOf(Float32Array);
    expect(textureData.length).toBe(nelx * nely);
  });

  it('should normalize stress values correctly', () => {
    const nelx = 4;
    const nely = 3;
    const stress = new Float64Array(nelx * nely);
    
    // Set stress values
    const maxStress = 100;
    for (let i = 0; i < stress.length; i++) {
      stress[i] = i * 10; // 0, 10, 20, ..., 110
    }

    const textureData = packStressToTexture(stress, maxStress, nelx, nely);

    // All values should be normalized (divided by maxStress)
    let foundMax = -Infinity;
    for (let i = 0; i < textureData.length; i++) {
      foundMax = Math.max(foundMax, textureData[i]);
    }

    // The max value in stress is 110, which normalized by 100 = 1.1
    expect(foundMax).toBeCloseTo(1.1, 5);
  });

  it('should handle zero maxStress gracefully', () => {
    const nelx = 2;
    const nely = 2;
    const stress = new Float64Array(nelx * nely);
    stress.fill(50);

    // Should not throw or produce NaN/Infinity
    const textureData = packStressToTexture(stress, 0, nelx, nely);

    for (let i = 0; i < textureData.length; i++) {
      expect(Number.isFinite(textureData[i])).toBe(true);
      expect(textureData[i]).toBe(50); // Divided by 1 (safe fallback)
    }
  });

  it('should flip Y coordinate correctly', () => {
    const nelx = 2;
    const nely = 3;
    const stress = new Float64Array(nelx * nely);
    
    // Set bottom-left element stress
    stress[0] = 100; // x=0, y=0 in column-major

    const textureData = packStressToTexture(stress, 100, nelx, nely);

    // After Y-flip, bottom-left in data becomes top-left in texture
    // index = x + (nely - 1 - y) * nelx = 0 + (3 - 1 - 0) * 2 = 4
    expect(textureData[4]).toBe(1.0); // 100/100 = 1.0
  });
});

describe('WebGLRenderer', () => {
  describe('isSupported', () => {
    it('should return a boolean', () => {
      const result = WebGLRenderer.isSupported();
      expect(typeof result).toBe('boolean');
    });

    // Note: In Node.js test environment, WebGL is typically not available
    // This test documents expected behavior
    it('should return false in non-browser environment', () => {
      // In vitest/node environment, document.createElement returns a mock
      // that doesn't have real WebGL support
      const result = WebGLRenderer.isSupported();
      // We expect false in test environment, but the function should not throw
      expect(result).toBe(false);
    });
  });

  // Note: Full WebGL rendering tests require a browser environment
  // These tests focus on the static methods and initialization logic
  describe('static methods', () => {
    it('isSupported should not throw', () => {
      expect(() => WebGLRenderer.isSupported()).not.toThrow();
    });
  });
});

describe('Texture byte layout', () => {
  it('density texture should produce correct grayscale byte values', () => {
    const nelx = 3;
    const nely = 2;
    const densities = new Float64Array([
      0.0, 0.5,  // Column 0: y=0 (0.0), y=1 (0.5)
      0.25, 0.75, // Column 1
      1.0, 0.0,   // Column 2
    ]);

    const floatData = packDensitiesToTexture(densities, nelx, nely);
    
    // Convert to bytes (as WebGL would)
    const byteData = new Uint8Array(floatData.length);
    for (let i = 0; i < floatData.length; i++) {
      byteData[i] = Math.round(floatData[i] * 255);
    }

    // Check that byte values are in valid range
    for (let i = 0; i < byteData.length; i++) {
      expect(byteData[i]).toBeGreaterThanOrEqual(0);
      expect(byteData[i]).toBeLessThanOrEqual(255);
    }

    // Check specific values exist (accounting for Y-flip rearrangement)
    const values = Array.from(byteData);
    expect(values).toContain(0);   // 0.0 density
    expect(values).toContain(128); // 0.5 density (approximate)
    expect(values).toContain(255); // 1.0 density
  });

  it('stress texture normalization should preserve relative values', () => {
    const nelx = 2;
    const nely = 2;
    const stress = new Float64Array([100, 200, 50, 150]);
    const maxStress = 200;

    const floatData = packStressToTexture(stress, maxStress, nelx, nely);
    
    // Convert to bytes
    const byteData = new Uint8Array(floatData.length);
    for (let i = 0; i < floatData.length; i++) {
      byteData[i] = Math.round(Math.min(1, floatData[i]) * 255);
    }

    // Max stress (200) should map to 255
    expect(Math.max(...byteData)).toBe(255);
    
    // Min stress (50) should map to ~64 (50/200 * 255)
    expect(Math.min(...byteData)).toBeCloseTo(64, -1);
  });
});

describe('Colormap LUT for WebGL', () => {
  describe('createLUT', () => {
    it('should create LUT with correct size (256 entries * 3 channels)', () => {
      const colormap = getDefaultColormap();
      const lut = createLUT(colormap);
      expect(lut).toBeInstanceOf(Uint8Array);
      expect(lut.length).toBe(256 * 3);
    });

    it('should produce valid RGB values in range [0-255]', () => {
      const colormap = getDefaultColormap();
      const lut = createLUT(colormap);
      for (let i = 0; i < lut.length; i++) {
        expect(lut[i]).toBeGreaterThanOrEqual(0);
        expect(lut[i]).toBeLessThanOrEqual(255);
      }
    });

    it('should create different LUTs for different colormaps', () => {
      const thermal = getColormap('thermal')!;
      const viridis = getColormap('viridis')!;
      
      const thermalLUT = createLUT(thermal);
      const viridisLUT = createLUT(viridis);
      
      // The LUTs should be different
      let isDifferent = false;
      for (let i = 0; i < thermalLUT.length; i++) {
        if (thermalLUT[i] !== viridisLUT[i]) {
          isDifferent = true;
          break;
        }
      }
      expect(isDifferent).toBe(true);
    });

    it('should create LUTs for all available colormaps', () => {
      for (const colormap of COLORMAPS) {
        const lut = createLUT(colormap);
        expect(lut.length).toBe(256 * 3);
        // First entry should be valid (entry 0)
        expect(lut[0]).toBeGreaterThanOrEqual(0);
        expect(lut[0]).toBeLessThanOrEqual(255);
        // Last entry should be valid (entry 255)
        expect(lut[255 * 3]).toBeGreaterThanOrEqual(0);
        expect(lut[255 * 3]).toBeLessThanOrEqual(255);
      }
    });
  });

  describe('LUT color consistency', () => {
    it('thermal LUT should start with blue-ish colors (low stress)', () => {
      const thermal = getColormap('thermal')!;
      const lut = createLUT(thermal);
      
      // First entry (t=0, low stress) should be blue-ish
      const r = lut[0];
      const g = lut[1];
      const b = lut[2];
      
      // Blue channel should be significant for thermal at t=0
      expect(b).toBeGreaterThan(100);
    });

    it('thermal LUT should end with red-ish colors (high stress)', () => {
      const thermal = getColormap('thermal')!;
      const lut = createLUT(thermal);
      
      // Last entry (t=1, high stress) should be red-ish
      const r = lut[255 * 3];
      const g = lut[255 * 3 + 1];
      const b = lut[255 * 3 + 2];
      
      // Red should be high, others lower for thermal at t=1
      expect(r).toBe(255);
      expect(g).toBeLessThan(100);
    });

    it('viridis LUT should start with dark purple (low stress)', () => {
      const viridis = getColormap('viridis')!;
      const lut = createLUT(viridis);
      
      // First entry (t=0) should be dark purple [68, 1, 84]
      const r = lut[0];
      const g = lut[1];
      const b = lut[2];
      
      expect(r).toBeCloseTo(68, -1);
      expect(g).toBeLessThan(10);
      expect(b).toBeCloseTo(84, -1);
    });

    it('viridis LUT should end with yellow (high stress)', () => {
      const viridis = getColormap('viridis')!;
      const lut = createLUT(viridis);
      
      // Last entry (t=1) should be yellow-ish [253, 231, 37]
      const r = lut[255 * 3];
      const g = lut[255 * 3 + 1];
      const b = lut[255 * 3 + 2];
      
      expect(r).toBeCloseTo(253, -1);
      expect(g).toBeCloseTo(231, -1);
      expect(b).toBeLessThan(50);
    });
  });

  describe('LUT texture format', () => {
    it('LUT should be suitable for WebGL RGB texture (256x1)', () => {
      const colormap = getDefaultColormap();
      const lut = createLUT(colormap);
      
      // Should be exactly 256 RGB triplets = 768 bytes
      expect(lut.length).toBe(768);
      
      // Each triplet should be valid RGB
      for (let i = 0; i < 256; i++) {
        const r = lut[i * 3];
        const g = lut[i * 3 + 1];
        const b = lut[i * 3 + 2];
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(255);
      }
    });

    it('LUT indices should map correctly to normalized stress values', () => {
      const colormap = getDefaultColormap();
      const lut = createLUT(colormap);
      
      // Index 0 = t=0.0, Index 127/128 = t≈0.5, Index 255 = t=1.0
      // Verify the LUT is accessing colors at correct positions
      
      // Get color at t=0 directly from colormap
      const c0 = colormap.lookup(0);
      expect(lut[0]).toBe(c0[0]);
      expect(lut[1]).toBe(c0[1]);
      expect(lut[2]).toBe(c0[2]);
      
      // Get color at t=1 directly from colormap
      const c1 = colormap.lookup(1);
      expect(lut[255 * 3]).toBe(c1[0]);
      expect(lut[255 * 3 + 1]).toBe(c1[1]);
      expect(lut[255 * 3 + 2]).toBe(c1[2]);
      
      // Get color at t=0.5 (index 127 or 128)
      const c05 = colormap.lookup(127 / 255);
      expect(lut[127 * 3]).toBe(c05[0]);
      expect(lut[127 * 3 + 1]).toBe(c05[1]);
      expect(lut[127 * 3 + 2]).toBe(c05[2]);
    });
  });
});

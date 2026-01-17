/**
 * Comprehensive tests for resolution switching
 * 
 * Tests validation logic that ensures density arrays match current dimensions.
 * This prevents rendering stale data from a previous resolution.
 */

import { describe, it, expect } from 'vitest';
import { packDensitiesToTexture, packStressToTexture } from '../webgl/shaders';
import { PRESETS, RESOLUTIONS, getMeshDimensions } from '../presets';
import { SIMPOptimizer } from '../optimizer/simp';

/**
 * Helper: Create uniform density array (mirrors the hook's createUniformDensities)
 */
function createUniformDensities(nelx: number, nely: number, volumeFraction: number): Float64Array {
  const size = nelx * nely;
  const densities = new Float64Array(size);
  densities.fill(volumeFraction);
  return densities;
}

/**
 * Helper: Validate density array size (mirrors the hook's isDensityArrayValid)
 */
function isDensityArrayValid(densities: Float64Array | null, nelx: number, nely: number): boolean {
  if (!densities) return false;
  const expectedSize = nelx * nely;
  return densities.length === expectedSize;
}

describe('Resolution Switching', () => {
  
  describe('isDensityArrayValid', () => {
    it('should return false for null densities', () => {
      expect(isDensityArrayValid(null, 60, 20)).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(isDensityArrayValid(new Float64Array(0), 60, 20)).toBe(false);
    });

    it('should return true for correctly sized array at 60x20', () => {
      const densities = new Float64Array(60 * 20);
      expect(isDensityArrayValid(densities, 60, 20)).toBe(true);
    });

    it('should return true for correctly sized array at 120x40', () => {
      const densities = new Float64Array(120 * 40);
      expect(isDensityArrayValid(densities, 120, 40)).toBe(true);
    });

    it('should return false when 60x20 array is used with 120x40 dimensions', () => {
      const densities = new Float64Array(60 * 20); // 1200 elements
      expect(isDensityArrayValid(densities, 120, 40)).toBe(false); // expects 4800
    });

    it('should return false when 120x40 array is used with 60x20 dimensions', () => {
      const densities = new Float64Array(120 * 40); // 4800 elements
      expect(isDensityArrayValid(densities, 60, 20)).toBe(false); // expects 1200
    });
  });

  describe('createUniformDensities', () => {
    const allResolutionCombinations = [
      // MBB Beam / Bridge (aspect ratio 3)
      { nelx: 60, nely: 20, name: 'low res (aspect 3)' },
      { nelx: 120, nely: 40, name: 'high res (aspect 3)' },
      // Cantilever (aspect ratio 2)
      { nelx: 60, nely: 30, name: 'low res (aspect 2)' },
      { nelx: 120, nely: 60, name: 'high res (aspect 2)' },
    ];

    allResolutionCombinations.forEach(({ nelx, nely, name }) => {
      it(`should create correctly sized array for ${name} (${nelx}x${nely})`, () => {
        const volumeFraction = 0.5;
        const densities = createUniformDensities(nelx, nely, volumeFraction);
        
        expect(densities.length).toBe(nelx * nely);
        expect(densities.every(d => d === volumeFraction)).toBe(true);
      });
    });
  });

  describe('Texture Packing at All Resolutions', () => {
    const resolutions = [
      { nelx: 60, nely: 20 },
      { nelx: 120, nely: 40 },
      { nelx: 60, nely: 30 },
      { nelx: 120, nely: 60 },
    ];

    resolutions.forEach(({ nelx, nely }) => {
      describe(`${nelx}x${nely} mesh`, () => {
        it('should correctly pack density texture', () => {
          const densities = createUniformDensities(nelx, nely, 0.5);
          const packed = packDensitiesToTexture(densities, nelx, nely);
          
          expect(packed.length).toBe(nelx * nely);
          expect(packed.every(v => Math.abs(v - 0.5) < 0.001)).toBe(true);
        });

        it('should correctly pack stress texture', () => {
          const stress = new Float64Array(nelx * nely);
          stress.fill(100);
          const packed = packStressToTexture(stress, 100, nelx, nely);
          
          expect(packed.length).toBe(nelx * nely);
          expect(packed.every(v => Math.abs(v - 1.0) < 0.001)).toBe(true);
        });

        it('should handle gradient density data', () => {
          const densities = new Float64Array(nelx * nely);
          for (let i = 0; i < densities.length; i++) {
            densities[i] = i / (densities.length - 1);
          }
          
          const packed = packDensitiesToTexture(densities, nelx, nely);
          
          expect(packed.length).toBe(nelx * nely);
          
          const minVal = Math.min(...packed);
          const maxVal = Math.max(...packed);
          expect(minVal).toBeCloseTo(0, 5);
          expect(maxVal).toBeCloseTo(1, 5);
        });
      });
    });
  });

  describe('Resolution Transition Scenarios', () => {
    describe('60x20 to 120x40 transition', () => {
      it('should detect stale 60x20 data when expecting 120x40', () => {
        const oldDensities = new Float64Array(60 * 20);
        oldDensities.fill(0.3);
        
        const newNelx = 120;
        const newNely = 40;
        
        expect(isDensityArrayValid(oldDensities, newNelx, newNely)).toBe(false);
        
        const previewDensities = createUniformDensities(newNelx, newNely, 0.5);
        expect(previewDensities.length).toBe(newNelx * newNely);
      });

      it('should create valid preview for 120x40 when old data is invalid', () => {
        const oldDensities = new Float64Array(60 * 20);
        const nelx = 120;
        const nely = 40;
        
        const hasValidDensities = isDensityArrayValid(oldDensities, nelx, nely);
        const displayDensities = hasValidDensities 
          ? oldDensities 
          : createUniformDensities(nelx, nely, 0.5);
        
        expect(displayDensities.length).toBe(nelx * nely);
        expect(displayDensities.length).toBe(4800);
      });
    });

    describe('All resolution transition combinations', () => {
      const resolutionConfigs = [
        { id: 'low', nelx: 60, nely: 20 },
        { id: 'high', nelx: 120, nely: 40 },
      ];

      resolutionConfigs.forEach(from => {
        resolutionConfigs.forEach(to => {
          if (from.id !== to.id) {
            it(`should handle ${from.id} (${from.nelx}x${from.nely}) to ${to.id} (${to.nelx}x${to.nely})`, () => {
              const oldDensities = new Float64Array(from.nelx * from.nely);
              oldDensities.fill(0.4);
              
              const isValid = isDensityArrayValid(oldDensities, to.nelx, to.nely);
              
              expect(isValid).toBe(false);
              
              const preview = createUniformDensities(to.nelx, to.nely, 0.5);
              expect(preview.length).toBe(to.nelx * to.nely);
            });
          }
        });
      });
    });
  });

  describe('Preset + Resolution Matrix', () => {
    PRESETS.forEach(preset => {
      RESOLUTIONS.forEach(resolution => {
        const { nelx, nely } = getMeshDimensions(preset, resolution);
        
        describe(`${preset.name} at ${resolution.label} (actual: ${nelx}x${nely})`, () => {
          it('should create valid optimizer state', () => {
            const optimizer = new SIMPOptimizer({
              nelx,
              nely,
              volfrac: 0.5,
            });
            
            const state = optimizer.getState();
            
            expect(state.densities.length).toBe(nelx * nely);
            expect(isDensityArrayValid(state.densities, nelx, nely)).toBe(true);
          });

          it('should setup problem correctly', () => {
            const { forces, fixedDofs, supports } = preset.setup(nelx, nely);
            
            expect(forces).toBeInstanceOf(Float64Array);
            expect(forces.length).toBeGreaterThan(0);
            expect(fixedDofs.length).toBeGreaterThan(0);
            expect(supports.length).toBeGreaterThan(0);
          });

          it('should run first iteration and produce valid output', () => {
            const optimizer = new SIMPOptimizer({
              nelx,
              nely,
              volfrac: 0.5,
            });
            
            const { forces, fixedDofs } = preset.setup(nelx, nely);
            optimizer.setForces(forces);
            optimizer.setFixedDofs(fixedDofs);
            
            const state = optimizer.step();
            
            expect(state.densities.length).toBe(nelx * nely);
            expect(isDensityArrayValid(state.densities, nelx, nely)).toBe(true);
            
            expect(state.compliance).toBeGreaterThan(0);
            expect(state.compliance).toBeLessThan(Infinity);
            
            expect(state.strainEnergy.length).toBe(nelx * nely);
            expect(state.strainEnergy.some(e => e > 0)).toBe(true);
          });
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle switching to same resolution (no-op)', () => {
      const densities = new Float64Array(60 * 20);
      densities.fill(0.5);
      
      expect(isDensityArrayValid(densities, 60, 20)).toBe(true);
    });

    it('should handle very small meshes', () => {
      const densities = createUniformDensities(2, 2, 0.5);
      expect(densities.length).toBe(4);
      expect(isDensityArrayValid(densities, 2, 2)).toBe(true);
    });

    it('should handle non-standard aspect ratios', () => {
      const densities = createUniformDensities(60, 30, 0.5);
      expect(densities.length).toBe(60 * 30);
      expect(isDensityArrayValid(densities, 60, 30)).toBe(true);
      
      expect(isDensityArrayValid(densities, 60, 20)).toBe(false);
    });

    it('should handle rapid dimension changes', () => {
      const dimensions = [
        { nelx: 60, nely: 20 },
        { nelx: 120, nely: 40 },
        { nelx: 60, nely: 20 },
      ];

      let previousDensities: Float64Array | null = null;

      dimensions.forEach(({ nelx, nely }, index) => {
        const hasValidDensities = isDensityArrayValid(previousDensities, nelx, nely);
        
        if (index === 0) {
          expect(hasValidDensities).toBe(false);
        } else {
          expect(hasValidDensities).toBe(false);
        }

        previousDensities = createUniformDensities(nelx, nely, 0.5);
        
        expect(isDensityArrayValid(previousDensities, nelx, nely)).toBe(true);
      });
    });
  });

  describe('Stress Texture Validation', () => {
    it('should reject stress array with wrong size', () => {
      const stress = new Float64Array(60 * 20);
      expect(isDensityArrayValid(stress, 120, 40)).toBe(false);
    });

    it('should accept stress array with correct size', () => {
      const stress = new Float64Array(120 * 40);
      expect(isDensityArrayValid(stress, 120, 40)).toBe(true);
    });
  });

  describe('Byte Conversion for WebGL', () => {
    it('should correctly convert 60x20 density to bytes', () => {
      const nelx = 60, nely = 20;
      const densities = createUniformDensities(nelx, nely, 0.5);
      const packed = packDensitiesToTexture(densities, nelx, nely);
      
      const bytes = new Uint8Array(packed.length);
      for (let i = 0; i < packed.length; i++) {
        bytes[i] = Math.round(packed[i] * 255);
      }
      
      expect(bytes.every(b => b === 127 || b === 128)).toBe(true);
    });

    it('should correctly convert 120x40 density to bytes', () => {
      const nelx = 120, nely = 40;
      const densities = createUniformDensities(nelx, nely, 0.5);
      const packed = packDensitiesToTexture(densities, nelx, nely);
      
      const bytes = new Uint8Array(packed.length);
      for (let i = 0; i < packed.length; i++) {
        bytes[i] = Math.round(packed[i] * 255);
      }
      
      expect(bytes.every(b => b === 127 || b === 128)).toBe(true);
    });
  });
});

describe('Regression Prevention', () => {
  it('should validate array size before using densities', () => {
    const oldDensities = new Float64Array(1200);
    oldDensities.fill(0.3);
    
    const currentNelx = 120;
    const currentNely = 40;
    const expectedSize = 4800;
    
    const isValid = isDensityArrayValid(oldDensities, currentNelx, currentNely);
    expect(isValid).toBe(false);
    
    if (!isValid) {
      const preview = createUniformDensities(currentNelx, currentNely, 0.5);
      expect(preview.length).toBe(expectedSize);
    }
  });

  it('should show preview when no densities exist', () => {
    const densities: Float64Array | null = null;
    const nelx = 120, nely = 40;
    
    const hasValidDensities = isDensityArrayValid(densities, nelx, nely);
    expect(hasValidDensities).toBe(false);
    
    const preview = createUniformDensities(nelx, nely, 0.5);
    expect(preview.length).toBe(4800);
    expect(preview.every(d => d === 0.5)).toBe(true);
  });
});

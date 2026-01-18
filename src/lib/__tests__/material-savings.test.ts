/**
 * Tests for Material Savings Calculator
 */

import { describe, it, expect } from 'vitest';
import {
  MATERIALS,
  getMaterial,
  getMaterialsByCategory,
  calculateSavings,
  calculateSavingsForAllMaterials,
  calculateSavingsDefault,
  formatMass,
  formatCost,
  formatVolume,
  getQuickStats,
  type Dimensions,
} from '../material-savings';

describe('Material Database', () => {
  it('should have a comprehensive list of materials', () => {
    expect(MATERIALS.length).toBeGreaterThanOrEqual(10);
  });

  it('should include key engineering materials', () => {
    const materialIds = MATERIALS.map(m => m.id);
    expect(materialIds).toContain('aluminum-6061');
    expect(materialIds).toContain('steel-1018');
    expect(materialIds).toContain('titanium-6al4v');
    expect(materialIds).toContain('cfrp');
  });

  it('should have valid density values for all materials', () => {
    for (const material of MATERIALS) {
      expect(material.density).toBeGreaterThan(0);
      expect(material.density).toBeLessThan(25000); // No material denser than osmium
    }
  });

  it('should have valid cost values for all materials', () => {
    for (const material of MATERIALS) {
      expect(material.costPerKg).toBeGreaterThan(0);
      expect(material.costPerKg).toBeLessThan(1000); // Reasonable upper bound
    }
  });

  it('should have valid categories for all materials', () => {
    const validCategories = ['metal', 'polymer', 'composite'];
    for (const material of MATERIALS) {
      expect(validCategories).toContain(material.category);
    }
  });

  it('should have descriptions for all materials', () => {
    for (const material of MATERIALS) {
      expect(material.description.length).toBeGreaterThan(10);
    }
  });
});

describe('getMaterial', () => {
  it('should return material by ID', () => {
    const aluminum = getMaterial('aluminum-6061');
    expect(aluminum).toBeDefined();
    expect(aluminum?.name).toBe('Aluminum 6061-T6');
    expect(aluminum?.density).toBe(2700);
  });

  it('should return undefined for unknown material', () => {
    const unknown = getMaterial('unobtainium');
    expect(unknown).toBeUndefined();
  });
});

describe('getMaterialsByCategory', () => {
  it('should filter metals correctly', () => {
    const metals = getMaterialsByCategory('metal');
    expect(metals.length).toBeGreaterThan(0);
    for (const m of metals) {
      expect(m.category).toBe('metal');
    }
  });

  it('should filter polymers correctly', () => {
    const polymers = getMaterialsByCategory('polymer');
    expect(polymers.length).toBeGreaterThan(0);
    for (const m of polymers) {
      expect(m.category).toBe('polymer');
    }
  });

  it('should filter composites correctly', () => {
    const composites = getMaterialsByCategory('composite');
    expect(composites.length).toBeGreaterThan(0);
    for (const m of composites) {
      expect(m.category).toBe('composite');
    }
  });
});

describe('calculateSavings', () => {
  const aluminum = getMaterial('aluminum-6061')!;
  const testDimensions: Dimensions = {
    length: 0.1,  // 100mm
    width: 0.1,   // 100mm
    height: 0.01, // 10mm
  };
  // Volume = 0.1 * 0.1 * 0.01 = 0.0001 m³ = 100 cm³

  it('should calculate solid block properties correctly', () => {
    const savings = calculateSavings(1.0, testDimensions, aluminum);
    
    // Solid volume = 0.0001 m³
    expect(savings.solidVolume).toBeCloseTo(0.0001, 6);
    
    // Solid mass = 0.0001 m³ * 2700 kg/m³ = 0.27 kg
    expect(savings.solidMass).toBeCloseTo(0.27, 3);
    
    // Solid cost = 0.27 kg * $3.5/kg = $0.945
    expect(savings.solidCost).toBeCloseTo(0.945, 3);
  });

  it('should calculate 50% volume fraction correctly', () => {
    const savings = calculateSavings(0.5, testDimensions, aluminum);
    
    expect(savings.volumeFraction).toBe(0.5);
    expect(savings.materialSavedPercent).toBe(50);
    
    // Optimized mass should be half of solid
    expect(savings.optimizedMass).toBeCloseTo(0.135, 3);
    
    // Mass saved should be half of solid
    expect(savings.massSaved).toBeCloseTo(0.135, 3);
  });

  it('should calculate 30% volume fraction correctly (typical optimization)', () => {
    const savings = calculateSavings(0.3, testDimensions, aluminum);
    
    expect(savings.volumeFraction).toBe(0.3);
    expect(savings.materialSavedPercent).toBe(70);
    
    // 70% material saved
    expect(savings.massSaved).toBeCloseTo(0.27 * 0.7, 3);
    expect(savings.costSaved).toBeCloseTo(0.945 * 0.7, 3);
  });

  it('should handle 0% volume fraction (edge case)', () => {
    const savings = calculateSavings(0, testDimensions, aluminum);
    
    expect(savings.volumeFraction).toBe(0);
    expect(savings.materialSavedPercent).toBe(100);
    expect(savings.optimizedMass).toBe(0);
    expect(savings.massSaved).toBeCloseTo(0.27, 3);
  });

  it('should clamp volume fraction to valid range', () => {
    // Above 1
    const savingsOver = calculateSavings(1.5, testDimensions, aluminum);
    expect(savingsOver.volumeFraction).toBe(1);
    
    // Below 0
    const savingsUnder = calculateSavings(-0.5, testDimensions, aluminum);
    expect(savingsUnder.volumeFraction).toBe(0);
  });

  it('should work with different materials', () => {
    const steel = getMaterial('steel-1018')!;
    const titanium = getMaterial('titanium-6al4v')!;
    
    const aluminumSavings = calculateSavings(0.5, testDimensions, aluminum);
    const steelSavings = calculateSavings(0.5, testDimensions, steel);
    const titaniumSavings = calculateSavings(0.5, testDimensions, titanium);
    
    // Steel is denser, so more mass saved
    expect(steelSavings.massSaved).toBeGreaterThan(aluminumSavings.massSaved);
    
    // Titanium is more expensive, so more cost saved per kg
    expect(titaniumSavings.costSaved / titaniumSavings.massSaved)
      .toBeGreaterThan(aluminumSavings.costSaved / aluminumSavings.massSaved);
  });

  it('should return the material in results', () => {
    const savings = calculateSavings(0.5, testDimensions, aluminum);
    expect(savings.material).toBe(aluminum);
    expect(savings.material.id).toBe('aluminum-6061');
  });
});

describe('calculateSavingsForAllMaterials', () => {
  const testDimensions: Dimensions = {
    length: 0.1,
    width: 0.1,
    height: 0.01,
  };

  it('should return results for all materials', () => {
    const results = calculateSavingsForAllMaterials(0.5, testDimensions);
    expect(results.length).toBe(MATERIALS.length);
  });

  it('should have consistent volume fraction across all results', () => {
    const results = calculateSavingsForAllMaterials(0.4, testDimensions);
    for (const result of results) {
      expect(result.volumeFraction).toBe(0.4);
    }
  });

  it('should have different masses for different materials', () => {
    const results = calculateSavingsForAllMaterials(0.5, testDimensions);
    const masses = results.map(r => r.optimizedMass);
    const uniqueMasses = new Set(masses.map(m => m.toFixed(6)));
    
    // Should have multiple unique masses (not all the same)
    expect(uniqueMasses.size).toBeGreaterThan(1);
  });
});

describe('calculateSavingsDefault', () => {
  it('should work with default parameters', () => {
    const savings = calculateSavingsDefault(0.5);
    expect(savings).not.toBeNull();
    expect(savings?.material.id).toBe('aluminum-6061');
  });

  it('should work with specified material', () => {
    const savings = calculateSavingsDefault(0.5, 'titanium-6al4v');
    expect(savings).not.toBeNull();
    expect(savings?.material.id).toBe('titanium-6al4v');
  });

  it('should return null for unknown material', () => {
    const savings = calculateSavingsDefault(0.5, 'unobtainium');
    expect(savings).toBeNull();
  });

  it('should use 1m x 1m x 0.1m default dimensions', () => {
    const savings = calculateSavingsDefault(1.0);
    // Volume = 1 * 1 * 0.1 = 0.1 m³
    expect(savings?.solidVolume).toBe(0.1);
  });
});

describe('formatMass', () => {
  it('should format kilograms correctly', () => {
    expect(formatMass(5.5)).toBe('5.50 kg');
    expect(formatMass(1.0)).toBe('1.00 kg');
    expect(formatMass(100.5)).toBe('100.50 kg');
  });

  it('should format grams for small values', () => {
    expect(formatMass(0.5)).toBe('500.0 g');
    expect(formatMass(0.001)).toBe('1.0 g');
    expect(formatMass(0.123)).toBe('123.0 g');
  });

  it('should format milligrams for very small values', () => {
    expect(formatMass(0.0005)).toBe('500.00 mg');
    expect(formatMass(0.000001)).toBe('1.00 mg');
  });
});

describe('formatCost', () => {
  it('should format dollars correctly', () => {
    expect(formatCost(5.5)).toBe('$5.50');
    expect(formatCost(100.0)).toBe('$100.00');
    expect(formatCost(999.99)).toBe('$999.99');
  });

  it('should format thousands with k suffix', () => {
    expect(formatCost(1000)).toBe('$1.00k');
    expect(formatCost(5500)).toBe('$5.50k');
    expect(formatCost(10000)).toBe('$10.00k');
  });

  it('should format cents for small values', () => {
    expect(formatCost(0.5)).toBe('$50.0¢');
    expect(formatCost(0.01)).toBe('$1.0¢');
  });
});

describe('formatVolume', () => {
  it('should format liters for larger volumes', () => {
    expect(formatVolume(0.001)).toBe('1.00 L');
    expect(formatVolume(0.005)).toBe('5.00 L');
  });

  it('should format cubic centimeters for medium volumes', () => {
    expect(formatVolume(0.0001)).toBe('100.0 cm³');
    expect(formatVolume(0.00001)).toBe('10.0 cm³');
    expect(formatVolume(0.000001)).toBe('1.0 cm³');
  });

  it('should format cubic millimeters for small volumes', () => {
    expect(formatVolume(0.0000001)).toBe('100.00 mm³');
    expect(formatVolume(0.000000001)).toBe('1.00 mm³');
  });
});

describe('getQuickStats', () => {
  it('should calculate material saved percent correctly', () => {
    const stats = getQuickStats(0.3);
    expect(stats.materialSavedPercent).toBe(70);
  });

  it('should calculate mass reduction ratio correctly', () => {
    const stats = getQuickStats(0.5);
    expect(stats.massReductionRatio).toBeCloseTo(2.0, 2);
    
    const stats2 = getQuickStats(0.25);
    expect(stats2.massReductionRatio).toBeCloseTo(4.0, 2);
  });

  it('should return top materials savings', () => {
    const stats = getQuickStats(0.5);
    expect(stats.topMaterialsSaved.length).toBe(3);
    
    // Check that the names are short versions
    const names = stats.topMaterialsSaved.map(m => m.name);
    expect(names).toContain('Aluminum');
    expect(names).toContain('Steel');
    expect(names).toContain('Titanium');
  });

  it('should use custom dimensions when provided', () => {
    const smallDimensions: Dimensions = {
      length: 0.01,
      width: 0.01,
      height: 0.01,
    };
    
    const largeDimensions: Dimensions = {
      length: 1.0,
      width: 1.0,
      height: 1.0,
    };
    
    const smallStats = getQuickStats(0.5, smallDimensions);
    const largeStats = getQuickStats(0.5, largeDimensions);
    
    // Same percentage saved, but different actual masses
    expect(smallStats.materialSavedPercent).toBe(largeStats.materialSavedPercent);
    
    // The formatted strings should be different due to scale
    // Large dimensions will have kg, small will have g or mg
    expect(smallStats.topMaterialsSaved[0].massSaved)
      .not.toBe(largeStats.topMaterialsSaved[0].massSaved);
  });

  it('should handle edge case of 0 volume fraction', () => {
    const stats = getQuickStats(0);
    expect(stats.materialSavedPercent).toBe(100);
    expect(stats.massReductionRatio).toBe(Infinity);
  });
});

describe('Material Properties Validation', () => {
  it('should have aluminum density around 2700 kg/m³', () => {
    const aluminum = getMaterial('aluminum-6061');
    expect(aluminum?.density).toBeGreaterThan(2500);
    expect(aluminum?.density).toBeLessThan(3000);
  });

  it('should have steel density around 7850-7900 kg/m³', () => {
    const steel = getMaterial('steel-1018');
    expect(steel?.density).toBeGreaterThan(7800);
    expect(steel?.density).toBeLessThan(8000);
  });

  it('should have titanium density around 4400 kg/m³', () => {
    const titanium = getMaterial('titanium-6al4v');
    expect(titanium?.density).toBeGreaterThan(4300);
    expect(titanium?.density).toBeLessThan(4600);
  });

  it('should have CFRP lighter than aluminum', () => {
    const cfrp = getMaterial('cfrp');
    const aluminum = getMaterial('aluminum-6061');
    expect(cfrp?.density).toBeLessThan(aluminum!.density);
  });

  it('should have titanium more expensive per kg than steel', () => {
    const titanium = getMaterial('titanium-6al4v');
    const steel = getMaterial('steel-1018');
    expect(titanium?.costPerKg).toBeGreaterThan(steel!.costPerKg);
  });
});

describe('Integration Scenarios', () => {
  it('should calculate realistic aerospace part savings', () => {
    // Typical aerospace bracket: 200mm x 100mm x 50mm
    const dimensions: Dimensions = {
      length: 0.2,
      width: 0.1,
      height: 0.05,
    };
    
    // Typical topology optimization achieves 40-60% volume reduction
    const volumeFraction = 0.4;
    
    const titaniumSavings = calculateSavings(
      volumeFraction,
      dimensions,
      getMaterial('titanium-6al4v')!
    );
    
    // Original solid would be 1L = 0.001 m³
    expect(titaniumSavings.solidVolume).toBeCloseTo(0.001, 6);
    
    // 60% material saved
    expect(titaniumSavings.materialSavedPercent).toBe(60);
    
    // For titanium at 4430 kg/m³:
    // Solid: 4.43 kg
    // Optimized: 1.772 kg
    // Saved: 2.658 kg
    expect(titaniumSavings.solidMass).toBeCloseTo(4.43, 1);
    expect(titaniumSavings.optimizedMass).toBeCloseTo(1.772, 1);
    expect(titaniumSavings.massSaved).toBeCloseTo(2.658, 1);
  });

  it('should calculate realistic 3D printing savings', () => {
    // Small 3D printed part: 50mm x 50mm x 20mm
    const dimensions: Dimensions = {
      length: 0.05,
      width: 0.05,
      height: 0.02,
    };
    
    const volumeFraction = 0.35;
    
    const plaSavings = calculateSavings(
      volumeFraction,
      dimensions,
      getMaterial('pla')!
    );
    
    // 65% material saved
    expect(plaSavings.materialSavedPercent).toBe(65);
    
    // For PLA at 1240 kg/m³:
    // Volume: 50 cm³ = 0.00005 m³
    // Solid: 0.062 kg = 62g
    expect(plaSavings.solidMass).toBeCloseTo(0.062, 3);
  });
});

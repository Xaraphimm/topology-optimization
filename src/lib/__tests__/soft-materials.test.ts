/**
 * Tests for Soft Materials Database and Calculations
 */

import { describe, it, expect } from 'vitest';
import {
  SOFT_MATERIALS,
  getSoftMaterial,
  getSoftMaterialsByCategory,
  getPrintableSoftMaterials,
  calculateAllowableStress,
  calculateMinimumDensity,
  estimateWallThickness,
  meetsWallThicknessConstraint,
  calculateVonMisesFromStrainEnergy,
  analyzeStressField,
  summarizeStressAnalysis,
  findRuptureRiskElements,
  formatStress,
  calculateMuscleWallThickness,
  type SoftMaterial,
} from '../soft-materials';

describe('Soft Materials Database', () => {
  it('should have a comprehensive list of soft materials', () => {
    expect(SOFT_MATERIALS.length).toBeGreaterThanOrEqual(10);
  });

  it('should include key soft material types', () => {
    const materialIds = SOFT_MATERIALS.map(m => m.id);
    expect(materialIds).toContain('ecoflex-0030');
    expect(materialIds).toContain('dragon-skin-30');
    expect(materialIds).toContain('tpu-95a');
    expect(materialIds).toContain('paam-hydrogel');
  });

  it('should have valid mechanical properties for all materials', () => {
    for (const material of SOFT_MATERIALS) {
      expect(material.density).toBeGreaterThan(0);
      expect(material.ultimateStress).toBeGreaterThan(0);
      expect(material.ultimateTensileStrain).toBeGreaterThan(0);
      expect(material.youngsModulus).toBeGreaterThan(0);
      expect(material.shoreHardness).toBeGreaterThanOrEqual(0);
      expect(material.shoreHardness).toBeLessThanOrEqual(100);
    }
  });

  it('should have valid categories for all materials', () => {
    const validCategories = ['elastomer', 'hydrogel', 'foam', 'textile'];
    for (const material of SOFT_MATERIALS) {
      expect(validCategories).toContain(material.category);
    }
  });

  it('should have valid hyperelastic model types', () => {
    const validModels = ['neo-hookean', 'mooney-rivlin', 'ogden', 'yeoh'];
    for (const material of SOFT_MATERIALS) {
      expect(validModels).toContain(material.hyperelasticModel);
    }
  });

  it('should have descriptions and applications for all materials', () => {
    for (const material of SOFT_MATERIALS) {
      expect(material.description.length).toBeGreaterThan(10);
      expect(material.applications.length).toBeGreaterThan(0);
    }
  });
});

describe('getSoftMaterial', () => {
  it('should return material by ID', () => {
    const ecoflex = getSoftMaterial('ecoflex-0030');
    expect(ecoflex).toBeDefined();
    expect(ecoflex?.name).toBe('Ecoflex 00-30');
    expect(ecoflex?.shoreHardness).toBe(30);
  });

  it('should return undefined for unknown material', () => {
    const unknown = getSoftMaterial('unobtainium');
    expect(unknown).toBeUndefined();
  });
});

describe('getSoftMaterialsByCategory', () => {
  it('should filter elastomers correctly', () => {
    const elastomers = getSoftMaterialsByCategory('elastomer');
    expect(elastomers.length).toBeGreaterThan(0);
    for (const m of elastomers) {
      expect(m.category).toBe('elastomer');
    }
  });

  it('should filter hydrogels correctly', () => {
    const hydrogels = getSoftMaterialsByCategory('hydrogel');
    expect(hydrogels.length).toBeGreaterThan(0);
    for (const m of hydrogels) {
      expect(m.category).toBe('hydrogel');
    }
  });
});

describe('getPrintableSoftMaterials', () => {
  it('should return only printable materials', () => {
    const printable = getPrintableSoftMaterials();
    expect(printable.length).toBeGreaterThan(0);
    for (const m of printable) {
      expect(m.printable).toBe(true);
    }
  });

  it('should include TPU materials', () => {
    const printable = getPrintableSoftMaterials();
    const hasTPU = printable.some(m => m.id.includes('tpu'));
    expect(hasTPU).toBe(true);
  });
});

describe('calculateAllowableStress', () => {
  const testMaterial: SoftMaterial = {
    id: 'test',
    name: 'Test Material',
    category: 'elastomer',
    density: 1000,
    shoreHardness: 50,
    ultimateStress: 2.0, // 2 MPa
    ultimateTensileStrain: 5.0,
    tearStrength: 10,
    youngsModulus: 0.5,
    shearModulus: 0.17,
    hyperelasticModel: 'neo-hookean',
    c10: 0.08,
    fatigueLimit: 0.5, // 0.5 MPa
    maxCycles: 100000,
    costPerKg: 50,
    printable: false,
    moldable: true,
    description: 'Test',
    applications: ['Testing'],
  };

  it('should calculate allowable stress with safety factor', () => {
    const allowable = calculateAllowableStress(testMaterial, 2.0);
    expect(allowable).toBe(1.0); // 2.0 / 2.0
  });

  it('should use ultimate stress by default', () => {
    const allowable = calculateAllowableStress(testMaterial, 1.0);
    expect(allowable).toBe(2.0); // Ultimate stress
  });

  it('should use fatigue limit when specified', () => {
    const allowable = calculateAllowableStress(testMaterial, 1.0, true);
    expect(allowable).toBe(0.5); // Fatigue limit
  });

  it('should apply safety factor to fatigue limit', () => {
    const allowable = calculateAllowableStress(testMaterial, 2.0, true);
    expect(allowable).toBe(0.25); // 0.5 / 2.0
  });
});

describe('calculateMinimumDensity', () => {
  it('should return 0 when stress is below allowable', () => {
    const minDensity = calculateMinimumDensity(0.5, 1.0, 3.0);
    expect(minDensity).toBe(0);
  });

  it('should calculate minimum density correctly', () => {
    // If applied stress is 8x allowable, with penal=3:
    // ρ_min = (8)^(1/3) = 2.0, clamped to 1.0
    const minDensity = calculateMinimumDensity(8.0, 1.0, 3.0);
    expect(minDensity).toBe(1.0);
  });

  it('should return reasonable values for typical stress ratios', () => {
    // Applied 2x allowable, penal=3: ρ_min = 2^(1/3) ≈ 1.26, clamped to 1.0
    const minDensity = calculateMinimumDensity(2.0, 1.0, 3.0);
    expect(minDensity).toBe(1.0);

    // Applied 1.5x allowable, penal=3: ρ_min = 1.5^(1/3) ≈ 1.145
    const minDensity2 = calculateMinimumDensity(1.5, 1.0, 3.0);
    expect(minDensity2).toBe(1.0);
  });

  it('should clamp to valid range', () => {
    const minDensity = calculateMinimumDensity(0.001, 1.0, 3.0);
    expect(minDensity).toBeGreaterThanOrEqual(0);
    expect(minDensity).toBeLessThanOrEqual(1);
  });
});

describe('estimateWallThickness', () => {
  it('should estimate wall thickness from density', () => {
    expect(estimateWallThickness(1.0, 1.0)).toBe(1.0);
    expect(estimateWallThickness(0.5, 2.0)).toBe(1.0);
    expect(estimateWallThickness(0.8, 1.5)).toBeCloseTo(1.2);
  });
});

describe('meetsWallThicknessConstraint', () => {
  it('should pass when all densities meet constraint', () => {
    const densities = new Float64Array([1.0, 0.9, 0.8, 0.001, 0.001]);
    const result = meetsWallThicknessConstraint(densities, 5, 1, 1.0, 0.5);
    expect(result.passes).toBe(true);
    expect(result.violations).toBe(0);
  });

  it('should fail when solid regions are too thin', () => {
    const densities = new Float64Array([0.3, 0.3, 0.3, 0.001, 0.001]); // 0.3 < 0.5 min
    const result = meetsWallThicknessConstraint(densities, 5, 1, 1.0, 0.5);
    expect(result.passes).toBe(false);
    expect(result.violations).toBe(3);
  });

  it('should ignore void regions', () => {
    const densities = new Float64Array([1.0, 0.05, 0.05, 0.001, 0.001]); // Low densities are voids
    const result = meetsWallThicknessConstraint(densities, 5, 1, 1.0, 0.5);
    expect(result.passes).toBe(true);
  });
});

describe('calculateVonMisesFromStrainEnergy', () => {
  it('should calculate von Mises stress from strain energy', () => {
    // σ_vm = √(2 * E * U / V)
    const strainEnergy = 0.5;
    const youngsModulus = 1.0;
    const elementVolume = 1.0;

    const vonMises = calculateVonMisesFromStrainEnergy(strainEnergy, youngsModulus, elementVolume);
    expect(vonMises).toBe(1.0); // √(2 * 1 * 0.5 / 1) = 1
  });

  it('should return 0 for zero strain energy', () => {
    const vonMises = calculateVonMisesFromStrainEnergy(0, 1.0, 1.0);
    expect(vonMises).toBe(0);
  });

  it('should handle different parameters', () => {
    const vonMises = calculateVonMisesFromStrainEnergy(2.0, 0.5, 2.0);
    // √(2 * 0.5 * 2.0 / 2.0) = √1 = 1
    expect(vonMises).toBe(1.0);
  });
});

describe('analyzeStressField', () => {
  const testMaterial = getSoftMaterial('ecoflex-0030')!;

  it('should analyze stress for all elements', () => {
    const strainEnergy = new Float64Array([0.1, 0.2, 0.3, 0.4]);
    const densities = new Float64Array([1.0, 0.8, 0.6, 0.4]);
    const elementVolume = 1.0;

    const results = analyzeStressField(strainEnergy, densities, testMaterial, elementVolume);

    expect(results.length).toBe(4);
    for (const result of results) {
      expect(result.vonMises).toBeGreaterThanOrEqual(0);
      expect(result.ruptureRisk).toBeGreaterThanOrEqual(0);
      expect(result.ruptureRisk).toBeLessThanOrEqual(1);
    }
  });

  it('should calculate safety margin correctly', () => {
    const strainEnergy = new Float64Array([0.0001]); // Very low stress
    const densities = new Float64Array([1.0]);
    const elementVolume = 1.0;

    const results = analyzeStressField(strainEnergy, densities, testMaterial, elementVolume, 2.0);

    expect(results[0].safetyMargin).toBeGreaterThan(1); // Should be safe
  });
});

describe('summarizeStressAnalysis', () => {
  const testMaterial = getSoftMaterial('ecoflex-0030')!;

  it('should summarize stress results correctly', () => {
    const stressResults = [
      { vonMises: 0.1, maxPrincipal: 0.11, minPrincipal: -0.03, safetyMargin: 7.0, ruptureRisk: 0.07 },
      { vonMises: 0.2, maxPrincipal: 0.22, minPrincipal: -0.06, safetyMargin: 3.5, ruptureRisk: 0.14 },
      { vonMises: 0.5, maxPrincipal: 0.55, minPrincipal: -0.15, safetyMargin: 1.4, ruptureRisk: 0.36 },
    ];

    const summary = summarizeStressAnalysis(stressResults, testMaterial, 2.0);

    expect(summary.maxVonMises).toBe(0.5);
    expect(summary.avgVonMises).toBeCloseTo(0.267, 2);
    expect(summary.minSafetyMargin).toBe(1.4);
    expect(summary.elementsAtRisk).toBe(0); // None above 80% risk
    expect(summary.passesConstraint).toBe(true);
  });

  it('should identify elements at risk', () => {
    const stressResults = [
      { vonMises: 0.1, maxPrincipal: 0.11, minPrincipal: -0.03, safetyMargin: 7.0, ruptureRisk: 0.07 },
      { vonMises: 1.2, maxPrincipal: 1.32, minPrincipal: -0.36, safetyMargin: 0.58, ruptureRisk: 0.86 }, // At risk
      { vonMises: 1.5, maxPrincipal: 1.65, minPrincipal: -0.45, safetyMargin: 0.47, ruptureRisk: 1.0 }, // At risk
    ];

    const summary = summarizeStressAnalysis(stressResults, testMaterial, 2.0);

    expect(summary.elementsAtRisk).toBe(2);
    expect(summary.passesConstraint).toBe(false);
    expect(summary.recommendation).toContain('WARNING');
  });
});

describe('findRuptureRiskElements', () => {
  it('should find elements above threshold', () => {
    const stressResults = [
      { vonMises: 0.1, maxPrincipal: 0.11, minPrincipal: -0.03, safetyMargin: 7.0, ruptureRisk: 0.5 },
      { vonMises: 0.5, maxPrincipal: 0.55, minPrincipal: -0.15, safetyMargin: 1.4, ruptureRisk: 0.85 },
      { vonMises: 1.0, maxPrincipal: 1.1, minPrincipal: -0.3, safetyMargin: 0.7, ruptureRisk: 0.95 },
    ];

    const atRisk = findRuptureRiskElements(stressResults, 0.8);

    expect(atRisk.length).toBe(2);
    expect(atRisk).toContain(1);
    expect(atRisk).toContain(2);
  });

  it('should return empty array when no elements at risk', () => {
    const stressResults = [
      { vonMises: 0.1, maxPrincipal: 0.11, minPrincipal: -0.03, safetyMargin: 7.0, ruptureRisk: 0.1 },
      { vonMises: 0.2, maxPrincipal: 0.22, minPrincipal: -0.06, safetyMargin: 3.5, ruptureRisk: 0.2 },
    ];

    const atRisk = findRuptureRiskElements(stressResults, 0.8);

    expect(atRisk.length).toBe(0);
  });
});

describe('formatStress', () => {
  it('should format MPa correctly', () => {
    expect(formatStress(5.5)).toBe('5.50 MPa');
    expect(formatStress(1.0)).toBe('1.00 MPa');
    expect(formatStress(100.5)).toBe('100.50 MPa');
  });

  it('should format kPa for small values', () => {
    expect(formatStress(0.5)).toBe('500.0 kPa');
    expect(formatStress(0.001)).toBe('1.0 kPa');
  });

  it('should format Pa for very small values', () => {
    expect(formatStress(0.0005)).toBe('500 Pa');
  });
});

describe('calculateMuscleWallThickness', () => {
  const testMaterial = getSoftMaterial('dragon-skin-30')!;

  it('should calculate wall thickness for pneumatic muscle', () => {
    const params = {
      maxPressure: 0.2, // 0.2 MPa = 200 kPa
      maxStroke: 20,
      force: 10,
      diameter: 20, // 20mm outer diameter
    };

    const result = calculateMuscleWallThickness(params, testMaterial, 2.0);

    expect(result.wallThickness).toBeGreaterThan(0);
    expect(result.wallThickness).toBeLessThan(10); // Less than radius
    expect(result.innerDiameter).toBeGreaterThan(0);
    expect(result.innerDiameter).toBeLessThan(20);
    expect(result.safetyMargin).toBeGreaterThanOrEqual(1.0);
  });

  it('should handle high pressure requiring thick walls', () => {
    const params = {
      maxPressure: 1.0, // 1 MPa - high pressure
      maxStroke: 20,
      force: 50,
      diameter: 20,
    };

    const result = calculateMuscleWallThickness(params, testMaterial, 2.0);

    // Higher pressure should result in thicker walls
    expect(result.wallThickness).toBeGreaterThan(1);
  });

  it('should return zero inner diameter if pressure exceeds capability', () => {
    const weakMaterial = getSoftMaterial('alginate-hydrogel')!; // Very weak
    const params = {
      maxPressure: 0.5, // 0.5 MPa - too high for alginate
      maxStroke: 20,
      force: 10,
      diameter: 20,
    };

    const result = calculateMuscleWallThickness(params, weakMaterial, 2.0);

    // Should indicate the material can't handle this pressure
    expect(result.innerDiameter).toBe(0);
    expect(result.safetyMargin).toBe(0);
  });
});

describe('Material Properties Validation', () => {
  it('should have silicones with realistic properties', () => {
    const ecoflex = getSoftMaterial('ecoflex-0030');
    expect(ecoflex?.ultimateStress).toBeGreaterThan(0.5);
    expect(ecoflex?.ultimateStress).toBeLessThan(5);
    expect(ecoflex?.ultimateTensileStrain).toBeGreaterThan(1); // >100%
  });

  it('should have TPU stiffer than silicones', () => {
    const ecoflex = getSoftMaterial('ecoflex-0030')!;
    const tpu = getSoftMaterial('tpu-95a')!;

    expect(tpu.youngsModulus).toBeGreaterThan(ecoflex.youngsModulus);
    expect(tpu.ultimateStress).toBeGreaterThan(ecoflex.ultimateStress);
  });

  it('should have hydrogels weaker than elastomers', () => {
    const ecoflex = getSoftMaterial('ecoflex-0030')!;
    const hydrogel = getSoftMaterial('paam-hydrogel')!;

    expect(hydrogel.ultimateStress).toBeLessThan(ecoflex.ultimateStress);
  });
});

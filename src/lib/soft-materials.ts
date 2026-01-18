/**
 * Soft Materials Database for Artificial Muscle Optimization
 *
 * Provides material definitions and mechanical properties for soft/hyperelastic
 * materials commonly used in artificial muscles, soft robotics, and flexible structures.
 *
 * Key properties for soft material optimization:
 * - Ultimate stress (rupture threshold)
 * - Maximum strain before failure
 * - Hyperelastic model parameters
 * - Safety factors for wall thickness calculations
 */

/**
 * Hyperelastic material model types
 * - neo-hookean: Simplest model, good for moderate strains (<30%)
 * - mooney-rivlin: Better for rubber-like materials
 * - ogden: Most accurate for large strains, complex fitting
 * - yeoh: Good balance of accuracy and simplicity
 */
export type HyperelasticModel = 'neo-hookean' | 'mooney-rivlin' | 'ogden' | 'yeoh';

/**
 * Soft material definition with mechanical properties
 */
export interface SoftMaterial {
  id: string;
  name: string;
  category: 'elastomer' | 'hydrogel' | 'foam' | 'textile';

  // Basic mechanical properties
  density: number;              // kg/m³
  shoreHardness: number;        // Shore A (0-100)

  // Strength properties (critical for rupture prevention)
  ultimateStress: number;       // MPa - stress at rupture
  ultimateTensileStrain: number; // Maximum strain before failure (e.g., 5.0 = 500%)
  tearStrength: number;         // kN/m - resistance to tear propagation

  // Stiffness (for optimization)
  youngsModulus: number;        // MPa - initial/tangent modulus
  shearModulus: number;         // MPa - G = E / (2(1+ν))

  // Hyperelastic model parameters (Neo-Hookean for simplicity)
  hyperelasticModel: HyperelasticModel;
  c10: number;                  // MPa - Neo-Hookean/Mooney-Rivlin parameter
  c01?: number;                 // MPa - Mooney-Rivlin second parameter

  // Fatigue properties (for cyclic loading in muscles)
  fatigueLimit?: number;        // MPa - stress for infinite life
  maxCycles?: number;           // Typical cycles to failure at ultimate/2

  // Cost and manufacturing
  costPerKg: number;            // USD/kg
  printable: boolean;           // Can be 3D printed
  moldable: boolean;            // Can be injection/compression molded

  // Description
  description: string;
  applications: string[];
}

/**
 * Database of common soft materials for artificial muscles and soft robotics
 * Properties from manufacturer datasheets and literature
 */
export const SOFT_MATERIALS: SoftMaterial[] = [
  // === SILICONE ELASTOMERS ===
  {
    id: 'ecoflex-0030',
    name: 'Ecoflex 00-30',
    category: 'elastomer',
    density: 1070,
    shoreHardness: 30,
    ultimateStress: 1.4,
    ultimateTensileStrain: 9.0, // 900% elongation
    tearStrength: 6.5,
    youngsModulus: 0.069, // Very soft
    shearModulus: 0.023,
    hyperelasticModel: 'neo-hookean',
    c10: 0.017,
    fatigueLimit: 0.2,
    maxCycles: 100000,
    costPerKg: 45,
    printable: false,
    moldable: true,
    description: 'Ultra-soft platinum-cure silicone, excellent for pneumatic actuators',
    applications: ['Pneumatic muscles', 'Soft grippers', 'Wearable sensors'],
  },
  {
    id: 'ecoflex-0050',
    name: 'Ecoflex 00-50',
    category: 'elastomer',
    density: 1070,
    shoreHardness: 50,
    ultimateStress: 2.2,
    ultimateTensileStrain: 8.0,
    tearStrength: 9.8,
    youngsModulus: 0.083,
    shearModulus: 0.028,
    hyperelasticModel: 'neo-hookean',
    c10: 0.021,
    fatigueLimit: 0.35,
    maxCycles: 150000,
    costPerKg: 45,
    printable: false,
    moldable: true,
    description: 'Medium-soft silicone, good balance of strength and flexibility',
    applications: ['McKibben muscles', 'Soft actuators', 'Prosthetics'],
  },
  {
    id: 'dragon-skin-10',
    name: 'Dragon Skin 10',
    category: 'elastomer',
    density: 1080,
    shoreHardness: 10,
    ultimateStress: 2.8,
    ultimateTensileStrain: 10.0,
    tearStrength: 8.9,
    youngsModulus: 0.151,
    shearModulus: 0.050,
    hyperelasticModel: 'neo-hookean',
    c10: 0.025,
    fatigueLimit: 0.4,
    maxCycles: 200000,
    costPerKg: 55,
    printable: false,
    moldable: true,
    description: 'High-performance silicone with excellent tear resistance',
    applications: ['High-cycle actuators', 'Prosthetic sockets', 'Skin simulants'],
  },
  {
    id: 'dragon-skin-30',
    name: 'Dragon Skin 30',
    category: 'elastomer',
    density: 1080,
    shoreHardness: 30,
    ultimateStress: 3.4,
    ultimateTensileStrain: 6.4,
    tearStrength: 17.9,
    youngsModulus: 0.59,
    shearModulus: 0.20,
    hyperelasticModel: 'neo-hookean',
    c10: 0.098,
    fatigueLimit: 0.6,
    maxCycles: 300000,
    costPerKg: 55,
    printable: false,
    moldable: true,
    description: 'Strong silicone with high tear strength, ideal for high-pressure applications',
    applications: ['High-pressure muscles', 'Structural soft robots', 'Medical devices'],
  },
  {
    id: 'sylgard-184',
    name: 'Sylgard 184 PDMS',
    category: 'elastomer',
    density: 1030,
    shoreHardness: 50,
    ultimateStress: 6.7,
    ultimateTensileStrain: 1.2,
    tearStrength: 2.6,
    youngsModulus: 2.6,
    shearModulus: 0.87,
    hyperelasticModel: 'neo-hookean',
    c10: 0.29,
    fatigueLimit: 1.0,
    maxCycles: 50000,
    costPerKg: 120,
    printable: false,
    moldable: true,
    description: 'Precision PDMS for microfluidics, stiffer than Ecoflex',
    applications: ['Microfluidic muscles', 'Lab-on-chip', 'Optical devices'],
  },

  // === THERMOPLASTIC ELASTOMERS ===
  {
    id: 'tpu-95a',
    name: 'TPU 95A (Flexible)',
    category: 'elastomer',
    density: 1210,
    shoreHardness: 95,
    ultimateStress: 35,
    ultimateTensileStrain: 5.8,
    tearStrength: 85,
    youngsModulus: 26,
    shearModulus: 8.7,
    hyperelasticModel: 'neo-hookean',
    c10: 4.3,
    fatigueLimit: 8,
    maxCycles: 500000,
    costPerKg: 35,
    printable: true,
    moldable: true,
    description: '3D printable flexible TPU, excellent for prototyping',
    applications: ['Prototypes', 'Bellows actuators', 'Flexible joints'],
  },
  {
    id: 'tpu-80a',
    name: 'TPU 80A (Soft)',
    category: 'elastomer',
    density: 1180,
    shoreHardness: 80,
    ultimateStress: 20,
    ultimateTensileStrain: 7.0,
    tearStrength: 45,
    youngsModulus: 8,
    shearModulus: 2.7,
    hyperelasticModel: 'neo-hookean',
    c10: 1.3,
    fatigueLimit: 4,
    maxCycles: 300000,
    costPerKg: 40,
    printable: true,
    moldable: true,
    description: 'Softer TPU variant, good for higher deformation applications',
    applications: ['Soft grippers', 'Wearables', 'Dampers'],
  },
  {
    id: 'ninjaflex',
    name: 'NinjaFlex TPU',
    category: 'elastomer',
    density: 1190,
    shoreHardness: 85,
    ultimateStress: 26,
    ultimateTensileStrain: 6.6,
    tearStrength: 52,
    youngsModulus: 12,
    shearModulus: 4.0,
    hyperelasticModel: 'neo-hookean',
    c10: 2.0,
    fatigueLimit: 5,
    maxCycles: 200000,
    costPerKg: 65,
    printable: true,
    moldable: false,
    description: 'Popular FDM-printable flexible filament',
    applications: ['FDM prototypes', 'Phone cases', 'Soft robotics research'],
  },

  // === HYDROGELS ===
  {
    id: 'paam-hydrogel',
    name: 'PAAm Hydrogel (Tough)',
    category: 'hydrogel',
    density: 1050,
    shoreHardness: 15,
    ultimateStress: 0.8,
    ultimateTensileStrain: 20.0, // 2000% for tough hydrogels
    tearStrength: 1.0,
    youngsModulus: 0.03,
    shearModulus: 0.01,
    hyperelasticModel: 'neo-hookean',
    c10: 0.005,
    fatigueLimit: 0.1,
    maxCycles: 10000,
    costPerKg: 25,
    printable: false,
    moldable: true,
    description: 'Tough double-network hydrogel, biocompatible',
    applications: ['Biomedical actuators', 'Drug delivery', 'Artificial cartilage'],
  },
  {
    id: 'alginate-hydrogel',
    name: 'Alginate Hydrogel',
    category: 'hydrogel',
    density: 1020,
    shoreHardness: 5,
    ultimateStress: 0.1,
    ultimateTensileStrain: 1.5,
    tearStrength: 0.2,
    youngsModulus: 0.05,
    shearModulus: 0.017,
    hyperelasticModel: 'neo-hookean',
    c10: 0.008,
    costPerKg: 15,
    printable: true,
    moldable: true,
    description: 'Bioprinting-compatible natural hydrogel',
    applications: ['Tissue scaffolds', 'Cell encapsulation', 'Biodegradable actuators'],
  },

  // === FOAMS ===
  {
    id: 'poron-foam',
    name: 'PORON Urethane Foam',
    category: 'foam',
    density: 320,
    shoreHardness: 25,
    ultimateStress: 0.4,
    ultimateTensileStrain: 2.0,
    tearStrength: 3.5,
    youngsModulus: 0.15,
    shearModulus: 0.05,
    hyperelasticModel: 'neo-hookean',
    c10: 0.025,
    fatigueLimit: 0.08,
    maxCycles: 1000000,
    costPerKg: 80,
    printable: false,
    moldable: true,
    description: 'Microcellular urethane with excellent energy return',
    applications: ['Impact absorption', 'Cushioning actuators', 'Shoe soles'],
  },

  // === SPECIALTY ===
  {
    id: 'hasel-dielectric',
    name: 'HASEL Dielectric Elastomer',
    category: 'elastomer',
    density: 1050,
    shoreHardness: 40,
    ultimateStress: 3.0,
    ultimateTensileStrain: 5.0,
    tearStrength: 10,
    youngsModulus: 0.5,
    shearModulus: 0.17,
    hyperelasticModel: 'neo-hookean',
    c10: 0.083,
    fatigueLimit: 0.5,
    maxCycles: 100000,
    costPerKg: 200,
    printable: false,
    moldable: true,
    description: 'Hydraulically amplified self-healing electrostatic actuator material',
    applications: ['HASEL actuators', 'Electroactive polymers', 'High-speed muscles'],
  },
];

/**
 * Get a soft material by ID
 */
export function getSoftMaterial(id: string): SoftMaterial | undefined {
  return SOFT_MATERIALS.find(m => m.id === id);
}

/**
 * Get soft materials by category
 */
export function getSoftMaterialsByCategory(category: SoftMaterial['category']): SoftMaterial[] {
  return SOFT_MATERIALS.filter(m => m.category === category);
}

/**
 * Get printable soft materials
 */
export function getPrintableSoftMaterials(): SoftMaterial[] {
  return SOFT_MATERIALS.filter(m => m.printable);
}

/**
 * Stress constraint configuration for soft material optimization
 */
export interface StressConstraintConfig {
  material: SoftMaterial;
  safetyFactor: number;           // Typically 1.5-3.0 for soft materials
  minWallThickness: number;       // mm - minimum manufacturable wall
  maxStress: number;              // MPa - computed from material + safety factor
  considerFatigue: boolean;       // Use fatigue limit instead of ultimate
  targetCycles?: number;          // Design life in cycles
}

/**
 * Calculate maximum allowable stress for a material with safety factor
 */
export function calculateAllowableStress(
  material: SoftMaterial,
  safetyFactor: number = 2.0,
  useFatigue: boolean = false
): number {
  if (useFatigue && material.fatigueLimit) {
    return material.fatigueLimit / safetyFactor;
  }
  return material.ultimateStress / safetyFactor;
}

/**
 * Calculate minimum density needed to keep stress below allowable
 * Used in stress-constrained topology optimization
 *
 * For SIMP: σ = σ_0 / ρ^p (stress increases as density decreases)
 * Therefore: ρ_min = (σ_0 / σ_allowable)^(1/p)
 */
export function calculateMinimumDensity(
  appliedStress: number,   // MPa - stress at full density
  allowableStress: number, // MPa - maximum allowed stress
  penalization: number = 3.0
): number {
  if (appliedStress <= allowableStress) {
    return 0; // No minimum density constraint needed
  }

  // ρ_min = (σ_applied / σ_allowable)^(1/p)
  const minDensity = Math.pow(appliedStress / allowableStress, 1 / penalization);
  return Math.min(1.0, Math.max(0.001, minDensity));
}

/**
 * Estimate wall thickness from element density and mesh size
 */
export function estimateWallThickness(
  density: number,
  elementSize: number, // mm
): number {
  // Approximate: wall thickness ~ density * element size
  return density * elementSize;
}

/**
 * Check if a design meets minimum wall thickness constraint
 */
export function meetsWallThicknessConstraint(
  densities: Float64Array,
  nelx: number,
  nely: number,
  elementSize: number, // mm
  minWallThickness: number, // mm
): { passes: boolean; violations: number; minFound: number } {
  const minDensityRequired = minWallThickness / elementSize;

  let violations = 0;
  let minFound = 1.0;

  for (let i = 0; i < densities.length; i++) {
    const d = densities[i];
    if (d > 0.1 && d < minDensityRequired) { // Only check "solid" regions
      violations++;
    }
    if (d > 0.1 && d < minFound) {
      minFound = d;
    }
  }

  return {
    passes: violations === 0,
    violations,
    minFound: estimateWallThickness(minFound, elementSize),
  };
}

/**
 * Stress analysis result per element
 */
export interface ElementStressResult {
  vonMises: number;         // MPa - von Mises equivalent stress
  maxPrincipal: number;     // MPa - maximum principal stress
  minPrincipal: number;     // MPa - minimum principal stress (compression negative)
  safetyMargin: number;     // > 1 is safe, < 1 is failure
  ruptureRisk: number;      // 0-1, where 1 = certain rupture
}

/**
 * Calculate von Mises stress from strain energy and element properties
 * Approximation for visualization purposes
 *
 * For linear elasticity: σ_vm ≈ √(2 * E * U / V)
 * where U is strain energy and V is element volume
 */
export function calculateVonMisesFromStrainEnergy(
  strainEnergy: number,
  youngsModulus: number, // MPa
  elementVolume: number, // mm³
): number {
  if (strainEnergy <= 0 || elementVolume <= 0) return 0;

  // σ_vm ≈ √(2 * E * U / V) - simplified approximation
  return Math.sqrt(2 * youngsModulus * strainEnergy / elementVolume);
}

/**
 * Analyze stress for all elements and determine rupture risk
 */
export function analyzeStressField(
  strainEnergy: Float64Array,
  densities: Float64Array,
  material: SoftMaterial,
  elementVolume: number, // mm³
  safetyFactor: number = 2.0,
): ElementStressResult[] {
  const allowableStress = calculateAllowableStress(material, safetyFactor);
  const results: ElementStressResult[] = [];

  for (let i = 0; i < strainEnergy.length; i++) {
    const density = densities[i];

    // Scale Young's modulus by density (SIMP)
    const effectiveE = material.youngsModulus * Math.pow(density, 3);

    // Calculate von Mises stress
    const vonMises = calculateVonMisesFromStrainEnergy(
      strainEnergy[i],
      effectiveE,
      elementVolume * density // Effective volume
    );

    // Safety margin: > 1 is safe
    const safetyMargin = vonMises > 0 ? allowableStress / vonMises : Infinity;

    // Rupture risk: 0 = safe, 1 = at rupture
    const ruptureRisk = Math.min(1, vonMises / material.ultimateStress);

    results.push({
      vonMises,
      maxPrincipal: vonMises * 1.1, // Approximation
      minPrincipal: -vonMises * 0.3, // Approximation
      safetyMargin,
      ruptureRisk,
    });
  }

  return results;
}

/**
 * Find elements at risk of rupture
 */
export function findRuptureRiskElements(
  stressResults: ElementStressResult[],
  threshold: number = 0.8 // 80% of rupture stress
): number[] {
  const atRisk: number[] = [];

  for (let i = 0; i < stressResults.length; i++) {
    if (stressResults[i].ruptureRisk >= threshold) {
      atRisk.push(i);
    }
  }

  return atRisk;
}

/**
 * Summary of stress analysis for a design
 */
export interface StressAnalysisSummary {
  maxVonMises: number;          // MPa
  avgVonMises: number;          // MPa
  minSafetyMargin: number;      // Minimum safety factor achieved
  elementsAtRisk: number;       // Count of elements near rupture
  passesConstraint: boolean;    // Overall pass/fail
  recommendation: string;       // User-friendly recommendation
}

/**
 * Generate summary of stress analysis
 */
export function summarizeStressAnalysis(
  stressResults: ElementStressResult[],
  material: SoftMaterial,
  safetyFactor: number = 2.0,
): StressAnalysisSummary {
  let maxVonMises = 0;
  let sumVonMises = 0;
  let minSafetyMargin = Infinity;
  let elementsAtRisk = 0;

  for (const result of stressResults) {
    if (result.vonMises > maxVonMises) maxVonMises = result.vonMises;
    sumVonMises += result.vonMises;
    if (result.safetyMargin < minSafetyMargin) minSafetyMargin = result.safetyMargin;
    if (result.ruptureRisk >= 0.8) elementsAtRisk++;
  }

  const avgVonMises = sumVonMises / stressResults.length;
  const allowableStress = calculateAllowableStress(material, safetyFactor);
  const passesConstraint = maxVonMises <= allowableStress;

  let recommendation: string;
  if (minSafetyMargin >= safetyFactor) {
    recommendation = 'Design meets safety requirements. Safe for fabrication.';
  } else if (minSafetyMargin >= 1.0) {
    recommendation = `Design has reduced safety margin (${minSafetyMargin.toFixed(2)}x). Consider increasing wall thickness.`;
  } else {
    recommendation = `WARNING: Design exceeds material limits! Increase density or choose stronger material.`;
  }

  return {
    maxVonMises,
    avgVonMises,
    minSafetyMargin: minSafetyMargin === Infinity ? safetyFactor : minSafetyMargin,
    elementsAtRisk,
    passesConstraint,
    recommendation,
  };
}

/**
 * Format stress value for display
 */
export function formatStress(mpa: number): string {
  if (mpa >= 1) {
    return `${mpa.toFixed(2)} MPa`;
  } else if (mpa >= 0.001) {
    return `${(mpa * 1000).toFixed(1)} kPa`;
  } else {
    return `${(mpa * 1000000).toFixed(0)} Pa`;
  }
}

/**
 * Artificial muscle specific calculations
 */
export interface MuscleDesignParams {
  maxPressure: number;         // MPa - internal pressure
  maxStroke: number;           // % - desired contraction
  force: number;               // N - output force required
  diameter: number;            // mm - muscle outer diameter
}

/**
 * Calculate required wall thickness for a pneumatic muscle
 * Using thick-walled cylinder formula (Lamé equations)
 */
export function calculateMuscleWallThickness(
  params: MuscleDesignParams,
  material: SoftMaterial,
  safetyFactor: number = 2.0,
): { wallThickness: number; innerDiameter: number; safetyMargin: number } {
  const { maxPressure, diameter } = params;
  const outerRadius = diameter / 2;

  const allowableStress = calculateAllowableStress(material, safetyFactor);

  // Thick-wall cylinder: σ_hoop = p * (ri² + ro²) / (ro² - ri²)
  // Solving for ri given σ_allowable and p:
  // ri = ro * √((σ - p) / (σ + p))

  const stressRatio = (allowableStress - maxPressure) / (allowableStress + maxPressure);

  if (stressRatio <= 0) {
    // Pressure exceeds material capability
    return { wallThickness: diameter / 2, innerDiameter: 0, safetyMargin: 0 };
  }

  const innerRadius = outerRadius * Math.sqrt(stressRatio);
  const wallThickness = outerRadius - innerRadius;

  // Verify actual stress
  const actualHoopStress = maxPressure * (innerRadius * innerRadius + outerRadius * outerRadius)
    / (outerRadius * outerRadius - innerRadius * innerRadius);

  return {
    wallThickness,
    innerDiameter: innerRadius * 2,
    safetyMargin: allowableStress / actualHoopStress,
  };
}

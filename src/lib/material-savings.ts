/**
 * Material Savings Calculator
 * 
 * Calculates material and weight savings from topology optimization.
 * Includes database of common engineering materials with density and cost data.
 */

/**
 * Material definition with physical properties
 */
export interface Material {
  id: string;
  name: string;
  density: number;        // kg/m³
  costPerKg: number;      // USD/kg (approximate)
  category: 'metal' | 'polymer' | 'composite';
  description: string;
}

/**
 * Database of common engineering materials
 * Densities from engineering handbooks, costs are approximate market values
 */
export const MATERIALS: Material[] = [
  {
    id: 'aluminum-6061',
    name: 'Aluminum 6061-T6',
    density: 2700,
    costPerKg: 3.5,
    category: 'metal',
    description: 'General purpose aluminum alloy, excellent machinability',
  },
  {
    id: 'aluminum-7075',
    name: 'Aluminum 7075-T6',
    density: 2810,
    costPerKg: 5.0,
    category: 'metal',
    description: 'High-strength aerospace aluminum',
  },
  {
    id: 'steel-1018',
    name: 'Steel 1018',
    density: 7870,
    costPerKg: 1.0,
    category: 'metal',
    description: 'Low carbon steel, common structural material',
  },
  {
    id: 'steel-4340',
    name: 'Steel 4340',
    density: 7850,
    costPerKg: 2.5,
    category: 'metal',
    description: 'High-strength alloy steel for critical components',
  },
  {
    id: 'titanium-6al4v',
    name: 'Titanium 6Al-4V',
    density: 4430,
    costPerKg: 35.0,
    category: 'metal',
    description: 'Aerospace-grade titanium alloy, excellent strength-to-weight',
  },
  {
    id: 'inconel-718',
    name: 'Inconel 718',
    density: 8190,
    costPerKg: 45.0,
    category: 'metal',
    description: 'Nickel superalloy for high-temperature applications',
  },
  {
    id: 'abs',
    name: 'ABS Plastic',
    density: 1040,
    costPerKg: 2.0,
    category: 'polymer',
    description: 'Common 3D printing plastic',
  },
  {
    id: 'pla',
    name: 'PLA Plastic',
    density: 1240,
    costPerKg: 2.5,
    category: 'polymer',
    description: 'Biodegradable 3D printing plastic',
  },
  {
    id: 'nylon-pa12',
    name: 'Nylon PA12',
    density: 1010,
    costPerKg: 4.0,
    category: 'polymer',
    description: 'Engineering plastic for functional parts',
  },
  {
    id: 'cfrp',
    name: 'Carbon Fiber (CFRP)',
    density: 1550,
    costPerKg: 25.0,
    category: 'composite',
    description: 'Carbon fiber reinforced polymer, highest specific strength',
  },
];

/**
 * Get a material by ID
 */
export function getMaterial(id: string): Material | undefined {
  return MATERIALS.find(m => m.id === id);
}

/**
 * Get materials by category
 */
export function getMaterialsByCategory(category: Material['category']): Material[] {
  return MATERIALS.filter(m => m.category === category);
}

/**
 * Physical dimensions for volume calculation
 * All values in meters
 */
export interface Dimensions {
  length: number;  // meters
  width: number;   // meters
  height: number;  // meters
}

/**
 * Results from material savings calculation
 */
export interface SavingsResult {
  // Volume metrics
  volumeFraction: number;           // 0-1, fraction of material used
  materialSavedPercent: number;     // Percentage of material saved (0-100)
  
  // Solid block reference (without optimization)
  solidVolume: number;              // m³
  solidMass: number;                // kg
  solidCost: number;                // USD
  
  // Optimized structure
  optimizedVolume: number;          // m³
  optimizedMass: number;            // kg
  optimizedCost: number;            // USD
  
  // Savings
  volumeSaved: number;              // m³
  massSaved: number;                // kg
  costSaved: number;                // USD
  
  // Material info
  material: Material;
}

/**
 * Calculate material savings for a given optimization result
 * 
 * @param volumeFraction - Fraction of material used (0-1)
 * @param dimensions - Physical dimensions of the design envelope
 * @param material - Material to calculate for
 * @returns Detailed savings breakdown
 */
export function calculateSavings(
  volumeFraction: number,
  dimensions: Dimensions,
  material: Material
): SavingsResult {
  // Validate inputs
  const vf = Math.max(0, Math.min(1, volumeFraction));
  const solidVolume = dimensions.length * dimensions.width * dimensions.height;
  
  // Solid block (without optimization)
  const solidMass = solidVolume * material.density;
  const solidCost = solidMass * material.costPerKg;
  
  // Optimized structure
  const optimizedVolume = solidVolume * vf;
  const optimizedMass = optimizedVolume * material.density;
  const optimizedCost = optimizedMass * material.costPerKg;
  
  // Savings
  const volumeSaved = solidVolume - optimizedVolume;
  const massSaved = solidMass - optimizedMass;
  const costSaved = solidCost - optimizedCost;
  const materialSavedPercent = (1 - vf) * 100;
  
  return {
    volumeFraction: vf,
    materialSavedPercent,
    solidVolume,
    solidMass,
    solidCost,
    optimizedVolume,
    optimizedMass,
    optimizedCost,
    volumeSaved,
    massSaved,
    costSaved,
    material,
  };
}

/**
 * Quick calculation for multiple materials
 * Returns savings for each material in the database
 */
export function calculateSavingsForAllMaterials(
  volumeFraction: number,
  dimensions: Dimensions
): SavingsResult[] {
  return MATERIALS.map(material => calculateSavings(volumeFraction, dimensions, material));
}

/**
 * Calculate savings with default 1m x 1m x 0.1m dimensions
 * Useful for quick comparisons
 */
export function calculateSavingsDefault(
  volumeFraction: number,
  materialId: string = 'aluminum-6061'
): SavingsResult | null {
  const material = getMaterial(materialId);
  if (!material) return null;
  
  const defaultDimensions: Dimensions = {
    length: 1.0,    // 1 meter
    width: 1.0,     // 1 meter
    height: 0.1,    // 100mm thick
  };
  
  return calculateSavings(volumeFraction, defaultDimensions, material);
}

/**
 * Format mass for display (auto-select kg or g)
 */
export function formatMass(kg: number): string {
  if (kg >= 1) {
    return `${kg.toFixed(2)} kg`;
  } else if (kg >= 0.001) {
    return `${(kg * 1000).toFixed(1)} g`;
  } else {
    return `${(kg * 1000000).toFixed(2)} mg`;
  }
}

/**
 * Format cost for display
 */
export function formatCost(usd: number): string {
  if (usd >= 1000) {
    return `$${(usd / 1000).toFixed(2)}k`;
  } else if (usd >= 1) {
    return `$${usd.toFixed(2)}`;
  } else {
    return `$${(usd * 100).toFixed(1)}¢`;
  }
}

/**
 * Format volume for display (auto-select m³, cm³, or mm³)
 */
export function formatVolume(m3: number): string {
  if (m3 >= 0.001) {
    return `${(m3 * 1000).toFixed(2)} L`;
  } else if (m3 >= 0.000001) {
    return `${(m3 * 1000000).toFixed(1)} cm³`;
  } else {
    return `${(m3 * 1000000000).toFixed(2)} mm³`;
  }
}

/**
 * Get quick stats for the current optimization
 * Returns a summary suitable for display
 */
export interface QuickStats {
  materialSavedPercent: number;
  massReductionRatio: number;  // e.g., "2.5x lighter"
  topMaterialsSaved: {
    name: string;
    massSaved: string;
    costSaved: string;
  }[];
}

export function getQuickStats(
  volumeFraction: number,
  dimensions: Dimensions = { length: 0.3, width: 0.1, height: 0.05 } // 30cm x 10cm x 5cm default
): QuickStats {
  const materialSavedPercent = (1 - volumeFraction) * 100;
  const massReductionRatio = volumeFraction > 0 ? 1 / volumeFraction : Infinity;
  
  // Calculate for key materials
  const keyMaterials = ['aluminum-6061', 'steel-1018', 'titanium-6al4v'];
  const topMaterialsSaved = keyMaterials
    .map(id => {
      const material = getMaterial(id);
      if (!material) return null;
      const savings = calculateSavings(volumeFraction, dimensions, material);
      return {
        name: material.name.split(' ')[0], // Just "Aluminum", "Steel", etc.
        massSaved: formatMass(savings.massSaved),
        costSaved: formatCost(savings.costSaved),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  
  return {
    materialSavedPercent,
    massReductionRatio,
    topMaterialsSaved,
  };
}

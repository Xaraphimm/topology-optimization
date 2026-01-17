/**
 * Density and sensitivity filters for topology optimization
 * 
 * Filters are essential to prevent checkerboard patterns and mesh-dependency.
 * This implements the density-based sensitivity filter from Sigmund's work.
 */

/**
 * Precomputed filter data for efficient repeated application
 */
export interface FilterData {
  nelx: number;
  nely: number;
  rmin: number;
  // For each element, store the indices of neighbors and their weights
  neighborIndices: Int32Array[];
  neighborWeights: Float64Array[];
}

/**
 * Prepare the filter by precomputing neighbor indices and weights
 * This only needs to be done once when the mesh or filter radius changes
 * 
 * The filter uses a linear hat function: w = max(0, rmin - dist)
 * 
 * @param nelx - Number of elements in x direction
 * @param nely - Number of elements in y direction
 * @param rmin - Filter radius (in element lengths)
 */
export function prepareFilter(nelx: number, nely: number, rmin: number): FilterData {
  const neighborIndices: Int32Array[] = [];
  const neighborWeights: Float64Array[] = [];
  
  // For each element, find neighbors within rmin and compute weights
  for (let elx = 0; elx < nelx; elx++) {
    for (let ely = 0; ely < nely; ely++) {
      const elemIdx = elx * nely + ely;
      
      // Element center (using 0-indexed positions)
      const cx = elx + 0.5;
      const cy = ely + 0.5;
      
      // Find all elements within filter radius
      const indices: number[] = [];
      const weights: number[] = [];
      
      // Search range (conservative bounds)
      const searchRadius = Math.ceil(rmin);
      const minX = Math.max(0, elx - searchRadius);
      const maxX = Math.min(nelx - 1, elx + searchRadius);
      const minY = Math.max(0, ely - searchRadius);
      const maxY = Math.min(nely - 1, ely + searchRadius);
      
      for (let nx = minX; nx <= maxX; nx++) {
        for (let ny = minY; ny <= maxY; ny++) {
          // Neighbor center
          const ncx = nx + 0.5;
          const ncy = ny + 0.5;
          
          // Distance between element centers
          const dist = Math.sqrt((cx - ncx) ** 2 + (cy - ncy) ** 2);
          
          // Weight (linear hat function)
          const weight = Math.max(0, rmin - dist);
          
          if (weight > 0) {
            const neighborIdx = nx * nely + ny;
            indices.push(neighborIdx);
            weights.push(weight);
          }
        }
      }
      
      // Normalize weights to sum to 1
      const weightSum = weights.reduce((a, b) => a + b, 0);
      const normalizedWeights = weights.map(w => w / weightSum);
      
      neighborIndices[elemIdx] = new Int32Array(indices);
      neighborWeights[elemIdx] = new Float64Array(normalizedWeights);
    }
  }
  
  return { nelx, nely, rmin, neighborIndices, neighborWeights };
}

/**
 * Apply the density filter to sensitivities
 * This prevents checkerboard patterns and ensures mesh independence
 * 
 * The filtered sensitivity is:
 * dc_filtered[e] = sum_i(w_i * rho_i * dc_i) / (rho_e * sum_i(w_i))
 * 
 * Simplified when weights are pre-normalized:
 * dc_filtered[e] = sum_i(w_i * rho_i * dc_i) / rho_e
 * 
 * @param filterData - Precomputed filter data
 * @param densities - Current element densities
 * @param sensitivities - Raw sensitivities (compliance derivatives)
 * @returns Filtered sensitivities
 */
export function applySensitivityFilter(
  filterData: FilterData,
  densities: Float64Array,
  sensitivities: Float64Array
): Float64Array {
  const nelem = filterData.nelx * filterData.nely;
  const filtered = new Float64Array(nelem);
  
  for (let e = 0; e < nelem; e++) {
    const neighbors = filterData.neighborIndices[e];
    const weights = filterData.neighborWeights[e];
    
    let sum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < neighbors.length; i++) {
      const neighborIdx = neighbors[i];
      const weight = weights[i];
      sum += weight * densities[neighborIdx] * sensitivities[neighborIdx];
      weightSum += weight;
    }
    
    // Avoid division by zero for very low densities
    const rhoE = Math.max(densities[e], 1e-9);
    filtered[e] = sum / (rhoE * weightSum);
  }
  
  return filtered;
}

/**
 * Apply density filter directly to the density field
 * This is an alternative approach that filters densities instead of sensitivities
 * 
 * @param filterData - Precomputed filter data
 * @param densities - Element densities to filter
 * @returns Filtered densities
 */
export function applyDensityFilter(
  filterData: FilterData,
  densities: Float64Array
): Float64Array {
  const nelem = filterData.nelx * filterData.nely;
  const filtered = new Float64Array(nelem);
  
  for (let e = 0; e < nelem; e++) {
    const neighbors = filterData.neighborIndices[e];
    const weights = filterData.neighborWeights[e];
    
    let sum = 0;
    for (let i = 0; i < neighbors.length; i++) {
      sum += weights[i] * densities[neighbors[i]];
    }
    
    filtered[e] = sum;
  }
  
  return filtered;
}

/**
 * Verify that filter weights sum to 1 for each element
 */
export function verifyFilterWeights(filterData: FilterData, tolerance: number = 1e-10): boolean {
  const nelem = filterData.nelx * filterData.nely;
  
  for (let e = 0; e < nelem; e++) {
    const weights = filterData.neighborWeights[e];
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += weights[i];
    }
    if (Math.abs(sum - 1.0) > tolerance) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get the number of neighbors for each element (for debugging/testing)
 */
export function getNeighborCounts(filterData: FilterData): Int32Array {
  const nelem = filterData.nelx * filterData.nely;
  const counts = new Int32Array(nelem);
  
  for (let e = 0; e < nelem; e++) {
    counts[e] = filterData.neighborIndices[e].length;
  }
  
  return counts;
}

/**
 * SharedArrayBuffer utilities for high-resolution optimization
 * 
 * Provides zero-copy data transfer between worker and main thread
 * when crossOriginIsolated is enabled (COOP/COEP headers present).
 * 
 * Falls back to standard postMessage with array copying when not available.
 */

/**
 * Check if SharedArrayBuffer is available
 * Requires crossOriginIsolated context (COOP/COEP headers)
 */
export function isSharedArrayBufferAvailable(): boolean {
  // Check if we're in a cross-origin isolated context
  if (typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated) {
    return false;
  }
  
  // Check if SharedArrayBuffer exists and is functional
  try {
    if (typeof SharedArrayBuffer === 'undefined') {
      return false;
    }
    // Test that we can actually create one
    const test = new SharedArrayBuffer(8);
    return test.byteLength === 8;
  } catch {
    return false;
  }
}

/**
 * Shared buffer configuration for optimization state
 */
export interface SharedBufferConfig {
  nElem: number;       // Number of elements (for densities/strainEnergy)
  nDofs: number;       // Number of DOFs (for displacement)
}

/**
 * Shared buffers for optimization state
 * Used for zero-copy transfer between worker and main thread
 */
export interface SharedBuffers {
  // Shared memory buffers
  densitiesBuffer: SharedArrayBuffer;
  strainEnergyBuffer: SharedArrayBuffer;
  
  // Typed array views (main thread and worker share these)
  densities: Float64Array;
  strainEnergy: Float64Array;
  
  // Scalar state (still transferred via postMessage, but small)
  // These are updated atomically via Atomics or simple assignment
  stateBuffer: SharedArrayBuffer;
  stateView: Float64Array; // [compliance, volume, change, iteration, converged]
}

/**
 * State indices in the shared state buffer
 */
export const STATE_INDICES = {
  COMPLIANCE: 0,
  VOLUME: 1,
  CHANGE: 2,
  ITERATION: 3,
  CONVERGED: 4,  // 1 = converged, 0 = not converged
} as const;

/**
 * Create shared buffers for optimization state
 */
export function createSharedBuffers(config: SharedBufferConfig): SharedBuffers | null {
  if (!isSharedArrayBufferAvailable()) {
    return null;
  }
  
  try {
    const { nElem } = config;
    
    // Create shared buffers
    const densitiesBuffer = new SharedArrayBuffer(nElem * Float64Array.BYTES_PER_ELEMENT);
    const strainEnergyBuffer = new SharedArrayBuffer(nElem * Float64Array.BYTES_PER_ELEMENT);
    const stateBuffer = new SharedArrayBuffer(5 * Float64Array.BYTES_PER_ELEMENT);
    
    // Create typed array views
    const densities = new Float64Array(densitiesBuffer);
    const strainEnergy = new Float64Array(strainEnergyBuffer);
    const stateView = new Float64Array(stateBuffer);
    
    return {
      densitiesBuffer,
      strainEnergyBuffer,
      densities,
      strainEnergy,
      stateBuffer,
      stateView,
    };
  } catch (error) {
    console.warn('Failed to create shared buffers:', error);
    return null;
  }
}

/**
 * Write optimization state to shared buffers
 * Called by worker after each iteration
 */
export function writeStateToSharedBuffers(
  sharedBuffers: SharedBuffers,
  densities: Float64Array,
  strainEnergy: Float64Array,
  compliance: number,
  volume: number,
  change: number,
  iteration: number,
  converged: boolean
): void {
  // Copy densities
  sharedBuffers.densities.set(densities);
  
  // Copy strain energy
  sharedBuffers.strainEnergy.set(strainEnergy);
  
  // Write scalar state
  sharedBuffers.stateView[STATE_INDICES.COMPLIANCE] = compliance;
  sharedBuffers.stateView[STATE_INDICES.VOLUME] = volume;
  sharedBuffers.stateView[STATE_INDICES.CHANGE] = change;
  sharedBuffers.stateView[STATE_INDICES.ITERATION] = iteration;
  sharedBuffers.stateView[STATE_INDICES.CONVERGED] = converged ? 1 : 0;
}

/**
 * Read optimization state from shared buffers
 * Called by main thread to read current state
 */
export function readStateFromSharedBuffers(sharedBuffers: SharedBuffers): {
  densities: Float64Array;
  strainEnergy: Float64Array;
  compliance: number;
  volume: number;
  change: number;
  iteration: number;
  converged: boolean;
} {
  return {
    densities: sharedBuffers.densities,
    strainEnergy: sharedBuffers.strainEnergy,
    compliance: sharedBuffers.stateView[STATE_INDICES.COMPLIANCE],
    volume: sharedBuffers.stateView[STATE_INDICES.VOLUME],
    change: sharedBuffers.stateView[STATE_INDICES.CHANGE],
    iteration: sharedBuffers.stateView[STATE_INDICES.ITERATION],
    converged: sharedBuffers.stateView[STATE_INDICES.CONVERGED] === 1,
  };
}

/**
 * Transfer shared buffer configuration to worker
 * Returns a message payload that can be sent via postMessage
 */
export function getSharedBufferTransferPayload(sharedBuffers: SharedBuffers): {
  densitiesBuffer: SharedArrayBuffer;
  strainEnergyBuffer: SharedArrayBuffer;
  stateBuffer: SharedArrayBuffer;
} {
  return {
    densitiesBuffer: sharedBuffers.densitiesBuffer,
    strainEnergyBuffer: sharedBuffers.strainEnergyBuffer,
    stateBuffer: sharedBuffers.stateBuffer,
  };
}

/**
 * Reconstruct shared buffer views from transferred buffers
 * Called by worker after receiving shared buffers
 */
export function reconstructSharedBufferViews(payload: {
  densitiesBuffer: SharedArrayBuffer;
  strainEnergyBuffer: SharedArrayBuffer;
  stateBuffer: SharedArrayBuffer;
}): SharedBuffers {
  return {
    densitiesBuffer: payload.densitiesBuffer,
    strainEnergyBuffer: payload.strainEnergyBuffer,
    densities: new Float64Array(payload.densitiesBuffer),
    strainEnergy: new Float64Array(payload.strainEnergyBuffer),
    stateBuffer: payload.stateBuffer,
    stateView: new Float64Array(payload.stateBuffer),
  };
}

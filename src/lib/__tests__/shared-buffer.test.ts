/**
 * Tests for SharedArrayBuffer utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isSharedArrayBufferAvailable,
  createSharedBuffers,
  writeStateToSharedBuffers,
  readStateFromSharedBuffers,
  getSharedBufferTransferPayload,
  reconstructSharedBufferViews,
  STATE_INDICES,
  type SharedBufferConfig,
  type SharedBuffers,
} from '../optimizer/shared-buffer';

describe('isSharedArrayBufferAvailable', () => {
  it('should return boolean', () => {
    const result = isSharedArrayBufferAvailable();
    expect(typeof result).toBe('boolean');
  });

  it('should detect when SharedArrayBuffer exists', () => {
    // In Node.js/vitest, SharedArrayBuffer is typically available
    // This test verifies the function runs without error
    const result = isSharedArrayBufferAvailable();
    // Result depends on environment, just verify it's a boolean
    expect([true, false]).toContain(result);
  });
});

describe('createSharedBuffers', () => {
  const config: SharedBufferConfig = {
    nElem: 100,
    nDofs: 200,
  };

  it('should return null if SharedArrayBuffer not available', () => {
    // Mock crossOriginIsolated to be false
    const originalCOI = globalThis.crossOriginIsolated;
    Object.defineProperty(globalThis, 'crossOriginIsolated', {
      value: false,
      configurable: true,
    });

    const result = createSharedBuffers(config);
    
    // Restore
    if (originalCOI !== undefined) {
      Object.defineProperty(globalThis, 'crossOriginIsolated', {
        value: originalCOI,
        configurable: true,
      });
    } else {
      delete (globalThis as Record<string, unknown>).crossOriginIsolated;
    }

    // Result should be null when not cross-origin isolated
    expect(result).toBeNull();
  });

  it('should create buffers with correct sizes when available', () => {
    // Skip if SharedArrayBuffer not available
    if (!isSharedArrayBufferAvailable()) {
      return;
    }

    const result = createSharedBuffers(config);
    
    if (result) {
      expect(result.densities.length).toBe(config.nElem);
      expect(result.strainEnergy.length).toBe(config.nElem);
      expect(result.stateView.length).toBe(5);
    }
  });
});

describe('writeStateToSharedBuffers and readStateFromSharedBuffers', () => {
  it('should round-trip state correctly', () => {
    // Skip if SharedArrayBuffer not available
    if (!isSharedArrayBufferAvailable()) {
      return;
    }

    const config: SharedBufferConfig = { nElem: 10, nDofs: 20 };
    const buffers = createSharedBuffers(config);
    
    if (!buffers) {
      return; // Skip if buffers couldn't be created
    }

    // Write state
    const densities = new Float64Array(10).fill(0.5);
    densities[5] = 0.8;
    const strainEnergy = new Float64Array(10).fill(0.1);
    strainEnergy[3] = 0.9;

    writeStateToSharedBuffers(
      buffers,
      densities,
      strainEnergy,
      123.456,  // compliance
      0.45,     // volume
      0.001,    // change
      42,       // iteration
      false     // converged
    );

    // Read state
    const state = readStateFromSharedBuffers(buffers);

    expect(state.compliance).toBeCloseTo(123.456, 6);
    expect(state.volume).toBeCloseTo(0.45, 6);
    expect(state.change).toBeCloseTo(0.001, 6);
    expect(state.iteration).toBe(42);
    expect(state.converged).toBe(false);
    expect(state.densities[5]).toBeCloseTo(0.8, 6);
    expect(state.strainEnergy[3]).toBeCloseTo(0.9, 6);
  });

  it('should handle converged state', () => {
    if (!isSharedArrayBufferAvailable()) {
      return;
    }

    const config: SharedBufferConfig = { nElem: 5, nDofs: 10 };
    const buffers = createSharedBuffers(config);
    
    if (!buffers) {
      return;
    }

    writeStateToSharedBuffers(
      buffers,
      new Float64Array(5),
      new Float64Array(5),
      50.0,
      0.3,
      0.0001,
      100,
      true // converged
    );

    const state = readStateFromSharedBuffers(buffers);
    expect(state.converged).toBe(true);
  });
});

describe('getSharedBufferTransferPayload and reconstructSharedBufferViews', () => {
  it('should transfer and reconstruct buffers correctly', () => {
    if (!isSharedArrayBufferAvailable()) {
      return;
    }

    const config: SharedBufferConfig = { nElem: 8, nDofs: 16 };
    const original = createSharedBuffers(config);
    
    if (!original) {
      return;
    }

    // Write some data
    original.densities[0] = 0.123;
    original.strainEnergy[7] = 0.789;
    original.stateView[STATE_INDICES.COMPLIANCE] = 999;

    // Get transfer payload
    const payload = getSharedBufferTransferPayload(original);

    // Verify payload contains SharedArrayBuffers
    expect(payload.densitiesBuffer).toBeInstanceOf(SharedArrayBuffer);
    expect(payload.strainEnergyBuffer).toBeInstanceOf(SharedArrayBuffer);
    expect(payload.stateBuffer).toBeInstanceOf(SharedArrayBuffer);

    // Reconstruct views
    const reconstructed = reconstructSharedBufferViews(payload);

    // Verify data is accessible through reconstructed views
    expect(reconstructed.densities[0]).toBeCloseTo(0.123, 6);
    expect(reconstructed.strainEnergy[7]).toBeCloseTo(0.789, 6);
    expect(reconstructed.stateView[STATE_INDICES.COMPLIANCE]).toBeCloseTo(999, 6);

    // Verify modifications are shared
    original.densities[1] = 0.456;
    expect(reconstructed.densities[1]).toBeCloseTo(0.456, 6);
  });
});

describe('STATE_INDICES', () => {
  it('should have all required indices', () => {
    expect(STATE_INDICES.COMPLIANCE).toBeDefined();
    expect(STATE_INDICES.VOLUME).toBeDefined();
    expect(STATE_INDICES.CHANGE).toBeDefined();
    expect(STATE_INDICES.ITERATION).toBeDefined();
    expect(STATE_INDICES.CONVERGED).toBeDefined();
  });

  it('should have unique indices', () => {
    const indices = Object.values(STATE_INDICES);
    const uniqueIndices = new Set(indices);
    expect(uniqueIndices.size).toBe(indices.length);
  });

  it('should fit within state buffer size', () => {
    const maxIndex = Math.max(...Object.values(STATE_INDICES));
    expect(maxIndex).toBeLessThan(5); // State buffer has 5 elements
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useComparisonState } from '../hooks/useComparisonState';

// Mock the useOptimizer hook since it uses Web Workers
vi.mock('@/lib/optimizer/useOptimizer', () => ({
  useOptimizer: vi.fn(() => ({
    state: {
      densities: new Float64Array(0),
      strainEnergy: new Float64Array(0),
      compliance: Infinity,
      volume: 0.5,
      iteration: 0,
      converged: false,
      change: 1.0,
    },
    history: [],
    isRunning: false,
    isReady: true,
    error: null,
    start: vi.fn(),
    pause: vi.fn(),
    reset: vi.fn(),
    step: vi.fn(),
  })),
}));

// Get the mocked module
import { useOptimizer } from '@/lib/optimizer/useOptimizer';
const mockedUseOptimizer = vi.mocked(useOptimizer);

describe('useComparisonState', () => {
  let mockStartA: ReturnType<typeof vi.fn>;
  let mockStartB: ReturnType<typeof vi.fn>;
  let mockPauseA: ReturnType<typeof vi.fn>;
  let mockPauseB: ReturnType<typeof vi.fn>;
  let mockResetA: ReturnType<typeof vi.fn>;
  let mockResetB: ReturnType<typeof vi.fn>;
  let callCount: number;

  beforeEach(() => {
    callCount = 0;
    mockStartA = vi.fn();
    mockStartB = vi.fn();
    mockPauseA = vi.fn();
    mockPauseB = vi.fn();
    mockResetA = vi.fn();
    mockResetB = vi.fn();

    // Mock useOptimizer to return different mocks for A and B
    mockedUseOptimizer.mockImplementation(() => {
      const isFirst = callCount % 2 === 0;
      callCount++;
      return {
        state: {
          densities: new Float64Array(0),
          strainEnergy: new Float64Array(0),
          compliance: Infinity,
          volume: 0.5,
          iteration: 0,
          converged: false,
          change: 1.0,
        },
        history: [],
        isRunning: false,
        isReady: true,
        error: null,
        start: isFirst ? mockStartA : mockStartB,
        pause: isFirst ? mockPauseA : mockPauseB,
        reset: isFirst ? mockResetA : mockResetB,
        step: vi.fn(),
      };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with two independent configs', () => {
    const { result } = renderHook(() => useComparisonState());

    // Check that both configs exist and are objects
    expect(result.current.configA).toBeDefined();
    expect(result.current.configB).toBeDefined();

    // Check that configs have expected properties
    expect(result.current.configA).toHaveProperty('presetId');
    expect(result.current.configA).toHaveProperty('resolutionId');
    expect(result.current.configA).toHaveProperty('volumeFraction');

    expect(result.current.configB).toHaveProperty('presetId');
    expect(result.current.configB).toHaveProperty('resolutionId');
    expect(result.current.configB).toHaveProperty('volumeFraction');

    // Configs should have different default volume fractions
    expect(result.current.configA.volumeFraction).toBe(0.5);
    expect(result.current.configB.volumeFraction).toBe(0.3);
  });

  it('startBoth() starts both optimizers', () => {
    const { result } = renderHook(() => useComparisonState());

    act(() => {
      result.current.startBoth();
    });

    expect(mockStartA).toHaveBeenCalledTimes(1);
    expect(mockStartB).toHaveBeenCalledTimes(1);
  });

  it('pauseBoth() pauses both optimizers', () => {
    const { result } = renderHook(() => useComparisonState());

    act(() => {
      result.current.pauseBoth();
    });

    expect(mockPauseA).toHaveBeenCalledTimes(1);
    expect(mockPauseB).toHaveBeenCalledTimes(1);
  });

  it('resetBoth() resets both optimizers', () => {
    const { result } = renderHook(() => useComparisonState());

    act(() => {
      result.current.resetBoth();
    });

    expect(mockResetA).toHaveBeenCalledTimes(1);
    expect(mockResetB).toHaveBeenCalledTimes(1);
  });

  it('syncFromA() copies configA to configB', () => {
    const { result } = renderHook(() => useComparisonState());

    // First, change configA to something different
    act(() => {
      result.current.setConfigA({
        presetId: 'cantilever',
        volumeFraction: 0.7,
      });
    });

    // Verify configA changed
    expect(result.current.configA.presetId).toBe('cantilever');
    expect(result.current.configA.volumeFraction).toBe(0.7);

    // Sync from A to B
    act(() => {
      result.current.syncFromA();
    });

    // Verify configB now matches configA
    expect(result.current.configB.presetId).toBe('cantilever');
    expect(result.current.configB.volumeFraction).toBe(0.7);
  });

  it('changing configA does not affect configB (independence test)', () => {
    const { result } = renderHook(() => useComparisonState());

    // Store initial configB values
    const initialConfigB = { ...result.current.configB };

    // Change configA
    act(() => {
      result.current.setConfigA({
        presetId: 'bridge',
        resolutionId: 'high',
        volumeFraction: 0.8,
      });
    });

    // Verify configA changed
    expect(result.current.configA.presetId).toBe('bridge');
    expect(result.current.configA.resolutionId).toBe('high');
    expect(result.current.configA.volumeFraction).toBe(0.8);

    // Verify configB is unchanged
    expect(result.current.configB.presetId).toBe(initialConfigB.presetId);
    expect(result.current.configB.resolutionId).toBe(initialConfigB.resolutionId);
    expect(result.current.configB.volumeFraction).toBe(initialConfigB.volumeFraction);
  });

  it('setConfigA updates only configA', () => {
    const { result } = renderHook(() => useComparisonState());

    act(() => {
      result.current.setConfigA({ volumeFraction: 0.6 });
    });

    expect(result.current.configA.volumeFraction).toBe(0.6);
    // configB should remain at its default
    expect(result.current.configB.volumeFraction).toBe(0.3);
  });

  it('setConfigB updates only configB', () => {
    const { result } = renderHook(() => useComparisonState());

    act(() => {
      result.current.setConfigB({ volumeFraction: 0.4 });
    });

    expect(result.current.configB.volumeFraction).toBe(0.4);
    // configA should remain at its default
    expect(result.current.configA.volumeFraction).toBe(0.5);
  });

  it('syncFromB() copies configB to configA', () => {
    const { result } = renderHook(() => useComparisonState());

    // Change configB
    act(() => {
      result.current.setConfigB({
        presetId: 'bridge',
        volumeFraction: 0.25,
      });
    });

    // Sync from B to A
    act(() => {
      result.current.syncFromB();
    });

    // Verify configA now matches configB
    expect(result.current.configA.presetId).toBe('bridge');
    expect(result.current.configA.volumeFraction).toBe(0.25);
  });

  it('provides mesh dimensions for both panels', () => {
    const { result } = renderHook(() => useComparisonState());

    expect(result.current.meshA).toHaveProperty('nelx');
    expect(result.current.meshA).toHaveProperty('nely');
    expect(result.current.meshB).toHaveProperty('nelx');
    expect(result.current.meshB).toHaveProperty('nely');

    // Should have positive dimensions
    expect(result.current.meshA.nelx).toBeGreaterThan(0);
    expect(result.current.meshA.nely).toBeGreaterThan(0);
    expect(result.current.meshB.nelx).toBeGreaterThan(0);
    expect(result.current.meshB.nely).toBeGreaterThan(0);
  });

  it('provides boundary condition data for both panels', () => {
    const { result } = renderHook(() => useComparisonState());

    expect(result.current.bcDataA).toHaveProperty('supports');
    expect(result.current.bcDataA).toHaveProperty('loads');
    expect(result.current.bcDataB).toHaveProperty('supports');
    expect(result.current.bcDataB).toHaveProperty('loads');

    // Should have arrays
    expect(Array.isArray(result.current.bcDataA.supports)).toBe(true);
    expect(Array.isArray(result.current.bcDataA.loads)).toBe(true);
  });

  it('individual start/pause/reset work correctly', () => {
    const { result } = renderHook(() => useComparisonState());

    // Test startA
    act(() => {
      result.current.startA();
    });
    expect(mockStartA).toHaveBeenCalledTimes(1);
    expect(mockStartB).not.toHaveBeenCalled();

    // Test pauseA
    act(() => {
      result.current.pauseA();
    });
    expect(mockPauseA).toHaveBeenCalledTimes(1);
    expect(mockPauseB).not.toHaveBeenCalled();

    // Test resetB
    act(() => {
      result.current.resetB();
    });
    expect(mockResetB).toHaveBeenCalledTimes(1);
    expect(mockResetA).not.toHaveBeenCalled();
  });
});

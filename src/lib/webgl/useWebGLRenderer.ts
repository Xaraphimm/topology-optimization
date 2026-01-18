'use client';

import { RefObject, useEffect, useRef, useState, useCallback } from 'react';
import { WebGLRenderer, ViewMode } from './WebGLRenderer';
import { getColormap, getDefaultColormap, createLUT } from '@/lib/colormaps';

interface UseWebGLRendererResult {
  isWebGLAvailable: boolean;
  error: string | null;
  render: () => void;
}

/**
 * Check if a density array matches the expected dimensions
 * This prevents rendering stale data from a previous resolution
 */
function isDensityArrayValid(densities: Float64Array | null, nelx: number, nely: number): boolean {
  if (!densities) return false;
  const expectedSize = nelx * nely;
  return densities.length === expectedSize;
}

/**
 * React hook for managing the WebGL renderer lifecycle
 * 
 * @param canvasRef - Reference to the canvas element
 * @param densities - Density values for each element (null if no data yet)
 * @param stressEnergy - Strain energy values for each element (null if no data yet)
 * @param nelx - Number of elements in x direction
 * @param nely - Number of elements in y direction
 * @param viewMode - Current view mode ('material' or 'stress')
 * @param previewDensities - Preview density pattern to show when densities is null
 * @param stressColormap - Colormap ID for stress visualization (default: 'thermal')
 * @returns Object containing WebGL availability status, any error message, and manual render function
 */
export function useWebGLRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  densities: Float64Array | null,
  stressEnergy: Float64Array | null,
  nelx: number,
  nely: number,
  viewMode: ViewMode,
  previewDensities: Float64Array,
  stressColormap: string = 'thermal'
): UseWebGLRendererResult {
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const [isWebGLAvailable, setIsWebGLAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize renderer on mount
  useEffect(() => {
    // Check WebGL support
    if (!WebGLRenderer.isSupported()) {
      setIsWebGLAvailable(false);
      setError('WebGL is not supported in this browser');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    // Create and initialize renderer
    const renderer = new WebGLRenderer(canvas);
    const success = renderer.init();

    if (!success) {
      setIsWebGLAvailable(false);
      setError('Failed to initialize WebGL renderer');
      return;
    }

    rendererRef.current = renderer;
    setIsWebGLAvailable(true);
    setError(null);

    // Initialize with default colormap LUT
    const colormap = getColormap(stressColormap) || getDefaultColormap();
    const lut = createLUT(colormap);
    renderer.updateColormapLUT(lut);

    // Clean up on unmount
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [canvasRef]); // Note: stressColormap handled in separate effect

  // Update density texture when data changes
  // When densities is null OR wrong size, create a uniform preview texture
  // This is critical for handling resolution switches correctly
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !renderer.isReady()) {
      return;
    }

    // CRITICAL FIX: Validate density array size matches current dimensions
    // This prevents rendering stale data from a previous resolution (e.g., 60x20 data on 120x40 canvas)
    const hasValidDensities = isDensityArrayValid(densities, nelx, nely);
    
    // Use actual densities only if they match current dimensions, otherwise use preview pattern
    const displayDensities = hasValidDensities 
      ? densities! 
      : previewDensities;
    
    renderer.updateDensities(displayDensities, nelx, nely);
    // Immediately render after updating densities to ensure display is current
    renderer.render(viewMode);
  }, [densities, nelx, nely, viewMode, previewDensities]);

  // Update stress texture when data changes
  // Also validates that stress array matches current dimensions
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !renderer.isReady() || !stressEnergy) {
      return;
    }

    // CRITICAL: Validate stress array size matches current dimensions
    // Skip if array is from a previous resolution
    if (!isDensityArrayValid(stressEnergy, nelx, nely)) {
      return;
    }

    // Calculate max stress for normalization
    let maxStress = 0;
    for (let i = 0; i < stressEnergy.length; i++) {
      if (stressEnergy[i] > maxStress) {
        maxStress = stressEnergy[i];
      }
    }

    renderer.updateStress(stressEnergy, maxStress);
    // Immediately render after updating stress to ensure display is current
    renderer.render(viewMode);
  }, [stressEnergy, nelx, nely, viewMode]);

  // Update colormap LUT when stressColormap changes
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !renderer.isReady()) {
      return;
    }

    const colormap = getColormap(stressColormap) || getDefaultColormap();
    const lut = createLUT(colormap);
    renderer.updateColormapLUT(lut);
    
    // Re-render if currently in stress view to show the new colormap
    if (viewMode === 'stress') {
      renderer.render(viewMode);
    }
  }, [stressColormap, viewMode]);

  // Render when view mode changes
  // Note: density/stress updates already trigger render in their respective effects
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !renderer.isReady()) {
      return;
    }

    renderer.render(viewMode);
  }, [viewMode]);

  // Manual render function for resize handling
  const render = useCallback(() => {
    const renderer = rendererRef.current;
    if (renderer && renderer.isReady()) {
      renderer.render(viewMode);
    }
  }, [viewMode]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(render);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [render]);

  return {
    isWebGLAvailable,
    error,
    render,
  };
}

export default useWebGLRenderer;

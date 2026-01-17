'use client';

import { RefObject, useEffect, useRef, useState, useCallback } from 'react';
import { WebGLRenderer, ViewMode } from './WebGLRenderer';

interface UseWebGLRendererResult {
  isWebGLAvailable: boolean;
  error: string | null;
  render: () => void;
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
 * @returns Object containing WebGL availability status, any error message, and manual render function
 */
export function useWebGLRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  densities: Float64Array | null,
  stressEnergy: Float64Array | null,
  nelx: number,
  nely: number,
  viewMode: ViewMode
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

    // Clean up on unmount
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [canvasRef]);

  // Update density texture when data changes
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !renderer.isReady() || !densities) {
      return;
    }

    renderer.updateDensities(densities, nelx, nely);
  }, [densities, nelx, nely]);

  // Update stress texture when data changes
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !renderer.isReady() || !stressEnergy) {
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
  }, [stressEnergy]);

  // Render when view mode changes or data updates
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !renderer.isReady()) {
      return;
    }

    renderer.render(viewMode);
  }, [viewMode, densities, stressEnergy]);

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

'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { WebGLRenderer, useWebGLRenderer } from '@/lib/webgl';
import { getColormap, getDefaultColormap, type Colormap } from '@/lib/colormaps';

interface Support {
  x: number;
  y: number;
  type: 'pin' | 'roller-x' | 'roller-y';
}

interface Load {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export type ViewMode = 'material' | 'stress';

interface CanvasProps {
  densities: Float64Array | null;
  strainEnergy: Float64Array | null;
  nelx: number;
  nely: number;
  viewMode: ViewMode;
  supports?: Support[];
  loads?: Load[];
  className?: string;
  /** Initial volume fraction for rendering preview mesh when densities is null */
  initialVolumeFraction?: number;
  /** Prefer WebGL rendering when available (default: true) */
  preferWebGL?: boolean;
  /** Colormap ID for stress view (default: 'thermal') */
  stressColormap?: string;
}

/**
 * Hook to detect dark mode changes
 */
function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);
  
  useEffect(() => {
    // Check initial state
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    
    checkDark();
    
    // Watch for class changes on <html>
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    
    return () => observer.disconnect();
  }, []);
  
  return isDark;
}

/**
 * Create a uniform density array for the preview mesh
 */
function createUniformDensities(nelx: number, nely: number, volumeFraction: number): Float64Array {
  const size = nelx * nely;
  const densities = new Float64Array(size);
  densities.fill(volumeFraction);
  return densities;
}

/**
 * Smoothstep function for smooth interpolation
 * Used to create more natural color transitions
 */
function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/**
 * Apply gamma correction
 * @param value - Linear value (0-1)
 * @param gamma - Gamma value (default 2.2 for standard displays)
 * @returns Gamma-corrected value
 */
function applyGamma(value: number, gamma: number = 2.2): number {
  return Math.pow(Math.max(0, Math.min(1, value)), 1 / gamma);
}

/**
 * Apply contrast enhancement using smoothstep
 * Creates sharper visual boundaries while maintaining smooth gradients
 */
function enhanceContrast(value: number, low: number = 0.08, high: number = 0.92): number {
  if (value <= low) return 0;
  if (value >= high) return 1;
  return (value - low) / (high - low);
}

/**
 * Convert density to grayscale with gamma correction and contrast enhancement
 * Matches the WebGL shader visual output
 */
function densityToGray(density: number): number {
  // Apply gamma correction for perceptually uniform brightness
  const gammaCorrected = applyGamma(density);
  
  // Apply contrast enhancement
  const enhanced = enhanceContrast(gammaCorrected);
  
  // Invert: 0 (void) = white, 1 (solid) = black
  const gray = 1 - enhanced;
  
  // Apply inverse gamma for final output
  return applyGamma(gray);
}

/**
 * Convert a value in [0,1] to a stress color using the specified colormap
 * 
 * @param normalizedValue - Normalized stress value [0, 1]
 * @param colormap - Colormap to use (default: thermal)
 */
function stressToColorWithMap(normalizedValue: number, colormap: Colormap): string {
  // Clamp to [0, 1]
  const t = Math.max(0, Math.min(1, normalizedValue));
  
  // Get RGB from colormap
  const rgb = colormap.lookup(t);
  
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/**
 * Legacy stress color function (blue-white-red)
 * Used when no colormap is specified or as fallback
 */
function stressToColorLegacy(normalizedValue: number): string {
  // Clamp to [0, 1]
  const t = Math.max(0, Math.min(1, normalizedValue));
  
  // Define colors in linear space (matching WebGL shader)
  const blue = [0.231, 0.510, 0.965];
  const white = [1.0, 1.0, 1.0];
  const red = [0.937, 0.267, 0.267];
  
  let color: number[];
  
  if (t < 0.5) {
    // Blue to white transition with smoothstep
    const s = t * 2;
    const smooth_s = smoothstep(s);
    color = [
      blue[0] + smooth_s * (white[0] - blue[0]),
      blue[1] + smooth_s * (white[1] - blue[1]),
      blue[2] + smooth_s * (white[2] - blue[2]),
    ];
  } else {
    // White to red transition with smoothstep
    const s = (t - 0.5) * 2;
    const smooth_s = smoothstep(s);
    color = [
      white[0] + smooth_s * (red[0] - white[0]),
      white[1] + smooth_s * (red[1] - white[1]),
      white[2] + smooth_s * (red[2] - white[2]),
    ];
  }
  
  // Apply gamma correction
  const r = Math.round(applyGamma(color[0]) * 255);
  const g = Math.round(applyGamma(color[1]) * 255);
  const b = Math.round(applyGamma(color[2]) * 255);
  
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Canvas component for rendering topology optimization results
 * 
 * Supports two rendering modes:
 * - WebGL: GPU-accelerated rendering for large meshes (default when available)
 * - Canvas2D: Fallback for browsers without WebGL support
 * 
 * Supports two view modes:
 * - material: Grayscale density view (white = void, black = solid)
 * - stress: Blue-white-red heatmap (blue = low stress, red = high stress)
 */
export function Canvas({ 
  densities, 
  strainEnergy,
  nelx, 
  nely,
  viewMode,
  supports = [], 
  loads = [],
  className = '',
  initialVolumeFraction = 0.5,
  preferWebGL = true,
  stressColormap = 'thermal',
}: CanvasProps) {
  // Get the colormap for stress view
  const colormap = getColormap(stressColormap) || getDefaultColormap();
  // Main canvas for WebGL or Canvas2D mesh rendering
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  // Overlay canvas for boundary conditions (always Canvas2D)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const isDark = useDarkMode();

  // Check if WebGL should be used (only check once on mount)
  const [useWebGL, setUseWebGL] = useState(false);
  const hasCheckedWebGL = useRef(false);

  useEffect(() => {
    if (!hasCheckedWebGL.current && preferWebGL) {
      const nextUseWebGL = WebGLRenderer.isSupported();
      if (nextUseWebGL !== useWebGL) {
        setUseWebGL(nextUseWebGL);
      }
      hasCheckedWebGL.current = true;
    }
  }, [preferWebGL, useWebGL]);
  
  // WebGL renderer hook (only active when useWebGL is true)
  const { isWebGLAvailable, error: webglError, render: webglRender } = useWebGLRenderer(
    mainCanvasRef,
    useWebGL ? densities : null, // Only pass data if using WebGL
    useWebGL ? strainEnergy : null,
    nelx,
    nely,
    viewMode,
    initialVolumeFraction
  );
  
  // Determine actual rendering mode
  const actuallyUsingWebGL = useWebGL && isWebGLAvailable && !webglError;
  
  // Canvas2D rendering for mesh (fallback)
  const renderCanvas2D = useCallback(() => {
    if (actuallyUsingWebGL) return; // Skip if using WebGL
    
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get display dimensions
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    // Set actual canvas size (for sharp rendering)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);
    
    // Calculate element size
    const elemWidth = displayWidth / nelx;
    const elemHeight = displayHeight / nely;
    
    // Theme-aware colors
    const bgColor = isDark ? '#1f2937' : '#f8fafc';
    
    // Clear canvas
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    // Use actual densities if available, otherwise create uniform preview mesh
    const displayDensities = densities || createUniformDensities(nelx, nely, initialVolumeFraction);
    const isPreview = !densities;
    
    // For stress view, normalize strain energy to [0, 1]
    let maxStrainEnergy = 0;
    if (viewMode === 'stress' && strainEnergy && !isPreview) {
      for (let i = 0; i < strainEnergy.length; i++) {
        if (strainEnergy[i] > maxStrainEnergy) {
          maxStrainEnergy = strainEnergy[i];
        }
      }
    }
    
    // Draw elements
    // Elements are stored column by column (x varies slower than y)
    // Y=0 is at the bottom in our coordinate system, but canvas Y=0 is at top
    for (let elx = 0; elx < nelx; elx++) {
      for (let ely = 0; ely < nely; ely++) {
        const elemIdx = elx * nely + ely;
        const density = displayDensities[elemIdx];
        
        // Canvas Y is flipped (0 at top), so we draw from top
        const canvasX = elx * elemWidth;
        const canvasY = (nely - 1 - ely) * elemHeight; // Flip Y
        
        if (viewMode === 'material' || isPreview) {
          // Convert density to grayscale with gamma correction and contrast enhancement
          // This matches the WebGL shader output for visual consistency
          const gray = Math.round(densityToGray(density) * 255);
          ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
        } else {
          // Stress view: use selected colormap
          if (strainEnergy && maxStrainEnergy > 0) {
            // Normalize strain energy and apply sqrt to spread out colors more
            const normalized = Math.sqrt(strainEnergy[elemIdx] / maxStrainEnergy);
            ctx.fillStyle = stressToColorWithMap(normalized, colormap);
          } else {
            ctx.fillStyle = '#e5e7eb';
          }
        }
        
        // Use Math.floor/ceil to ensure no hairline gaps between elements
        // The +1 overlap ensures clean rendering on all displays and DPR values
        ctx.fillRect(
          Math.floor(canvasX),
          Math.floor(canvasY),
          Math.ceil(elemWidth) + 1,
          Math.ceil(elemHeight) + 1
        );
      }
    }
  }, [densities, strainEnergy, nelx, nely, viewMode, isDark, initialVolumeFraction, actuallyUsingWebGL, colormap]);
  
  // Render boundary conditions overlay (always Canvas2D)
  const renderOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get display dimensions
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    // Set actual canvas size (for sharp rendering)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);
    
    // Clear canvas (transparent)
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    
    // Draw supports and loads
    const nodeWidth = displayWidth / nelx;
    const nodeHeight = displayHeight / nely;
    
    for (const support of supports) {
      const canvasX = support.x * nodeWidth;
      const canvasY = (nely - support.y) * nodeHeight; // Flip Y
      
      ctx.save();
      ctx.translate(canvasX, canvasY);
      
      if (support.type === 'pin') {
        // Draw triangle for pin support
        drawPinSupport(ctx, Math.min(nodeWidth, nodeHeight) * 0.8);
      } else if (support.type === 'roller-x') {
        // Roller that allows Y movement (fixes X)
        drawRollerSupport(ctx, Math.min(nodeWidth, nodeHeight) * 0.8, 'vertical');
      } else if (support.type === 'roller-y') {
        // Roller that allows X movement (fixes Y)
        drawRollerSupport(ctx, Math.min(nodeWidth, nodeHeight) * 0.8, 'horizontal');
      }
      
      ctx.restore();
    }
    
    // Draw loads
    for (const load of loads) {
      const canvasX = load.x * nodeWidth;
      const canvasY = (nely - load.y) * nodeHeight; // Flip Y
      
      ctx.save();
      ctx.translate(canvasX, canvasY);
      
      // Arrow pointing in direction of load
      const arrowLength = Math.min(nodeWidth, nodeHeight) * 1.5;
      drawArrow(ctx, 0, 0, load.dx * arrowLength, -load.dy * arrowLength); // Flip dy for canvas
      
      ctx.restore();
    }
  }, [nelx, nely, supports, loads]);
  
  // Render on data change
  useEffect(() => {
    if (actuallyUsingWebGL) {
      // WebGL rendering is handled by the hook
      webglRender();
    } else {
      renderCanvas2D();
    }
    renderOverlay();
  }, [actuallyUsingWebGL, webglRender, renderCanvas2D, renderOverlay]);
  
  // Re-render on resize
  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(() => {
        if (actuallyUsingWebGL) {
          webglRender();
        } else {
          renderCanvas2D();
        }
        renderOverlay();
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [actuallyUsingWebGL, webglRender, renderCanvas2D, renderOverlay]);
  
  return (
    <div 
      className={`relative w-full ${className}`}
      style={{ 
        aspectRatio: `${nelx} / ${nely}`,
        maxHeight: '400px',
      }}
    >
      {/* Main canvas for mesh rendering (WebGL or Canvas2D) */}
      <canvas
        ref={mainCanvasRef}
        className="absolute inset-0 w-full h-full"
      />
      {/* Overlay canvas for boundary conditions (always Canvas2D) */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </div>
  );
}

/**
 * Draw a triangular pin support symbol
 */
function drawPinSupport(ctx: CanvasRenderingContext2D, size: number) {
  const h = size;
  const w = size * 0.8;
  
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-w/2, h);
  ctx.lineTo(w/2, h);
  ctx.closePath();
  
  ctx.fillStyle = '#3b82f6';
  ctx.fill();
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  // Ground line
  ctx.beginPath();
  ctx.moveTo(-w/2 - 4, h);
  ctx.lineTo(w/2 + 4, h);
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Hatching
  const hatchCount = 4;
  const hatchSpacing = (w + 8) / hatchCount;
  ctx.beginPath();
  for (let i = 0; i < hatchCount; i++) {
    const x = -w/2 - 4 + i * hatchSpacing + hatchSpacing/2;
    ctx.moveTo(x, h);
    ctx.lineTo(x - 4, h + 6);
  }
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Draw a roller support symbol
 */
function drawRollerSupport(ctx: CanvasRenderingContext2D, size: number, orientation: 'horizontal' | 'vertical') {
  const radius = size * 0.2;
  
  ctx.save();
  
  if (orientation === 'vertical') {
    ctx.rotate(Math.PI / 2);
  }
  
  // Circle (roller)
  ctx.beginPath();
  ctx.arc(0, radius * 1.5, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#3b82f6';
  ctx.fill();
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  // Ground line
  const lineWidth = size * 0.6;
  ctx.beginPath();
  ctx.moveTo(-lineWidth/2, radius * 2.5);
  ctx.lineTo(lineWidth/2, radius * 2.5);
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Hatching
  const hatchCount = 3;
  const hatchSpacing = lineWidth / hatchCount;
  ctx.beginPath();
  for (let i = 0; i < hatchCount; i++) {
    const x = -lineWidth/2 + i * hatchSpacing + hatchSpacing/2;
    ctx.moveTo(x, radius * 2.5);
    ctx.lineTo(x - 3, radius * 2.5 + 5);
  }
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Draw an arrow (for loads)
 */
function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const headLength = 10;
  const headAngle = Math.PI / 6;
  
  const angle = Math.atan2(y2 - y1, x2 - x1);
  
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  
  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle - headAngle),
    y2 - headLength * Math.sin(angle - headAngle)
  );
  ctx.lineTo(
    x2 - headLength * Math.cos(angle + headAngle),
    y2 - headLength * Math.sin(angle + headAngle)
  );
  ctx.closePath();
  ctx.fillStyle = '#dc2626';
  ctx.fill();
}

export default Canvas;

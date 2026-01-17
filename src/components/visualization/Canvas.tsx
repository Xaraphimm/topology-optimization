'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { WebGLRenderer, useWebGLRenderer } from '@/lib/webgl';

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
 * Convert a value in [0,1] to a blue-white-red color
 * 0 = blue (low stress), 0.5 = white, 1 = red (high stress)
 */
function stressToColor(normalizedValue: number): string {
  // Clamp to [0, 1]
  const t = Math.max(0, Math.min(1, normalizedValue));
  
  let r: number, g: number, b: number;
  
  if (t < 0.5) {
    // Blue to white (0 to 0.5)
    const s = t * 2; // 0 to 1
    r = Math.round(59 + s * (255 - 59));   // 59 -> 255
    g = Math.round(130 + s * (255 - 130)); // 130 -> 255
    b = Math.round(246 + s * (255 - 246)); // 246 -> 255
  } else {
    // White to red (0.5 to 1)
    const s = (t - 0.5) * 2; // 0 to 1
    r = 255;
    g = Math.round(255 - s * 255); // 255 -> 0
    b = Math.round(255 - s * 217); // 255 -> 38
  }
  
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
}: CanvasProps) {
  // Main canvas for WebGL or Canvas2D mesh rendering
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  // Overlay canvas for boundary conditions (always Canvas2D)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const isDark = useDarkMode();
  
  // Check if WebGL should be used
  const [useWebGL, setUseWebGL] = useState(false);
  
  // Initialize WebGL availability check
  useEffect(() => {
    if (preferWebGL && WebGLRenderer.isSupported()) {
      setUseWebGL(true);
    } else {
      setUseWebGL(false);
    }
  }, [preferWebGL]);
  
  // WebGL renderer hook (only active when useWebGL is true)
  const { isWebGLAvailable, error: webglError, render: webglRender } = useWebGLRenderer(
    mainCanvasRef,
    useWebGL ? densities : null, // Only pass data if using WebGL
    useWebGL ? strainEnergy : null,
    nelx,
    nely,
    viewMode
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
          // Convert density to grayscale (0=white/void, 1=black/solid)
          const gray = Math.round((1 - density) * 255);
          ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
        } else {
          // Stress view: blue-white-red heatmap
          if (strainEnergy && maxStrainEnergy > 0) {
            // Normalize strain energy and apply sqrt to spread out colors more
            const normalized = Math.sqrt(strainEnergy[elemIdx] / maxStrainEnergy);
            ctx.fillStyle = stressToColor(normalized);
          } else {
            ctx.fillStyle = '#e5e7eb';
          }
        }
        
        ctx.fillRect(canvasX, canvasY, elemWidth + 0.5, elemHeight + 0.5);
      }
    }
  }, [densities, strainEnergy, nelx, nely, viewMode, isDark, initialVolumeFraction, actuallyUsingWebGL]);
  
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

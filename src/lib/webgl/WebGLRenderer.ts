/**
 * WebGL Renderer for topology optimization visualization
 * Provides GPU-accelerated rendering for large meshes
 */

import {
  vertexShaderSource,
  materialFragmentShaderSource,
  stressFragmentShaderSource,
  createShader,
  createProgram,
  packDensitiesToTexture,
  packStressToTexture,
} from './shaders';

export type ViewMode = 'material' | 'stress';

/**
 * Rendering options for visual quality control
 */
export interface RenderingOptions {
  /** Use smooth bilinear interpolation (true) or crisp nearest-neighbor (false) */
  smoothRendering: boolean;
}

const DEFAULT_RENDERING_OPTIONS: RenderingOptions = {
  smoothRendering: true, // Default to smooth for better visual quality
};

interface ProgramInfo {
  program: WebGLProgram;
  attribLocations: {
    position: number;
    texCoord: number;
  };
  uniformLocations: {
    densityTexture?: WebGLUniformLocation | null;
    stressTexture?: WebGLUniformLocation | null;
    colormapLUT?: WebGLUniformLocation | null;
    nelx?: WebGLUniformLocation | null;
    nely?: WebGLUniformLocation | null;
    maxStress?: WebGLUniformLocation | null;
  };
}

/**
 * WebGL-based renderer for topology visualization
 */
export class WebGLRenderer {
  private gl: WebGLRenderingContext | null = null;
  private canvas: HTMLCanvasElement;
  private materialProgram: ProgramInfo | null = null;
  private stressProgram: ProgramInfo | null = null;
  private densityTexture: WebGLTexture | null = null;
  private stressTexture: WebGLTexture | null = null;
  private colormapLUTTexture: WebGLTexture | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private isInitialized = false;
  private contextLost = false;
  
  // Current mesh dimensions
  private nelx = 0;
  private nely = 0;
  private maxStress = 1;
  
  // Flag to track if density texture has valid data
  private hasDensityData = false;
  
  // Rendering options for visual quality
  private renderingOptions: RenderingOptions;

  constructor(canvas: HTMLCanvasElement, options: Partial<RenderingOptions> = {}) {
    this.canvas = canvas;
    this.renderingOptions = { ...DEFAULT_RENDERING_OPTIONS, ...options };
  }

  /**
   * Check if WebGL is supported in the current browser
   */
  static isSupported(): boolean {
    if (typeof document === 'undefined') {
      return false;
    }
    
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl !== null;
    } catch {
      return false;
    }
  }

  /**
   * Initialize WebGL context and compile shaders
   * @returns true if initialization succeeded, false otherwise
   */
  init(): boolean {
    if (this.isInitialized) {
      return true;
    }

    // Get WebGL context
    this.gl = (
      this.canvas.getContext('webgl') || 
      this.canvas.getContext('experimental-webgl')
    ) as WebGLRenderingContext | null;

    if (!this.gl) {
      console.error('WebGL not supported');
      return false;
    }

    // Set up context loss handling
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);

    // Compile shaders and create programs
    if (!this.setupPrograms()) {
      return false;
    }

    // Create buffers
    if (!this.setupBuffers()) {
      return false;
    }

    // Create textures
    if (!this.setupTextures()) {
      return false;
    }

    this.isInitialized = true;
    return true;
  }

  /**
   * Handle WebGL context loss
   */
  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    console.warn('WebGL context lost');
  };

  /**
   * Handle WebGL context restoration
   */
  private handleContextRestored = (): void => {
    console.info('WebGL context restored, reinitializing...');
    this.contextLost = false;
    this.isInitialized = false;
    this.init();
  };

  /**
   * Set up shader programs
   */
  private setupPrograms(): boolean {
    const gl = this.gl!;

    // Create vertex shader (shared between both programs)
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    if (!vertexShader) {
      return false;
    }

    // Create material fragment shader
    const materialFragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      materialFragmentShaderSource
    );
    if (!materialFragmentShader) {
      gl.deleteShader(vertexShader);
      return false;
    }

    // Create stress fragment shader
    const stressFragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      stressFragmentShaderSource
    );
    if (!stressFragmentShader) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(materialFragmentShader);
      return false;
    }

    // Create material program
    const materialProg = createProgram(gl, vertexShader, materialFragmentShader);
    if (!materialProg) {
      return false;
    }

    this.materialProgram = {
      program: materialProg,
      attribLocations: {
        position: gl.getAttribLocation(materialProg, 'a_position'),
        texCoord: gl.getAttribLocation(materialProg, 'a_texCoord'),
      },
      uniformLocations: {
        densityTexture: gl.getUniformLocation(materialProg, 'u_densityTexture'),
        nelx: gl.getUniformLocation(materialProg, 'u_nelx'),
        nely: gl.getUniformLocation(materialProg, 'u_nely'),
      },
    };

    // Create stress program (need a new vertex shader instance)
    const vertexShader2 = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    if (!vertexShader2) {
      return false;
    }

    const stressProg = createProgram(gl, vertexShader2, stressFragmentShader);
    if (!stressProg) {
      return false;
    }

    this.stressProgram = {
      program: stressProg,
      attribLocations: {
        position: gl.getAttribLocation(stressProg, 'a_position'),
        texCoord: gl.getAttribLocation(stressProg, 'a_texCoord'),
      },
      uniformLocations: {
        stressTexture: gl.getUniformLocation(stressProg, 'u_stressTexture'),
        colormapLUT: gl.getUniformLocation(stressProg, 'u_colormapLUT'),
        maxStress: gl.getUniformLocation(stressProg, 'u_maxStress'),
      },
    };

    return true;
  }

  /**
   * Set up vertex buffers for full-screen quad
   */
  private setupBuffers(): boolean {
    const gl = this.gl!;

    // Create position buffer (two triangles forming a quad)
    // Clip space coordinates: (-1,-1) to (1,1)
    const positions = new Float32Array([
      -1, -1,  // bottom-left
       1, -1,  // bottom-right
      -1,  1,  // top-left
       1,  1,  // top-right
    ]);

    this.quadBuffer = gl.createBuffer();
    if (!this.quadBuffer) {
      return false;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Create texture coordinate buffer
    // Texture coordinates: (0,0) to (1,1)
    // Note: Y is flipped - (0,0) is bottom-left in texture space
    const texCoords = new Float32Array([
      0, 0,  // bottom-left
      1, 0,  // bottom-right
      0, 1,  // top-left
      1, 1,  // top-right
    ]);

    this.texCoordBuffer = gl.createBuffer();
    if (!this.texCoordBuffer) {
      return false;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    return true;
  }

  /**
   * Set up textures for density and stress data
   * Uses LINEAR filtering for smooth rendering or NEAREST for crisp pixels
   */
  private setupTextures(): boolean {
    const gl = this.gl!;
    
    // Select filtering mode based on rendering options
    // LINEAR: Smooth bilinear interpolation between texels - produces smooth gradients
    // NEAREST: Crisp pixel-perfect rendering - shows individual elements clearly
    const filterMode = this.renderingOptions.smoothRendering ? gl.LINEAR : gl.NEAREST;

    // Create density texture
    this.densityTexture = gl.createTexture();
    if (!this.densityTexture) {
      return false;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.densityTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterMode);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterMode);

    // Create stress texture
    this.stressTexture = gl.createTexture();
    if (!this.stressTexture) {
      return false;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.stressTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterMode);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterMode);

    // Create colormap LUT texture (256x1 RGB)
    // Uses LINEAR filtering for smooth color transitions
    this.colormapLUTTexture = gl.createTexture();
    if (!this.colormapLUTTexture) {
      return false;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.colormapLUTTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return true;
  }

  /**
   * Update density texture from Float64Array
   */
  updateDensities(densities: Float64Array, nelx: number, nely: number): void {
    if (!this.gl || !this.densityTexture || this.contextLost) {
      return;
    }

    const gl = this.gl;
    
    // Validate input data size matches expected dimensions
    const expectedSize = nelx * nely;
    if (densities.length !== expectedSize) {
      console.warn(`WebGL: Density array size (${densities.length}) doesn't match mesh dimensions (${nelx}x${nely}=${expectedSize})`);
      return;
    }
    
    this.nelx = nelx;
    this.nely = nely;

    // Pack densities into texture format (Float32, Y-flipped)
    const textureData = packDensitiesToTexture(densities, nelx, nely);

    // Convert to Uint8 since LUMINANCE with floats may not be well-supported
    const uint8Data = new Uint8Array(nelx * nely);
    for (let i = 0; i < textureData.length; i++) {
      uint8Data[i] = Math.round(textureData[i] * 255);
    }

    gl.bindTexture(gl.TEXTURE_2D, this.densityTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      nelx,
      nely,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      uint8Data
    );
    
    // Mark that we have valid density data
    this.hasDensityData = true;
  }

  /**
   * Update stress texture from Float64Array
   */
  updateStress(stress: Float64Array, maxStress: number): void {
    if (!this.gl || !this.stressTexture || this.contextLost) {
      return;
    }

    // Safety check: ensure dimensions are set
    if (this.nelx === 0 || this.nely === 0) {
      console.warn('WebGL: Cannot update stress texture - mesh dimensions not set');
      return;
    }

    // Validate input data size
    const expectedSize = this.nelx * this.nely;
    if (stress.length !== expectedSize) {
      console.warn(`WebGL: Stress array size (${stress.length}) doesn't match mesh dimensions (${this.nelx}x${this.nely}=${expectedSize})`);
      return;
    }

    const gl = this.gl;
    this.maxStress = maxStress > 0 ? maxStress : 1;

    // Pack stress into texture format (normalized, Y-flipped)
    const textureData = packStressToTexture(stress, this.maxStress, this.nelx, this.nely);

    // Convert to Uint8
    const uint8Data = new Uint8Array(this.nelx * this.nely);
    for (let i = 0; i < textureData.length; i++) {
      uint8Data[i] = Math.round(Math.min(1, textureData[i]) * 255);
    }

    gl.bindTexture(gl.TEXTURE_2D, this.stressTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      this.nelx,
      this.nely,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      uint8Data
    );
  }

  /**
   * Update the colormap LUT texture from a Uint8Array
   * The LUT should be 256 entries * 3 channels (RGB) = 768 bytes
   * Each entry maps normalized stress [0-255] -> RGB color
   * 
   * @param lut - Uint8Array of 768 bytes (256 RGB triplets)
   */
  updateColormapLUT(lut: Uint8Array): void {
    if (!this.gl || !this.colormapLUTTexture || this.contextLost) {
      return;
    }

    // Validate LUT size: 256 entries * 3 channels = 768 bytes
    if (lut.length !== 256 * 3) {
      console.warn(`WebGL: Invalid LUT size (${lut.length}), expected 768 bytes`);
      return;
    }

    const gl = this.gl;

    gl.bindTexture(gl.TEXTURE_2D, this.colormapLUTTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGB,
      256,  // width: 256 color entries
      1,    // height: 1 (1D texture stored as 2D)
      0,
      gl.RGB,
      gl.UNSIGNED_BYTE,
      lut
    );
  }

  /**
   * Set mesh dimensions without updating texture data
   * This allows the renderer to prepare for incoming data
   */
  setDimensions(nelx: number, nely: number): void {
    this.nelx = nelx;
    this.nely = nely;
    // Reset the data flag when dimensions change - old data is invalid
    this.hasDensityData = false;
  }

  /**
   * Render the current view
   */
  render(viewMode: ViewMode): void {
    if (!this.gl || !this.isInitialized || this.contextLost) {
      return;
    }

    // Safety check: ensure mesh dimensions are set before rendering
    if (this.nelx === 0 || this.nely === 0) {
      // Dimensions not yet set - skip render, will be called again when updateDensities is called
      return;
    }

    const gl = this.gl;

    // Handle canvas resize with device pixel ratio
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    if (this.canvas.width !== displayWidth * dpr || 
        this.canvas.height !== displayHeight * dpr) {
      this.canvas.width = displayWidth * dpr;
      this.canvas.height = displayHeight * dpr;
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Clear the canvas
    gl.clearColor(0.97, 0.98, 0.99, 1.0); // Light gray background
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Select program based on view mode
    const programInfo = viewMode === 'material' ? this.materialProgram : this.stressProgram;
    if (!programInfo) {
      return;
    }

    gl.useProgram(programInfo.program);

    // Set up position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(programInfo.attribLocations.position);
    gl.vertexAttribPointer(
      programInfo.attribLocations.position,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );

    // Set up texture coordinate attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(programInfo.attribLocations.texCoord);
    gl.vertexAttribPointer(
      programInfo.attribLocations.texCoord,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );

    // Set uniforms and bind texture
    gl.activeTexture(gl.TEXTURE0);

    if (viewMode === 'material') {
      gl.bindTexture(gl.TEXTURE_2D, this.densityTexture);
      if (programInfo.uniformLocations.densityTexture !== undefined) {
        gl.uniform1i(programInfo.uniformLocations.densityTexture, 0);
      }
      if (programInfo.uniformLocations.nelx !== undefined) {
        gl.uniform1i(programInfo.uniformLocations.nelx, this.nelx);
      }
      if (programInfo.uniformLocations.nely !== undefined) {
        gl.uniform1i(programInfo.uniformLocations.nely, this.nely);
      }
    } else {
      // Bind stress texture to texture unit 0
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.stressTexture);
      if (programInfo.uniformLocations.stressTexture !== undefined) {
        gl.uniform1i(programInfo.uniformLocations.stressTexture, 0);
      }
      
      // Bind colormap LUT texture to texture unit 1
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.colormapLUTTexture);
      if (programInfo.uniformLocations.colormapLUT !== undefined) {
        gl.uniform1i(programInfo.uniformLocations.colormapLUT, 1);
      }
      
      if (programInfo.uniformLocations.maxStress !== undefined) {
        gl.uniform1f(programInfo.uniformLocations.maxStress, 1.0); // Already normalized in texture
      }
    }

    // Draw the quad as a triangle strip
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Update rendering options (e.g., toggle smooth rendering)
   * Note: This reinitializes textures to apply new filtering mode
   */
  setRenderingOptions(options: Partial<RenderingOptions>): void {
    const newOptions = { ...this.renderingOptions, ...options };
    
    // Only reinitialize if filtering mode changed
    if (newOptions.smoothRendering !== this.renderingOptions.smoothRendering) {
      this.renderingOptions = newOptions;
      
      // Reinitialize textures with new filtering mode
      if (this.gl && this.isInitialized) {
        // Delete old textures
        if (this.densityTexture) {
          this.gl.deleteTexture(this.densityTexture);
          this.densityTexture = null;
        }
        if (this.stressTexture) {
          this.gl.deleteTexture(this.stressTexture);
          this.stressTexture = null;
        }
        if (this.colormapLUTTexture) {
          this.gl.deleteTexture(this.colormapLUTTexture);
          this.colormapLUTTexture = null;
        }
        
        // Recreate textures with new filtering
        this.setupTextures();
        this.hasDensityData = false;
      }
    } else {
      this.renderingOptions = newOptions;
    }
  }

  /**
   * Get current rendering options
   */
  getRenderingOptions(): RenderingOptions {
    return { ...this.renderingOptions };
  }

  /**
   * Clean up WebGL resources
   */
  dispose(): void {
    if (!this.gl) {
      return;
    }

    const gl = this.gl;

    // Remove event listeners
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    // Delete textures
    if (this.densityTexture) {
      gl.deleteTexture(this.densityTexture);
      this.densityTexture = null;
    }
    if (this.stressTexture) {
      gl.deleteTexture(this.stressTexture);
      this.stressTexture = null;
    }
    if (this.colormapLUTTexture) {
      gl.deleteTexture(this.colormapLUTTexture);
      this.colormapLUTTexture = null;
    }

    // Delete buffers
    if (this.quadBuffer) {
      gl.deleteBuffer(this.quadBuffer);
      this.quadBuffer = null;
    }
    if (this.texCoordBuffer) {
      gl.deleteBuffer(this.texCoordBuffer);
      this.texCoordBuffer = null;
    }

    // Delete programs
    if (this.materialProgram) {
      gl.deleteProgram(this.materialProgram.program);
      this.materialProgram = null;
    }
    if (this.stressProgram) {
      gl.deleteProgram(this.stressProgram.program);
      this.stressProgram = null;
    }

    this.gl = null;
    this.isInitialized = false;
  }

  /**
   * Check if the renderer is ready to render
   */
  isReady(): boolean {
    return this.isInitialized && !this.contextLost;
  }
}

export default WebGLRenderer;

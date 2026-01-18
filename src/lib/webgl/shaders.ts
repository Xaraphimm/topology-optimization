/**
 * GLSL Shader source code for WebGL-based topology visualization
 */

/**
 * Vertex shader for full-screen quad rendering
 * Maps clip-space positions to texture coordinates
 */
export const vertexShaderSource = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

/**
 * Fragment shader for material/density view
 * Renders grayscale: 0 = white (void), 1 = black (solid)
 * 
 * Enhanced with:
 * - Gamma correction for perceptually uniform brightness
 * - Contrast enhancement for clearer solid/void distinction
 * - Smooth material boundary transitions
 */
export const materialFragmentShaderSource = `
precision highp float;
varying vec2 v_texCoord;
uniform sampler2D u_densityTexture;
uniform int u_nelx;
uniform int u_nely;

// Gamma correction for perceptually uniform brightness
// Human vision perceives brightness non-linearly, gamma correction compensates
const float GAMMA = 2.2;
const float INV_GAMMA = 1.0 / 2.2;

// Contrast enhancement parameters
// These values create a sharper visual distinction between solid and void regions
const float CONTRAST_CENTER = 0.5;  // Material boundary threshold
const float CONTRAST_LOW = 0.08;    // Lower bound for smoothstep
const float CONTRAST_HIGH = 0.92;   // Upper bound for smoothstep

void main() {
  // Sample density at this fragment's position
  float density = texture2D(u_densityTexture, v_texCoord).r;
  
  // Apply gamma correction for perceptually uniform brightness
  // This makes mid-gray values appear more natural
  float gammaCorrected = pow(density, INV_GAMMA);
  
  // Apply contrast enhancement using smoothstep
  // This creates sharper visual boundaries while maintaining smooth gradients
  // Densities below CONTRAST_LOW map toward 0, above CONTRAST_HIGH toward 1
  float enhanced = smoothstep(CONTRAST_LOW, CONTRAST_HIGH, gammaCorrected);
  
  // Convert to grayscale: 0 (void) = white, 1 (solid) = black
  float gray = 1.0 - enhanced;
  
  // Apply inverse gamma for final output (most displays expect gamma-encoded values)
  float finalGray = pow(gray, INV_GAMMA);
  
  gl_FragColor = vec4(finalGray, finalGray, finalGray, 1.0);
}
`;

/**
 * Fragment shader for stress/strain energy view (legacy - hardcoded blue-white-red)
 * Kept for backward compatibility and testing
 * 
 * Enhanced with:
 * - Improved color interpolation using smoothstep
 * - Better perceptual uniformity
 * - Gamma-corrected output
 */
export const stressFragmentShaderSourceLegacy = `
precision highp float;
varying vec2 v_texCoord;
uniform sampler2D u_stressTexture;
uniform float u_maxStress;

// Gamma for perceptual correction
const float GAMMA = 2.2;
const float INV_GAMMA = 1.0 / 2.2;

// Blue-white-red colormap with improved interpolation
// t=0: blue (low stress), t=0.5: white, t=1: red (high stress)
// Uses smoothstep for more natural color transitions
vec3 stressColor(float t) {
  // Clamp input to valid range
  float tc = clamp(t, 0.0, 1.0);
  
  // Define colors in linear space for accurate interpolation
  // Blue: Tailwind blue-500 (59, 130, 246)
  vec3 blue = vec3(0.231, 0.510, 0.965);
  // White
  vec3 white = vec3(1.0, 1.0, 1.0);
  // Red: Vibrant red (239, 68, 68) - Tailwind red-500
  vec3 red = vec3(0.937, 0.267, 0.267);
  
  vec3 color;
  if (tc < 0.5) {
    // Blue to white transition
    float s = tc * 2.0;
    // Use smoothstep for smoother gradient near boundaries
    float smooth_s = smoothstep(0.0, 1.0, s);
    color = mix(blue, white, smooth_s);
  } else {
    // White to red transition
    float s = (tc - 0.5) * 2.0;
    float smooth_s = smoothstep(0.0, 1.0, s);
    color = mix(white, red, smooth_s);
  }
  
  return color;
}

void main() {
  float stress = texture2D(u_stressTexture, v_texCoord).r;
  
  // Apply sqrt for better visual distribution of stress values
  // This spreads out the lower stress values which are often more numerous
  float normalized = sqrt(stress / u_maxStress);
  
  // Get color from colormap
  vec3 color = stressColor(normalized);
  
  // Apply gamma correction for display (most monitors expect gamma-encoded values)
  vec3 gammaCorrected = pow(color, vec3(INV_GAMMA));
  
  gl_FragColor = vec4(gammaCorrected, 1.0);
}
`;

/**
 * Fragment shader for stress/strain energy view with dynamic colormap LUT
 * Uses a 1D texture lookup table for colormap - allows runtime palette switching
 * 
 * The LUT texture is a 256x1 RGB texture where each texel represents
 * the color for that normalized stress value (0-255 maps to 0.0-1.0)
 */
export const stressFragmentShaderSource = `
precision highp float;
varying vec2 v_texCoord;
uniform sampler2D u_stressTexture;
uniform sampler2D u_colormapLUT;
uniform float u_maxStress;

void main() {
  // Sample stress value at this position
  float stress = texture2D(u_stressTexture, v_texCoord).r;
  
  // Apply sqrt for better visual distribution of stress values
  // This spreads out the lower stress values which are often more numerous
  float normalized = sqrt(stress / u_maxStress);
  
  // Clamp to valid range
  normalized = clamp(normalized, 0.0, 1.0);
  
  // Sample color from LUT texture
  // The LUT is a 256x1 texture, so we sample at (normalized, 0.5)
  // Using 0.5 for Y to sample the center of the single row
  vec3 color = texture2D(u_colormapLUT, vec2(normalized, 0.5)).rgb;
  
  gl_FragColor = vec4(color, 1.0);
}
`;

/**
 * Helper function to create a shader program
 */
export function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    console.error('Failed to create shader');
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Helper function to create and link a shader program
 */
export function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) {
    console.error('Failed to create program');
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program linking error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

/**
 * Validate shader source for common errors
 * Returns an array of error messages (empty if valid)
 */
export function validateShaderSource(source: string): string[] {
  const errors: string[] = [];
  
  // Check for basic GLSL syntax requirements
  if (!source.includes('void main()') && !source.includes('void main ()')) {
    errors.push('Missing main() function');
  }
  
  // Check for matching braces
  const openBraces = (source.match(/{/g) || []).length;
  const closeBraces = (source.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`Mismatched braces: ${openBraces} open, ${closeBraces} close`);
  }
  
  // Check for matching parentheses
  const openParens = (source.match(/\(/g) || []).length;
  const closeParens = (source.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push(`Mismatched parentheses: ${openParens} open, ${closeParens} close`);
  }
  
  return errors;
}

/**
 * Convert normalized stress value to RGB color (matching shader logic)
 * Used for testing and fallback rendering
 * 
 * Enhanced with smoothstep interpolation and gamma correction to match WebGL shader
 */
export function stressToRGB(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  
  // Smoothstep function for smoother transitions
  const smoothstep = (x: number): number => x * x * (3 - 2 * x);
  
  // Define colors (matching shader)
  const blue = [0.231, 0.510, 0.965];
  const white = [1.0, 1.0, 1.0];
  const red = [0.937, 0.267, 0.267];
  
  let color: number[];
  
  if (clamped < 0.5) {
    const s = clamped * 2;
    const smooth_s = smoothstep(s);
    // Blue to white
    color = [
      blue[0] + smooth_s * (white[0] - blue[0]),
      blue[1] + smooth_s * (white[1] - blue[1]),
      blue[2] + smooth_s * (white[2] - blue[2]),
    ];
  } else {
    const s = (clamped - 0.5) * 2;
    const smooth_s = smoothstep(s);
    // White to red
    color = [
      white[0] + smooth_s * (red[0] - white[0]),
      white[1] + smooth_s * (red[1] - white[1]),
      white[2] + smooth_s * (red[2] - white[2]),
    ];
  }
  
  // Apply gamma correction (inverse gamma = 1/2.2)
  const invGamma = 1 / 2.2;
  const gammaCorrected = color.map(c => Math.pow(c, invGamma));
  
  return [
    Math.round(gammaCorrected[0] * 255),
    Math.round(gammaCorrected[1] * 255),
    Math.round(gammaCorrected[2] * 255),
  ];
}

/**
 * Pack Float64Array densities into a format suitable for WebGL texture
 * Returns a Float32Array since WebGL doesn't support Float64
 */
export function packDensitiesToTexture(
  densities: Float64Array,
  nelx: number,
  nely: number
): Float32Array {
  const textureData = new Float32Array(nelx * nely);
  
  // Copy and flip Y to match canvas convention (Y=0 at top)
  for (let x = 0; x < nelx; x++) {
    for (let y = 0; y < nely; y++) {
      const srcIdx = x * nely + y;
      // Flip Y: bottom row in data becomes top row in texture
      const dstIdx = x + (nely - 1 - y) * nelx;
      textureData[dstIdx] = densities[srcIdx];
    }
  }
  
  return textureData;
}

/**
 * Normalize stress values and pack into texture format
 */
export function packStressToTexture(
  stress: Float64Array,
  maxStress: number,
  nelx: number,
  nely: number
): Float32Array {
  const textureData = new Float32Array(nelx * nely);
  const safeMax = maxStress > 0 ? maxStress : 1;
  
  // Normalize and flip Y
  for (let x = 0; x < nelx; x++) {
    for (let y = 0; y < nely; y++) {
      const srcIdx = x * nely + y;
      const dstIdx = x + (nely - 1 - y) * nelx;
      // Store raw normalized value; shader applies sqrt
      textureData[dstIdx] = stress[srcIdx] / safeMax;
    }
  }
  
  return textureData;
}

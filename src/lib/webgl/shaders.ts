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
 */
export const materialFragmentShaderSource = `
precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_densityTexture;
uniform int u_nelx;
uniform int u_nely;

void main() {
  // Sample density at this fragment's position
  float density = texture2D(u_densityTexture, v_texCoord).r;
  // Grayscale: 0 = white (void), 1 = black (solid)
  float gray = 1.0 - density;
  gl_FragColor = vec4(gray, gray, gray, 1.0);
}
`;

/**
 * Fragment shader for stress/strain energy view
 * Renders blue-white-red colormap based on stress intensity
 */
export const stressFragmentShaderSource = `
precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_stressTexture;
uniform float u_maxStress;

// Blue-white-red colormap
// t=0: blue (low stress), t=0.5: white, t=1: red (high stress)
vec3 stressColor(float t) {
  if (t < 0.5) {
    float s = t * 2.0;
    // Blue RGB: (59, 130, 246) / 255 = (0.231, 0.510, 0.965)
    return mix(vec3(0.231, 0.510, 0.965), vec3(1.0, 1.0, 1.0), s);
  } else {
    float s = (t - 0.5) * 2.0;
    // Red RGB: (255, 0, 38) / 255 = (1.0, 0.0, 0.149)
    return mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.0, 0.149), s);
  }
}

void main() {
  float stress = texture2D(u_stressTexture, v_texCoord).r;
  float normalized = sqrt(stress / u_maxStress); // sqrt for better color spread
  gl_FragColor = vec4(stressColor(normalized), 1.0);
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
 */
export function stressToRGB(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  
  if (clamped < 0.5) {
    const s = clamped * 2;
    // Blue to white
    return [
      Math.round((0.231 + s * (1.0 - 0.231)) * 255),
      Math.round((0.510 + s * (1.0 - 0.510)) * 255),
      Math.round((0.965 + s * (1.0 - 0.965)) * 255),
    ];
  } else {
    const s = (clamped - 0.5) * 2;
    // White to red
    return [
      255,
      Math.round(255 - s * 255),
      Math.round(255 - s * (255 - 38)),
    ];
  }
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

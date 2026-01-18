/**
 * Rupture Risk Colormap
 *
 * Color scheme optimized for visualizing stress and rupture risk
 * in soft material optimization. Uses a green-yellow-red gradient
 * that's intuitive for safety visualization.
 */

/**
 * Rupture risk color stops (green = safe, red = rupture)
 * Value range: 0 (safe) to 1 (rupture)
 */
export const RUPTURE_RISK_COLORMAP = {
  name: 'rupture-risk',
  stops: [
    { value: 0.0, color: [34, 197, 94] },    // Green (safe)
    { value: 0.3, color: [74, 222, 128] },   // Light green
    { value: 0.5, color: [250, 204, 21] },   // Yellow (caution)
    { value: 0.7, color: [251, 146, 60] },   // Orange (warning)
    { value: 0.85, color: [239, 68, 68] },   // Red (danger)
    { value: 1.0, color: [127, 29, 29] },    // Dark red (rupture)
  ] as const,
};

/**
 * Safety margin colormap (inverse - high safety = green)
 * Value range: 0 (failure) to 3+ (very safe)
 */
export const SAFETY_MARGIN_COLORMAP = {
  name: 'safety-margin',
  stops: [
    { value: 0.0, color: [127, 29, 29] },    // Dark red (failure)
    { value: 0.5, color: [239, 68, 68] },    // Red
    { value: 1.0, color: [251, 146, 60] },   // Orange (at limit)
    { value: 1.5, color: [250, 204, 21] },   // Yellow
    { value: 2.0, color: [74, 222, 128] },   // Light green
    { value: 3.0, color: [34, 197, 94] },    // Green (very safe)
  ] as const,
};

/**
 * Interpolate color from a colormap
 */
export function interpolateColor(
  value: number,
  colormap: typeof RUPTURE_RISK_COLORMAP | typeof SAFETY_MARGIN_COLORMAP
): [number, number, number] {
  const stops = colormap.stops;

  // Clamp to colormap range
  const minVal = stops[0].value;
  const maxVal = stops[stops.length - 1].value;
  const clampedValue = Math.max(minVal, Math.min(maxVal, value));

  // Find surrounding stops
  let lowerIdx = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    if (clampedValue >= stops[i].value && clampedValue <= stops[i + 1].value) {
      lowerIdx = i;
      break;
    }
  }

  const lower = stops[lowerIdx];
  const upper = stops[lowerIdx + 1];

  // Linear interpolation
  const t = (clampedValue - lower.value) / (upper.value - lower.value);

  return [
    Math.round(lower.color[0] + t * (upper.color[0] - lower.color[0])),
    Math.round(lower.color[1] + t * (upper.color[1] - lower.color[1])),
    Math.round(lower.color[2] + t * (upper.color[2] - lower.color[2])),
  ];
}

/**
 * Convert RGB to hex string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Get color for rupture risk value
 */
export function getRuptureRiskColor(risk: number): string {
  const [r, g, b] = interpolateColor(risk, RUPTURE_RISK_COLORMAP);
  return rgbToHex(r, g, b);
}

/**
 * Get color for safety margin value
 */
export function getSafetyMarginColor(margin: number): string {
  const [r, g, b] = interpolateColor(margin, SAFETY_MARGIN_COLORMAP);
  return rgbToHex(r, g, b);
}

/**
 * Generate LUT texture data for rupture risk visualization
 * Returns a 256x1 RGBA array for WebGL texture
 */
export function generateRuptureRiskLUT(): Uint8Array {
  const data = new Uint8Array(256 * 4);

  for (let i = 0; i < 256; i++) {
    const value = i / 255;
    const [r, g, b] = interpolateColor(value, RUPTURE_RISK_COLORMAP);

    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255; // Full opacity
  }

  return data;
}

/**
 * Get CSS class for rupture risk level
 */
export function getRuptureRiskClass(risk: number): string {
  if (risk >= 0.85) return 'text-red-700 dark:text-red-400 font-bold';
  if (risk >= 0.7) return 'text-orange-600 dark:text-orange-400 font-semibold';
  if (risk >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

/**
 * Get descriptive label for rupture risk level
 */
export function getRuptureRiskLabel(risk: number): string {
  if (risk >= 0.85) return 'CRITICAL - Rupture likely';
  if (risk >= 0.7) return 'HIGH RISK - Reinforce walls';
  if (risk >= 0.5) return 'CAUTION - Near limit';
  if (risk >= 0.3) return 'MODERATE - Monitor stress';
  return 'SAFE - Good margin';
}

/**
 * Get descriptive label for safety margin
 */
export function getSafetyMarginLabel(margin: number): string {
  if (margin >= 3.0) return 'Excellent (3x+ safety)';
  if (margin >= 2.0) return 'Good (2x+ safety)';
  if (margin >= 1.5) return 'Acceptable (1.5x safety)';
  if (margin >= 1.0) return 'At limit (1x safety)';
  return 'FAILURE - Below limit';
}

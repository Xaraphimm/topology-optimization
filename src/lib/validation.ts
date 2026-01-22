/**
 * Validation and Sanitization Utilities
 *
 * Provides centralized input validation and sanitization functions
 * to prevent security vulnerabilities like XSS, injection attacks, and
 * invalid data handling.
 *
 * @module validation
 */

/**
 * CSS color validation patterns
 */
const HEX_COLOR_PATTERN = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;
const RGB_COLOR_PATTERN = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;
const RGBA_COLOR_PATTERN = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/;

/**
 * Named CSS colors (subset of commonly used colors)
 */
const NAMED_COLORS = new Set([
  'black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
  'gray', 'grey', 'orange', 'purple', 'pink', 'brown', 'transparent',
  'navy', 'teal', 'olive', 'maroon', 'silver', 'lime', 'aqua', 'fuchsia',
]);

/**
 * RGB color tuple
 */
export type RGBTuple = [number, number, number];

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  valid: boolean;
  value: T;
  error?: string;
}

/**
 * Validate and sanitize a CSS color string
 * Returns true if the color is a valid CSS color format
 *
 * @param color - The color string to validate
 * @returns Whether the color is valid
 */
export function isValidCSSColor(color: string): boolean {
  if (typeof color !== 'string') return false;

  const trimmed = color.trim().toLowerCase();

  // Check named colors
  if (NAMED_COLORS.has(trimmed)) return true;

  // Check hex colors
  if (HEX_COLOR_PATTERN.test(trimmed)) return true;

  // Check rgb() colors
  if (RGB_COLOR_PATTERN.test(trimmed)) {
    const match = trimmed.match(RGB_COLOR_PATTERN);
    if (match) {
      const [, r, g, b] = match;
      return (
        parseInt(r, 10) <= 255 &&
        parseInt(g, 10) <= 255 &&
        parseInt(b, 10) <= 255
      );
    }
  }

  // Check rgba() colors
  if (RGBA_COLOR_PATTERN.test(trimmed)) {
    const match = trimmed.match(RGBA_COLOR_PATTERN);
    if (match) {
      const [, r, g, b] = match;
      return (
        parseInt(r, 10) <= 255 &&
        parseInt(g, 10) <= 255 &&
        parseInt(b, 10) <= 255
      );
    }
  }

  return false;
}

/**
 * Sanitize a CSS color string
 * Returns the sanitized color or a fallback if invalid
 *
 * @param color - The color string to sanitize
 * @param fallback - Fallback color if validation fails (default: '#000000')
 * @returns Sanitized color string
 */
export function sanitizeCSSColor(color: string, fallback: string = '#000000'): string {
  if (isValidCSSColor(color)) {
    return color.trim();
  }
  return fallback;
}

/**
 * Parse a CSS color to RGB tuple
 * Returns null if the color cannot be parsed
 *
 * @param color - The color string to parse
 * @returns RGB tuple or null
 */
export function parseColorToRGB(color: string): RGBTuple | null {
  if (typeof color !== 'string') return null;

  const trimmed = color.trim();

  // Parse hex colors
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    } else if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        return [r, g, b];
      }
    }
    return null;
  }

  // Parse rgb() and rgba() colors
  const rgbMatch = trimmed.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    if (r <= 255 && g <= 255 && b <= 255) {
      return [r, g, b];
    }
    return null;
  }

  // Named colors - return common defaults
  const namedColorMap: Record<string, RGBTuple> = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    red: [255, 0, 0],
    green: [0, 128, 0],
    blue: [0, 0, 255],
    yellow: [255, 255, 0],
    cyan: [0, 255, 255],
    magenta: [255, 0, 255],
    gray: [128, 128, 128],
    grey: [128, 128, 128],
    orange: [255, 165, 0],
    purple: [128, 0, 128],
    pink: [255, 192, 203],
    brown: [165, 42, 42],
    transparent: [0, 0, 0],
    navy: [0, 0, 128],
    teal: [0, 128, 128],
    olive: [128, 128, 0],
    maroon: [128, 0, 0],
    silver: [192, 192, 192],
    lime: [0, 255, 0],
    aqua: [0, 255, 255],
    fuchsia: [255, 0, 255],
  };

  const namedColor = namedColorMap[trimmed.toLowerCase()];
  if (namedColor) {
    return namedColor;
  }

  return null;
}

/**
 * Validate a numeric input
 * Handles NaN, Infinity, and range validation
 *
 * @param value - The value to validate
 * @param options - Validation options
 * @returns Validation result with sanitized value
 */
export function validateNumber(
  value: unknown,
  options: {
    min?: number;
    max?: number;
    default?: number;
    allowNaN?: boolean;
    allowInfinity?: boolean;
    integer?: boolean;
  } = {}
): ValidationResult<number> {
  const {
    min = -Infinity,
    max = Infinity,
    default: defaultValue = 0,
    allowNaN = false,
    allowInfinity = false,
    integer = false,
  } = options;

  // Convert to number if needed
  let num: number;
  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    num = parseFloat(value);
  } else {
    return {
      valid: false,
      value: defaultValue,
      error: 'Value must be a number',
    };
  }

  // Check NaN
  if (isNaN(num)) {
    if (allowNaN) {
      return { valid: true, value: NaN };
    }
    return {
      valid: false,
      value: defaultValue,
      error: 'Value cannot be NaN',
    };
  }

  // Check Infinity
  if (!isFinite(num)) {
    if (allowInfinity) {
      return { valid: true, value: num };
    }
    return {
      valid: false,
      value: defaultValue,
      error: 'Value cannot be Infinity',
    };
  }

  // Check integer requirement
  if (integer && !Number.isInteger(num)) {
    num = Math.round(num);
  }

  // Clamp to range
  if (num < min) {
    return {
      valid: false,
      value: min,
      error: `Value must be at least ${min}`,
    };
  }

  if (num > max) {
    return {
      valid: false,
      value: max,
      error: `Value must be at most ${max}`,
    };
  }

  return { valid: true, value: num };
}

/**
 * Validate and clamp a number to a range
 * Shorthand for common case of just wanting a safe value
 *
 * @param value - The value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @param defaultValue - Default if value is invalid
 * @returns Clamped value
 */
export function clampNumber(
  value: unknown,
  min: number,
  max: number,
  defaultValue?: number
): number {
  const result = validateNumber(value, {
    min,
    max,
    default: defaultValue ?? min
  });
  return result.value;
}

/**
 * Validate array dimensions
 *
 * @param arr - The array to validate
 * @param expectedLength - Expected length
 * @returns Whether the array is valid
 */
export function isValidArray(
  arr: unknown,
  expectedLength?: number
): boolean {
  if (!arr) return false;

  // Check for arrays
  if (Array.isArray(arr)) {
    return expectedLength === undefined || arr.length === expectedLength;
  }

  // Check for typed arrays
  if (arr instanceof Float64Array || arr instanceof Float32Array) {
    return expectedLength === undefined || arr.length === expectedLength;
  }

  return false;
}

/**
 * Type guard for Float64Array with optional length check
 */
export function isFloat64Array(
  arr: unknown,
  expectedLength?: number
): arr is Float64Array {
  if (!(arr instanceof Float64Array)) return false;
  return expectedLength === undefined || arr.length === expectedLength;
}

/**
 * Sanitize a string for use in SVG attributes
 * Removes potentially dangerous characters
 *
 * @param str - The string to sanitize
 * @returns Sanitized string
 */
export function sanitizeSVGAttribute(str: string): string {
  if (typeof str !== 'string') return '';

  // Remove any characters that could break out of attribute context
  // Only allow alphanumeric, spaces, and safe punctuation
  return str
    .replace(/[<>"'&]/g, '') // Remove XML/HTML special chars
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

/**
 * Escape XML special characters for safe inclusion in SVG
 *
 * @param str - The string to escape
 * @returns Escaped string
 */
export function escapeXML(str: string): string {
  if (typeof str !== 'string') return '';

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Validate mesh dimensions
 *
 * @param nelx - Number of elements in x direction
 * @param nely - Number of elements in y direction
 * @returns Validation result
 */
export function validateMeshDimensions(
  nelx: number,
  nely: number
): ValidationResult<{ nelx: number; nely: number }> {
  const nelxResult = validateNumber(nelx, { min: 1, max: 1000, integer: true });
  const nelyResult = validateNumber(nely, { min: 1, max: 1000, integer: true });

  if (!nelxResult.valid || !nelyResult.valid) {
    return {
      valid: false,
      value: { nelx: nelxResult.value, nely: nelyResult.value },
      error: nelxResult.error || nelyResult.error,
    };
  }

  return {
    valid: true,
    value: { nelx: nelxResult.value, nely: nelyResult.value },
  };
}

/**
 * Validate volume fraction
 *
 * @param volfrac - Volume fraction (0-1)
 * @returns Validated and clamped volume fraction
 */
export function validateVolumeFraction(volfrac: number): number {
  return clampNumber(volfrac, 0.01, 0.99, 0.5);
}

/**
 * Type guard for checking if value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate worker message structure
 * Returns true if the message has the expected type field
 */
export function isValidWorkerMessage(
  message: unknown,
  expectedType?: string
): message is { type: string; [key: string]: unknown } {
  if (!isPlainObject(message)) return false;
  if (typeof message.type !== 'string') return false;
  if (expectedType !== undefined && message.type !== expectedType) return false;
  return true;
}

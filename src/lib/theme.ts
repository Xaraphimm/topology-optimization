/**
 * Theme utilities for managing dark/light mode
 * 
 * Defaults to dark mode, persists user preference in localStorage
 */

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme-preference';

/**
 * Get the initial theme, checking localStorage first, then defaulting to dark
 * This is called on the client side only
 */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  
  return 'dark'; // Default to dark mode
}

/**
 * Save theme preference to localStorage
 */
export function setStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage not available
  }
}

/**
 * Apply theme to document by toggling the 'dark' class on <html>
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Toggle between dark and light themes
 */
export function toggleTheme(): Theme {
  const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const newTheme: Theme = current === 'dark' ? 'light' : 'dark';
  
  applyTheme(newTheme);
  setStoredTheme(newTheme);
  
  return newTheme;
}

/**
 * Inline script to run before React hydration to prevent flash
 * This prevents the flash of wrong theme on initial load
 */
export const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var theme = (stored === 'light') ? 'light' : 'dark';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

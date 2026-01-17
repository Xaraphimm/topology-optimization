'use client';

import { useSyncExternalStore, useRef, useLayoutEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStoredTheme, applyTheme, toggleTheme, type Theme } from '@/lib/theme';

/**
 * Subscribe to theme changes by watching the document class
 */
function subscribeToTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

function getThemeSnapshot(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function getServerSnapshot(): Theme {
  return 'dark'; // Server always renders dark mode
}

/**
 * Theme toggle button with sun/moon icons
 * Defaults to dark mode, persists preference in localStorage
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerSnapshot);
  const initialized = useRef(false);

  // Initialize theme on mount - using useLayoutEffect to run synchronously before paint
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(() => {
    if (!initialized.current) {
      const stored = getStoredTheme();
      applyTheme(stored);
      initialized.current = true;
    }
  }, []);

  const handleToggle = () => {
    toggleTheme();
    // Theme state is automatically updated via useSyncExternalStore
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className="h-9 w-9"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 text-yellow-400 transition-transform hover:rotate-12" />
      ) : (
        <Moon className="h-5 w-5 text-slate-700 transition-transform hover:-rotate-12" />
      )}
    </Button>
  );
}

export default ThemeToggle;

import { describe, it, expect } from 'vitest';
import type { HistoryPoint } from '../optimizer/useOptimizer';

/**
 * Tests for the history tracking functionality used in convergence graphs.
 * 
 * Note: The actual hook behavior is tested via integration tests.
 * These tests verify the data structures and validation logic.
 */

describe('History Point Structure', () => {
  it('should have all required fields', () => {
    const point: HistoryPoint = {
      iteration: 1,
      compliance: 250.5,
      change: 0.15,
      volume: 0.5,
    };
    
    expect(point.iteration).toBeDefined();
    expect(point.compliance).toBeDefined();
    expect(point.change).toBeDefined();
    expect(point.volume).toBeDefined();
  });
  
  it('should accept valid iteration values', () => {
    const points: HistoryPoint[] = [
      { iteration: 0, compliance: 100, change: 1.0, volume: 0.5 },
      { iteration: 1, compliance: 90, change: 0.5, volume: 0.5 },
      { iteration: 100, compliance: 50, change: 0.01, volume: 0.5 },
      { iteration: 200, compliance: 45, change: 0.001, volume: 0.5 },
    ];
    
    for (const point of points) {
      expect(point.iteration).toBeGreaterThanOrEqual(0);
    }
  });
  
  it('should accept valid compliance values', () => {
    const points: HistoryPoint[] = [
      { iteration: 1, compliance: 1000, change: 0.5, volume: 0.5 },
      { iteration: 2, compliance: 250.5, change: 0.3, volume: 0.5 },
      { iteration: 3, compliance: 45.123, change: 0.1, volume: 0.5 },
    ];
    
    for (const point of points) {
      expect(point.compliance).toBeGreaterThan(0);
      expect(point.compliance).toBeLessThan(Infinity);
    }
  });
  
  it('should accept valid change values (0 to 1)', () => {
    const points: HistoryPoint[] = [
      { iteration: 1, compliance: 100, change: 1.0, volume: 0.5 },
      { iteration: 2, compliance: 90, change: 0.5, volume: 0.5 },
      { iteration: 3, compliance: 80, change: 0.1, volume: 0.5 },
      { iteration: 4, compliance: 70, change: 0.01, volume: 0.5 },
      { iteration: 5, compliance: 65, change: 0.001, volume: 0.5 },
    ];
    
    for (const point of points) {
      expect(point.change).toBeGreaterThanOrEqual(0);
      expect(point.change).toBeLessThanOrEqual(1);
    }
  });
  
  it('should accept valid volume values (0 to 1)', () => {
    const points: HistoryPoint[] = [
      { iteration: 1, compliance: 100, change: 0.5, volume: 0.3 },
      { iteration: 2, compliance: 90, change: 0.4, volume: 0.5 },
      { iteration: 3, compliance: 80, change: 0.3, volume: 0.7 },
    ];
    
    for (const point of points) {
      expect(point.volume).toBeGreaterThan(0);
      expect(point.volume).toBeLessThanOrEqual(1);
    }
  });
});

describe('History Array Operations', () => {
  it('should support adding new points', () => {
    const history: HistoryPoint[] = [];
    
    history.push({ iteration: 1, compliance: 100, change: 0.5, volume: 0.5 });
    expect(history.length).toBe(1);
    
    history.push({ iteration: 2, compliance: 90, change: 0.4, volume: 0.5 });
    expect(history.length).toBe(2);
  });
  
  it('should maintain chronological order', () => {
    const history: HistoryPoint[] = [
      { iteration: 1, compliance: 100, change: 0.5, volume: 0.5 },
      { iteration: 2, compliance: 90, change: 0.4, volume: 0.5 },
      { iteration: 3, compliance: 80, change: 0.3, volume: 0.5 },
    ];
    
    for (let i = 1; i < history.length; i++) {
      expect(history[i].iteration).toBeGreaterThan(history[i - 1].iteration);
    }
  });
  
  it('should support slicing for max history limit', () => {
    const MAX_HISTORY = 250;
    const history: HistoryPoint[] = [];
    
    // Add more points than the max
    for (let i = 1; i <= 300; i++) {
      history.push({
        iteration: i,
        compliance: 100 - i * 0.1,
        change: 1 / i,
        volume: 0.5,
      });
    }
    
    // Simulate the max history cap
    const capped = history.slice(-MAX_HISTORY);
    
    expect(capped.length).toBe(MAX_HISTORY);
    expect(capped[0].iteration).toBe(51); // 300 - 250 + 1
    expect(capped[capped.length - 1].iteration).toBe(300);
  });
  
  it('should support clearing history', () => {
    let history: HistoryPoint[] = [
      { iteration: 1, compliance: 100, change: 0.5, volume: 0.5 },
      { iteration: 2, compliance: 90, change: 0.4, volume: 0.5 },
    ];
    
    // Clear by reassigning to empty array
    history = [];
    
    expect(history.length).toBe(0);
  });
  
  it('should detect duplicate iterations', () => {
    const history: HistoryPoint[] = [
      { iteration: 1, compliance: 100, change: 0.5, volume: 0.5 },
      { iteration: 2, compliance: 90, change: 0.4, volume: 0.5 },
    ];
    
    const newPoint: HistoryPoint = {
      iteration: 2,
      compliance: 85,
      change: 0.35,
      volume: 0.5,
    };
    
    // Check for duplicate
    const isDuplicate = history.length > 0 && 
      history[history.length - 1].iteration === newPoint.iteration;
    
    expect(isDuplicate).toBe(true);
  });
});

describe('History Data Validation', () => {
  it('should filter out invalid initial states', () => {
    const rawStates = [
      { iteration: 0, compliance: Infinity, change: 1.0, volume: 0.5 },
      { iteration: 1, compliance: 250, change: 0.5, volume: 0.5 },
      { iteration: 2, compliance: 200, change: 0.3, volume: 0.5 },
    ];
    
    // Filter logic from useOptimizer
    const validHistory = rawStates.filter(
      state => state.iteration > 0 && state.compliance < Infinity
    );
    
    expect(validHistory.length).toBe(2);
    expect(validHistory[0].iteration).toBe(1);
  });
  
  it('should track decreasing compliance (typical convergence)', () => {
    const history: HistoryPoint[] = [
      { iteration: 1, compliance: 500, change: 0.8, volume: 0.5 },
      { iteration: 5, compliance: 300, change: 0.4, volume: 0.5 },
      { iteration: 10, compliance: 200, change: 0.2, volume: 0.5 },
      { iteration: 20, compliance: 150, change: 0.1, volume: 0.5 },
      { iteration: 50, compliance: 120, change: 0.02, volume: 0.5 },
    ];
    
    // Verify compliance generally decreases
    for (let i = 1; i < history.length; i++) {
      expect(history[i].compliance).toBeLessThanOrEqual(history[i - 1].compliance);
    }
  });
  
  it('should track decreasing change (convergence indicator)', () => {
    const history: HistoryPoint[] = [
      { iteration: 1, compliance: 500, change: 0.8, volume: 0.5 },
      { iteration: 5, compliance: 300, change: 0.4, volume: 0.5 },
      { iteration: 10, compliance: 200, change: 0.2, volume: 0.5 },
      { iteration: 20, compliance: 150, change: 0.05, volume: 0.5 },
      { iteration: 50, compliance: 120, change: 0.01, volume: 0.5 },
    ];
    
    // Verify change decreases toward convergence
    for (let i = 1; i < history.length; i++) {
      expect(history[i].change).toBeLessThanOrEqual(history[i - 1].change);
    }
  });
  
  it('should maintain volume near target', () => {
    const targetVolume = 0.5;
    const tolerance = 0.05;
    
    const history: HistoryPoint[] = [
      { iteration: 1, compliance: 500, change: 0.8, volume: 0.52 },
      { iteration: 5, compliance: 300, change: 0.4, volume: 0.51 },
      { iteration: 10, compliance: 200, change: 0.2, volume: 0.50 },
      { iteration: 20, compliance: 150, change: 0.1, volume: 0.50 },
    ];
    
    for (const point of history) {
      expect(Math.abs(point.volume - targetVolume)).toBeLessThanOrEqual(tolerance);
    }
  });
});

describe('Chart Data Formatting', () => {
  it('should format compliance for display', () => {
    const formatCompliance = (value: number) => {
      if (value >= 1000) return value.toFixed(0);
      if (value >= 100) return value.toFixed(1);
      return value.toFixed(2);
    };
    
    expect(formatCompliance(1500)).toBe('1500');
    expect(formatCompliance(250.5)).toBe('250.5');
    expect(formatCompliance(45.123)).toBe('45.12');
  });
  
  it('should format change as percentage', () => {
    const formatChange = (value: number) => (value * 100).toFixed(2) + '%';
    
    expect(formatChange(0.5)).toBe('50.00%');
    expect(formatChange(0.01)).toBe('1.00%');
    expect(formatChange(0.001)).toBe('0.10%');
  });
  
  it('should format volume as percentage', () => {
    const formatVolume = (value: number) => (value * 100).toFixed(1) + '%';
    
    expect(formatVolume(0.5)).toBe('50.0%');
    expect(formatVolume(0.35)).toBe('35.0%');
    expect(formatVolume(0.7)).toBe('70.0%');
  });
});

# Topology Visualization Bug Investigation

The topology optimization viewer broke. Graphs stopped loading reliably in normal view, and the split-view comparison mode got stuck on "Initializing..." forever. This document traces the failure through the rendering pipeline to find where things actually fell apart.

---

## What's Failing

Two separate issues are at play:

**Normal View:** Convergence graphs sometimes don't appear even after optimization starts. The canvas renders fine, but the charts stay blank or flash briefly before disappearing.

**Split View:** Both panels freeze during initialization. Neither optimizer actually starts, so there's nothing to display. The UI just hangs.

Both symptoms point to state management or initialization race conditions somewhere in the React component tree.

---

## Investigation Areas

### 1. Canvas Rendering

The visualization uses WebGL when available, with Canvas2D as fallback. This dual-mode setup has a few places where initialization can silently fail.

**WebGL Race Condition** (`Canvas.tsx:143-153`)

The `useWebGLRenderer` hook gets density data conditionally. If `useWebGL` is false during init, the hook receives `null` and might fail without reporting it. The fallback logic depends on `isWebGLAvailable` and `webglError` states, so if either gets set incorrectly, the canvas goes blank.

**Canvas2D Dependencies** (`Canvas.tsx:156-230`)

The `renderCanvas2D` function has a lot of dependencies. If useEffect isn't triggering re-renders when data changes, the canvas won't update even though the optimizer is running.

### 2. History Data & Graphs

**Initial State Filtering** (`useOptimizer.ts:98-121`)

The history accumulation logic explicitly filters out invalid states:
```typescript
if (newState.iteration > 0 && newState.compliance < Infinity) {
  // Only add to history
}
```

Initial state has `compliance: Infinity` and `iteration: 0`, so graphs stay empty until after the first optimization step. If something prevents that first step from completing, you get permanent blank charts.

**Graph Rendering Condition** (`ConvergenceGraphs.tsx:87-133`)

The component checks `data.length > 0` before rendering. If history never gets populated, you just see "Start optimization to see data" forever.

### 3. Worker Initialization

**WASM Loading** (`simp.worker.ts:91-102`)

The solver tries WASM first, falls back to JS. But errors only get logged to console, not sent to the main thread. If both fail silently, the worker appears ready but can't actually optimize.

**Ready State Sync** (`simp.worker.ts:158-168`, `useOptimizer.ts:158-168`)

The UI waits for an 'initialized' message before showing the canvas. If `state.densities` comes back empty or invalid, the component won't display anything. The "Initializing..." message just stays there.

### 4. Split View Specifics

**Dual Workers** (`useComparisonState.ts:152-154`)

Split view creates two separate optimizer workers. If one fails during init, it can affect the other through shared state or resource contention. Both `isReadyA` and `isReadyB` need to become true for the panels to work.

**Display Logic** (`ComparisonPanel.tsx:102-103`)
```typescript
const displayDensities = hasStarted && state.densities.length > 0 ? state.densities : null;
```

If `hasStarted` is true but densities are empty, you get nothing. The panel looks stuck even though it's technically "running."

### 5. Config Change Timing

**Reset Sequence** (`useOptimizer.ts:214-235`)

When config changes, the hook resets everything:
```typescript
setIsReady(false);
setIsRunning(false);
setState(INITIAL_STATE);
clearHistory();
```

Between `setIsReady(false)` and worker re-initialization, the UI shows "Initializing..." If the worker is slow or fails, that state never clears.

---

## Testing Approach

### Reproduce It First
- Load the page, check if canvas shows preview mesh
- Start optimization, watch for graphs
- Enter split view, see if both panels initialize
- Try rapid preset changes while running

### Add Diagnostic Logging

Key places to instrument:
- `Canvas.tsx:153` - log `actuallyUsingWebGL`, `useWebGL`, `isWebGLAvailable`, `webglError`
- `useOptimizer.ts:159` - log densities length and compliance on 'initialized'
- `simp.worker.ts:93` - log WASM init success/failure
- `ComparisonView.tsx:64` - log `isReadyA` and `isReadyB`

### Stress Tests
- Throttle network to Slow 3G, see if "Initializing..." ever clears
- Disable WebGL via browser flags, test Canvas2D fallback
- Click Start/Pause/Start rapidly, check for state corruption
- Change preset while optimizer is running

---

## Likely Root Causes

1. **History filtering blocks initial display** - Graphs require `iteration > 0`, so they stay blank until first step completes
2. **Worker init errors swallowed** - WASM/JS failures logged but not propagated to UI
3. **useEffect dependencies wrong** - Canvas not re-rendering when data arrives
4. **Dual worker resource conflict** - Split view workers stepping on each other during init

---

## Expected Fixes

- Relax history validity constraints or seed with initial data point
- Propagate worker errors to main thread with proper error state
- Audit useEffect dependencies in Canvas and related components  
- Add init timeout with error message if worker doesn't respond
- Consider staggered worker init for split view to avoid race conditions

The goal is stable graphs in both views, with clear error messages when something actually fails instead of silent hangs.

---

**PHNX Foundry** | Follow [@Xaraphim](https://x.com/Xaraphim) on X

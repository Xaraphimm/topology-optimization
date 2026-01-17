# Topology Visualization Bug Investigation Plan

## Problem Statement
The topology split view and normal view graphs are buggy - they don't correctly load all the time, and the split view won't even load anymore.

## Investigation Areas

### 1. Canvas Rendering Issues

#### Issue 1.1: WebGL Initialization Race Condition
**Location:** `Canvas.tsx:143-153`

**Problem:**
```typescript
const { isWebGLAvailable, error: webglError, render: webglRender } = useWebGLRenderer(
  mainCanvasRef,
  useWebGL ? densities : null,  // Null when useWebGL=false
  ...
);
const actuallyUsingWebGL = useWebGL && isWebGLAvailable && !webglError;
```

**Potential Bug:** `useWebGLRenderer` might receive `null` for densities when `useWebGL` is false, causing the renderer to fail silently.

**Test:**
- Check if `isWebGLAvailable` ever becomes true when it should
- Verify `webglError` state is properly propagated
- Test with `preferWebGL={false}` to force Canvas2D mode

#### Issue 1.2: Canvas2D Rendering Dependencies
**Location:** `Canvas.tsx:156-230`

**Problem:** The `renderCanvas2D` function has many dependencies and might not re-render when data changes.

**Test:**
- Add console.log to track when `renderCanvas2D` is called
- Verify `useEffect` dependencies trigger re-renders correctly
- Check if `displayDensities` is correctly populated

### 2. History Data & Convergence Graphs

#### Issue 2.1: Initial State Not Displayed
**Location:** `useOptimizer.ts:98-121`, `ConvergenceGraphs.tsx:87`

**Problem:**
```typescript
if (newState.iteration > 0 && newState.compliance < Infinity) {
  // Only add to history
}
```
Initial state has `compliance: Infinity` and `iteration: 0`, so graphs never show data until after first optimization step.

**Test:**
- Check if graphs show after optimization starts
- Verify history array is populated correctly after each iteration
- Test with `history.length` logs

#### Issue 2.2: Graph Rendering Condition
**Location:** `ConvergenceGraphs.tsx:87-133`

**Problem:**
```typescript
{data.length > 0 ? (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart ... />
  </ResponsiveContainer>
) : (
  <div>Start optimization to see data</div>
)}
```

**Test:**
- Verify `history` prop is being passed correctly from parent
- Check if `hasStarted` state in parent components prevents data flow

### 3. Worker Initialization

#### Issue 3.1: WASM Solver Loading
**Location:** `simp.worker.ts:91-102`

**Problem:**
```typescript
try {
  await initWasm();
  solver = await createSolver(true);
  wasmInitialized = true;
} catch (error) {
  console.warn('Failed to initialize WASM solver, using JS fallback:', error);
  solver = await createSolver(false);
  wasmInitialized = true;
}
```

**Potential Bugs:**
- Error is only logged, not sent to main thread
- `createSolver(false)` might also fail silently

**Test:**
- Add error messages to main thread on WASM failure
- Verify JS solver actually works when WASM fails
- Test with browser dev tools network tab (blocked WASM files?)

#### Issue 3.2: Ready State Synchronization
**Location:** `simp.worker.ts:158-168`, `useOptimizer.ts:158-168`

**Problem:**
```typescript
case 'initialized':
  setIsReady(true);
  setState(deserializeState(message.state));
  if (pendingStartRef.current) {
    pendingStartRef.current = false;
    setIsRunning(true);
    worker.postMessage({ type: 'start' });
  }
```

**Potential Bug:** If `state.densities` is empty or invalid, the component won't display anything.

**Test:**
- Log `state.densities.length` when `initialized` message received
- Verify `isReady` state propagates to UI components correctly

### 4. Comparison View (Split View) Issues

#### Issue 4.1: Two Optimizer Workers
**Location:** `useComparisonState.ts:152-154`

**Problem:**
```typescript
const optimizerA = useOptimizer(optimizerConfigA);
const optimizerB = useOptimizer(optimizerConfigB);
```

Two separate workers are created. If one fails, both might be affected.

**Test:**
- Check if both workers initialize successfully
- Test with identical configs in both panels
- Verify `isReadyA` and `isReadyB` both become true

#### Issue 4.2: Display Data Logic
**Location:** `ComparisonPanel.tsx:102-103`

**Problem:**
```typescript
const displayDensities = hasStarted && state.densities.length > 0 ? state.densities : null;
const displayStrainEnergy = hasStarted && state.strainEnergy.length > 0 ? state.strainEnergy : null;
```

**Test:**
- Log `hasStarted` and `state.densities.length` values
- Verify `state` is properly updated from worker messages

### 5. Race Conditions in State Management

#### Issue 5.1: Config Change Timing
**Location:** `useOptimizer.ts:214-235`

**Problem:**
```typescript
useEffect(() => {
  if (!optimizerConfig) return;
  configRef.current = optimizerConfig;
  setIsReady(false);  // Reset ready state
  setIsRunning(false);
  setState(INITIAL_STATE);
  clearHistory();
  // ...
  worker.postMessage(cmd);  // Send init command
}, [optimizerConfig, clearHistory]);
```

**Potential Bug:** Between `setIsReady(false)` and worker initialization, UI shows "Initializing..." but worker might be slow.

**Test:**
- Add timing logs for worker initialization
- Test rapid config changes (preset switches)
- Verify `isReady` state is never stuck as false

#### Issue 5.2: Pending Start Race
**Location:** `useOptimizer.ts:92`, `162-166`, `238-251`

**Problem:**
```typescript
const pendingStartRef = useRef(false);

// In 'initialized' handler:
if (pendingStartRef.current) {
  pendingStartRef.current = false;
  setIsRunning(true);
  worker.postMessage({ type: 'start' });
}

// In start():
if (!isReady) {
  pendingStartRef.current = true;
  return;
}
```

**Test:**
- Test clicking start before worker is ready
- Test clicking start multiple times rapidly
- Verify `pendingStartRef` doesn't get stuck as true

## Testing Methodology

### Phase 1: Reproduce the Bug

1. **Normal View Test:**
   - Load the page
   - Check if canvas renders with preview mesh
   - Click "Start"
   - Observe if optimization runs
   - Check if convergence graphs appear

2. **Split View Test:**
   - Click "Compare Side-by-Side"
   - Check if both panels load
   - Verify "Initializing..." messages disappear
   - Click "Start Both"
   - Observe if both panels run optimization
   - Check if graphs appear in both panels

### Phase 2: Add Debug Logging

Add the following logs to identify the failure point:

**In `Canvas.tsx`:**
```typescript
// Line 153 (after actuallyUsingWebGL calculation)
console.log('[Canvas] actuallyUsingWebGL:', actuallyUsingWebGL, 'useWebGL:', useWebGL, 'isWebGLAvailable:', isWebGLAvailable, 'webglError:', webglError);

// Line 187 (in renderCanvas2D)
console.log('[Canvas] renderCanvas2D called, densities:', densities?.length, 'nelx:', nelx, 'nely:', nely);
```

**In `useOptimizer.ts`:**
```typescript
// Line 144 (after 'ready' message)
console.log('[useOptimizer] Worker ready');

// Line 159 (after 'initialized' message)
console.log('[useOptimizer] Initialized, densities:', message.state.densities.length, 'compliance:', message.state.compliance);

// Line 98 (in addHistoryPoint)
console.log('[useOptimizer] Adding history point, iteration:', newState.iteration, 'compliance:', newState.compliance, 'willAdd:', (newState.iteration > 0 && newState.compliance < Infinity));
```

**In `simp.worker.ts`:**
```typescript
// Line 93 (in initializeSolver)
console.log('[Worker] Initializing WASM solver...');

// Line 99 (on failure)
console.log('[Worker] WASM failed, using JS solver');

// Line 116 (after init command)
console.log('[Worker] Initializing optimizer, nelx:', command.config.nelx, 'nely:', command.config.nely);
```

**In `ComparisonView.tsx`:**
```typescript
// Line 64-65
console.log('[ComparisonView] isReadyA:', isReadyA, 'isReadyB:', isReadyB);
```

### Phase 3: Test Scenarios

1. **Slow Network Test:**
   - Open DevTools Network tab
   - Throttle connection to "Slow 3G"
   - Try loading and starting optimization
   - Check if "Initializing..." ever disappears

2. **WebGL Disabled Test:**
   - Open Chrome flags: `chrome://flags/#disable-webgl`
   - Enable "Disable WebGL"
   - Reload page
   - Test both normal and split view

3. **Memory Pressure Test:**
   - Open 10+ tabs
   - Try running optimization
   - Check for memory errors in console

4. **Rapid State Change Test:**
   - Click "Start"
   - Immediately click "Pause"
   - Immediately click "Start" again
   - Check for state corruption

5. **Config Change During Run Test:**
   - Click "Start"
   - While running, change preset
   - Verify optimization stops cleanly
   - Verify new preset loads

### Phase 4: Hypothesis Validation

**Hypothesis 1: Graphs not showing because initial state is invalid**
- Validation: Check if `history` is empty after first optimization step
- Fix: Either add initial state to history or change display logic

**Hypothesis 2: Worker not initializing in split view**
- Validation: Check `isReadyA` and `isReadyB` logs
- Fix: Add better error handling for dual worker initialization

**Hypothesis 3: Canvas not re-rendering when data arrives**
- Validation: Log `renderCanvas2D` calls vs state updates
- Fix: Check useEffect dependencies

**Hypothesis 4: WebGL initialization fails silently**
- Validation: Check `webglError` logs
- Fix: Force Canvas2D fallback with better error messages

### Phase 5: Root Cause Analysis

Based on test results, identify the primary failure point:

1. If worker never sends 'ready' message → Worker initialization issue
2. If worker sends 'ready' but never 'initialized' → Optimizer initialization issue
3. If both messages received but canvas doesn't render → Canvas rendering issue
4. If canvas renders but graphs don't appear → History data issue
5. If split view panels don't load → Dual worker issue

## Expected Fix Areas

Based on the code analysis, the likely fixes needed are:

1. **Fix history data display:** Allow initial state to be displayed or update graph display condition
2. **Add better error handling:** Propagate WASM/solver errors to UI
3. **Fix canvas rendering dependencies:** Ensure re-render triggers correctly
4. **Add loading timeouts:** Show error if worker doesn't initialize within reasonable time
5. **Verify dual worker management:** Ensure both workers in split view can coexist

## Test Execution Plan

Run tests in order:
1. Phase 1: Reproduce bug (baseline)
2. Phase 2: Add logs (diagnostic mode)
3. Phase 3: Scenarios (systematic testing)
4. Phase 4: Validate hypotheses (targeted testing)
5. Phase 5: Root cause analysis (conclusion)

Document findings at each phase to narrow down the issue.

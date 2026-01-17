# CRITICAL BUGS FOUND

## Bug #1: State Update in useMemo (INFINITE LOOP RISK)

**Location:** `TopologyVisualizer.tsx:61`

**Code:**
```typescript
const optimizerConfig = useMemo<UseOptimizerConfig | null>(() => {
  const currentPreset = getPreset(selectedPreset) || PRESETS[0];
  const currentResolution = RESOLUTIONS.find(r => r.id === selectedResolution) || RESOLUTIONS[0];
  const dims = getMeshDimensions(currentPreset, currentResolution);

  // Set up problem
  const { forces, fixedDofs, supports, loads } = currentPreset.setup(dims.nelx, dims.nely);

  // Update BC data for visualization (side effect, but needed for Canvas)
  // This is safe because it's derived from the same inputs
  setBcData({ supports, loads });  // ⚠️ BUG: setState in useMemo!

  return {
    config: {
      nelx: dims.nelx,
      nely: dims.nely,
      volfrac: volumeFraction,
      penal: 3.0,
      rmin: Math.max(1.5, dims.nelx / 40),
      maxIter: 200,
      tolx: 0.01,
    },
    forces,
    fixedDofs,
  };
}, [selectedPreset, selectedResolution, volumeFraction]);
```

**Problem:**
Calling `setState` inside `useMemo` violates React best practices and can cause infinite loops because:
1. `setBcData` triggers a re-render
2. Re-render causes `optimizerConfig` useMemo to re-run
3. useMemo calls `setBcData` again
4. Loop continues...

**Impact:**
- Graphs may not load correctly due to component constantly re-rendering
- Component state becomes corrupted
- Performance degradation

**Fix:**
Move the state update to a `useEffect` that depends on the computed data:

```typescript
// In useMemo (remove setState):
const optimizerConfig = useMemo(() => {
  const currentPreset = getPreset(selectedPreset) || PRESETS[0];
  const currentResolution = RESOLUTIONS.find(r => r.id === selectedResolution) || RESOLUTIONS[0];
  const dims = getMeshDimensions(currentPreset, currentResolution);
  const { forces, fixedDofs, supports, loads } = currentPreset.setup(dims.nelx, dims.nely);
  return {
    config: { /* ... */ },
    forces,
    fixedDofs,
    // Store supports/loads in the memoized value
    supports,
    loads,
  };
}, [selectedPreset, selectedResolution, volumeFraction]);

// New useEffect to update BC data:
useEffect(() => {
  if (optimizerConfig) {
    const currentPreset = getPreset(selectedPreset) || PRESETS[0];
    const currentResolution = RESOLUTIONS.find(r => r.id === selectedResolution) || RESOLUTIONS[0];
    const dims = getMeshDimensions(currentPreset, currentResolution);
    const { supports, loads } = currentPreset.setup(dims.nelx, dims.nely);
    setBcData({ supports, loads });
  }
}, [optimizerConfig, selectedPreset, selectedResolution]);
```

---

## Bug #2: Synchronous setState in useEffect (CASCADING RENDERS)

**Location:** `Canvas.tsx:134-140`

**Code:**
```typescript
useEffect(() => {
  if (preferWebGL && WebGLRenderer.isSupported()) {
    setUseWebGL(true);  // ⚠️ BUG: Synchronous setState in effect body
  } else {
    setUseWebGL(false); // ⚠️ BUG: Synchronous setState in effect body
  }
}, [preferWebGL]);
```

**Problem:**
The effect calls setState synchronously on every render when `preferWebGL` changes, which can trigger cascading renders and performance issues.

**Impact:**
- Canvas may not render correctly due to multiple re-renders
- Performance degradation during WebGL initialization
- Graphs may flicker or not appear

**Fix:**
Since `useWebGL` should only be set once when the component mounts, use a ref or move the logic:

```typescript
const [useWebGL, setUseWebGL] = useState(false);
const hasCheckedWebGL = useRef(false);

useEffect(() => {
  if (!hasCheckedWebGL.current && preferWebGL) {
    setUseWebGL(WebGLRenderer.isSupported());
    hasCheckedWebGL.current = true;
  }
}, [preferWebGL]);
```

---

## Additional Issues Found

### Issue 3: Unused Variable
**Location:** `ComparisonPanel.tsx:99`

```typescript
const [graphsExpanded, setGraphsExpanded] = useState(false);  // Never used
```
- This state is declared but never used, suggesting incomplete implementation

### Issue 4: Unused Import
**Location:** `ComparisonView.tsx:12`

```typescript
import { ArrowLeft } from 'lucide-react';  // Imported but never used
```
- Code cleanup needed

---

## Root Cause Analysis

The primary bugs causing the topology graphs to not load are:

1. **Infinite loop in TopologyVisualizer** - `setBcData` in useMemo causes constant re-renders, preventing the optimizer from settling and showing graphs.

2. **Cascading renders in Canvas** - Synchronous setState in useEffect causes multiple renders, which can disrupt the WebGL/Canvas2D initialization and prevent proper visualization.

3. **Side effects:** These issues compound in split view where two optimizers are running, doubling the rendering overhead.

---

## Recommended Fix Priority

1. **HIGH:** Fix Bug #1 (setState in useMemo) - This is causing the infinite loop
2. **HIGH:** Fix Bug #2 (synchronous setState) - This is causing performance issues
3. **LOW:** Clean up unused code (Issue 3, 4)

---

## Testing After Fixes

After implementing the fixes:

1. Test normal view:
   - Load page
   - Verify canvas renders preview mesh
   - Click Start
   - Verify convergence graphs appear

2. Test split view:
   - Click "Compare Side-by-Side"
   - Verify both panels load
   - Click "Start Both"
   - Verify both show graphs

3. Monitor console for errors
4. Check performance (no excessive re-renders)

---

**PHNX Foundry** | Follow [@Xaraphim](https://x.com/Xaraphim) on X

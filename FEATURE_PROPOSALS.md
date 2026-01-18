# Feature Proposals for Topology Optimization Tool

*Prepared for review - Based on codebase analysis and 2024-2025 research*

---

## Executive Summary

After analyzing the codebase and researching recent advances in topology optimization, I've identified **5 low-risk, high-value features** that build on existing infrastructure. These are ordered by implementation priority (lowest risk first).

| Priority | Feature | Risk | Effort | Key Value |
|----------|---------|------|--------|-----------|
| 1 | Quick Stress Analysis | Very Low | 2-3 days | Uses existing stress module |
| 2 | Design History & Comparison | Low | 3-5 days | Better UX, no algorithm changes |
| 3 | Manufacturing Constraints | Low-Med | 5-7 days | Real-world manufacturability |
| 4 | Parameter Sensitivity Analysis | Low | 3-5 days | Educational, pure reuse |
| 5 | Export with Manufacturing Metadata | Very Low | 2-3 days | Documentation value |

---

## Feature 1: Quick Stress Analysis for Standard Materials

### Description
After optimization completes on the **Standard Materials** tab, automatically show stress analysis using the soft materials stress infrastructure. Allow users to select a material and see if the design would survive under load.

### Why It's Valuable
- Bridges gap between "optimized for stiffness" and "will it break?"
- **Code already exists** in `soft-materials.ts` - just need to expose it
- Answers the question: "Can I actually build this?"
- Direct path to the soft materials feature for interested users

### Technical Approach

```
Files to modify:
├── src/components/visualization/TopologyVisualizer.tsx  (add stress panel)
├── src/lib/optimizer/useOptimizer.ts                   (expose strain energy)
└── src/components/visualization/StressAnalysisPanel.tsx (NEW - ~200 lines)

Files to reuse (no changes):
├── src/lib/soft-materials.ts           (analyzeStressField, SOFT_MATERIALS)
├── src/lib/rupture-colormap.ts         (getRuptureRiskColor, etc.)
└── src/lib/material-savings.ts         (MATERIALS for rigid materials)
```

**Implementation Steps:**

1. **Create StressAnalysisPanel component** (~150 lines)
   ```typescript
   // Shows after optimization completes
   // Material selector (dropdown of MATERIALS + SOFT_MATERIALS)
   // Safety factor slider (1.0-4.0)
   // Results: Max Stress, Safety Margin, Elements at Risk
   // Warning banner if safety margin < 1
   ```

2. **Add to TopologyVisualizer** (~20 lines)
   ```typescript
   // After convergence, show StressAnalysisPanel
   // Pass strainEnergy and densities from state
   ```

3. **Create helper to analyze rigid materials** (~50 lines)
   ```typescript
   // Extend analyzeStressField to work with MATERIALS
   // Add yield strength estimates for metals
   ```

### Test Plan

```typescript
// src/lib/__tests__/stress-analysis-integration.test.ts

describe('Stress Analysis Integration', () => {
  describe('analyzeStressField with rigid materials', () => {
    it('should calculate von Mises stress for aluminum');
    it('should calculate safety margin correctly');
    it('should identify elements at risk');
    it('should handle zero strain energy gracefully');
  });

  describe('StressAnalysisPanel', () => {
    it('should render material selector with all materials');
    it('should update results when material changes');
    it('should show warning when safety margin < 1');
    it('should show success when design is safe');
    it('should handle empty strain energy array');
  });

  describe('integration with optimizer', () => {
    it('should show panel after optimization converges');
    it('should hide panel before optimization starts');
    it('should update when new optimization completes');
  });
});
```

**Test count estimate:** 15-20 tests

---

## Feature 2: Design History & Comparison

### Description
Keep a history of the last 5 optimizations with thumbnails. Allow side-by-side comparison of two designs with metrics overlay.

### Why It's Valuable
- Users iterate through many designs - need to compare
- Standard feature in CAD tools (Fusion 360, SolidWorks)
- No algorithm changes - pure UX improvement
- Helps answer: "Was my previous design actually better?"

### Technical Approach

```
Files to create:
├── src/lib/design-history.ts           (~100 lines - state management)
├── src/components/visualization/DesignHistory.tsx      (~200 lines)
├── src/components/visualization/DesignComparison.tsx   (~150 lines)
└── src/lib/__tests__/design-history.test.ts            (~150 lines)

Files to modify:
├── src/components/visualization/TopologyVisualizer.tsx (add save button, history panel)
```

**Data Structure:**
```typescript
interface SavedDesign {
  id: string;
  name: string;
  timestamp: Date;

  // Parameters
  preset: string;
  resolution: string;
  volumeFraction: number;

  // Results
  densities: Float64Array;
  strainEnergy: Float64Array;
  compliance: number;
  iterations: number;

  // Thumbnail (base64 PNG, 100x33 pixels)
  thumbnail: string;
}

interface DesignHistoryState {
  designs: SavedDesign[];  // Max 5, FIFO
  compareIds: [string, string] | null;
}
```

**Implementation Steps:**

1. **Create design-history.ts** (~100 lines)
   - `saveDesign(state, config) -> SavedDesign`
   - `loadDesigns() -> SavedDesign[]` (localStorage)
   - `deleteDesign(id)`
   - `generateThumbnail(densities, nelx, nely) -> string`

2. **Create DesignHistory component** (~200 lines)
   - Collapsible panel showing saved designs
   - Each item: thumbnail, name, timestamp, metrics
   - Delete button, Compare checkbox
   - "Compare Selected" button

3. **Create DesignComparison component** (~150 lines)
   - Split view with two Canvas components
   - Metrics comparison table below
   - Highlight which design is better for each metric
   - "Close Comparison" button

4. **Integrate into TopologyVisualizer** (~30 lines)
   - "Save Design" button after convergence
   - History panel in sidebar or collapsible section

### Test Plan

```typescript
// src/lib/__tests__/design-history.test.ts

describe('Design History', () => {
  describe('saveDesign', () => {
    it('should create SavedDesign with all required fields');
    it('should generate unique IDs');
    it('should limit history to 5 designs (FIFO)');
    it('should persist to localStorage');
  });

  describe('loadDesigns', () => {
    it('should load from localStorage');
    it('should handle empty/corrupt localStorage');
    it('should deserialize Float64Arrays correctly');
  });

  describe('deleteDesign', () => {
    it('should remove design by ID');
    it('should update localStorage');
  });

  describe('generateThumbnail', () => {
    it('should create base64 PNG');
    it('should be correct dimensions (100x33)');
    it('should handle various mesh sizes');
  });

  describe('DesignHistory component', () => {
    it('should render list of saved designs');
    it('should show thumbnails');
    it('should handle empty history');
    it('should allow selection for comparison');
  });

  describe('DesignComparison component', () => {
    it('should render two designs side-by-side');
    it('should show metrics comparison');
    it('should highlight better values');
    it('should handle close action');
  });
});
```

**Test count estimate:** 20-25 tests

---

## Feature 3: Manufacturing Constraints

### Description
Add optional manufacturing constraints: **symmetry**, **minimum feature size**, and **overhang angle** (for 3D printing). These modify the optimization to produce manufacturable designs.

### Why It's Valuable
- #1 complaint about topology optimization: "designs aren't buildable"
- Standard in commercial tools (Altair, Fusion 360, nTopology)
- Addresses real engineering need
- Educational: shows how constraints affect design

### Technical Approach

```
Files to create:
├── src/lib/optimizer/manufacturing-constraints.ts  (~250 lines)
├── src/components/visualization/ConstraintControls.tsx (~200 lines)
└── src/lib/__tests__/manufacturing-constraints.test.ts (~200 lines)

Files to modify:
├── src/lib/optimizer/simp.ts           (add constraint penalty to objective)
├── src/lib/optimizer/types.ts          (add constraint config types)
├── src/components/visualization/Controls.tsx (add constraint section)
```

**Constraint Types:**

```typescript
interface ManufacturingConstraints {
  // Symmetry
  symmetryX: boolean;      // Mirror across X axis
  symmetryY: boolean;      // Mirror across Y axis

  // Feature size
  minFeatureSize: number;  // Elements (uses filter radius)

  // Overhang (for AM)
  maxOverhangAngle: number;  // Degrees from vertical (0-90)
  buildDirection: 'up' | 'down' | 'left' | 'right';
}
```

**Implementation Steps:**

1. **Create manufacturing-constraints.ts** (~250 lines)
   ```typescript
   // Symmetry: mirror densities across axis
   function enforceSymmetry(densities, nelx, nely, axis): Float64Array

   // Min feature: penalize isolated small features
   function computeFeatureSizePenalty(densities, filterData): number

   // Overhang: penalize unsupported material
   function computeOverhangPenalty(densities, nelx, nely, angle, direction): number

   // Combined constraint handler
   function applyConstraints(densities, config): { densities: Float64Array, penalty: number }
   ```

2. **Modify SIMP optimizer** (~50 lines)
   - Add constraint config to SIMPConfig
   - Apply constraints after OC update
   - Add penalty to objective function for logging

3. **Create ConstraintControls component** (~200 lines)
   - Collapsible "Manufacturing Constraints" section
   - Symmetry checkboxes (X, Y)
   - Min feature size slider (1-5 elements)
   - Overhang angle slider (0-90°)
   - Build direction selector

4. **Integrate into Controls** (~20 lines)
   - Add ConstraintControls below volume fraction

### Test Plan

```typescript
// src/lib/__tests__/manufacturing-constraints.test.ts

describe('Manufacturing Constraints', () => {
  describe('enforceSymmetry', () => {
    it('should mirror densities across X axis');
    it('should mirror densities across Y axis');
    it('should handle both axes simultaneously');
    it('should preserve volume fraction');
    it('should work with odd/even dimensions');
  });

  describe('computeFeatureSizePenalty', () => {
    it('should return 0 for uniform density');
    it('should penalize isolated small features');
    it('should not penalize large solid regions');
    it('should scale with feature count');
  });

  describe('computeOverhangPenalty', () => {
    it('should return 0 for fully supported designs');
    it('should penalize overhanging elements');
    it('should respect angle threshold');
    it('should work with all build directions');
    it('should handle edge cases (corners, edges)');
  });

  describe('applyConstraints', () => {
    it('should apply all enabled constraints');
    it('should compute total penalty');
    it('should handle empty constraint config');
  });

  describe('integration with optimizer', () => {
    it('should produce symmetric designs when enabled');
    it('should respect minimum feature size');
    it('should reduce overhangs when constrained');
    it('should not affect optimization when disabled');
  });
});
```

**Test count estimate:** 25-30 tests

---

## Feature 4: Parameter Sensitivity Analysis

### Description
Run the same optimization with multiple parameter combinations (volume fraction, filter radius, penalization) and display results in a comparison table. Shows which parameters matter most.

### Why It's Valuable
- Users don't know optimal parameters for their problem
- Eliminates trial-and-error workflow
- Educational: shows parameter sensitivity
- Uses existing optimizer - no algorithm changes

### Technical Approach

```
Files to create:
├── src/lib/optimizer/parameter-study.ts        (~150 lines)
├── src/components/visualization/ParameterStudy.tsx (~300 lines)
└── src/lib/__tests__/parameter-study.test.ts   (~100 lines)

Files to modify:
├── src/components/visualization/TopologyVisualizer.tsx (add study button)
```

**Implementation Steps:**

1. **Create parameter-study.ts** (~150 lines)
   ```typescript
   interface ParameterStudyConfig {
     baseConfig: SIMPConfig;
     variations: {
       volfrac?: number[];     // e.g., [0.3, 0.4, 0.5, 0.6]
       rmin?: number[];        // e.g., [1.2, 1.5, 2.0]
       penal?: number[];       // e.g., [2, 3, 4]
     };
   }

   interface StudyResult {
     config: SIMPConfig;
     compliance: number;
     iterations: number;
     converged: boolean;
     thumbnail: string;
   }

   async function runParameterStudy(
     config: ParameterStudyConfig,
     forces: Float64Array,
     fixedDofs: number[],
     onProgress: (completed: number, total: number) => void
   ): Promise<StudyResult[]>
   ```

2. **Create ParameterStudy component** (~300 lines)
   - "Run Parameter Study" button
   - Configuration panel:
     - Checkboxes for which parameters to vary
     - Number of steps for each parameter
   - Progress indicator during runs
   - Results table:
     - Thumbnail | Vol.Frac | Filter | Penal | Compliance | Iterations
     - Sortable columns
     - Highlight best/worst in each column
   - "Apply to Main" button to use selected parameters

3. **Integrate into TopologyVisualizer** (~20 lines)
   - Add "Parameter Study" button in controls
   - Modal or expanded panel for study interface

### Test Plan

```typescript
// src/lib/__tests__/parameter-study.test.ts

describe('Parameter Study', () => {
  describe('generateStudyConfigs', () => {
    it('should generate all combinations');
    it('should handle single parameter variation');
    it('should handle multiple parameter variations');
    it('should respect base config for non-varied params');
  });

  describe('runParameterStudy', () => {
    it('should run all configurations');
    it('should report progress correctly');
    it('should capture results for each config');
    it('should handle optimization failures gracefully');
  });

  describe('ParameterStudy component', () => {
    it('should render configuration options');
    it('should show progress during study');
    it('should display results table');
    it('should sort by any column');
    it('should highlight best/worst values');
    it('should allow applying selected config');
  });
});
```

**Test count estimate:** 15-20 tests

---

## Feature 5: Export with Manufacturing Metadata

### Description
When exporting designs (SVG/PNG), include metadata about the design parameters, material savings, and manufacturing notes. Makes exports self-documenting.

### Why It's Valuable
- Answers "what parameters did I use for this design?"
- Useful for design review and documentation
- Very low risk - extends existing export
- Professional quality output

### Technical Approach

```
Files to modify:
├── src/lib/export/svg-export.ts        (~50 lines added)
├── src/lib/export/image-export.ts      (~80 lines added)
├── src/components/visualization/ExportButton.tsx (~100 lines added)

Files to create:
├── src/lib/export/metadata.ts          (~100 lines)
└── src/lib/__tests__/export-metadata.test.ts (~80 lines)
```

**Metadata Structure:**

```typescript
interface DesignMetadata {
  // Design parameters
  preset: string;
  resolution: string;
  volumeFraction: number;
  filterRadius: number;
  penalization: number;

  // Results
  finalCompliance: number;
  iterations: number;

  // Material analysis (optional)
  material?: string;
  estimatedWeight?: string;
  estimatedCost?: string;
  materialSavings?: string;

  // User notes
  notes?: string;

  // Generation info
  generatedAt: string;
  toolVersion: string;
}
```

**Implementation Steps:**

1. **Create metadata.ts** (~100 lines)
   ```typescript
   function generateMetadata(state, config, material?): DesignMetadata
   function formatMetadataForSVG(metadata): string  // XML comments
   function formatMetadataForPNG(metadata): Map<string, string>  // tEXt chunks
   ```

2. **Modify svg-export.ts** (~50 lines)
   - Add metadata as XML comments at top of SVG
   - Include in `<desc>` element for accessibility

3. **Modify image-export.ts** (~80 lines)
   - Embed metadata in PNG tEXt chunks
   - Use standard keys: Title, Author, Description, Comment

4. **Update ExportButton** (~100 lines)
   - Add "Include Metadata" checkbox (default: on)
   - Add "Add Notes" text field (optional)
   - Pass metadata to export functions

### Test Plan

```typescript
// src/lib/__tests__/export-metadata.test.ts

describe('Export Metadata', () => {
  describe('generateMetadata', () => {
    it('should include all design parameters');
    it('should include results (compliance, iterations)');
    it('should include material info when provided');
    it('should format timestamp correctly');
    it('should include tool version');
  });

  describe('formatMetadataForSVG', () => {
    it('should generate valid XML comments');
    it('should escape special characters');
    it('should include all metadata fields');
  });

  describe('formatMetadataForPNG', () => {
    it('should create valid tEXt chunk map');
    it('should use standard PNG metadata keys');
    it('should handle missing optional fields');
  });

  describe('SVG export with metadata', () => {
    it('should include metadata comments in output');
    it('should include desc element');
    it('should not break SVG rendering');
  });

  describe('PNG export with metadata', () => {
    it('should embed metadata in tEXt chunks');
    it('should be readable by image tools');
  });
});
```

**Test count estimate:** 15-18 tests

---

## Implementation Schedule Recommendation

If you want to implement these, here's a suggested order:

### Week 1: Quick Wins
1. **Feature 5: Export Metadata** (2-3 days) - Lowest risk, immediate value
2. **Feature 1: Quick Stress Analysis** (2-3 days) - Reuses existing code

### Week 2: UX Improvements
3. **Feature 2: Design History** (3-5 days) - Great UX, no algorithm changes
4. **Feature 4: Parameter Study** (3-5 days) - Educational value

### Week 3: Advanced
5. **Feature 3: Manufacturing Constraints** (5-7 days) - Highest complexity but high value

---

## Research Sources

- [Multi-material topology optimization - Springer 2025](https://link.springer.com/article/10.1007/s10483-026-3339-6)
- [Topology Optimization for Additive Manufacturing - ASME 2024](https://asmedigitalcollection.asme.org/mechanicaldesign/article/148/1/014501/1218561)
- [Overhang constraints for AM - Springer 2025](https://link.springer.com/article/10.1007/s00158-025-04124-6)
- [TO-NODE: ML Acceleration - Wiley 2024](https://onlinelibrary.wiley.com/doi/full/10.1002/nme.7428)
- [PAVED: Pareto Visualization - CGF 2023](https://onlinelibrary.wiley.com/doi/full/10.1111/cgf.13990)
- Altair Topology Optimization, Fusion 360 Generative Design (commercial tools analysis)

---

*Generated by Claude Code - Ready for review*

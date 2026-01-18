# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2026-01-17

### Added - High-Resolution Support & Performance Overhaul
- **Optimized solver** - Precomputed CSR sparsity pattern and reusable scratch arrays for 2-4x faster high-resolution optimization
- **Higher resolution presets** - Standard (120x40), High (180x60), Ultra (240x80) - up to 4x more elements
- **SharedArrayBuffer support** - COOP/COEP headers for zero-copy data transfer between worker and UI
- **Colormap selector** - Thermal (default) and Viridis colormaps for stress visualization
- **Example Gallery** - Real-world application examples with recommended settings

### Added - New Tests
- 65 new tests (333 -> 398 total)
- Optimized solver assembly tests
- SharedArrayBuffer + fallback tests  
- Colormap functionality tests

### Technical
- New `src/lib/optimizer/optimized-solver.ts` with precomputed mesh connectivity
- New `src/lib/optimizer/shared-buffer.ts` for SharedArrayBuffer utilities
- New `src/lib/colormaps.ts` with Thermal and Viridis colormaps
- New `ColorPaletteSelector` component for stress view
- New `ExampleGallery` component with industry applications
- COOP/COEP headers in `next.config.ts` for cross-origin isolation

---

## [2.1.0] - 2026-01-17

### Added - Material Savings Calculator
- **Real-time savings display** - Shows percentage of material saved during optimization
- **Weight reduction ratio** - Displays how many times lighter the optimized structure is
- **Multi-material database** - 10 engineering materials (aluminum, steel, titanium, composites, polymers)
- **Custom dimensions input** - Calculate actual weight/cost savings for your part size
- **Cost estimation** - Approximate material cost savings based on market prices
- **Quick comparison view** - Side-by-side aluminum, steel, and titanium savings

### Added - New Tests
- 46 new tests for material savings functionality (287 -> 333 total)
- Material database validation tests
- Savings calculation tests
- Formatting utility tests
- Integration scenario tests (aerospace parts, 3D printing)

### Technical
- New `src/lib/material-savings.ts` module with calculation logic
- New `MaterialSavingsCalculator.tsx` UI component
- Material database with density and cost data for 10 materials

---

## [2.0.0] - 2026-01-17

### Added - Visual Engine Overhaul
- **Smooth bilinear texture filtering** - WebGL LINEAR filtering for smooth density gradients
- **Gamma correction** - Perceptually uniform brightness using standard 2.2 gamma
- **Contrast enhancement** - Smoothstep-based enhancement for clearer solid/void boundaries
- **Improved stress colormap** - Smoothstep color interpolation with Tailwind colors
- **Canvas2D parity** - Fallback renderer now matches WebGL visual quality

### Added - High-Resolution Export System
- **PNG export** - 4x, 8x, 16x resolution with bicubic upsampling
- **SVG vector export** - Marching Squares contour extraction for infinite scalability
- **Catmull-Rom spline smoothing** - Publication-quality curve smoothing for SVG
- **Export UI** - Integrated dropdown in visualization header
- **Upsampling library** - Bilinear, bicubic, and nearest-neighbor interpolation

### Added - New Tests
- 54 new tests (233 -> 287 total)
- Rendering enhancement test suite (18 tests)
- Export functionality test suite (36 tests)

### Technical
- New `src/lib/export/` module with upsampling, image export, and SVG export
- Enhanced shaders with `precision highp float` for better quality
- Configurable `RenderingOptions` for WebGL renderer
- All 287 tests passing

---

## [1.0.0] - 2026-01-17

### Added
- Interactive topology optimization visualizer with real-time SIMP algorithm
- WebAssembly solver (2.3x faster than JavaScript fallback)
- WebGL rendering with Canvas2D fallback
- Side-by-side comparison mode
- Live convergence graphs (Compliance, Density Change, Volume)
- Interactive SIMP Material Model explainer with penalization slider
- Multiple pre-configured problems (MBB Beam, Cantilever, Bridge)
- Resolution options (60x20, 120x40)
- Material/Stress view toggle
- Theme toggle (light/dark mode)
- Educational content and user guidance
- PHNX Foundry branding
- MIT License

### Technical
- Built with Next.js 16, React 19, TypeScript
- Rust-based WASM optimizer with JavaScript fallback
- 233 comprehensive tests (all passing)
- Zero dependencies with known vulnerabilities
- Security headers (CSP, X-Frame-Options, etc.)
- Mobile responsive design
- Deployed on Vercel

### Security
- No API keys or sensitive data in repository
- Client-side only - zero server dependencies
- No data collection or tracking
- Clean security audit

## [1.0.0-rc1] - 2026-01-17

### Added
- Release candidate with PHNX Foundry branding
- Security hardening
- Deployment preparation

---

**PHNX Foundry** | Follow [@Xaraphim](https://x.com/Xaraphim) on X

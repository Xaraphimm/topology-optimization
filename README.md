# Topology Optimization Visualizer

[![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)](https://github.com/Xaraphimm/topology-optimization)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-398%20passing-brightgreen.svg)](./src/lib/__tests__)
[![Live Demo](https://img.shields.io/badge/demo-live-success.svg)](https://topology-optimization-yump.vercel.app)

Interactive web-based topology optimization using SIMP (Solid Isotropic Material with Penalization). Watch material distribute itself in real-time to create optimal structures.

**PHNX Foundry** | Follow [@Xaraphim](https://x.com/Xaraphim) on X for aerospace engineering deep-dives

---

## Status

**Version:** 2.2.0 (High-Resolution + Colormaps)  
**Status:** Production Ready  
**Live Demo:** https://topology-optimization-yump.vercel.app

---

## Features

### Core Optimization
- **Real-time optimization** - SIMP algorithm running in WebAssembly with JavaScript fallback
- **Hardware-accelerated rendering** - WebGL visualization with Canvas2D fallback
- **Side-by-side comparison** - Compare different configurations simultaneously
- **Multiple load cases** - Cantilever, MBB beam, L-bracket, and more
- **Live convergence tracking** - Watch compliance, volume, and density change in real-time
- **Interactive SIMP explainer** - Material model visualization with penalization slider
- **100% client-side** - No servers, no data collection, complete privacy

### Visual Quality (New in v2.0)
- **Smooth bilinear rendering** - GPU-accelerated texture filtering eliminates pixelation
- **Gamma-corrected output** - Perceptually uniform brightness for professional appearance
- **Enhanced contrast** - Clearer solid/void boundaries using smoothstep enhancement
- **Improved stress colormap** - Smoothstep interpolation for natural color transitions

### High-Resolution Export (New in v2.0)
- **PNG Export** - Up to 16x upsampling with bicubic interpolation
- **SVG Vector Export** - Infinitely scalable using Marching Squares contour extraction
- **Spline Smoothing** - Catmull-Rom curves for publication-quality vector output
- **One-click download** - Export button integrated into visualization header

### Material Savings Calculator (New in v2.1)
- **Real-time savings display** - Shows percentage of material saved during optimization
- **Weight reduction ratio** - See how many times lighter the optimized structure is
- **Multi-material support** - 10 engineering materials (aluminum, steel, titanium, composites, polymers)
- **Custom dimensions** - Input your part size to calculate actual weight and cost savings
- **Cost estimation** - Approximate material cost savings based on market prices

### High-Resolution Support (New in v2.2)
- **Resolution presets** - Standard (120x40), High (180x60), Ultra (240x80) mesh options
- **Optimized solver** - Precomputed CSR sparsity pattern, reusable CG scratch arrays for faster iteration
- **SharedArrayBuffer support** - Zero-copy data transfer with COOP/COEP headers for cross-origin isolation
- **Colormap system** - Thermal (default) and Viridis palettes for stress visualization
- **Color palette selector** - Switch between colormaps in real-time
- **Example gallery** - 4 real-world aerospace examples with interactive descriptions

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the visualizer.

## How It Works

The SIMP (Solid Isotropic Material with Penalization) method iteratively redistributes material to minimize structural compliance while respecting a volume constraint. Material density at each element is penalized to push toward discrete 0/1 values, creating clear void/solid regions.

Key steps:
1. Finite element analysis computes structural response
2. Sensitivity analysis determines where material helps most
3. Density filter prevents checkerboarding
4. Material is redistributed based on sensitivities
5. Repeat until convergence

## Technical Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Next.js 16, React 19, TypeScript |
| **Optimization** | Custom SIMP in Rust (WASM) + TypeScript fallback |
| **Rendering** | WebGL with gamma-corrected shaders, Canvas2D fallback |
| **Export** | Bicubic upsampling, Marching Squares, Catmull-Rom splines |
| **UI** | Tailwind CSS, Radix UI components |
| **Charts** | Recharts for convergence visualization |
| **Testing** | Vitest, 398 tests |

## Project Structure

```
topology-optimization/
├── src/
│   ├── app/                    # Next.js App Router
│   ├── components/
│   │   ├── visualization/      # Canvas, controls, graphs, export UI
│   │   ├── content/            # Educational explainers
│   │   └── ui/                 # Shadcn/UI components
│   └── lib/
│       ├── optimizer/          # SIMP solver + Web Worker
│       │   ├── simp.ts         # Core algorithm
│       │   ├── optimized-solver.ts  # CSR-optimized FEM solver
│       │   ├── shared-buffer.ts     # SharedArrayBuffer utilities
│       │   ├── simp.worker.ts  # Web Worker for off-thread computation
│       │   └── wasm-pkg/       # Compiled WASM module
│       ├── webgl/              # WebGL rendering engine
│       │   └── shaders.ts      # Gamma-corrected shaders
│       ├── colormaps.ts        # Thermal/Viridis colormap system
│       ├── export/             # High-res export module
│       └── material-savings.ts # Material savings calculator
│           ├── upsampling.ts   # Bilinear/bicubic interpolation
│           ├── image-export.ts # PNG/JPEG export
│           └── svg-export.ts   # Marching Squares + SVG generation
├── wasm-solver/                # Rust source for WASM solver
└── DEPLOYMENT_NOTES.md         # Deployment instructions
```

## Building for Production

```bash
npm run build
npm start
```

The build process:
1. Uses pre-built WASM from `src/lib/optimizer/wasm-pkg`
2. Bundles the Next.js application
3. Produces a production build for Vercel

### Requirements for Building

- Node.js 20.x
- Rust (latest stable) for WASM development
- wasm-pack (`cargo install wasm-pack`) if rebuilding WASM
- wasm32 target (`rustup target add wasm32-unknown-unknown`) for WASM compilation

## Testing

```bash
npm test              # Run all 398 tests
npm run test:watch    # Watch mode for development
npm run test:coverage # Generate coverage report
```

Test coverage includes:
- Core SIMP algorithm (21 tests)
- FEM solver (16 tests)
- WebGL rendering & shaders (33 tests)
- Visual rendering enhancements (18 tests)
- Export functionality (36 tests)
- Material savings calculator (46 tests)
- Resolution switching (54 tests)
- And more...

## Deployment

**Production:** https://topology-optimization-yump.vercel.app

This project is deployed on **Vercel** with automatic deployments on every push to `main`.

See [DEPLOYMENT_NOTES.md](./DEPLOYMENT_NOTES.md) for detailed deployment instructions.

## Performance

The WASM solver provides significant performance improvements over the JavaScript fallback:

```
=== Performance Benchmark (60x20 mesh, 2562 DOFs) ===
JS Solver:   ~24ms, 240 iterations
WASM Solver: ~11ms, 240 iterations
Speedup:     2.3x
```

The application automatically falls back to JavaScript if WASM fails to load.

## Privacy

The algorithm runs **entirely in your browser** using JavaScript and WebAssembly:

- ✅ No data sent to any server
- ✅ No analytics or tracking
- ✅ No cookies (except theme preference in localStorage)
- ✅ Complete computational privacy

## Security

This release has been security audited:

- ✅ No exposed API keys or secrets
- ✅ No known dependency vulnerabilities
- ✅ Content Security Policy headers configured
- ✅ XSS-safe implementation
- ✅ Secure external links (`rel="noopener noreferrer"`)

## Version History

| Version | Date | Status | Notes |
|---------|------|--------|-------|
| 2.2.0 | Jan 17, 2026 | **Production** | High-resolution support + colormap system |
| 2.1.0 | Jan 17, 2026 | Stable | Material savings calculator |
| 2.0.0 | Jan 17, 2026 | Stable | Major visual upgrade + high-res export |
| 1.0.0 | Jan 17, 2026 | Stable | Official release with full features |
| 1.0.0-rc1 | Jan 17, 2026 | Deprecated | Pre-release testing |

### What's New in v2.2.0

**High-Resolution Mesh Support:**
- New resolution presets: Standard (120x40), High (180x60), Ultra (240x80)
- Optimized FEM solver with precomputed CSR sparsity pattern
- Reusable conjugate gradient scratch arrays for reduced memory allocation
- SharedArrayBuffer support for zero-copy worker data transfer
- COOP/COEP headers configured for cross-origin isolation

**Colormap System:**
- Thermal colormap (default): Blue-Cyan-Green-Yellow-Red gradient
- Viridis colormap: Perceptually uniform, colorblind-friendly
- Real-time palette switching via UI selector
- Applied to stress visualization mode

**Example Gallery:**
- 4 interactive real-world aerospace examples
- Wing rib, engine mount, satellite bracket, landing gear fitting
- Educational descriptions with engineering context

**Testing:**
- 65 new tests (333 -> 398 total)
- Optimized solver tests (16)
- SharedArrayBuffer tests (10)
- Colormap system tests (30)
- Integration tests (9)

### What's New in v2.1.0

**Material Savings Calculator:**
- Real-time material savings percentage display
- Weight reduction ratio (e.g., "2.5x lighter")
- Database of 10 engineering materials with density and cost data
- Custom dimension input for calculating actual part savings
- Quick comparison view for aluminum, steel, and titanium
- Cost estimation based on market prices

**Testing:**
- 46 new tests (287 -> 333 total)
- Material database validation
- Savings calculation accuracy
- Formatting utility tests

### What's New in v2.0.0

**Visual Engine Overhaul:**
- Smooth bilinear texture filtering (WebGL)
- Gamma correction (2.2) for perceptually uniform output
- Contrast enhancement via smoothstep function
- Improved stress colormap with Tailwind colors
- Canvas2D fallback matches WebGL quality

**Export System:**
- PNG export with 4x/8x/16x bicubic upsampling
- SVG vector export using Marching Squares algorithm
- Catmull-Rom spline smoothing for curves
- Integrated export button in UI

**Testing:**
- 54 new tests (233 -> 287 total)
- Rendering enhancement tests
- Export functionality tests

## License

MIT License - see [LICENSE](./LICENSE) for details

Copyright (c) 2025 PHNX Foundry | Xaraphim

---

**PHNX Foundry** | Engineering education through interactive visualization  
Follow [@Xaraphim](https://x.com/Xaraphim) on X

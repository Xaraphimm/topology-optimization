# Topology Optimization Visualizer

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Xaraphimm/topology-optimization)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-233%20passing-brightgreen.svg)](./src/lib/__tests__)
[![Live Demo](https://img.shields.io/badge/demo-live-success.svg)](https://topology-optimization-yump.vercel.app)

Interactive web-based topology optimization using SIMP (Solid Isotropic Material with Penalization). Watch material distribute itself in real-time to create optimal structures.

**PHNX Foundry** | Follow [@Xaraphim](https://x.com/Xaraphim) on X for aerospace engineering deep-dives

---

## Status

**Version:** 1.0.0 (Official Release)  
**Status:** Production Ready  
**Live Demo:** https://topology-optimization-yump.vercel.app

---

## Features

- **Real-time optimization** - SIMP algorithm running in WebAssembly with JavaScript fallback
- **Hardware-accelerated rendering** - WebGL visualization with Canvas2D fallback
- **Side-by-side comparison** - Compare different configurations simultaneously
- **Multiple load cases** - Cantilever, MBB beam, L-bracket, and more
- **Live convergence tracking** - Watch compliance, volume, and density change in real-time
- **Interactive SIMP explainer** - Material model visualization with penalization slider
- **100% client-side** - No servers, no data collection, complete privacy

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
| **Rendering** | WebGL with custom shaders, Canvas2D fallback |
| **UI** | Tailwind CSS, Radix UI components |
| **Charts** | Recharts for convergence visualization |
| **Testing** | Vitest, 233 tests |

## Project Structure

```
topology-optimization/
├── src/
│   ├── app/                    # Next.js App Router
│   ├── components/
│   │   ├── visualization/      # Canvas, controls, graphs
│   │   ├── content/            # Educational explainers
│   │   └── ui/                 # Shadcn/UI components
│   └── lib/
│       ├── optimizer/          # SIMP solver + Web Worker
│       │   ├── simp.ts         # Core algorithm
│       │   ├── simp.worker.ts  # Web Worker for off-thread computation
│       │   └── wasm-pkg/       # Compiled WASM module
│       └── webgl/              # WebGL rendering engine
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
npm test              # Run all 233 tests
npm run test:watch    # Watch mode for development
npm run test:coverage # Generate coverage report
```

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
| 1.0.0 | Jan 17, 2026 | **Production** | Official release with full features |
| 1.0.0-rc1 | Jan 17, 2026 | Release Candidate | Pre-release testing |

## License

MIT License - see [LICENSE](./LICENSE) for details

Copyright (c) 2025 PHNX Foundry | Xaraphim

---

**PHNX Foundry** | Engineering education through interactive visualization  
Follow [@Xaraphim](https://x.com/Xaraphim) on X

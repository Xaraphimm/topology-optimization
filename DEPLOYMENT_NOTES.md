# Deployment Notes - Topology Optimization Visualizer

**Version:** 1.0.0 (Official Release)  
**Date:** January 17, 2026  
**Author:** Xaraphim | PHNX Foundry

---

## Current Status

This release has been:
- ✅ Security audited (no vulnerabilities, no exposed secrets)
- ✅ All 233 tests passing
- ✅ Production build verified
- ✅ PHNX Foundry branding applied
- ✅ Vercel deployment active

**The site is live and production-ready.**

---

## Current Deployment

**Platform:** Vercel  
**Live URL:** https://topology-optimization-yump.vercel.app  
**Version:** 1.0.0  
**Status:** Production  
**Deployment Date:** January 17, 2026

Vercel automatically deploys on every push to the `main` branch.

---

## Vercel Deployment Setup

### Build Configuration

Vercel uses the following configuration automatically:

- **Framework:** Next.js
- **Build Command:** `npm run build`
- **Install Command:** `npm install`
- **Output:** `.next` (handled by Vercel)

### WASM Build Strategy

WASM is pre-built and committed to the repository:

```
src/lib/optimizer/wasm-pkg/
```

This avoids needing Rust on the Vercel build machine and ensures fast, reliable deployments.

To rebuild WASM locally:

```bash
npm run build:wasm
```

---

## GitHub Pages Status

GitHub Pages deployment has been **disabled**. The project is now fully hosted on Vercel.

If needed, GitHub Pages can be re-enabled by restoring static export mode and re-running the workflow.

---

## Build Requirements (Local)

- **Node.js:** 20.x
- **npm:** 10.x
- **Rust:** Latest stable (for WASM development only)
- **wasm-pack:** `cargo install wasm-pack`
- **wasm32 target:** `rustup target add wasm32-unknown-unknown`

---

## Testing

```bash
npm test              # Run all 233 tests
npm run test:watch    # Watch mode
npm run test:coverage # Generate coverage report
```

---

## Security & Privacy

- **No external API calls** - Everything runs client-side
- **No analytics or tracking** - Zero telemetry
- **No data transmission** - All computation in browser
- **WASM sandboxed** - Runs in WebAssembly sandbox
- **No user data stored** - Only theme preference in localStorage

---

## Repository Structure

```
topology-optimization/
├── src/
│   ├── app/                 # Next.js App Router
│   ├── components/
│   │   ├── visualization/   # Canvas, graphs, controls
│   │   ├── content/         # Educational explainers
│   │   └── ui/              # Shadcn/UI components
│   └── lib/
│       ├── optimizer/       # SIMP solver + Web Worker
│       │   ├── simp.ts      # Main algorithm
│       │   ├── simp.worker.ts # Web Worker
│       │   ├── wasm-pkg/    # Compiled WASM
│       │   └── ...
│       └── webgl/           # WebGL renderer
├── wasm-solver/             # Rust WASM source
├── LICENSE                  # MIT License
├── README.md                # Project documentation
├── DEPLOYMENT_NOTES.md      # This file
├── CHANGELOG.md             # Version history
├── BUG_INVESTIGATION.md     # Bug analysis documentation
├── FIX_SUMMARY.md           # Bug fix documentation
└── CRITICAL_BUGS.md         # Critical bugs documentation
```

---

## Contact

**PHNX Foundry**  
Follow [@Xaraphim](https://x.com/Xaraphim) on X

---

*This document reflects the official v1.0.0 production release.*

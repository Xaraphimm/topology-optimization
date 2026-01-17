# Deployment Notes - Topology Optimization Visualizer

**Version:** 1.0.0-rc1 (Release Candidate 1)  
**Date:** January 17, 2025  
**Author:** Xaraphim | PHNX Foundry

---

## Current Status

This release candidate has been:
- ✅ Security audited (no vulnerabilities, no exposed secrets)
- ✅ All 233 tests passing
- ✅ Production build verified
- ✅ PHNX Foundry branding applied
- ✅ Static export configured

**The site is NOT currently deployed.** This is a release candidate ready for GitHub Pages deployment when the author chooses.

---

## Planned Deployment: GitHub Pages

### Architecture

The application is configured for **static export** (`output: 'export'` in next.config.ts). This generates a fully static site in the `/out` directory that can be served from any static hosting provider.

### GitHub Pages Setup (When Ready)

1. **Repository Settings:**
   - Go to repository Settings → Pages
   - Source: Deploy from a branch OR GitHub Actions
   - Branch: `main` (or `gh-pages` if using Actions)

2. **Option A: Deploy from Branch**
   - Build locally: `npm run build`
   - The `/out` directory contains the static site
   - Either commit `/out` to a `gh-pages` branch, or configure Pages to serve from `/out` on main

3. **Option B: GitHub Actions (Recommended)**
   - Create `.github/workflows/deploy.yml` (template below)
   - Automatic deployment on every push to main

### GitHub Actions Workflow Template

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown
      
      - name: Install wasm-pack
        run: cargo install wasm-pack
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./out

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

## Important Notes for Next Agent

### Security Headers Limitation

The `next.config.ts` includes comprehensive security headers (CSP, X-Frame-Options, etc.), but these **will NOT be applied** when using GitHub Pages with static export. This is a Next.js limitation.

**Workarounds:**
1. **Deploy to Vercel or Netlify instead** - Headers will work automatically
2. **Use Cloudflare Pages** - Can configure headers via `_headers` file
3. **Accept limitation for GitHub Pages** - The site is still secure, just without additional hardening headers

### Build Requirements

The WASM solver requires Rust and wasm-pack to be installed:
- Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- wasm-pack: `cargo install wasm-pack`
- wasm32 target: `rustup target add wasm32-unknown-unknown`

The build script (`npm run build`) automatically runs `npm run build:wasm` first.

### Known Linter Warnings

The ESLint output shows warnings about `setState` in `useEffect`. These are **intentional and documented** in `FIX_SUMMARY.md`. They are:
- WebGL initialization check (runs once)
- State resets on config change (expected behavior)

These do NOT indicate bugs and should not be "fixed."

### Repository Structure

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
├── out/                     # Static export (after build)
├── LICENSE                  # MIT License
├── README.md                # Project documentation
├── DEPLOYMENT_NOTES.md      # This file
├── BUG_INVESTIGATION.md     # Bug analysis documentation
├── FIX_SUMMARY.md           # Bug fix documentation
└── CRITICAL_BUGS.md         # Critical bugs documentation
```

### Environment

- **Node.js:** 20.x recommended
- **npm:** 10.x
- **Rust:** Latest stable
- **Next.js:** 16.1.3
- **React:** 19.2.3

### Testing

```bash
npm test              # Run all 233 tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Local Development

```bash
npm install
npm run dev           # Starts on http://localhost:3000
```

---

## Privacy & Security

- **No external API calls** - Everything runs client-side
- **No analytics or tracking** - Zero telemetry
- **No data transmission** - All computation in browser
- **WASM sandboxed** - Runs in WebAssembly sandbox
- **No user data stored** - Only theme preference in localStorage

---

## Contact

**PHNX Foundry**  
Follow [@Xaraphim](https://x.com/Xaraphim) on X

---

*This document was prepared as part of the v1.0.0-rc1 release candidate.*

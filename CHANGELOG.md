# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

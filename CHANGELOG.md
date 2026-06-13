# Changelog

All notable changes to padm0nk are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Full rewrite of the runtime from a flat, framework-free, no-build extension into
a bundled, modular, type-safe codebase. No behavioral regressions intended — the
gamepad layout, default bindings, mapping math, and storage protocol are
preserved (with the diagonal-speed fix below as the one intentional divergence).

### Added

- 64 Vitest unit tests covering the pure `src/core/` modules (config, combos,
  labels, registry, mapper, gamepad state/api, storage).
- GitHub Actions CI: format-check → typecheck → test → build, uploading the
  built `dist/` as an artifact.
- File import/export of profiles (download/upload `.json`) in the options page,
  alongside the existing copy/paste textarea.
- Remap conflict warning: binding an input already assigned elsewhere surfaces a
  non-blocking notice instead of silently reassigning.
- Configurable toggle and show-binds combos (defaults `F8` / `F9`) replacing the
  former hardcoded keys.
- Shadow-DOM HUD and binds overlay so injected UI styles are isolated from the
  host page (and dodge page CSP for inline styles).
- Self-hosted, bundled UI font path (`fontUrl` wired bridge → MAIN world) with a
  graceful fallback stack.

### Changed

- Full migration to TypeScript (strict) + Vite with `@crxjs/vite-plugin`, Svelte 5
  for all UI, and Tailwind v4 with a shared theme palette (no inline hex).
- Modular architecture: pure `src/core/`, isolated/MAIN-world `src/content/`,
  Svelte `src/ui/` (popup, options, HUD, overlay).
- Registry-driven configuration: a single control registry
  (`src/core/controller-actions.ts`) is the source of truth for default
  bindings, the options page sections, the binds overlay, and the README table.
- Install from source now requires a build step; load the `dist/` build output
  as an unpacked extension rather than the repo root.
- Packaging moved from `scripts/pack.sh` to `npm run zip` (builds, then zips the
  `dist/` output to `padm0nk-<version>.zip`).

### Fixed

- Diagonal left-stick overspeed: per-axis clamping let diagonals reach magnitude
  ~1.41 (~41% faster than cardinal movement). Replaced with a radial clamp so the
  stick vector magnitude is capped at 1.
- `prettyInput` drift: the MAIN-world side lacked `Mouse3`/`Mouse4` labels that
  the options page had; unified into a single `labels.ts`.
- Removed the dead/unreachable toggle-capture branch (`commitCapture`); toggle and
  show-binds are captured only as combos.
- Stopped hotlinking the Xbox CDN font; the UI font is now bundled/self-hosted and
  delivered through the bridge.
- Reduced per-frame allocation in the gamepad snapshot path by reusing cached
  buffers instead of allocating a new `Gamepad`, button wrappers, and axes array on
  every `getGamepads()` call.

## [1.0.0]

- Initial release: virtual Xbox controller for Xbox Cloud Gaming via the Gamepad
  API, WASD → left stick, mouse → right stick aim, remapping, sensitivity /
  smoothing / aim-curve tuning, and local-only settings.

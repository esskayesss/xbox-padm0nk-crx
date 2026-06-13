# Bundled fonts

## bahnschrift.woff (required — drop the binary here)

Legacy padm0nk hotlinked **Bahnschrift** from the xbox CDN
(`assets.play.xbox.com/.../Bahnschrift.woff`). That is **Bug 6** — we do NOT
hotlink anymore. Instead the font is bundled and exposed as a web-accessible
resource.

`manifest.config.ts` globs `assets/fonts/*.woff` into `web_accessible_resources`,
and `src/content/bridge.ts` resolves `assets/fonts/bahnschrift.woff` via
`chrome.runtime.getURL(...)` and ships it to the MAIN world as `payload.fontUrl`.

### What to do

Drop a self-hosted **Bahnschrift-equivalent** `.woff` here, named exactly:

```
assets/fonts/bahnschrift.woff
```

We intentionally do not commit the actual Microsoft Bahnschrift binary
(licensing). Use a metrically-compatible / visually-similar self-hosted font.

**Do NOT** re-introduce a CDN hotlink.

### Fallback stack (P5/P6 MUST use this)

`fontUrl` may be empty (file absent) or fail to load. The MAIN-world UI must
register the font via `@font-face` against `fontUrl` AND always specify this
fallback stack so text renders cleanly regardless:

```css
font-family: 'Bahnschrift', 'Segoe UI', system-ui, sans-serif;
```

The `.gitkeep` keeps this directory in the repo until the real `.woff` lands.

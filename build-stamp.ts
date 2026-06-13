// Build-time version stamp. Computed once when the build config is evaluated so
// every produced `dist/` carries a unique, human-readable marker — surfaced as
// the manifest `version_name` (visible on the chrome://extensions card). Lets
// you confirm at a glance that a reloaded extension is the build you just made,
// not a stale one.
import { execSync } from 'node:child_process';

function chromeVersionFromEnv(): string | null {
	const raw = process.env.PADM0NK_VERSION;
	if (!raw) return null;
	if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(raw)) {
		throw new Error('PADM0NK_VERSION must be a Chrome extension version like 1.2.3');
	}
	return raw;
}

/** Semantic version (also the manifest `version`). Release builds set PADM0NK_VERSION from git tag. */
export const VERSION = chromeVersionFromEnv() ?? '1.0.0';

function sh(cmd: string): string {
	try {
		return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return '';
	}
}

function buildStamp(): string {
	const hash = sh('git rev-parse --short HEAD') || 'nogit';
	const dirty = sh('git status --porcelain') ? '+dirty' : '';
	const d = new Date();
	const p = (n: number): string => String(n).padStart(2, '0');
	const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.${p(d.getHours())}${p(d.getMinutes())}`;
	return `${hash}${dirty}·${ts}`;
}

/** e.g. "a8759ee·20260612.0431" or "a8759ee+dirty·20260612.0431". */
export const BUILD_STAMP = buildStamp();

/** e.g. "1.0.0 (build a8759ee·20260612.0431)" — shown in chrome://extensions. */
export const VERSION_NAME = `${VERSION} (build ${BUILD_STAMP})`;
